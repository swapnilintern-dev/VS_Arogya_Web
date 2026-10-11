// =============================================================================
// Outlet role + the marketing→outlet stock assignment — routes/outletRoute.js.
//
// LOCKED RULE #3 (lib/outlet/outlet_repository.dart): there is no "mark paid"
// call here. Payment status is only ever READ from the server.
//
// Server contracts (controller/outletController.js, rolePaymentController.js):
//   GET  /outlets?pincode=           → { outlets }
//   POST /outlet-register            → { outlet }
//   GET  /outlet-profile/:id         → { outlet }
//   GET  /outlet-products/:id        → { products: [{ product, quantity, batch, batch_count }] }
//   GET  /outlet/product/:id/available-batches[?all=1]
//                                    → { batches } | { product, stock, total_stock, batch_count, batches }
//   POST /outlet/allocate-preview    → { allocations, remaining, availableBatches }  body { productId, quantity, overrides }
//   POST /outlet-stock               → { stock, allocations }  body { outletId, productId, quantity, allocations }
//   GET  /outlet-orders/:id          → { orders }
//   POST /outlet/bill                → { createOrder }  body { customer, items }
//   POST /outlet/register-vendor     → { success }      vendor-shaped body
//   POST /outlet/orders/:id/payment  → { paymentLink, qrImageData, expiresAt, status }
//   POST /outlet/orders/:id/razorpay → { razorpayOrderId, amount, currency, razorpayKeyId }
//   GET  /outlet/orders/:id/status   → { status, paid }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post } from './http';
import { normalizeOrder } from './orderService';

// --- Directory (marketing) ---------------------------------------------------

export async function listOutlets(pincode) {
  const body = await get(`${ENDPOINTS.outlet.list}${pincode ? `?pincode=${encodeURIComponent(pincode)}` : ''}`);
  return body?.outlets || [];
}

export async function registerOutlet(payload) {
  const body = await post(ENDPOINTS.outlet.register, payload, { auth: false });
  return body?.outlet || body;
}

export async function getOutletProfile(outletId) {
  const body = await get(ENDPOINTS.outlet.profile(outletId));
  return body?.outlet || null;
}

// --- Stock -------------------------------------------------------------------

/**
 * GET /outlet-products/:id — the stock marketing assigned to this outlet.
 *
 * Each row carries the FEFO front lot (`batch`) and the number of live lots
 * (`batch_count`), so the stock table and the billing picker never have to
 * fetch batches per row just to answer "what do I sell first?".
 */
export async function listOutletStock(outletId) {
  const body = await get(ENDPOINTS.outlet.products(outletId));
  return (body?.products || [])
    .filter((row) => row.product && typeof row.product === 'object')
    .map((row) => ({
      ...row,
      quantity: Number(row.quantity) || 0,
      frontLot: row.batch || null,
      liveLots: row.batch_count ?? 0,
    }));
}

/**
 * Every lot this outlet holds, product joined — the source for the counter's
 * "sell these first" watchlist. One call per product on the server, so it is
 * only used where the whole shelf genuinely matters.
 */
export async function listOutletLots(outletId) {
  const rows = await listOutletStock(outletId);
  const perProduct = await Promise.all(rows.map(async (row) => {
    const detail = await getOutletMedicineDetail(outletId, row.product._id);
    return detail.batches.map((b) => ({ ...b, product: row.product._id, productDoc: row.product }));
  }));
  return perProduct.flat();
}

/** Every lot the outlet holds for one product — expired and emptied included. */
export async function getOutletMedicineDetail(outletId, productId) {
  const body = await get(`${ENDPOINTS.outlet.availableBatches(productId)}?all=1`);
  const batches = body?.batches || [];
  return {
    product: body?.product || null,
    batches,
    totalStock: body?.total_stock ?? batches.reduce((s, b) => s + (Number(b.available_quantity) || 0), 0),
    stockMirror: body?.stock ?? 0,
    batchCount: body?.batch_count ?? batches.length,
    showsAllLots: true,
  };
}

/** Sellable lots only, FEFO order — the batch picker's source. */
export async function listOutletAvailableBatches(productId) {
  const body = await get(ENDPOINTS.outlet.availableBatches(productId));
  return body?.batches || [];
}

/** Non-mutating validation of a bill line against live outlet inventory. */
export async function previewOutletAllocation({ productId, quantity, pinnedBatchId }) {
  const body = await post(ENDPOINTS.outlet.allocatePreview, {
    productId,
    quantity,
    overrides: pinnedBatchId ? [{ batch: pinnedBatchId, quantity }] : [],
  });
  return {
    allocations: body?.allocations || [],
    remaining: body?.remaining ?? 0,
    availableBatches: body?.availableBatches || [],
  };
}

/**
 * Marketing pushes catalog stock into an outlet. ADDITIVE — the server adds to
 * what the outlet already holds and deducts the same units from the catalog.
 * One call per medicine.
 */
export async function assignStockToOutlet({ outletId, lines }) {
  const results = [];
  for (const line of lines) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await post(ENDPOINTS.outlet.assignStock, {
      outletId,
      productId: line.product._id,
      quantity: line.quantity,
      allocations: line.batch
        ? [{ batch: line.batch._id, batch_number: line.batch.batch_number, quantity: line.quantity }]
        : [],
    }));
  }
  return { success: true, assigned: results.length };
}

// --- Orders ------------------------------------------------------------------

export async function listOutletOrders(outletId) {
  const body = await get(ENDPOINTS.outlet.orders(outletId));
  return (body?.orders || []).map(normalizeOrder);
}

/**
 * POST /outlet/bill — the POS bill. Deducts outlet stock, renders the invoice.
 * The walk-in customer is captured vendor-shaped on the page (it is also filed
 * for approval); the bill route reads the short names below.
 */
export async function placeOutletBill({ customer, lines }) {
  const body = await post(ENDPOINTS.outlet.bill, {
    customer: {
      name: customer.contact_person_name || customer.store_name,
      firm: customer.store_name,
      phone: customer.mobile_no,
      address: customer.full_address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pin_code,
      gstin: customer.gst_no,
    },
    items: lines.map((l) => ({
      productId: l.product._id,
      quantity: l.quantity,
      freeQty: l.freeQty || 0,
      allocations: l.batch ? [{ batch: l.batch._id, batch_number: l.batch.batch_number, quantity: l.quantity }] : [],
    })),
  }, { timeoutMs: 120000 });
  return normalizeOrder(body?.createOrder || body?.order);
}

/** Files the walk-in customer as a PENDING vendor for the admin approval flow. */
export async function registerOutletVendor(customer) {
  return post(ENDPOINTS.outlet.registerVendor, customer, { timeoutMs: 60000 });
}

// --- Payment (server-owned status; never set client-side) --------------------

export async function createOutletPaymentLink(orderId) {
  const body = await post(ENDPOINTS.outlet.paymentLink(orderId));
  return {
    link_url: body?.paymentLink || null,
    qrImageData: body?.qrImageData || null,
    link_expiresAt: body?.expiresAt || null,
    status: body?.status,
    amount: body?.amount,
  };
}

export async function createOutletRazorpayOrder(orderId) {
  const body = await post(ENDPOINTS.outlet.razorpayOrder(orderId));
  return {
    razorpay_orderId: body?.razorpayOrderId,
    amount: body?.amount,
    currency: body?.currency,
    key: body?.razorpayKeyId,
  };
}

/** Read-only poll. The client NEVER marks an order paid. */
export async function getOutletOrderStatus(orderId) {
  const body = await get(ENDPOINTS.outlet.orderStatus(orderId));
  return { status: body?.status, paid: body?.paid ?? body?.status === 'PAID' };
}
