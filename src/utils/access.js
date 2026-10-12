// =============================================================================
// Browse-only accounts — mirrors lib/customer/price_gate.dart in the Flutter app.
//
// Prices and ordering are for APPROVED vendors only. An email-OTP sign-in with
// no account yet comes back from /eotp-verify as role "guest" with
// approvalStatus "Not Registered"; a vendor still under review or rejected
// comes back the same way with "Pending" / "Rejected". Those sessions may
// browse the catalogue but see a blurred price and cannot reach the cart.
//
// The server refuses a guest token on every protected route (isAuthenticated),
// so this is the presentational half only.
// =============================================================================

import { ROLES } from '../constants/roles';

export const BROWSE_STATUS = {
  NOT_REGISTERED: 'not_registered',
  PENDING: 'pending',
  REJECTED: 'rejected',
};

/**
 * Why this session is browse-only, or null when it may see prices and order.
 * A session without an approvalStatus (password login) counts as approved,
 * exactly like VendorApproval.treatUnknownAsApproved in the app.
 */
export function browseStatusOf(session) {
  if (!session || session.role !== ROLES.VENDOR) return null;

  const status = String(session.approvalStatus || '').trim().toLowerCase();
  if (status === 'approved') return null;
  if (status === 'pending') return BROWSE_STATUS.PENDING;
  if (status === 'rejected') return BROWSE_STATUS.REJECTED;
  if (String(session.rawRole || '').toLowerCase() === 'guest' || status) {
    return BROWSE_STATUS.NOT_REGISTERED;
  }
  return null;
}

/** What the browse-only buyer is told, and where the button takes them. */
export const BROWSE_COPY = {
  [BROWSE_STATUS.NOT_REGISTERED]: {
    title: 'Register to see prices and order',
    text: 'You are browsing as a guest. Complete your vendor registration — once an admin approves it, prices and ordering unlock.',
    cta: 'Complete vendor registration',
    to: '/register',
  },
  [BROWSE_STATUS.PENDING]: {
    title: 'Your registration is under review',
    text: 'Prices and ordering unlock as soon as an admin approves your registration. You will get an email when that happens.',
    cta: null,
    to: null,
  },
  [BROWSE_STATUS.REJECTED]: {
    title: 'Your registration was rejected',
    text: 'Update your details and submit the registration again to start ordering.',
    cta: 'Update & resubmit',
    to: '/register',
  },
};
