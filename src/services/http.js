// =============================================================================
// HTTP client — the ONE place a network request is made.
//
// While USE_MOCK is true nothing here reaches the network: every service
// resolves from src/mock/ instead. Set VITE_USE_MOCK=false and the same service
// functions start issuing real requests against the existing self/server
// backend. No component changes.
//
// AUTH: the Authorization: Bearer header, not the cookie. The Flutter app
// prefers the same path and documents why (lib/services/auth_service.dart):
// browsers don't expose Set-Cookie to JS, and the server's CORS setup does not
// send credentials (see PROJECT_ANALYSIS.md §9.11).
// =============================================================================

import { apiUrl, USE_MOCK } from '../config/api';

const TOKEN_KEY = 'vsa.web.token';

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

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A gateway timeout or a crashed route answers with HTML, not JSON.
    throw new ApiError('The server sent an unexpected response. Please try again in a moment.', {
      status: response.status,
      code: 'BAD_RESPONSE',
    });
  }
}

/**
 * Issues one request. `body` may be a plain object (sent as JSON) or a
 * FormData (sent as multipart — the Content-Type header is left to the browser
 * so the boundary is correct).
 */
export async function request(path, { method = 'GET', body, headers = {}, auth = true, signal } = {}) {
  if (USE_MOCK) {
    throw new ApiError(
      'HTTP is disabled while the site runs on mock data. Set VITE_USE_MOCK=false to go live.',
      { code: 'MOCK_MODE' },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const token = auth ? getAuthToken() : null;

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal: controller.signal,
      headers: {
        ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.', { code: 'TIMEOUT' });
    }
    throw new ApiError('Cannot reach the server. Check your connection and try again.', { code: 'NETWORK' });
  }
  clearTimeout(timer);

  const payload = await parse(response);

  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, {
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

export const get = (path, opts) => request(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
export const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body });
export const del = (path, opts) => request(path, { ...opts, method: 'DELETE' });

export { USE_MOCK };
