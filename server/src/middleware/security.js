import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { env, corsOrigins, isProduction } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const helmetMiddleware = helmet({
  contentSecurityPolicy: isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          // Signed "authenticated"-delivery URLs (see document.service.js's
          // generateSignedAccessUrl) come from Cloudinary's *api* subdomain
          // (`/v1_1/.../image/download?...`), not the `res.cloudinary.com`
          // CDN used for public assets — both need to be allowed.
          imgSrc: ["'self'", 'data:', 'blob:', 'res.cloudinary.com', 'api.cloudinary.com'],
          // Decrypted chat pictures, video and voice messages play from blob: URLs.
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", 'wss:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    : false,
  crossOriginResourcePolicy: { policy: 'same-site' },
});

// Strict, explicit-allowlist CORS — never a wildcard for an authenticated,
// cookie-based API. Requests with no Origin header (server-to-server, curl)
// are allowed through since they can't carry browser credentials anyway.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new AppError('FORBIDDEN', 'Origin not allowed by CORS policy.', 403));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id', 'Idempotency-Key'],
  maxAge: 600,
});

export function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// General API rate limit — applied globally, on top of stricter per-route
// limits for auth-sensitive endpoints (see auth routes).
// Chat has its own, more generous limit (a conversation is many small
// requests) — see chatRateLimiter below; the general limiter skips it.
export const generalRateLimiter = rateLimit({
  skip: (req) => req.originalUrl.startsWith('/api/v1/chat'),
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw AppError.tooManyRequests();
  },
});

// Stricter limiter factory for login / password reset / MFA / email
// verification — brute-force and credential-stuffing surfaces.
export function authRateLimiter(maxOverride) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: maxOverride ?? env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    // Rate-limit per IP+account-identifier pair where possible so one bad
    // actor can't lock out an entire office/NAT'd IP's login attempts alone;
    // falls back to IP if no email present in the body yet.
    keyGenerator: (req) => `${req.ip}:${req.body?.email ?? ''}`,
    handler: () => {
      throw AppError.tooManyRequests('Too many attempts. Please wait before trying again.');
    },
  });
}

// Origin/Referer check as a second CSRF layer alongside SameSite cookies and
// the csrfProtection double-submit token (see middleware/csrf.js). Cheap and
// effective against most cross-site request forgery attempts.
export function originCheckMiddleware(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !corsOrigins.includes(origin)) {
    throw AppError.forbidden('Request origin is not trusted.');
  }
  next();
}

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.chatActor?.kind ?? 'x'}:${req.chatActor?.id ?? req.ip}`,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'You are sending too fast. Please slow down.' } },
});
