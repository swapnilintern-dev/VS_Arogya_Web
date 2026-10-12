// =============================================================================
// Expiry grading — a direct port of ExpiryTier in lib/widgets/expiry_alert.dart,
// so a batch is graded IDENTICALLY in the app and on the website.
//
//   expired (<0d, blocks sale) · critical (≤30d) · warning/"Expiring Soon" (≤90d)
//   · caution/"Watch" (≤180d) · safe/"Good" (>180d) · unknown (no printed expiry)
//
// The backend's own `isExpiringSoon` virtual is the ≤90-day rule, i.e. tiers
// expired | critical | warning.
// =============================================================================

import { daysUntil } from './dates';

export const EXPIRY_TIER = {
  EXPIRED: 'expired',
  CRITICAL: 'critical',
  WARNING: 'warning',
  CAUTION: 'caution',
  SAFE: 'safe',
  UNKNOWN: 'unknown',
};

export const EXPIRY_META = {
  [EXPIRY_TIER.EXPIRED]: { label: 'Expired', color: '#B3261E', tone: 'danger' },
  [EXPIRY_TIER.CRITICAL]: { label: 'Critical', color: '#E53935', tone: 'danger' },
  [EXPIRY_TIER.WARNING]: { label: 'Expiring soon', color: '#E8710A', tone: 'warning' },
  [EXPIRY_TIER.CAUTION]: { label: 'Watch', color: '#B98900', tone: 'warning' },
  [EXPIRY_TIER.SAFE]: { label: 'Good', color: '#4CAF82', tone: 'success' },
  [EXPIRY_TIER.UNKNOWN]: { label: 'No expiry', color: '#757575', tone: 'muted' },
};

/** A lot with no printed expiry is sellable — the backend treats null as fine. */
export function expiryTierOf(value) {
  const days = daysUntil(value);
  if (days === null) return EXPIRY_TIER.UNKNOWN;
  if (days < 0) return EXPIRY_TIER.EXPIRED;
  if (days <= 30) return EXPIRY_TIER.CRITICAL;
  if (days <= 90) return EXPIRY_TIER.WARNING;
  if (days <= 180) return EXPIRY_TIER.CAUTION;
  return EXPIRY_TIER.SAFE;
}

/** Only an expired lot may never be sold. */
export const blocksSale = (value) => expiryTierOf(value) === EXPIRY_TIER.EXPIRED;

/** The backend's ≤90-day flag. */
export function isExpiringSoon(value) {
  const tier = expiryTierOf(value);
  return (
    tier === EXPIRY_TIER.EXPIRED ||
    tier === EXPIRY_TIER.CRITICAL ||
    tier === EXPIRY_TIER.WARNING
  );
}

/** "12 days left" / "Expired 4 days ago" / "1 yr 2 mo left" */
export function expiryPhrase(value) {
  const days = daysUntil(value);
  if (days === null) return 'No printed expiry';
  if (days < 0) {
    const ago = -days;
    return ago === 1 ? 'Expired yesterday' : `Expired ${ago} days ago`;
  }
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  if (days < 60) return `${days} days left`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo left`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years} yr ${rem} mo left` : `${years} yr left`;
}
