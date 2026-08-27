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
};

/** Roles that skip the vendor approval gate on the server. */
export const STAFF_ROLES = [
  ROLES.ADMIN,
  ROLES.MARKETING,
  ROLES.DELIVERY,
  ROLES.AGENT,
  ROLES.OUTLET,
];

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.MARKETING]: 'Marketing Head',
  [ROLES.VENDOR]: 'Vendor',
  [ROLES.DELIVERY]: 'Delivery Partner',
  [ROLES.OUTLET]: 'Outlet Staff',
  [ROLES.AGENT]: 'Area Agent',
};

/** Where each role lands after signing in. */
export const ROLE_HOME = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.MARKETING]: '/marketing',
  [ROLES.VENDOR]: '/shop',
  [ROLES.DELIVERY]: '/delivery',
  [ROLES.OUTLET]: '/outlet',
  [ROLES.AGENT]: '/agent',
};

/**
 * Keyword matching, exactly like the Flutter router: "marketing head",
 * "delivery boy" and "Admin" all resolve. Delivery is checked BEFORE agent so
 * "delivery agent" never lands on the Area Agent portal.
 */
export function normalizeRole(raw) {
  const role = String(raw || '').toLowerCase();
  if (role.includes('admin')) return ROLES.ADMIN;
  if (role.includes('marketing')) return ROLES.MARKETING;
  if (role.includes('outlet')) return ROLES.OUTLET;
  if (role.includes('delivery')) return ROLES.DELIVERY;
  if (role.includes('agent')) return ROLES.AGENT;
  return ROLES.VENDOR;
}

export const homeForRole = (raw) => ROLE_HOME[normalizeRole(raw)] || '/shop';
