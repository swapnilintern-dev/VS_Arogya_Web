// =============================================================================
// Products + batches — routes/postRouter.js and routes/batchRoute.js.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, request, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { PRODUCTS, PRODUCT_BATCHES, batchesOfProduct } from '../mock/products';
import { allocateFefo } from '../utils/stock';

// A mutable working copy so create/update/delete are visible during a session.
let products = PRODUCTS.map((p) => ({ ...p, isExpiringSoon: p.isExpiringSoon }));
let batches = PRODUCT_BATCHES.map((b) => ({ ...b, isExpiringSoon: b.isExpiringSoon }));

const recomputeStock = (productId) => {
  const total = batches
    .filter((b) => b.product_id === productId)
    .reduce((s, b) => s + Number(b.available_quantity || 0), 0);
  const front = batches
    .filter((b) => b.product_id === productId && b.available_quantity > 0)
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];

  products = products.map((p) =>
    p._id === productId
      ? { ...p, stock: total, batch_no: front?.batch_number || p.batch_no, exp_date: front?.expiry_date || p.exp_date }
      : p,
  );
};

// --- Products ----------------------------------------------------------------

export async function listProducts() {
  if (USE_MOCK) { await delay(); return products.map((p) => ({ ...p })); }
  const body = await get(ENDPOINTS.products.all, { auth: false });
  return body?.products || body?.product || body?.data || [];
}

export async function getProduct(id) {
  if (USE_MOCK) { await delay(160); return products.find((p) => p._id === id) || null; }
  const all = await listProducts();
  return all.find((p) => p._id === id) || null;
}

/**
 * Create. On the server this is multipart — text fields plus `image` (up to N)
 * and one optional `video`.
 */
export async function createProduct(fields, media = {}) {
  if (USE_MOCK) {
    await delay(520);
    const created = {
      ...fields,
      _id: `p${Date.now()}`,
      stock: 0,
      image: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpiringSoon: false,
    };
    products = [created, ...products];
    return created;
  }
  return request(ENDPOINTS.products.add, { method: 'POST', body: buildProductForm(fields, media) });
}

export async function updateProduct(id, fields, media = {}) {
  if (USE_MOCK) {
    await delay(460);
    products = products.map((p) => (p._id === id ? { ...p, ...fields, updatedAt: new Date().toISOString() } : p));
    return products.find((p) => p._id === id);
  }
  return request(ENDPOINTS.products.update(id), { method: 'PUT', body: buildProductForm(fields, media) });
}

export async function deleteProduct(id) {
  if (USE_MOCK) {
    await delay(300);
    products = products.filter((p) => p._id !== id);
    batches = batches.filter((b) => b.product_id !== id);
    return { success: true };
  }
  return del(ENDPOINTS.products.remove(id));
}

function buildProductForm(fields, { images = [], video, keepImages, removeVideo } = {}) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, v);
  });
  images.forEach((file) => form.append('image', file));
  if (video) form.append('video', video);
  if (keepImages) form.append('keepImages', JSON.stringify(keepImages));
  if (removeVideo) form.append('removeVideo', 'true');
  return form;
}

// --- Wishlist (vendor) -------------------------------------------------------

let savedIds = new Set([PRODUCTS[1]._id, PRODUCTS[13]._id, PRODUCTS[20]._id]);

export async function listSavedProducts() {
  if (USE_MOCK) { await delay(180); return products.filter((p) => savedIds.has(p._id)); }
  const body = await get(ENDPOINTS.products.saved);
  return body?.savedProducts || body?.products || [];
}

export async function toggleSavedProduct(productId) {
  if (USE_MOCK) {
    await delay(140);
    savedIds = new Set(savedIds);
    if (savedIds.has(productId)) savedIds.delete(productId);
    else savedIds.add(productId);
    return { saved: savedIds.has(productId) };
  }
  const body = await post(ENDPOINTS.products.save(productId));
  return { saved: body?.saved ?? true };
}

export const isSaved = (productId) => savedIds.has(productId);

// --- Batches (FEFO) ----------------------------------------------------------

export async function listBatches(productId) {
  if (USE_MOCK) {
    await delay(220);
    return batches.filter((b) => b.product_id === productId).map((b) => ({ ...b }));
  }
  const body = await get(ENDPOINTS.batches.ofProduct(productId), { auth: false });
  return body?.batches || [];
}

/** Sellable lots only, nearest expiry first — the picker's source. */
export async function listAvailableBatches(productId) {
  if (USE_MOCK) {
    await delay(200);
    return batchesOfProduct(productId)
      .filter((b) => b.available_quantity > 0)
      .filter((b) => !b.expiry_date || new Date(b.expiry_date) >= new Date())
      .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
      .map((b) => ({ ...b }));
  }
  const body = await get(ENDPOINTS.batches.availableOfProduct(productId), { auth: false });
  return body?.batches || [];
}

/**
 * Non-mutating "can this quantity be issued, from these lots?". With the real
 * backend this is the ONLY authority on allocation — the client never computes
 * inventory. The mock branch mirrors the server's FEFO policy so the UI behaves
 * the same during development.
 */
export async function previewAllocation({ productId, quantity, pinnedBatchId }) {
  if (USE_MOCK) {
    await delay(180);
    const lots = batchesOfProduct(productId);
    if (pinnedBatchId) {
      const pinned = lots.find((b) => b._id === pinnedBatchId);
      if (pinned) {
        const take = Math.min(quantity, pinned.available_quantity);
        const rest = allocateFefo(lots.filter((b) => b._id !== pinnedBatchId), quantity - take);
        return {
          allocations: [
            { batch: pinned._id, batch_number: pinned.batch_number, expiry_date: pinned.expiry_date, quantity: take },
            ...rest.allocations,
          ],
          remaining: rest.remaining,
          availableBatches: rest.availableBatches,
        };
      }
    }
    return allocateFefo(lots, quantity);
  }
  return post(ENDPOINTS.batches.allocatePreview, {
    productId,
    quantity,
    allocations: pinnedBatchId ? [{ batch: pinnedBatchId, quantity }] : [],
  }, { auth: false });
}

export async function createBatch(productId, payload) {
  if (USE_MOCK) {
    await delay(360);
    const created = {
      _id: `b${Date.now()}`,
      product_id: productId,
      ...payload,
      available_quantity: payload.available_quantity ?? payload.purchase_quantity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    batches = [...batches, created];
    recomputeStock(productId);
    return created;
  }
  return post(ENDPOINTS.batches.create(productId), payload, { auth: false });
}

export async function updateBatch(batchId, payload) {
  if (USE_MOCK) {
    await delay(320);
    const target = batches.find((b) => b._id === batchId);
    batches = batches.map((b) => (b._id === batchId ? { ...b, ...payload, updatedAt: new Date().toISOString() } : b));
    if (target) recomputeStock(target.product_id);
    return batches.find((b) => b._id === batchId);
  }
  return put(ENDPOINTS.batches.update(batchId), payload, { auth: false });
}

export async function deleteBatch(batchId) {
  if (USE_MOCK) {
    await delay(280);
    const target = batches.find((b) => b._id === batchId);
    batches = batches.filter((b) => b._id !== batchId);
    if (target) recomputeStock(target.product_id);
    return { success: true };
  }
  return del(ENDPOINTS.batches.remove(batchId), { auth: false });
}

/** Every lot in the catalogue — powers the marketing batch overview page. */
export async function listAllBatches() {
  if (USE_MOCK) {
    await delay(260);
    return batches.map((b) => ({
      ...b,
      product: products.find((p) => p._id === b.product_id) || null,
    }));
  }
  const all = await listProducts();
  const perProduct = await Promise.all(all.map((p) => listBatches(p._id)));
  return perProduct.flat();
}
