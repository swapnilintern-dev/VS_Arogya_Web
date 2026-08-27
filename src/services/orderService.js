// =============================================================================
// Orders — routes/orderRoute.js (vendor), routes/adminRoute.js (staff pipeline)
// and routes/manualRoute.js (marketing places on a vendor's behalf).
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { ORDERS, TOTAL_REVENUE, invoiceForOrder } from '../mock/orders';
import { ORDER_STATUS } from '../constants/orders';

let orders = ORDERS.map((o) => ({ ...o }));

const clone = (o) => JSON.parse(JSON.stringify(o));

// --- Reads -------------------------------------------------------------------

/** GET /all-orders — the platform-wide feed admin, marketing and delivery read. */
export async function listAllOrders() {
  if (USE_MOCK) { await delay(); return orders.map(clone); }
  const body = await get(ENDPOINTS.admin.allOrders, { auth: false });
  return body?.orders || body?.order || [];
}

export async function getOrder(id) {
  if (USE_MOCK) { await delay(160); const o = orders.find((x) => x._id === id); return o ? clone(o) : null; }
  const body = await get(ENDPOINTS.admin.singleOrder(id), { auth: false });
  return body?.order || null;
}

/** GET /get-order — the signed-in vendor's own orders. */
export async function listMyOrders(vendorId) {
  if (USE_MOCK) {
    await delay();
    return orders.filter((o) => o.user._id === vendorId).map(clone);
  }
  const body = await get(ENDPOINTS.orders.mine);
  return body?.orders || body?.order || [];
}

/** GET /total-revenue — realised revenue (Delivered orders). */
export async function getTotalRevenue() {
  if (USE_MOCK) { await delay(180); return TOTAL_REVENUE; }
  const body = await get(ENDPOINTS.admin.totalRevenue, { auth: false });
  return Number(body?.totalRevenue ?? body?.total ?? 0);
}

// --- Pipeline ----------------------------------------------------------------

const TRANSITION = {
  confirm: { next: ORDER_STATUS.CONFIRMED, endpoint: ENDPOINTS.admin.confirmOrder },
  ship: { next: ORDER_STATUS.SHIPPED, endpoint: ENDPOINTS.admin.shipOrder },
  outForDelivery: { next: ORDER_STATUS.OUT_FOR_DELIVERY, endpoint: ENDPOINTS.admin.outForDelivery },
  deliver: { next: ORDER_STATUS.DELIVERED, endpoint: ENDPOINTS.admin.deliverOrder },
};

/**
 * Advances one order. `transition` is a key of TRANSITION — never a raw status,
 * so a caller cannot invent a state the server does not support.
 *
 * NOTE: accepting an order (`confirm`) is what generates the invoice and
 * deducts stock server-side; cancelling restores it.
 */
export async function advanceOrder(id, transition) {
  const step = TRANSITION[transition];
  if (!step) throw new Error(`Unknown order transition: ${transition}`);

  if (USE_MOCK) {
    await delay(500);
    orders = orders.map((o) => {
      if (o._id !== id) return o;
      const updated = { ...o, orderStatus: step.next, updatedAt: new Date().toISOString() };
      if (step.next === ORDER_STATUS.CONFIRMED && !updated.invoice) {
        updated.invoice = { _id: `i${Date.now()}`, invoiceNumber: `INV-2026-${String(9000 + Math.floor(Math.random() * 900))}` };
      }
      if (step.next === ORDER_STATUS.DELIVERED) updated.deliveredAt = new Date().toISOString();
      return updated;
    });
    return clone(orders.find((o) => o._id === id));
  }
  await put(step.endpoint(id), undefined, { auth: false });
  return getOrder(id);
}

export async function cancelOrder(id) {
  if (USE_MOCK) {
    await delay(420);
    orders = orders.map((o) =>
      o._id === id ? { ...o, orderStatus: ORDER_STATUS.CANCELLED, updatedAt: new Date().toISOString() } : o);
    return clone(orders.find((o) => o._id === id));
  }
  await put(ENDPOINTS.orders.cancel(id));
  return getOrder(id);
}

// --- Vendor checkout ---------------------------------------------------------

export async function placeOrder({ lines, address, paymentMethod, buyer }) {
  if (USE_MOCK) {
    await delay(800);
    const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    const created = {
      _id: `o${Date.now()}`,
      orderNo: `VSA-${String(49000 + orders.length)}`,
      user: buyer,
      orderItems: lines.map((l) => ({
        product: l.product,
        quantity: l.quantity,
        orderPrice: l.product.price,
        freeQty: 0,
        batch_no: l.product.batch_no,
        exp_date: l.product.exp_date,
        allocations: [],
      })),
      shippingAddress: {
        address: address.line1,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: 'India',
        phoneNo: address.phone,
      },
      paymentMethod,
      paymentInfo: { status: 'Pending' },
      totalAmount: Math.round(total * 100) / 100,
      orderStatus: ORDER_STATUS.PENDING,
      amountWord: `Rupees ${Math.round(total).toLocaleString('en-IN')} Only`,
      orderType: 'byApp',
      createdAt: new Date().toISOString(),
    };
    orders = [created, ...orders];
    return clone(created);
  }
  const body = await post(ENDPOINTS.orders.place, {
    shippingAddress: {
      address: address.line1,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: 'India',
      phoneNo: address.phone,
    },
    paymentMethod,
  });
  return body?.order || body;
}

// --- Manual order (marketing / outlet) ---------------------------------------

/**
 * The server has no "create order with lines" route: the app adds ONE UNIT per
 * call to the vendor's cart, then places the order. Reproduced faithfully so
 * the live path is a flag flip.
 *
 * `clientOrderId` is the idempotency key — the SAME value is reused across
 * retries so a mid-submit network drop can never create a duplicate order.
 */
export async function placeManualOrder({ vendorId, lines, clientOrderId, outletId }) {
  if (USE_MOCK) {
    await delay(950);
    const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    const created = {
      _id: `o${Date.now()}`,
      orderNo: `VSA-${String(49500 + orders.length)}`,
      user: lines[0]?.vendor || { _id: vendorId, store_name: 'Vendor' },
      outlet: outletId,
      orderItems: lines.map((l) => ({
        product: l.product,
        quantity: l.quantity,
        orderPrice: l.product.price,
        freeQty: l.freeQty || 0,
        batch_no: l.batch?.batch_number,
        exp_date: l.batch?.expiry_date,
        allocations: l.batch
          ? [{ batch: l.batch._id, batch_number: l.batch.batch_number, expiry_date: l.batch.expiry_date, quantity: l.quantity }]
          : [],
      })),
      shippingAddress: {
        address: l0(lines)?.vendor?.full_address || '—',
        city: l0(lines)?.vendor?.city || '—',
        state: l0(lines)?.vendor?.state || 'Maharashtra',
        pincode: l0(lines)?.vendor?.pin_code || '—',
        country: 'India',
        phoneNo: l0(lines)?.vendor?.mobile_no || '—',
      },
      paymentMethod: 'COD',
      paymentInfo: { status: 'Pending' },
      totalAmount: Math.round(total * 100) / 100,
      orderStatus: ORDER_STATUS.PENDING,
      amountWord: `Rupees ${Math.round(total).toLocaleString('en-IN')} Only`,
      orderType: 'byApp',
      source: outletId ? undefined : 'MANUAL_BY_MARKETING',
      clientOrderId,
      createdAt: new Date().toISOString(),
    };
    orders = [created, ...orders];
    return clone(created);
  }

  // One call per unit, exactly as the app does.
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await post(ENDPOINTS.manual.addToVendorCart(vendorId, line.product._id), {
        freeQty: line.freeQty || 0,
        allocations: line.batch
          ? [{ batch: line.batch._id, batch_number: line.batch.batch_number, quantity: line.quantity }]
          : [],
      }, { auth: false });
    }
  }
  const body = await post(
    outletId ? ENDPOINTS.outlet.manualOrder(vendorId) : ENDPOINTS.manual.placeOrder(vendorId),
    { clientOrderId, outletId },
    { auth: !!outletId },
  );
  return body?.order || body;
}

const l0 = (lines) => lines[0];

// --- Invoice -----------------------------------------------------------------

/**
 * GET /prev-invoice/:id answers a 302 to the hosted PDF. In mock mode there is
 * no document to fetch, so the caller gets the invoice RECORD and renders the
 * on-screen summary — mirroring the app's "server-first, on-device fallback".
 */
export async function getInvoice(orderId) {
  if (USE_MOCK) {
    await delay(280);
    const invoice = invoiceForOrder(orderId);
    if (!invoice) return null;
    return { ...invoice, pdfUrl: '' };
  }
  const body = await get(ENDPOINTS.invoice.preview(orderId));
  return body?.invoice || body;
}

// --- Payments ----------------------------------------------------------------

export async function createPayment(orderId) {
  if (USE_MOCK) {
    await delay(600);
    return { razorpay_orderId: `order_mock_${orderId}`, amount: 0, currency: 'INR', key: 'rzp_test_mock' };
  }
  return post(ENDPOINTS.payment.create(orderId));
}

export async function verifyPayment(payload) {
  if (USE_MOCK) { await delay(500); return { success: true }; }
  return post(ENDPOINTS.payment.verify, payload);
}
