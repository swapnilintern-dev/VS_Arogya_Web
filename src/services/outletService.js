// =============================================================================
// Outlet role + the marketing→outlet stock assignment — routes/outletRoute.js.
//
// LOCKED RULE #3 (lib/outlet/outlet_repository.dart): there is no "mark paid"
// call here. Payment status is only ever READ from the server.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import {
  OUTLETS, OUTLET_STOCK, OUTLET_STOCK_BATCHES, outletById, outletsInPincode,
  outletLotsOf, sellableOutletLotsOf,
} from '../mock/outlets';
import { ORDERS } from '../mock/orders';

let stock = OUTLET_STOCK.map((s) => ({ ...s }));

// --- Directory (marketing) ---------------------------------------------------

export async function listOutlets(pincode) {
  if (USE_MOCK) { await delay(); return outletsInPincode(pincode).map((o) => ({ ...o })); }
  const body = await get(`${ENDPOINTS.outlet.list}${pincode ? `?pincode=${pincode}` : ''}`);
  return body?.outlets || [];
}

export async function registerOutlet(payload) {
  if (USE_MOCK) {
    await delay(700);
    const created = { _id: `o${Date.now()}`, ...payload, status: 'Active', role: 'outlet', createdAt: new Date().toISOString() };
    OUTLETS.push(created);
    return created;
  }
  return post(ENDPOINTS.outlet.register, payload, { auth: false });
}

export async function getOutletProfile(outletId) {
  if (USE_MOCK) { await delay(200); return outletById(outletId) || OUTLETS[0]; }
  const body = await get(ENDPOINTS.outlet.profile(outletId));
  return body?.outlet || body;
}

// --- Stock -------------------------------------------------------------------

/**
 * GET /outlet-products/:id — the stock marketing assigned to this outlet.
 *
 * Each row is enriched with the FEFO front lot and the number of live lots, so
 * the stock table and the billing picker never have to fetch batches per row
 * just to answer "what do I sell first?".
 */
export async function listOutletStock(outletId) {
  if (USE_MOCK) {
    await delay();
    return stock.map((row) => {
      const lots = sellableOutletLotsOf(row.product._id);
      return { ...row, frontLot: lots[0] || null, liveLots: lots.length };
    });
  }
  const body = await get(ENDPOINTS.outlet.products(outletId));
  const rows = body?.products || body?.stock || [];
  return rows.map((row) => ({
    ...row,
    frontLot: row.batches?.[0] || null,
    liveLots: row.batchCount ?? (row.batches?.length || 0),
  }));
}

/**
 * Every lot this outlet holds, product joined — the source for the counter's
 * "sell these first" watchlist. With the live backend this is one call per
 * product, so it is only used where the whole shelf genuinely matters.
 */
export async function listOutletLots(outletId) {
  if (USE_MOCK) {
    await delay(240);
    return OUTLET_STOCK_BATCHES.map((b) => ({
      ...b,
      productDoc: stock.find((s) => s.product._id === b.product)?.product || null,
    }));
  }
  const rows = await listOutletStock(outletId);
  const perProduct = await Promise.all(rows.map(async (row) => {
    const detail = await getOutletMedicineDetail(outletId, row.product._id);
    return detail.batches.map((b) => ({ ...b, productDoc: row.product }));
  }));
  return perProduct.flat();
}

/** Every lot the outlet holds for one product — expired and emptied included. */
export async function getOutletMedicineDetail(outletId, productId) {
  if (USE_MOCK) {
    await delay(280);
    const row = stock.find((s) => s.product._id === productId);
    const lots = outletLotsOf(productId);
    return {
      product: row?.product || null,
      batches: lots.map((b) => ({ ...b })),
      totalStock: lots.reduce((s, b) => s + b.available_quantity, 0),
      stockMirror: row?.quantity ?? 0,
      batchCount: lots.length,
      showsAllLots: true,
    };
  }
  const body = await get(`${ENDPOINTS.outlet.availableBatches(productId)}?all=1`);
  return {
    product: body?.product || null,
    batches: body?.batches || [],
    totalStock: body?.totalStock ?? 0,
    stockMirror: body?.stockMirror ?? 0,
    batchCount: body?.batchCount ?? (body?.batches || []).length,
    showsAllLots: true,
  };
}

/** Sellable lots only, FEFO order — the batch picker's source. */
export async function listOutletAvailableBatches(productId) {
  if (USE_MOCK) { await delay(200); return sellableOutletLotsOf(productId).map((b) => ({ ...b })); }
  const body = await get(ENDPOINTS.outlet.availableBatches(productId));
  return body?.batches || [];
}

/** Non-mutating validation of a bill line against live outlet inventory. */
export async function previewOutletAllocation({ productId, quantity, pinnedBatchId }) {
  if (USE_MOCK) {
    await delay(180);
    const lots = sellableOutletLotsOf(productId);
    const ordered = pinnedBatchId
      ? [lots.find((b) => b._id === pinnedBatchId), ...lots.filter((b) => b._id !== pinnedBatchId)].filter(Boolean)
      : lots;
    let left = quantity;
    const allocations = [];
    for (const lot of ordered) {
      if (left <= 0) break;
      const take = Math.min(left, lot.available_quantity);
      allocations.push({ batch: lot._id, batch_number: lot.batch_number, expiry_date: lot.expiry_date, quantity: take });
      left -= take;
    }
    return { allocations, remaining: left, availableBatches: lots };
  }
  return post(ENDPOINTS.outlet.allocatePreview, {
    productId,
    quantity,
    allocations: pinnedBatchId ? [{ batch: pinnedBatchId, quantity }] : [],
  });
}

/**
 * Marketing pushes catalog stock into an outlet. ADDITIVE — the server adds to
 * what the outlet already holds and deducts the same units from the catalog.
 * One call per medicine, and a batch pick is mandatory.
 */
export async function assignStockToOutlet({ outletId, lines }) {
  if (USE_MOCK) {
    await delay(300 * Math.max(1, lines.length));
    return { success: true, assigned: lines.length };
  }
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
  if (USE_MOCK) {
    await delay();
    return ORDERS.filter((o) => o.outlet === outletId).map((o) => ({ ...o }));
  }
  const body = await get(ENDPOINTS.outlet.orders(outletId));
  return body?.orders || [];
}

/** POST /outlet/bill — the POS bill. Deducts outlet stock, renders the invoice. */
export async function placeOutletBill({ customer, lines, orderType, paymentMethod }) {
  if (USE_MOCK) {
    await delay(950);
    const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    return {
      _id: `o${Date.now()}`,
      orderNo: `VSA-POS-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      totalAmount: Math.round(total * 100) / 100,
      orderStatus: 'Pending',
      paymentMethod,
      orderType,
      customer,
      invoice: { _id: `i${Date.now()}`, invoiceNumber: `INV-2026-${String(Math.floor(Math.random() * 900) + 9100)}` },
      createdAt: new Date().toISOString(),
    };
  }
  return post(ENDPOINTS.outlet.bill, {
    customer,
    items: lines.map((l) => ({
      productId: l.product._id,
      quantity: l.quantity,
      allocations: l.batch ? [{ batch: l.batch._id, batch_number: l.batch.batch_number, quantity: l.quantity }] : [],
    })),
    orderType,
    paymentMethod,
  });
}

/** Files the walk-in customer as a PENDING vendor for the admin approval flow. */
export async function registerOutletVendor(customer) {
  if (USE_MOCK) { await delay(600); return { success: true, message: 'Registration filed for admin approval.' }; }
  return post(ENDPOINTS.outlet.registerVendor, customer);
}

// --- Payment (server-owned status; never set client-side) --------------------

export async function createOutletPaymentLink(orderId) {
  if (USE_MOCK) {
    await delay(650);
    return {
      link_id: `plink_mock_${orderId}`,
      link_url: `https://rzp.io/i/mock-${String(orderId).slice(-6)}`,
      link_expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
    };
  }
  return post(ENDPOINTS.outlet.paymentLink(orderId));
}

export async function createOutletRazorpayOrder(orderId) {
  if (USE_MOCK) { await delay(500); return { razorpay_orderId: `order_mock_${orderId}`, key: 'rzp_test_mock' }; }
  return post(ENDPOINTS.outlet.razorpayOrder(orderId));
}

/** Read-only poll. The client NEVER marks an order paid. */
export async function getOutletOrderStatus(orderId) {
  if (USE_MOCK) { await delay(400); return { status: 'AWAITING_PAYMENT', paid: false }; }
  const body = await get(ENDPOINTS.outlet.orderStatus(orderId));
  return { status: body?.status, paid: body?.paid ?? body?.status === 'PAID' };
}
