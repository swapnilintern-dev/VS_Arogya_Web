// =============================================================================
// Delivery Partner — routes/deliveryRoute.js plus the two order-status PUTs
// the role is allowed to call.
//
// A delivery agent's "tasks" are the orders currently Shipped (ready to pick
// up) or Out for Delivery (ready to complete). NOTE: the order model has no
// per-agent assignment field, so every agent sees the same platform-wide
// dispatch queue — the app documents this too (analysis §9.3).
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { RIDER_PROFILE } from '../mock/misc';
import { listAllOrders, advanceOrder } from './orderService';
import { ORDER_STATUS } from '../constants/orders';

/** Orders waiting on a rider: Shipped = next, Out for Delivery = active. */
export async function listTasks() {
  const orders = await listAllOrders();
  return orders
    .filter((o) => o.orderStatus === ORDER_STATUS.SHIPPED || o.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY)
    .map((o) => ({
      ...o,
      taskStatus: o.orderStatus === ORDER_STATUS.OUT_FOR_DELIVERY ? 'active' : 'next',
      itemCount: o.orderItems.reduce((s, it) => s + it.quantity, 0),
      codAmount: o.paymentMethod === 'COD' ? o.totalAmount : 0,
    }));
}

export async function listDelivered() {
  const orders = await listAllOrders();
  return orders.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED);
}

/** Shipped → Out for Delivery. */
export const pickUpTask = (orderId) => advanceOrder(orderId, 'outForDelivery');

/** Out for Delivery → Delivered. The authoritative action of the whole role. */
export const completeTask = (orderId) => advanceOrder(orderId, 'deliver');

/**
 * Doorstep collection: a SERVER-minted Razorpay payment link shown as a QR or
 * shared with the customer. The rider then polls until Razorpay confirms.
 */
export async function createDoorstepPaymentLink(orderId) {
  if (USE_MOCK) {
    await delay(650);
    return {
      link_id: `plink_mock_${orderId}`,
      link_url: `https://rzp.io/i/dm-${String(orderId).slice(-6)}`,
      link_expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
    };
  }
  return post(ENDPOINTS.delivery.paymentLink(orderId));
}

export async function getDoorstepPaymentStatus(orderId) {
  if (USE_MOCK) { await delay(500); return { status: 'Pending', paid: false }; }
  const body = await get(ENDPOINTS.delivery.paymentStatus(orderId));
  return { status: body?.status, paid: body?.status === 'Completed' };
}

export async function getRiderProfile() {
  if (USE_MOCK) { await delay(160); return { ...RIDER_PROFILE }; }
  // No profile endpoint exists for the delivery role; the session carries the
  // identity captured at login.
  return { ...RIDER_PROFILE };
}
