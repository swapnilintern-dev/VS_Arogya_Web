// =============================================================================
// Orders — routes/orderRoute.js (vendor), routes/adminRoute.js (staff pipeline)
// and routes/manualRoute.js (marketing places on a vendor's behalf).
//
// Server contracts:
//   GET  /all-orders                 → { allOrders }   user + orderItems.product populated
//   GET  /single-order/:id           → { order }       user + product + invoice populated
//   GET  /get-order       (auth)     → { orders }      the caller's own (product populated)
//   GET  /total-revenue              → { totalRevenue, deliveredCount }
//   PUT  /confirm-order/:id … /delivered-prder/:id → { success }
//   PUT  /cancel-order/:id (auth)    → { success }
//   POST /place-order     (auth)     → { Order }       body: flat address fields
//   POST /manual-cart/:vendorId/:productId  → adds ONE unit; body { freeQty, allocations }
//   POST /manual-order/:vendorId            → { Order }
//   POST /outlet/add-cart (outlet)          → body { productId, quantity, freeQty, allocations }
//   POST /outlet/manual-order/:vendorId     → { createOrder }
//   GET  /prev-invoice/:id    (auth)        → 302 → hosted invoice PDF
//   POST /create-payment/:id  (auth)        → COD: { success } / ONLINE: razorpay order
//   POST /verify-payment      (auth)        → { success }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, ApiError, requestJsonOrRedirect } from './http';
import { readSession } from './authService';
import { ROLES } from '../constants/roles';

// --- Normalisation -----------------------------------------------------------
//
// Populated refs can come back null when the referenced document was deleted
// (a vendor removed after ordering, a product deleted from the catalogue).
// Pages read `order.user.store_name` and `item.product.title` directly, so the
// service guarantees those objects exist.

const UNKNOWN_BUYER = { store_name: 'Unknown vendor', contact_person_name: '', mobile_no: '', email: '' };
const UNKNOWN_PRODUCT = { title: 'Product no longer in catalogue', price: 0, image: [] };

const asObject = (ref, fallback) => (ref && typeof ref === 'object' ? ref : { _id: ref || undefined, ...fallback });

export function normalizeOrder(o) {
  if (!o) return null;
  return {
    ...o,
    user: asObject(o.user, UNKNOWN_BUYER),
    orderItems: (o.orderItems || []).map((it) => ({
      ...it,
      product: asObject(it.product, UNKNOWN_PRODUCT),
      allocations: it.allocations || [],
    })),
    paymentInfo: o.paymentInfo || { status: 'Pending' },
    shippingAddress: o.shippingAddress || {},
  };
}

const normalizeAll = (rows) => (rows || []).map(normalizeOrder);

// --- Reads -------------------------------------------------------------------

/** GET /all-orders — the platform-wide feed admin, marketing and delivery read. */
export async function listAllOrders() {
  const body = await get(ENDPOINTS.admin.allOrders);
  return normalizeAll(body?.allOrders);
}

/**
 * One order, fully populated. GET /single-order/:id returns `order` on the
 * current server; an older deployment answers only the first line, in which
 * case the order is read from the list the signed-in role is allowed to see.
 */
export async function getOrder(id) {
  const body = await get(ENDPOINTS.admin.singleOrder(id));
  if (body?.order) return normalizeOrder(body.order);
  const rows = await listForRole();
  return rows.find((o) => o._id === id) || null;
}

async function listForRole() {
  const session = readSession();
  switch (session?.role) {
    case ROLES.VENDOR: return listMyOrders();
    case ROLES.OUTLET: {
      const body = await get(ENDPOINTS.outlet.orders(session.id));
      return normalizeAll(body?.orders);
    }
    case ROLES.AGENT: {
      const body = await post(ENDPOINTS.agent.pincodeOrders(session.id), {});
      return normalizeAll(body?.orders);
    }
    default: return listAllOrders();
  }
}

/** GET /get-order — the signed-in vendor's own orders (newest first). */
export async function listMyOrders() {
  const body = await get(ENDPOINTS.orders.mine);
  return normalizeAll(body?.orders).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** GET /total-revenue — realised revenue (Delivered orders). */
export async function getTotalRevenue() {
  const body = await get(ENDPOINTS.admin.totalRevenue);
  return Number(body?.totalRevenue ?? 0);
}

// --- Pipeline ----------------------------------------------------------------

const TRANSITION = {
  confirm: { endpoint: ENDPOINTS.admin.confirmOrder, timeoutMs: 120000 }, // renders the invoice PDF
  ship: { endpoint: ENDPOINTS.admin.shipOrder },
  outForDelivery: { endpoint: ENDPOINTS.admin.outForDelivery },
  deliver: { endpoint: ENDPOINTS.admin.deliverOrder },
};

/**
 * Advances one order. `transition` is a key of TRANSITION — never a raw status,
 * so a caller cannot invent a state the server does not support.
 *
 * NOTE: accepting an order (`confirm`) is what generates the invoice
 * server-side; cancelling restores the stock the order reserved.
 */
export async function advanceOrder(id, transition) {
  const step = TRANSITION[transition];
  if (!step) throw new Error(`Unknown order transition: ${transition}`);
  await put(step.endpoint(id), undefined, { timeoutMs: step.timeoutMs });
  return getOrder(id);
}

export async function cancelOrder(id) {
  await put(ENDPOINTS.orders.cancel(id));
  return getOrder(id);
}

// --- Vendor checkout ---------------------------------------------------------

/**
 * Places the order from the SERVER-side cart (the lines are already there —
 * `lines` is only used for the client's own summary). Then records the payment
 * method: COD closes the loop; ONLINE mints a Razorpay order the checkout page
 * hands to the Razorpay sheet.
 */
export async function placeOrder({ address, paymentMethod }) {
  const body = await post(ENDPOINTS.orders.place, {
    address: address.line1,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: 'India',
    phoneNo: address.phone,
  });
  const order = normalizeOrder(body?.Order || body?.order);
  if (!order?._id) throw new ApiError('The order was not created. Please try again.', { code: 'BAD_RESPONSE' });

  let payment = null;
  try {
    payment = await createPayment(order._id, paymentMethod);
  } catch {
    // The order exists; the vendor can retry payment from the order page.
  }
  return { ...order, paymentMethod, payment };
}

// --- Manual order (marketing / outlet) ---------------------------------------

/**
 * The server has no "create order with lines" route.
 *   • Marketing: add ONE UNIT per call to the VENDOR's cart, then place.
 *   • Outlet: add each line to the OUTLET's own cart (quantity + pinned lot),
 *     then place for the vendor — the outlet's stock is what gets deducted.
 */
export async function placeManualOrder({ vendorId, lines, outletId }) {
  const pinned = (line) => (line.batch
    ? [{ batch: line.batch._id, batch_number: line.batch.batch_number, quantity: line.quantity }]
    : []);

  if (outletId) {
    for (const line of lines) {
      // eslint-disable-next-line no-await-in-loop
      await post(ENDPOINTS.outlet.addToCart, {
        productId: line.product._id,
        quantity: line.quantity,
        freeQty: line.freeQty || 0,
        allocations: pinned(line),
      });
    }
    const body = await post(ENDPOINTS.outlet.manualOrder(vendorId), {}, { timeoutMs: 120000 });
    return normalizeOrder(body?.createOrder || body?.Order || body?.order);
  }

  for (const line of lines) {
    for (let i = 0; i < line.quantity; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await post(ENDPOINTS.manual.addToVendorCart(vendorId, line.product._id), {
        freeQty: line.freeQty || 0,
        allocations: pinned(line),
      });
    }
  }
  const body = await post(ENDPOINTS.manual.placeOrder(vendorId), {}, { timeoutMs: 120000 });
  return normalizeOrder(body?.Order || body?.order);
}

// --- Invoice -----------------------------------------------------------------

/**
 * The invoice RECORD (number, totals, hosted pdfUrl). Null until the order has
 * been accepted — the server answers 404 "Invoice not found" before that, which
 * is a state, not an error.
 */
export async function getInvoice(orderId) {
  const { payload, redirectedTo } = await requestJsonOrRedirect(ENDPOINTS.invoice.preview(orderId));
  if (payload?.invoice) return payload.invoice;
  // GET /prev-invoice/:id answers 302 → the hosted PDF, and the browser follows
  // it, so the file's URL is what comes back. The invoice NUMBER lives only on
  // the document itself in that case.
  if (redirectedTo) {
    const stamp = redirectedTo.match(/\/v(\d{10})\d*\//)?.[1];
    return { pdfUrl: redirectedTo, invoiceNumber: 'See PDF', generatedAt: stamp ? new Date(Number(stamp) * 1000).toISOString() : null };
  }
  return null;
}

// --- Payments ----------------------------------------------------------------

/** COD → marks the order COD. ONLINE → { razorpayOrderId, amount, currency, razorpayKeyId }. */
export async function createPayment(orderId, paymentMethod = 'COD') {
  return post(ENDPOINTS.payment.create(orderId), { paymentMethod });
}

export async function verifyPayment(payload) {
  return post(ENDPOINTS.payment.verify, payload);
}
