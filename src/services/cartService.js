// =============================================================================
// Vendor cart — routes/cartRoute.js. Every call is authenticated and the SERVER
// owns the cart (it lives on the Vendor document), so the website mirrors that:
// mutations return the refreshed cart rather than patching local state blindly.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, del, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { PRODUCTS } from '../mock/products';

let mockCart = [
  { product: PRODUCTS[1], quantity: 4, freeQty: 0 },
  { product: PRODUCTS[13], quantity: 2, freeQty: 0 },
];

const cloneCart = () => mockCart.map((l) => ({ ...l, product: { ...l.product } }));

export async function getCart() {
  if (USE_MOCK) { await delay(200); return cloneCart(); }
  const body = await get(ENDPOINTS.cart.get);
  return body?.cart?.items || body?.cart || [];
}

export async function addToCart(product, quantity = 1) {
  if (USE_MOCK) {
    await delay(220);
    const existing = mockCart.find((l) => l.product._id === product._id);
    if (existing) existing.quantity += quantity;
    else mockCart = [...mockCart, { product, quantity, freeQty: 0 }];
    return cloneCart();
  }
  await post(ENDPOINTS.cart.add(product._id));
  return getCart();
}

export async function increaseItem(productId) {
  if (USE_MOCK) {
    await delay(140);
    mockCart = mockCart.map((l) => (l.product._id === productId ? { ...l, quantity: l.quantity + 1 } : l));
    return cloneCart();
  }
  await post(ENDPOINTS.cart.increase(productId));
  return getCart();
}

export async function decreaseItem(productId) {
  if (USE_MOCK) {
    await delay(140);
    mockCart = mockCart
      .map((l) => (l.product._id === productId ? { ...l, quantity: l.quantity - 1 } : l))
      .filter((l) => l.quantity > 0);
    return cloneCart();
  }
  await post(ENDPOINTS.cart.decrease(productId));
  return getCart();
}

export async function removeItem(productId) {
  if (USE_MOCK) {
    await delay(180);
    mockCart = mockCart.filter((l) => l.product._id !== productId);
    return cloneCart();
  }
  await del(ENDPOINTS.cart.remove(productId));
  return getCart();
}

export async function clearCart() {
  if (USE_MOCK) { await delay(180); mockCart = []; return []; }
  await post(ENDPOINTS.cart.clear);
  return [];
}
