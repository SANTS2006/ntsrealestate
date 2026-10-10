import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// JWT is used only for mobile / external-API / service-to-service auth — the
// browser app uses cookie sessions instead (see docs/security/authentication.md).
// No PII or permissions are embedded in the payload: permissions are always
// re-derived server-side from `roles`/DB state at request time.

export function signAccessToken({ userId, organizationId, roles }) {
  return jwt.sign(
    { sub: userId, org: organizationId, roles },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: randomUUID(),
    }
  );
}

export function signRefreshToken({ userId, familyId }) {
  return jwt.sign(
    { sub: userId, fam: familyId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: randomUUID(),
    }
  );
}

export function verifyAccessToken(token) {
  try {
    // Algorithm is pinned explicitly — never trust the token's own `alg`
    // header (defends against alg-confusion / "none" algorithm attacks).
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch {
    throw AppError.unauthorized('Invalid or expired access token.');
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token.');
  }
}

// Short-lived (5 min) single-purpose ticket issued after a password check
// succeeds for an MFA-enabled account, and required to complete
// POST /auth/mfa/challenge. Signed with the access-token secret but scoped
// with `purpose` so it can never be accepted anywhere a real access token is
// expected, and vice versa.
export function signMfaChallengeToken(userId) {
  return jwt.sign({ sub: userId, purpose: 'mfa_challenge' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyMfaChallengeToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch {
    throw AppError.unauthorized('This MFA challenge has expired. Please sign in again.');
  }
  if (payload.purpose !== 'mfa_challenge') throw AppError.unauthorized('Invalid MFA challenge.');
  return payload;
}
