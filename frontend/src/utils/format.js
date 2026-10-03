// =============================================================================
// Formatting helpers — Indian rupee + locale conventions, matching the app.
// =============================================================================

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const inrCompactWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹1,234.50 */
export const currency = (value) => inr.format(Number(value) || 0);

/** ₹1,235 — for KPI tiles and table cells where paise are noise. */
export const currencyWhole = (value) => inrCompactWhole.format(Number(value) || 0);

/** ₹1.2L / ₹85.4K / ₹940 — for hero figures. */
export function currencyCompact(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export const number = (value) =>
  new Intl.NumberFormat('en-IN').format(Number(value) || 0);

export const percent = (value, digits = 1) =>
  `${(Number(value) || 0).toFixed(digits)}%`;

/** "AB" from "Apollo Pharmacy" — avatar initials, as the Flutter helper does. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Shortens a Mongo ObjectId for display: 66f1…c4a2 (lib/shared/short_id.dart). */
export function shortId(id) {
  const s = String(id || '');
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export const titleCase = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
