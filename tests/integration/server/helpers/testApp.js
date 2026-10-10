import supertest from 'supertest';
import { createApp } from '../../../../server/src/app.js';
import { prisma } from '../../../../server/src/config/database.js';

// One real Express app instance, exercised in-process by supertest (no
// port bound, no separate server process) — every integration/security
// test in this suite hits the actual middleware pipeline (Helmet, CORS,
// CSRF, rate limiting, auth, authorize, validate) exactly as it runs in
// production, against the real Neon database configured in server/.env.
// There is no mocking layer here by design: the whole point of this suite
// is to prove the real request pipeline enforces what docs/security claims
// it does.
export const app = createApp();

// Each simulated "browser" gets its own cookie jar (session + CSRF), the
// same way two different people opening the app in two different browsers
// would — `supertest.agent()` persists Set-Cookie across requests
// automatically. Use `newAgent()` once per test user/session, never share
// one across users (that would be testing something that can't happen in
// the real app: two people sharing a session cookie).
export function newAgent() {
  return supertest.agent(app);
}

// The CSRF cookie is deliberately NOT HttpOnly (see middleware/csrf.js) —
// real client JS reads it to mirror into the X-CSRF-Token header on
// state-changing requests. supertest's agent resends the *cookie*
// automatically, but doesn't know to mirror its value into a header, so
// tests do that explicitly after any response that sets/refreshes it.
export function extractCsrfToken(res) {
  return extractCookie(res, 'csrf_token');
}

// Generic Set-Cookie value reader — used wherever a test needs a cookie's
// actual value (not just "was it set"), e.g. to confirm the session cookie
// changes after login (session-fixation resistance). Reading it off the
// response headers directly is more robust than reaching into superagent's
// internal cookie-jar implementation.
export function extractCookie(res, name) {
  const setCookie = res.headers['set-cookie'] || [];
  for (const raw of setCookie) {
    const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(raw);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Convenience: GET a cheap endpoint to obtain (or refresh) the CSRF cookie
// on a fresh agent, returning the token to use as X-CSRF-Token going
// forward. Real clients get this the same way — any response issues it.
export async function primeCsrf(agent) {
  const res = await agent.get('/api/v1/health');
  return extractCsrfToken(res);
}

export { prisma };
