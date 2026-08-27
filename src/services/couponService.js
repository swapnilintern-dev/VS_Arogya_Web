// =============================================================================
// Coupons + promo banners — routes/couponRoute.js and routes/bannerRoute.js.
// =============================================================================

import ENDPOINTS from '../config/api';
import { get, post, put, del, request, USE_MOCK } from './http';
import { delay } from '../mock/seed';
import { COUPONS, BANNERS } from '../mock/marketing';

let coupons = COUPONS.map((c) => ({ ...c }));
let banners = BANNERS.map((b) => ({ ...b }));

export async function listCoupons() {
  if (USE_MOCK) { await delay(220); return coupons.map((c) => ({ ...c })); }
  const body = await get(ENDPOINTS.coupons.list, { auth: false });
  return body?.coupons || [];
}

export async function createCoupon(payload) {
  if (USE_MOCK) {
    await delay(480);
    const created = { _id: `c${Date.now()}`, redemptions: 0, active: true, expired: false, createdAt: new Date().toISOString(), ...payload };
    coupons = [created, ...coupons];
    return created;
  }
  return post(ENDPOINTS.coupons.create, payload, { auth: false });
}

export async function toggleCoupon(code) {
  if (USE_MOCK) {
    await delay(260);
    coupons = coupons.map((c) => (c.code === code && !c.expired ? { ...c, active: !c.active } : c));
    return coupons.find((c) => c.code === code);
  }
  return put(ENDPOINTS.coupons.toggle(code), undefined, { auth: false });
}

export async function deleteCoupon(code) {
  if (USE_MOCK) { await delay(240); coupons = coupons.filter((c) => c.code !== code); return { success: true }; }
  return del(ENDPOINTS.coupons.remove(code), { auth: false });
}

// --- Banners -----------------------------------------------------------------

export async function listBanners() {
  if (USE_MOCK) { await delay(200); return banners.map((b) => ({ ...b })); }
  const body = await get(ENDPOINTS.banners.list, { auth: false });
  return body?.banners || [];
}

export async function createBanner(fields, imageFile) {
  if (USE_MOCK) {
    await delay(650);
    const created = {
      _id: `bn${Date.now()}`,
      ...fields,
      image: { url: imageFile ? URL.createObjectURL(imageFile) : '', publicId: '' },
      active: true,
      createdAt: new Date().toISOString(),
    };
    banners = [created, ...banners];
    return created;
  }
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== '') form.append(k, v); });
  if (imageFile) form.append('image', imageFile);
  return request(ENDPOINTS.banners.create, { method: 'POST', body: form, auth: false });
}

export async function deleteBanner(id) {
  if (USE_MOCK) { await delay(240); banners = banners.filter((b) => b._id !== id); return { success: true }; }
  return del(ENDPOINTS.banners.remove(id), { auth: false });
}
