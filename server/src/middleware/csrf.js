import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// CSRF strategy: double-submit cookie, layered on top of SameSite=Lax session
// cookies and the Origin check in middleware/security.js. Rationale: the
// session cookie is HttpOnly (can't be read by JS to forge the header), so a
// second, readable cookie carries the token that the client must echo back
// in a custom header — an attacker's cross-site form can't read or set that
// header, only same-origin JS can.
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = randomUUID();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // must be readable by client JS to echo back in the header
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies[CSRF_COOKIE];
  }
  next();
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a ?? '');
  const bufB = Buffer.from(b ?? '');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Applied only to session-authenticated, state-changing routes (JWT/API
// clients are exempt — they don't carry ambient cookie credentials, so
// they're not vulnerable to CSRF in the same way).
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw AppError.forbidden('Invalid or missing CSRF token.');
  }
  next();
}
