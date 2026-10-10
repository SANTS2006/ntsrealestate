import axios from 'axios';
import { API_URL } from '../config/env.js';

// `withCredentials: true` sends the HttpOnly session cookie on every request
// — this is a cookie-session app, not a bearer-token app, for the browser
// client (see docs/security/authentication.md). No token is ever stored in
// localStorage/sessionStorage here.
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30_000,
});

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Echo the double-submit CSRF cookie back as a header on state-changing
// requests, matching the server's csrfProtection middleware.
apiClient.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes(config.method)) {
    const csrfToken = readCookie('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Double-clicks and impatient retries: an identical write sent again within a
// few seconds carries the SAME Idempotency-Key, so the server performs it once
// and hands the repeat the first answer. A deliberate second submission later
// (after the window) gets a new key and goes through normally.
const recentWrites = new Map();
const IDEMPOTENCY_WINDOW_MS = 8000;
apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (['get', 'head', 'options'].includes(method) || config.data instanceof FormData) return config;
  const signature = `${method}|${config.url}|${typeof config.data === 'string' ? config.data : JSON.stringify(config.data ?? {})}`;
  const now = Date.now();
  for (const [k, v] of recentWrites) if (now - v.at > IDEMPOTENCY_WINDOW_MS) recentWrites.delete(k);
  let entry = recentWrites.get(signature);
  if (!entry) {
    entry = { key: (crypto.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`), at: now };
    recentWrites.set(signature, entry);
  }
  config.headers['Idempotency-Key'] = entry.key;
  return config;
});

// Reads (GET) that fail because the server could not be reached in time —
// a free-tier server waking up, or a slow moment on the database — are tried
// again automatically (up to twice, with a pause) before the person ever
// sees an error. Writes are never retried: repeating a save could create it
// twice.
const MAX_READ_RETRIES = 2;
const isTransient = (error) => (
  !error.response || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || [502, 503, 504].includes(error.response.status)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;
    if (config && config.method === 'get' && !config.noRetry && isTransient(error) && (config.__retries ?? 0) < MAX_READ_RETRIES) {
      config.__retries = (config.__retries ?? 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 1500 * config.__retries));
      return apiClient.request(config);
    }

    // An expired session: tell the auth context so the route guard can send
    // the person to sign in (once), instead of every page showing its own error.
    if (error.response?.status === 401 && !/\/(auth|platform-admin)\//.test(error.config?.url ?? '') && !/\/login$/.test(error.config?.url ?? '')) {
      window.dispatchEvent(new Event('auth:expired'));
    }

    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    const noResponseMessage = timedOut
      ? 'This is taking longer than usual. Please wait a moment and try again.'
      : 'We could not reach the server. Please check your internet connection and try again.';
    const normalized = {
      code: error.response?.data?.error?.code ?? (timedOut ? 'TIMEOUT' : 'NETWORK_ERROR'),
      message: error.response?.data?.error?.message ?? noResponseMessage,
      statusCode: error.response?.status ?? 0,
      details: error.response?.data?.error?.details,
    };
    return Promise.reject(normalized);
  }
);
