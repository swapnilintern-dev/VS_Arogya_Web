// =============================================================================
// Stock grading. `product.stock` is the backend's auto-synced mirror of
// SUM(batch.available_quantity) — never edited directly.
// =============================================================================

import { DEFAULT_LOW_THRESHOLD } from '../constants/catalog';

export const STOCK_STATUS = { IN: 'inStock', LOW: 'low', OUT: 'out' };

export const STOCK_META = {
  [STOCK_STATUS.IN]: { label: 'In stock', tone: 'success' },
  [STOCK_STATUS.LOW]: { label: 'Low stock', tone: 'warning' },
  [STOCK_STATUS.OUT]: { label: 'Out of stock', tone: 'danger' },
};

export function stockStatusOf(stock, lowThreshold = DEFAULT_LOW_THRESHOLD) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return STOCK_STATUS.OUT;
  if (qty <= (Number(lowThreshold) || DEFAULT_LOW_THRESHOLD)) return STOCK_STATUS.LOW;
  return STOCK_STATUS.IN;
}

/**
 * Client-side FEFO preview — nearest expiry first, then oldest lot. Used ONLY
 * while the app runs on mock data: with the real backend, POST /allocate-preview
 * (or /outlet/allocate-preview) is the authority and this is never called.
 */
export function allocateFefo(batches, quantity) {
  const sellable = [...(batches || [])]
    .filter((b) => Number(b.available_quantity) > 0)
    .filter((b) => !b.expiry_date || new Date(b.expiry_date) >= new Date())
    .sort((a, b) => {
      const ax = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
      const bx = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      if (ax !== bx) return ax - bx;
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

  let remaining = Number(quantity) || 0;
  const allocations = [];
  for (const batch of sellable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.available_quantity));
    allocations.push({
      batch: batch._id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      quantity: take,
    });
    remaining -= take;
  }
  return { allocations, remaining, availableBatches: sellable };
}
