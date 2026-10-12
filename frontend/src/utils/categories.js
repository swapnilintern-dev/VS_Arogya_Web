import { MEDICINE_CATEGORIES } from '../constants/catalog';

/** Case/whitespace-insensitive category comparison — the catalogue stores them as typed. */
export const sameCategory = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * The known categories first, then any other spelling the products actually
 * use, so a filter chip exists for every category with stock behind it.
 */
export function categoriesOf(products) {
  const seen = new Map();
  MEDICINE_CATEGORIES.forEach((c) => seen.set(c.toLowerCase(), c));
  (products || []).forEach((p) => {
    const key = String(p.category || '').trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, String(p.category).trim());
  });
  return [...seen.values()];
}
