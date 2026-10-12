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
//
// Server contracts (controller/userController.js, deliveryagentController.js,
// outletController.js):
//   /login        {mobile_no, password} → {success, role, token, id, pincode, name}
//   /agent-login  {mobile, password}    → {success, role:"delivery", token, name}
//   /outlet-login {mobileNo, password}  → {success, role:"outlet", token, outlet}
// =============================================================================

import ENDPOINTS from '../config/api';
import { post, put, request, setAuthToken, getAuthToken, ApiError } from './http';
import { normalizeRole, ROLES } from '../constants/roles';

const SESSION_KEY = 'vsa.web.session';

/** The session shape every consumer reads. */
function toSession({ role, id, name, mobile, email, token, pincode, outlet, vendorType, shopType, approvalStatus }) {
  return {
    role: normalizeRole(role),
    rawRole: role,
    id,
    name,
    mobile: mobile || null,
    email: email || null,
    token,
    pincode: pincode || null,
    // Buyer type. The catalogue prices one product three ways (base /
    // drDisPercent / wholesellerPercent) and the rate card is chosen from these
    // two fields — there is no "my profile" endpoint to fetch them from, so
    // they have to ride along with the session (see utils/pricing.js).
    vendorType: vendorType || null,
    shopType: shopType || null,
    approvalStatus: approvalStatus || null,
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
    // A session without its token (cleared after a 401) is not a session.
    if (!session?.token && !getAuthToken()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    setAuthToken(session?.token || null);
    return session;
  } catch {
    return null;
  }
}

export const clearSession = () => saveSession(null);

// -----------------------------------------------------------------------------

/** Session from a /login or /eotp-verify body (Vendor collection: staff + buyers). */
const vendorSession = (body, mobile) => toSession({
  role: body.role || ROLES.VENDOR,
  id: body.id,
  name: body.name || body.store_name || body.contact_person_name,
  mobile: mobile || body.mobile_no,
  email: body.email,
  token: body.token,
  pincode: body.pincode,
  vendorType: body.vendor_type,
  shopType: body.shop_type,
  approvalStatus: body.approvalStatus,
});

/** Session from an /outlet-login (or /eotp-verify for an outlet) body. */
const outletSession = (body, mobile) => toSession({
  role: body.role || ROLES.OUTLET,
  id: body.outlet?._id || body.id,
  name: body.outlet?.outletName || body.name,
  mobile: mobile || body.outlet?.mobileNo,
  email: body.email || body.outlet?.email,
  token: body.token,
  pincode: body.outlet?.pincode || body.pincode,
  outlet: body.outlet,
});

const stopsCascade = (err) => err.code === 'NETWORK' || err.code === 'TIMEOUT' || err.code === 'BAD_RESPONSE';

async function loginLive(mobile, password) {
  // 1 — Vendor collection.
  let firstError;
  try {
    const body = await post(ENDPOINTS.auth.login, { mobile_no: mobile, password }, { auth: false });
    return vendorSession(body, mobile);
  } catch (err) {
    if (stopsCascade(err)) throw err;
    // A pending / rejected vendor is told so (403) — do not mask it with the
    // outlet collection's generic "Data mismatch".
    if (err.status === 403) throw err;
    firstError = err;
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
    if (stopsCascade(err)) throw err;
  }

  // 3 — Outlet collection.
  try {
    const body = await post(ENDPOINTS.outlet.login, { mobileNo: mobile, password }, { auth: false });
    return outletSession(body, mobile);
  } catch (err) {
    if (stopsCascade(err)) throw err;
    // Surface the Vendor collection's verdict — it is the one the user expects.
    throw new ApiError(
      firstError?.message?.trim() === 'User not found' ? 'No account found for this mobile number.' : 'Mobile number or password is incorrect.',
      { code: 'BUSINESS', status: 401 },
    );
  }
}

export async function login({ mobile, password }) {
  const session = await loginLive(mobile, password);
  saveSession(session);
  return session;
}

// --- Email one-time-code sign-in --------------------------------------------
//
// routes/eotpRoute.js. The code is mailed by the server (10-minute TTL, five
// attempts) and /eotp-verify answers with the SAME body as /login, so the two
// sign-in paths produce an identical session.
//
// /eotp deliberately answers 200 even for an address with no account — it must
// not reveal which emails are registered. The "no account" verdict therefore
// only arrives at the verify step (404).

export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 30;

/** Mails a code to `email`. Resolves once the server has accepted the request. */
export async function requestLoginOtp(email) {
  // The server sends the mail INSIDE the request, so this waits on SMTP (plus a
  // cold start on a sleeping host). Far longer than the default timeout — a
  // slow mail server must not look like a failure to the person signing in.
  return post(
    ENDPOINTS.emailOtp.send,
    { email: String(email).trim().toLowerCase() },
    { auth: false, timeoutMs: 120000 },
  );
}

/** Verifies the code and opens a session — the same shape `login` returns. */
export async function loginWithOtp({ email, otp }) {
  const address = String(email).trim().toLowerCase();
  const body = await post(ENDPOINTS.emailOtp.verify, { email: address, otp }, { auth: false });
  const session = body.outlet ? outletSession(body) : vendorSession(body);
  saveSession(session);
  return session;
}

export async function logout() {
  try { await post(ENDPOINTS.auth.logout); } catch { /* the local session is cleared regardless */ }
  clearSession();
}

/**
 * Vendor KYC registration (multipart on the server: gst_pdf, store_pic,
 * drug_lic_copy). `files` is a { field: File } map.
 */
export async function registerVendor(fields, files = {}) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') form.append(k, v);
  });
  Object.entries(files).forEach(([k, file]) => { if (file) form.append(k, file); });
  // Three Cloudinary uploads + an email — give it the long timeout.
  return request(ENDPOINTS.auth.registerVendor, { method: 'POST', body: form, auth: false, timeoutMs: 90000 });
}

/**
 * PUT /update-password.
 *
 * Serves both flows, because both end with the same proof of ownership:
 *   • Change password  — signed in, sends `currentPassword`.
 *   • Forgot password  — signed in by email OTP first, sends no current one.
 */
export async function updatePassword({ newPassword, currentPassword }) {
  return put(ENDPOINTS.auth.updatePassword, {
    newPassword,
    ...(currentPassword === undefined ? {} : { currentPassword }),
  });
}

/**
 * Forgot password: prove the address by OTP (which signs the account in), then
 * set the new password with that session. Returns the session it opened.
 */
export async function resetPasswordWithOtp({ email, otp, newPassword }) {
  const session = await loginWithOtp({ email, otp });
  await updatePassword({ newPassword });
  return session;
}

/** DELETE /vendor-delete — the signed-in account deletes itself. */
export async function deleteAccount() {
  return request(ENDPOINTS.auth.deleteAccount, { method: 'DELETE', body: { confirm: true } });
}
