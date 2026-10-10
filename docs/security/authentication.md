# Authentication Architecture

## 1. Hybrid model

| Client                          | Mechanism            | Storage                              |
|----------------------------------|-----------------------|----------------------------------------|
| Web browser (management portal) | Server-side session   | HttpOnly, Secure, SameSite=Lax cookie  |
| Mobile app (future)              | JWT (access+refresh) | Secure device storage (Keychain/Keystore) |
| External API consumers           | JWT (client-credentials-style) | N/A — bearer header per request |
| Service-to-service (internal jobs) | Signed internal token / direct DB access | N/A |

The browser app **never** uses JWT for its own session; JWT never touches `localStorage`.
This avoids XSS-based token theft for the primary attack surface (the browser).

## 2. Session authentication (browser)

```
POST /api/v1/auth/login
  → verify email+password (Argon2id) against users.password_hash
  → check account status (active, not locked, email_verified per policy)
  → check MFA (if enabled, require a second step before session is fully authenticated)
  → regenerate session ID (prevents session fixation)
  → store { userId, organizationId, roles[] } in session
  → set cookie: HttpOnly, Secure (prod), SameSite=Lax, maxAge = idle timeout
```

- Sessions are persisted in Postgres via `connect-pg-simple` (same Neon database, separate
  `session` table) — no Redis, no in-memory store (which would break horizontal scaling and
  leak sessions on restart).
- **Rotation**: session ID is regenerated on login and on privilege change (role/permission
  update, password change) to prevent fixation and stale-privilege sessions.
- **Idle timeout**: default 30 minutes of inactivity; **absolute timeout**: 12 hours, after
  which re-authentication is required regardless of activity.
- **Invalidation**: logout destroys the server-side session record (not just the cookie).
  "Log out everywhere" deletes all session rows for the user ID.
- **Re-authentication**: sensitive operations (password change, MFA changes, deleting
  financial records) require a fresh credential check within the last N minutes
  ("recent authentication"), independent of session validity.

## 3. JWT authentication (mobile / external API / services)

- **Access token**: short-lived (15 min), signed HS256/RS256 (`JWT_ACCESS_SECRET`), claims:
  `sub` (user id), `org` (organization id), `roles`, `iat`, `exp`, `iss`, `aud`, `jti`.
  No PII, no permissions list (permissions are re-derived server-side from roles at request
  time — never trusted from the token).
- **Refresh token**: longer-lived (7–30 days), stored hashed in the database (rotation table)
  so it can be revoked; rotated on every use (refresh token reuse detection → revoke chain).
- Every JWT is validated for `iss`, `aud`, `exp`, `nbf`, and signature before any claim is
  trusted. Algorithm is pinned server-side (no `alg: none`, no algorithm confusion).
- Revocation: refresh tokens are revocable via the database; access tokens are short-lived
  enough that revocation-on-read is not required, but a `jti` blocklist hook exists for
  emergency revocation.

## 4. Password security

- Hashing: **Argon2id** (via `argon2` npm package), tuned parameters (memory/time cost) set
  in `server/src/config/security.js`.
- Policy: minimum length 12, checked against common-password/breach patterns at signup;
  strength feedback returned to the client (zxcvbn-style scoring), never silently rejected
  without reason.
- Reset flow: single-use, time-limited (15 min) token, hashed at rest, invalidated after use
  or password change; generic response regardless of whether the email exists (anti-
  enumeration).
- Login throttling: progressive delay + IP/account rate limiting (see
  [security-architecture.md](security-architecture.md#rate-limiting)); failed attempts are
  audit-logged without ever logging the submitted password.

## 5. MFA (TOTP)

- Enrollment: server generates a TOTP secret + recovery codes (hashed at rest); the secret
  is shown once at enrollment (QR + manual entry), never retrievable afterward.
- Verification: 6-digit code, 30s window, ±1 step clock skew tolerance.
- Recovery codes: single-use, hashed, regenerated on demand (invalidating unused ones).
- Removal: requires recent re-authentication + (if enabled) a valid MFA code.

## 6. Email verification & account lifecycle

- New accounts start `status = pending` until email is verified via single-use token.
- Deactivation is soft (`status = inactive`) — never a hard delete of a user with historical
  financial/audit records attached.
