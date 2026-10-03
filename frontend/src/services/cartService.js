// =============================================================================
// Vendor cart — routes/cartRoute.js. Every call is authenticated and the SERVER
// owns the cart (it lives on the Vendor document), so the website mirrors that:
// mutations return the refreshed cart rather than patching local state blindly.
//
//   GET    /getCart-product          → { totalAmount, cart: [{ product, quantity, freeQty }] }
//   POST   /add-cart/:productId      → adds ONE unit (400 when it would exceed stock)
//   POST   /increase-cart-item/:id   → +1
//   POST   /dec-cart-itm/:id         → −1 (refuses below 1)
//   DELETE /remove-cart-item/:id
//   POST   /clear-cart
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, del } from './http';

/** Lines whose product was deleted from the catalogue are dropped client-side. */
const usable = (cart) => (cart || []).filter((l) => l && l.product && typeof l.product === 'object');

export async function getCart() {
  const body = await get(ENDPOINTS.cart.get);
  return usable(body?.cart);
}

/** The server adds one unit per call. */
export async function addToCart(product, quantity = 1) {
  for (let i = 0; i < Math.max(1, quantity); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await post(ENDPOINTS.cart.add(product._id));
  }
  return getCart();
}

export async function increaseItem(productId) {
  await post(ENDPOINTS.cart.increase(productId));
  return getCart();
}

/** The server refuses to go below one unit; at one, decreasing removes the line. */
export async function decreaseItem(productId) {
  const cart = await getCart();
  const line = cart.find((l) => l.product._id === productId);
  if (line && line.quantity <= 1) return removeItem(productId);
  await post(ENDPOINTS.cart.decrease(productId));
  return getCart();
}

export async function removeItem(productId) {
  await del(ENDPOINTS.cart.remove(productId));
  return getCart();
}

export async function clearCart() {
  await post(ENDPOINTS.cart.clear);
  return [];
}
