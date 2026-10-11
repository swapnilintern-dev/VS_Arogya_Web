// =============================================================================
// Coupons + promo banners — routes/couponRoute.js and routes/bannerRoute.js.
//
//   GET    /coupons               → { coupons }
//   POST   /coupons               → { coupon }   body { code, description, percentOff, maxDiscount }
//   PUT    /coupons/:code/toggle  → { coupon }
//   DELETE /coupons/:code         → { success }
//   GET    /promo-banners         → { banners }
//   POST   /promo-banners         → { banner }   multipart: fields + `image`
//   DELETE /promo-banners/:id     → { success }
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, request } from './http';

export async function listCoupons() {
  const body = await get(ENDPOINTS.coupons.list);
  return body?.coupons || [];
}

export async function createCoupon(payload) {
  const body = await post(ENDPOINTS.coupons.create, payload);
  return body?.coupon || body;
}

export async function toggleCoupon(code) {
  const body = await put(ENDPOINTS.coupons.toggle(code), undefined);
  return body?.coupon || body;
}

export async function deleteCoupon(code) {
  return del(ENDPOINTS.coupons.remove(code));
}

// --- Banners -----------------------------------------------------------------

export async function listBanners() {
  const body = await get(ENDPOINTS.banners.list);
  return body?.banners || [];
}

export async function createBanner(fields, imageFile) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== '') form.append(k, v); });
  if (imageFile) form.append('image', imageFile);
  const body = await request(ENDPOINTS.banners.create, { method: 'POST', body: form, timeoutMs: 90000 });
  return body?.banner || body;
}

export async function deleteBanner(id) {
  return del(ENDPOINTS.banners.remove(id));
}
