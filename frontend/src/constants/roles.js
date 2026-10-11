// =============================================================================
// Roles — mirrors homeForRole() in lib/auth/session.dart and the server's
// staffRoles list in controller/userController.js.
// =============================================================================

export const ROLES = {
  ADMIN: 'admin',
  MARKETING: 'marketing',
  VENDOR: 'vendor',
  DELIVERY: 'delivery',
  OUTLET: 'outlet',
  AGENT: 'agent',
  /**
   * Signed in by email OTP with no usable account — either no registration at
   * all, or one still Pending / Rejected. The server mints this token with NO
   * account id and its isAuthenticated REFUSES it on every protected route
   * (403), so a guest can read the public catalogue and nothing else.
   */
  GUEST: 'guest',
};

/** Roles that skip the vendor approval gate on the server. */
export const STAFF_ROLES = [
  ROLES.ADMIN,
  ROLES.MARKETING,
  ROLES.DELIVERY,
  ROLES.AGENT,
  ROLES.OUTLET,
];

export const APPROVAL = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  /** What the server sends for an address with no vendor record at all. */
  NOT_REGISTERED: 'Not Registered',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.MARKETING]: 'Marketing Head',
  [ROLES.VENDOR]: 'Vendor',
  [ROLES.DELIVERY]: 'Delivery Partner',
  [ROLES.OUTLET]: 'Outlet Staff',
  [ROLES.AGENT]: 'Area Agent',
  [ROLES.GUEST]: 'Guest',
};

/** Where each role lands after signing in. */
export const ROLE_HOME = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.MARKETING]: '/marketing',
  [ROLES.VENDOR]: '/shop',
  [ROLES.DELIVERY]: '/delivery',
  [ROLES.OUTLET]: '/outlet',
  [ROLES.AGENT]: '/agent',
  // A guest browses the storefront; the shop hides prices and ordering.
  [ROLES.GUEST]: '/shop',
};

/**
 * Keyword matching, exactly like the Flutter router: "marketing head",
 * "delivery boy" and "Admin" all resolve. Delivery is checked BEFORE agent so
 * "delivery agent" never lands on the Area Agent portal.
 */
export function normalizeRole(raw) {
  const role = String(raw || '').toLowerCase();
  // Exact match: "guest" is minted by the server, never typed by a human, and
  // must not be caught by the loose matching below.
  if (role === ROLES.GUEST) return ROLES.GUEST;
  if (role.includes('admin')) return ROLES.ADMIN;
  if (role.includes('marketing')) return ROLES.MARKETING;
  if (role.includes('outlet')) return ROLES.OUTLET;
  if (role.includes('delivery')) return ROLES.DELIVERY;
  if (role.includes('agent')) return ROLES.AGENT;
  return ROLES.VENDOR;
}

export const homeForRole = (raw) => ROLE_HOME[normalizeRole(raw)] || '/shop';

/**
 * Whether this session may see distributor prices and order.
 *
 * Only a registered, APPROVED vendor (and staff, who have no approval gate)
 * may. A guest — no account, or one still pending or rejected — browses the
 * catalogue without prices until an admin approves their registration.
 *
 * PRESENTATIONAL. The server is the real gate: it refuses a guest token on
 * every protected route, so hiding the price is about not teasing a number the
 * account cannot act on, not about secrecy.
 */
export function canSeePrices(session) {
  if (!session) return false;
  const role = normalizeRole(session.role);
  if (role === ROLES.GUEST) return false;
  if (STAFF_ROLES.includes(role)) return true;
  // A vendor reaches a session at all only once approved; an older payload
  // without the field is treated as approved rather than locking them out.
  return !session.approvalStatus || session.approvalStatus === APPROVAL.APPROVED;
}
