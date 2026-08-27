// =============================================================================
// Deterministic pseudo-random helpers.
//
// Mock data must be STABLE across reloads — a dashboard whose KPIs change every
// refresh is impossible to develop against. Everything below is derived from a
// fixed seed, so the fixtures are identical on every run.
// =============================================================================

let state = 20260826;

export function rand() {
  // Mulberry32
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const resetSeed = (value = 20260826) => { state = value; };

export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
export const money = (min, max, step = 0.5) =>
  Math.round((min + rand() * (max - min)) / step) * step;
export const chance = (p) => rand() < p;

/** A stable 24-hex-char id shaped like a Mongo ObjectId. */
export function oid(prefix, n) {
  const tail = String(n).padStart(6, '0');
  return (prefix + '0'.repeat(24)).slice(0, 18) + tail;
}

const DAY = 86400000;

/** ISO string `days` in the past (fractional days allowed). */
export const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString();
/** ISO string `days` in the future. */
export const daysAhead = (days) => new Date(Date.now() + days * DAY).toISOString();
export const monthsAhead = (months) => daysAhead(months * 30.44);
export const monthsAgo = (months) => daysAgo(months * 30.44);

/** Simulated network latency so loading states are visible during development. */
export const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));
