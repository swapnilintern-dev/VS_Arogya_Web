// =============================================================================
// Buyer pricing tier — the web twin of lib/services/buyer_pricing.dart.
//
// The catalogue carries THREE prices per medicine, and which one a buyer sees
// depends on what kind of business they are:
//
//   • retail      — the base `price` (an ordinary pharmacy)
//   • doctor      — base price minus `drDisPercent`      (hospital / clinic)
//   • wholeseller — base price minus `wholesellerPercent` (wholesale / distributor)
//
// Both percentages are per-product fields the Marketing team sets, including
// through the bulk Excel upload (columns DR_DIS_% and Wholseller_%).
//
// ─── PRESENTATION ONLY ───────────────────────────────────────────────────────
// The server is the authority on what is actually charged: controller/
// orderController.js totals an order from `product.price`, the BASE figure.
// This module only decides which number the storefront SHOWS on the catalogue
// and the product page — exactly where the app applies it — so a wrong tier is
// a display bug, never a pricing exploit. The cart, checkout and invoices
// deliberately stay on the server's figures.
// =============================================================================

export const PRICING_TIER = {
  RETAIL: 'retail',
  DOCTOR: 'doctor',
  WHOLESELLER: 'wholeseller',
};

export const TIER_LABEL = {
  [PRICING_TIER.RETAIL]: 'Your price',
  [PRICING_TIER.DOCTOR]: 'Doctor rate',
  [PRICING_TIER.WHOLESELLER]: 'Wholesale rate',
};

/** Retail never attracts a tier discount, so the UI can skip the whole badge. */
export const isDiscountedTier = (tier) => tier !== PRICING_TIER.RETAIL;

/**
 * Maps a vendor's registration fields onto a tier.
 *
 * `vendor_type` is the primary signal ("Hospital / Clinic" vs "Shop /
 * Pharmacy"); `shop_type` refines a shop into wholesale or retail. Both are
 * free text on the backend, so matching is loose and lowercase.
 *
 * Defaults to RETAIL — the UNDISCOUNTED price. Deliberately the conservative
 * direction: an unknown type shows the normal price rather than advertising a
 * discount the account may not be entitled to.
 */
export function tierFrom({ vendorType, shopType } = {}) {
  const v = String(vendorType || '').toLowerCase();
  const s = String(shopType || '').toLowerCase();

  // Checked first: a hospital pharmacy is a hospital buyer, even though its
  // shop_type also contains "pharmacy".
  if (v.includes('hospital') || v.includes('clinic') || v.includes('doctor')) return PRICING_TIER.DOCTOR;
  if (s.includes('hospital') || s.includes('clinic')) return PRICING_TIER.DOCTOR;
  if (s.includes('wholesale') || s.includes('wholeseller') || s.includes('distributor')) {
    return PRICING_TIER.WHOLESELLER;
  }
  return PRICING_TIER.RETAIL;
}

/** The tier for a session object (what AuthContext hands components). */
export const tierForSession = (session) =>
  tierFrom({ vendorType: session?.vendorType, shopType: session?.shopType });

/** Both percentages are stored as STRINGS on the server; parse leniently. */
const toPercent = (value) => {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const doctorPercentOf = (product) => toPercent(product?.drDisPercent);
export const wholesalePercentOf = (product) => toPercent(product?.wholesellerPercent);

/** The discount this tier gets on this product, in percent (0 for retail). */
export function discountPercentFor(product, tier) {
  if (tier === PRICING_TIER.DOCTOR) return doctorPercentOf(product);
  if (tier === PRICING_TIER.WHOLESELLER) return wholesalePercentOf(product);
  return 0;
}

/**
 * The price this account pays after its tier discount — clamped so an odd
 * configured percentage can never go below zero or above the base price.
 */
export function priceFor(product, tier) {
  const base = Number(product?.price) || 0;
  const pct = discountPercentFor(product, tier);
  if (pct <= 0) return base;
  return Math.min(base, Math.max(0, base * (1 - pct / 100)));
}

/** How much this account saves against the base price. */
export const savingFor = (product, tier) => (Number(product?.price) || 0) - priceFor(product, tier);
