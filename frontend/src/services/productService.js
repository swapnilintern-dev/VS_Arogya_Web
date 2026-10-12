// =============================================================================
// Products + batches — routes/postRouter.js and routes/batchRoute.js.
//
// Server contracts (controller/postController.js, batchController.js):
//   GET  /all-products                → { products }
//   POST /add-product   (multipart)   → { product }      fields + images[] + video
//   PUT  /update-product/:id          → { product }      + keptImages (JSON) / removeVideo
//   DELETE /delete-product/:id        → { success }
//   POST /save-prod/:id  (auth)       → toggles; { message: "Product saved" | "Product Usaved" }
//   GET  /all-saved      (auth)       → { all_save: { savedProducts: [product] } }
//   GET  /product/:id/batches         → { stock, batches }
//   GET  /product/:id/available-batches → { stock, sellable_stock, batches }
//   POST /allocate-preview            → { allocations, remaining, availableBatches }
//   POST /product/:id/batches         → { batch }
//   PUT  /batch/:batchId              → { batch }
//   DELETE /batch/:batchId            → { success }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, request } from './http';

// --- Products ----------------------------------------------------------------

export async function listProducts() {
  const body = await get(ENDPOINTS.products.all, { auth: false });
  return body?.products || [];
}

/** There is no GET /product/:id — the catalogue is one list, so read it there. */
export async function getProduct(id) {
  const all = await listProducts();
  return all.find((p) => p._id === id) || null;
}

/**
 * Create. Multipart on the server — text fields plus up to ten `images` files
 * and one optional `video`. Media uploads go to Cloudinary, so the call gets
 * the long timeout.
 */
export async function createProduct(fields, media = {}) {
  const body = await request(ENDPOINTS.products.add, {
    method: 'POST', body: buildProductForm(fields, media), timeoutMs: 120000,
  });
  return body?.product || body;
}

export async function updateProduct(id, fields, media = {}) {
  const body = await request(ENDPOINTS.products.update(id), {
    method: 'PUT', body: buildProductForm(fields, media), timeoutMs: 120000,
  });
  return body?.product || body;
}

export async function deleteProduct(id) {
  return del(ENDPOINTS.products.remove(id));
}

/**
 * `keepImages` is the list of EXISTING { url, publicId } entries to retain (in
 * order); the server field is `keptImages`. Omitting it keeps every current
 * image, so it is only sent when the editor actually loaded the product.
 */
function buildProductForm(fields, { images = [], video, keepImages, removeVideo } = {}) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, v);
  });
  images.forEach((file) => form.append('images', file));
  if (video) form.append('video', video);
  if (keepImages) form.append('keptImages', JSON.stringify(keepImages.map((i) => ({ publicId: i.publicId }))));
  if (removeVideo) form.append('removeVideo', 'true');
  return form;
}

/**
 * POST /bulk-upload — the spreadsheet goes to the SERVER, which parses it and
 * inserts the rows it accepts. Marketing/admin only (role comes from the JWT).
 *
 * Returns { totalRows, uploaded, failed, failedProducts: [{row, title, batchNo,
 * reason}] }. A partial result is normal: valid rows are inserted even when
 * others are rejected.
 */
export async function bulkUploadProducts(file) {
  const form = new FormData();
  form.append('file', file);
  const body = await request(ENDPOINTS.bulk.uploadProducts, {
    method: 'POST', body: form, timeoutMs: 180000,
  });
  return {
    totalRows: body?.totalRows ?? 0,
    uploaded: body?.uploaded ?? 0,
    failed: body?.failed ?? 0,
    failedProducts: body?.failedProducts || [],
    message: body?.message || '',
  };
}

// --- Wishlist (vendor) -------------------------------------------------------

export async function listSavedProducts() {
  const body = await get(ENDPOINTS.products.saved);
  return (body?.all_save?.savedProducts || []).filter(Boolean);
}

/** One call toggles; the server's message says which way it went. */
export async function toggleSavedProduct(productId) {
  const body = await post(ENDPOINTS.products.save(productId));
  const msg = String(body?.message || '').toLowerCase();
  return { saved: !msg.includes('usaved') && !msg.includes('unsaved') };
}

// --- Batches (FEFO) ----------------------------------------------------------

export async function listBatches(productId) {
  const body = await get(ENDPOINTS.batches.ofProduct(productId), { auth: false });
  return (body?.batches || []).map((b) => ({ ...b, product_id: b.product_id || productId }));
}

/** Sellable lots only, nearest expiry first — the picker's source. */
export async function listAvailableBatches(productId) {
  const body = await get(ENDPOINTS.batches.availableOfProduct(productId), { auth: false });
  return body?.batches || [];
}

/**
 * Non-mutating "can this quantity be issued, from these lots?". The server is
 * the ONLY authority on allocation — the client never computes inventory.
 */
export async function previewAllocation({ productId, quantity, pinnedBatchId }) {
  const body = await post(ENDPOINTS.batches.allocatePreview, {
    productId,
    quantity,
    overrides: pinnedBatchId ? [{ batch: pinnedBatchId, quantity }] : [],
  }, { auth: false });
  return {
    allocations: body?.allocations || [],
    remaining: body?.remaining ?? 0,
    availableBatches: body?.availableBatches || [],
  };
}

export async function createBatch(productId, payload) {
  const body = await post(ENDPOINTS.batches.create(productId), payload, { auth: false });
  return body?.batch || body;
}

export async function updateBatch(batchId, payload) {
  const body = await put(ENDPOINTS.batches.update(batchId), payload, { auth: false });
  return body?.batch || body;
}

export async function deleteBatch(batchId) {
  return del(ENDPOINTS.batches.remove(batchId), { auth: false });
}

/**
 * Every lot in the catalogue — powers the marketing batch overview page. The
 * server has no "all batches" route, so this is one call per product.
 */
export async function listAllBatches() {
  const all = await listProducts();
  const perProduct = await Promise.all(all.map(async (p) => {
    const rows = await listBatches(p._id);
    return rows.map((b) => ({ ...b, product: p }));
  }));
  return perProduct.flat();
}
