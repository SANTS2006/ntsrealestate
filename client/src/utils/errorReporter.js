import { API_URL } from '../config/env.js';

// Sends a short, sanitised description of a front-end failure to the server's
// log (no stack traces shown to people, no tokens or form data included).
let sent = 0;
const seen = new Set();

export function reportClientError(kind, error, extra = {}) {
  try {
    const message = String(error?.message ?? error ?? 'unknown').slice(0, 300);
    const key = `${kind}:${message}`;
    if (sent >= 10 || seen.has(key)) return; // never flood the server
    seen.add(key);
    sent += 1;
    const body = JSON.stringify({
      kind, message, name: String(error?.name ?? '').slice(0, 80),
      stack: String(error?.stack ?? '').split('\n').slice(0, 6).join('\n').slice(0, 1200),
      path: window.location.pathname, ...extra,
    });
    if (navigator.sendBeacon) navigator.sendBeacon(`${API_URL}/client-errors`, new Blob([body], { type: 'application/json' }));
    else fetch(`${API_URL}/client-errors`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    // reporting must never throw
  }
}

// Anything that escapes a component: runtime errors, rejected promises that
// nobody handled, and failed chunk preloads. They are logged here; what the
// person sees is decided by the ErrorBoundary.
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportClientError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportClientError('unhandledrejection', e.reason));
  window.addEventListener('vite:preloadError', (e) => reportClientError('preloadError', e.payload ?? 'preload failed'));
}
