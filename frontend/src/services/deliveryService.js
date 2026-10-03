// =============================================================================
// Delivery Partner — routes/deliveryRoute.js plus the two order-status PUTs
// the role is allowed to call.
//
// A delivery agent's "tasks" are the orders currently Shipped (ready to pick
// up) or Out for Delivery (ready to complete). NOTE: the order model has no
// per-agent assignment field, so every agent sees the same platform-wide
// dispatch queue — the app documents this too (analysis §9.3).
//
//   POST /delivery/payment-link/:id (delivery token) → { paid, paymentLink, amount, expiresAt }
//   GET  /delivery/payment-status/:id               → { paid }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post } from './http';
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
  const body = await post(ENDPOINTS.delivery.paymentLink(orderId));
  return {
    paid: !!body?.paid,
    link_url: body?.paymentLink || null,
    link_expiresAt: body?.expiresAt || null,
    amount: body?.amount,
  };
}

export async function getDoorstepPaymentStatus(orderId) {
  const body = await get(ENDPOINTS.delivery.paymentStatus(orderId));
  return { paid: !!body?.paid, status: body?.paid ? 'Completed' : 'Pending' };
}

/**
 * No profile endpoint exists for the delivery role — the identity captured at
 * login is all the server exposes. Figures such as ratings and vehicle details
 * have no backing field, so they are not shown.
 */
export function riderProfileFrom(session) {
  return {
    name: session?.name || 'Delivery partner',
    phone: session?.mobile || '',
    role: 'Delivery Partner',
  };
}
