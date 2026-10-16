import { AsyncLocalStorage } from 'node:async_hooks';
import { env, isProduction } from '../config/env.js';

// The address people use to reach the app, for links in emails. In production
// a CLIENT_URL that still points at localhost (a forgotten setting) must never
// reach an email, so we fall back to what the host reports (RENDER_EXTERNAL_URL)
// and then to the address the current request actually came in on.
const store = new AsyncLocalStorage();

export function requestOriginMiddleware(req, res, next) {
  const host = req.get('host');
  store.run({ origin: host ? `${req.protocol}://${host}` : null }, next);
}

const isLocal = (url) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url ?? '');
const clean = (url) => (url ? String(url).replace(/\/+$/, '') : null);

export function appBaseUrl() {
  const configured = clean(env.CLIENT_URL);
  if (!isProduction || (configured && !isLocal(configured))) return configured;
  const origin = clean(store.getStore()?.origin);
  return clean(process.env.RENDER_EXTERNAL_URL) ?? (origin && !isLocal(origin) ? origin : null) ?? configured;
}
