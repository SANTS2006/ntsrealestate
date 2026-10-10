# Threat Model — NTS Real Estate System

## 1. Assets

- Tenant PII (contact info, ID documents, emergency contacts)
- Owner PII and financial payout information
- Financial records (invoices, payments, expenses) — integrity-critical
- Lease agreements and property ownership documents
- Credentials (password hashes, session data, MFA secrets, JWT signing keys)
- Cloudinary API secret, Neon connection string, SMTP credentials
- Audit trail integrity

## 2. Actors

| Actor | Trust level |
|---|---|
| Super Admin | Platform-trusted, cross-org |
| Org Admin / Property Manager / Accountant / Maintenance Mgr / Agent | Org-trusted, scoped |
| Owner / Tenant | Low-trust, self-scoped only |
| Auditor | Read-only, org-scoped |
| Unauthenticated visitor | Untrusted |
| External attacker | Untrusted, adversarial |
| Malicious insider (any authenticated role) | Adversarial, authenticated |

## 3. Trust boundaries

```
[Browser] ---- HTTPS ----> [Express API] ---- TLS ----> [Neon Postgres]
                                  |---------- TLS ----------> [Cloudinary]
                                  |---------- TLS ----------> [SMTP provider]
```

Every arrow is a trust boundary crossing: input arriving from the left of an arrow is
untrusted until validated on the right.

## 4. STRIDE-style threats & mitigations

| Threat | Attack surface | Mitigation |
|---|---|---|
| Spoofing | Login, JWT | Argon2id, MFA, JWT signature+iss/aud/exp validation, session rotation |
| Tampering | Financial fields, request bodies | Server-side authoritative calculation, Zod schemas, mass-assignment allow-lists, DB constraints/transactions |
| Repudiation | Financial/admin actions | `audit_logs` on every mutating action, immutable (no update/delete API on audit rows) |
| Information disclosure | Cross-org data, documents, error messages | Org-scoped repositories, authenticated Cloudinary delivery + signed URLs, centralized error handler stripping stack traces/internal detail in prod |
| Denial of service | Login endpoint, uploads, search | Rate limiting (stricter on auth), file size caps, paginated queries, connection pool limits |
| Elevation of privilege | Role/permission editing, self-role-change | Server-authoritative role checks, explicit block on self-role-escalation, permission checks re-derived per request (not cached in session across a role change) |

## 5. Specific attack scenarios

- **IDOR on documents/invoices/leases** — mitigated by loading the row with a mandatory
  `organization_id` filter before any authorization decision; mismatched org → 404.
- **Malicious file upload (webshell disguised as image)** — magic-byte validation +
  Cloudinary never executes uploaded content + `raw` resource type for non-image/video
  documents is served as a download, not executed.
- **SQL injection** — Prisma parameterizes all queries; raw SQL (if ever used for reporting)
  goes through `Prisma.sql` tagged templates only, never string concatenation.
- **CSRF against session cookie** — `SameSite=Lax` + explicit CSRF token on state-changing
  requests + Origin header check (see security-architecture.md §CSRF).
- **JWT `alg:none` / confusion** — algorithm pinned server-side in verify options; library
  (`jsonwebtoken`/`jose`) configured to reject `none` and mismatched algorithms.
- **Session fixation** — session ID regenerated on login and privilege change.
- **Enumeration via password reset / login errors** — generic responses regardless of
  account existence.
- **Prototype pollution** — `Object.create(null)` / structured Zod parsing instead of
  raw `Object.assign(target, req.body)`; body size limits; no unguarded `_.merge` on
  user input.
- **Orphaned Cloudinary assets from failed deletes** — tracked via `status` field + retry job
  (see cloudinary-security.md §5), not "fire and forget."

## 6. Out of scope (documented, not implemented, until justified)

- Redis-backed caching/session store (no measured need yet — see authentication.md)
- Full Row-Level Security enforcement (designed, staged rollout — see authorization.md §5)
- SMS notifications (architecture allows it; no provider integrated yet)
