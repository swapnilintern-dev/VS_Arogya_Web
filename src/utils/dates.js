// =============================================================================
// Date helpers.
// =============================================================================

export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 14 Mar 2026 */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 14 Mar 2026, 4:35 pm */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** Mar 2026 — the way an expiry is printed on a pack. */
export function formatMonthYear(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** "just now" / "5m ago" / "2h ago" / "3d ago" / "14 Mar" — timeAgo() in the app. */
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** yyyy-mm-dd for <input type="date"> */
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/** Days from today until `value`; negative once past. Null when absent. */
export function daysUntil(value) {
  const d = toDate(value);
  if (!d) return null;
  const msPerDay = 86400000;
  return Math.ceil((d.getTime() - Date.now()) / msPerDay);
}
