// =============================================================================
// HTTP client — the ONE place a network request is made.
//
// AUTH: the Authorization: Bearer header, not the cookie. The Flutter app
// prefers the same path and documents why (lib/services/auth_service.dart):
// browsers don't expose Set-Cookie to JS, and the server's CORS setup does not
// send credentials (see PROJECT_ANALYSIS.md §9.11). The server's
// isAuthenticated middleware accepts either.
//
// SESSION EXPIRY: the JWT lives 1 day (7 for outlets). A 401 on an
// authenticated call means the token is gone or invalid; the client clears it
// and raises `auth:unauthorized`, which AuthProvider turns into a redirect to
// /login. No page has to know.
// =============================================================================

import { apiUrl } from '../config/api';

const TOKEN_KEY = 'vsa.web.token';

/** Dispatched on window when the server rejects the session token. */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode / storage disabled — the session simply won't survive a reload.
  }
}

export function getAuthToken() {
  if (authToken) return authToken;
  try {
    authToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

/** A failure that carries a message safe to show a user. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Marks a flow the backend does not implement yet (analysis §9). */
export class NotImplementedError extends ApiError {
  constructor(what) {
    super(`${what} has no backend endpoint yet.`, { code: 'NOT_IMPLEMENTED' });
    this.name = 'NotImplementedError';
  }
}

const TIMEOUT_MS = 45000; // Render free tier pays a cold start, same as the app.

/**
 * Reads the body as JSON. A non-JSON body (Express's HTML 404 for an unknown
 * route, a gateway timeout page) resolves to null on an error status — the
 * status carries the meaning — and throws BAD_RESPONSE on a 2xx, where JSON
 * was owed.
 */
async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) return null;
    throw new ApiError('The server sent an unexpected response. Please try again in a moment.', {
      status: response.status,
      code: 'BAD_RESPONSE',
    });
  }
}

/** Builds the fetch init every request shares (headers, body encoding, abort). */
function buildInit({ method, body, headers, auth, signal }) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const token = auth ? getAuthToken() : null;
  return {
    method,
    signal,
    headers: {
      ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  };
}

/** One fetch with the shared timeout and the NETWORK / TIMEOUT error mapping. */
async function send(path, init, { timeoutMs = TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    return await fetch(apiUrl(path), { ...init, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.', { code: 'TIMEOUT' });
    }
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }
}

function raiseUnauthorized() {
  setAuthToken(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

/**
 * Issues one request. `body` may be a plain object (sent as JSON) or a
 * FormData (sent as multipart — the Content-Type header is left to the browser
 * so the boundary is correct).
 *
 * `timeoutMs` lets slow routes (confirm-order renders a PDF through Puppeteer)
 * wait longer than the default, exactly as the app does.
 */
export async function request(path, {
  method = 'GET', body, headers = {}, auth = true, signal, timeoutMs,
} = {}) {
  const response = await send(path, buildInit({ method, body, headers, auth, signal }), { timeoutMs, signal });
  const payload = await parse(response);

  if (response.status === 401 && auth && getAuthToken()) {
    raiseUnauthorized();
    throw new ApiError('Your session has expired. Please sign in again.', {
      status: 401, code: 'UNAUTHORIZED', body: payload,
    });
  }

  if (!response.ok) {
    const fallback = response.status === 404 ? 'This feature is not available on the server.' : `Request failed (${response.status})`;
    throw new ApiError(payload?.message || fallback, {
      status: response.status,
      code: 'HTTP',
      body: payload,
    });
  }
  // The backend answers 200 with { success: false } on business failures.
  if (payload && payload.success === false) {
    throw new ApiError(payload.message || 'Request failed.', { status: response.status, code: 'BUSINESS', body: payload });
  }
  return payload;
}

/**
 * Fetches a binary document (the .xlsx reports) with the session header and
 * returns it as a Blob. Errors come back as JSON and are mapped like `request`.
 */
export async function requestBlob(path, { auth = true, timeoutMs } = {}) {
  const response = await send(path, buildInit({ method: 'GET', auth, headers: {} }), { timeoutMs });
  if (response.status === 401 && auth && getAuthToken()) {
    raiseUnauthorized();
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401, code: 'UNAUTHORIZED' });
  }
  if (!response.ok) {
    const payload = await parse(response).catch(() => null);
    throw new ApiError(payload?.message || `Download failed (${response.status})`, { status: response.status, code: 'HTTP' });
  }
  return response.blob();
}

/**
 * For a route that answers EITHER with JSON or with a 302 to a hosted file
 * (GET /prev-invoice/:id). The browser follows the redirect itself, so the
 * result is `{ payload }` for JSON or `{ redirectedTo }` for the file's URL.
 * A 404 (nothing to fetch yet) resolves to `{}`.
 */
export async function requestJsonOrRedirect(path, { auth = true, timeoutMs } = {}) {
  const response = await send(path, buildInit({ method: 'GET', auth, headers: {} }), { timeoutMs });
  if (response.redirected) return { redirectedTo: response.url };
  if (response.status === 401 && auth && getAuthToken()) {
    raiseUnauthorized();
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401, code: 'UNAUTHORIZED' });
  }
  if (response.status === 404) return {};
  const payload = await parse(response);
  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, { status: response.status, code: 'HTTP' });
  }
  return { payload };
}

export const get = (path, opts) => request(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
export const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body });
export const patch = (path, body, opts) => request(path, { ...opts, method: 'PATCH', body });
export const del = (path, opts) => request(path, { ...opts, method: 'DELETE' });
