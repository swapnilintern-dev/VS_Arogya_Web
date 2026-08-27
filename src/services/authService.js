// =============================================================================
// Auth — mirrors lib/services/auth_service.dart and the sign-in cascade in
// lib/sign_in_screen.dart:
//
//   1. POST /login          → Vendor collection (admin/marketing/delivery/agent/buyer)
//   2. POST /agent-login    → delivery agent collection
//   3. POST /outlet-login   → Outlet collection
//
// The first success decides the role. A NETWORK failure stops the cascade — only
// a credential rejection falls through to the next collection.
// =============================================================================

import ENDPOINTS from '../config/api';
import { post, request, setAuthToken, ApiError, NotImplementedError, USE_MOCK } from './http';
import { normalizeRole, ROLES } from '../constants/roles';
import { delay } from '../mock/seed';
import { ALL_VENDOR_COLLECTION, DEMO_OUTLET, DEMO_PASSWORD, findAccountByMobile } from '../mock/users';

const SESSION_KEY = 'vsa.web.session';

/** The session shape every consumer reads. */
function toSession({ role, id, name, mobile, token, pincode, outlet }) {
  return {
    role: normalizeRole(role),
    rawRole: role,
    id,
    name,
    mobile,
    token,
    pincode: pincode || null,
    // Only populated for an outlet login — the outlet id every outlet-scoped
    // call needs (OutletSession in the Flutter app).
    outlet: outlet || null,
  };
}

export function saveSession(session) {
  setAuthToken(session?.token || null);
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable */ }
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    setAuthToken(session?.token || null);
    return session;
  } catch {
    return null;
  }
}

export const clearSession = () => saveSession(null);

// -----------------------------------------------------------------------------

async function loginMock(mobile, password) {
  await delay(420);
  const account = findAccountByMobile(mobile);

  if (account) {
    if (password !== DEMO_PASSWORD) {
      throw new ApiError('Credentials are wrong.', { code: 'BUSINESS' });
    }
    // The server's approval gate: a buyer must be Approved to sign in.
    const role = normalizeRole(account.role);
    if (role === ROLES.VENDOR && account.approvalStatus !== 'Approved') {
      throw new ApiError(
        account.approvalStatus === 'Rejected'
          ? 'Your registration was rejected. Please contact support.'
          : "Your account is pending admin approval. You'll get your login details by email once approved.",
        { code: 'BUSINESS' },
      );
    }
    return toSession({
      role: account.role,
      id: account._id,
      name: account.store_name || account.contact_person_name,
      mobile: account.mobile_no,
      token: `mock.${role}.${account._id}`,
      pincode: account.pin_code,
    });
  }

  // Fall through to the Outlet collection, as the sign-in cascade does.
  if (String(mobile).trim() === DEMO_OUTLET.mobileNo) {
    if (password !== DEMO_PASSWORD) {
      throw new ApiError('Credentials are wrong.', { code: 'BUSINESS' });
    }
    return toSession({
      role: ROLES.OUTLET,
      id: DEMO_OUTLET._id,
      name: DEMO_OUTLET.outletName,
      mobile: DEMO_OUTLET.mobileNo,
      token: `mock.outlet.${DEMO_OUTLET._id}`,
      pincode: DEMO_OUTLET.pincode,
      outlet: DEMO_OUTLET,
    });
  }

  throw new ApiError('User not found.', { code: 'BUSINESS' });
}

async function loginLive(mobile, password) {
  // 1 — Vendor collection.
  try {
    const body = await post(ENDPOINTS.auth.login, { mobile_no: mobile, password }, { auth: false });
    return toSession({
      role: body.role,
      id: body.id,
      name: body.name || body.store_name || body.contact_person_name,
      mobile,
      token: body.token,
      pincode: body.pincode,
    });
  } catch (err) {
    if (err.code === 'NETWORK' || err.code === 'TIMEOUT') throw err;
  }

  // 2 — delivery agent collection.
  try {
    const body = await post(ENDPOINTS.delivery.agentLogin, { mobile, password }, { auth: false });
    return toSession({
      role: ROLES.DELIVERY,
      id: body.id || body._id,
      name: body.name,
      mobile,
      token: body.token,
    });
  } catch (err) {
    if (err.code === 'NETWORK' || err.code === 'TIMEOUT') throw err;
  }

  // 3 — Outlet collection.
  const body = await post(
    ENDPOINTS.outlet.login,
    { mobileNo: mobile, password },
    { auth: false },
  );
  return toSession({
    role: body.role || ROLES.OUTLET,
    id: body.outlet?._id,
    name: body.outlet?.outletName,
    mobile,
    token: body.token,
    pincode: body.outlet?.pincode,
    outlet: body.outlet,
  });
}

export async function login({ mobile, password }) {
  const session = USE_MOCK ? await loginMock(mobile, password) : await loginLive(mobile, password);
  saveSession(session);
  return session;
}

export async function logout() {
  if (!USE_MOCK) {
    try { await post(ENDPOINTS.auth.logout); } catch { /* the local session is cleared regardless */ }
  }
  clearSession();
}

/**
 * Vendor KYC registration (multipart on the server: gst_pdf, store_pic,
 * drug_lic_copy). `files` is a { field: File } map.
 */
export async function registerVendor(fields, files = {}) {
  if (USE_MOCK) {
    await delay(700);
    return { success: true, message: 'Registration submitted. Approval status will be sent to your email.' };
  }
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, v);
  });
  Object.entries(files).forEach(([k, file]) => { if (file) form.append(k, file); });
  return request(ENDPOINTS.auth.registerVendor, { method: 'POST', body: form, auth: false });
}

/**
 * Password reset. The Flutter flow is complete UI with `TODO(backend)` markers —
 * there is no send-OTP / verify-OTP route on the server (analysis §9.6).
 */
export async function requestPasswordOtp() {
  throw new NotImplementedError('Password reset by OTP');
}
export async function verifyPasswordOtp() {
  throw new NotImplementedError('Password reset by OTP');
}

export async function deleteAccount() {
  if (USE_MOCK) { await delay(); return { success: true }; }
  return request(ENDPOINTS.auth.deleteAccount, { method: 'DELETE' });
}

/** Used by the mock-only dev role switcher on the login page. */
export const demoAccounts = () => ALL_VENDOR_COLLECTION;
