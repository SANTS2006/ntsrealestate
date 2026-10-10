import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../auth/jwt.js';
import { findUserByIdUnscoped, findAuthContext } from '../repositories/user.repository.js';

const ABSOLUTE_TIMEOUT_MS = env.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;

// Populates req.user = { id, organizationId, roles, authMethod } from
// whichever credential is present — a session cookie (browser) or a
// `Authorization: Bearer` JWT (mobile/external API). See
// docs/security/authentication.md for which clients use which. Re-fetches
// the user's live status/roles from the database on every request rather
// than trusting stale session/token data, so a deactivated account or a
// role change take effect immediately rather than only after the session or
// access token expires.
export const authenticate = asyncHandler(async (req, res, next) => {
  // Several routers are mounted at the API root and each starts with
  // `authenticate`, so one request can pass through it many times — sign the
  // caller in once and let every later check reuse the result.
  if (req.user) return next();

  if (req.session?.userId) {
    if (Date.now() - (req.session.loginAt ?? 0) > ABSOLUTE_TIMEOUT_MS) {
      return req.session.destroy(() => next(AppError.unauthorized('Your session has expired. Please sign in again.')));
    }

    const user = await findAuthContext(req.session.userId);
    if (user?.status === 'inactive') {
      return req.session.destroy(() => next(AppError.forbidden('Your account has been deactivated. Please contact your administrator.')));
    }
    if (!user || user.status !== 'active' || user.organizationId !== req.session.organizationId) {
      return req.session.destroy(() => next(AppError.unauthorized('Your session is no longer valid. Please sign in again.')));
    }

    if (user.orgStatus !== 'active') {
      return req.session.destroy(() => next(AppError.forbidden('This company has been deactivated and all access has been revoked. Please contact the platform administrator.')));
    }

    // A person can hold several roles. Until they pick one (see POST
    // /auth/active-role) they act with all of them together; once they do,
    // only that role's permissions apply.
    const assignedRoles = user.roles ?? [];
    const active = req.session.activeRole;
    const roles = active && assignedRoles.includes(active) ? [active] : assignedRoles;
    req.user = { id: user.id, organizationId: user.organizationId, roles, assignedRoles, activeRole: roles.length === 1 && assignedRoles.length > 1 ? roles[0] : null, authMethod: 'session' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice('Bearer '.length));
    const user = await findUserByIdUnscoped(payload.sub);
    if (!user || user.status !== 'active' || user.organizationId !== payload.org) {
      throw AppError.unauthorized('This access token is no longer valid.');
    }
    req.user = { id: user.id, organizationId: user.organizationId, roles: payload.roles ?? [], authMethod: 'jwt' };
    return next();
  }

  throw AppError.unauthorized();
});

// Lightweight variant for endpoints (like GET /auth/me) that should behave
// differently for anonymous vs authenticated callers without hard-failing —
// still re-validates, just doesn't throw when nothing is presented.
export const authenticateOptional = asyncHandler(async (req, res, next) => {
  if (!req.session?.userId && !req.headers.authorization) return next();
  return authenticate(req, res, next);
});
