# Security Architecture — Overview

This is the index for the NTS Real Estate System's security design. Read alongside:
[authentication.md](authentication.md), [authorization.md](authorization.md),
[cloudinary-security.md](cloudinary-security.md), [threat-model.md](threat-model.md).

## Middleware pipeline (`server/src/app.js`)

```
requestId → structured request log (pino-http) → Helmet → CORS (allowlist)
  → Origin check → global rate limiter → JSON body parser (1mb limit)
  → cookie parser → session (Postgres-backed) → CSRF token issuance
  → [route: auth/authz/validation/controller] → error handler
```

## Controls implemented at Phase 1–3 (foundation)

| Control | Where |
|---|---|
| Security headers (HSTS, CSP, no-sniff, frame-deny, etc.) | `middleware/security.js` (Helmet) |
| Strict CORS allowlist, credentials-aware | `middleware/security.js` |
| Origin/Referer check (defense-in-depth CSRF layer) | `middleware/security.js` |
| Double-submit CSRF token | `middleware/csrf.js` |
| Global + auth-specific rate limiting | `middleware/security.js` |
| Structured logging with secret redaction | `config/logger.js` |
| Centralized error handling — no stack/SQL leakage in prod | `middleware/errorHandler.js` |
| Env validation fail-fast (no silent default secrets) | `config/env.js` |
| Postgres-backed sessions, HttpOnly/Secure/SameSite cookies | `config/session.js` |
| Request-size limits | `app.js` |

## Controls implemented at Phase 4 (authentication)

| Control | Where |
|---|---|
| Argon2id password hashing + server-side policy enforcement | `auth/password.js` |
| Session-based login with fixation-resistant regeneration, idle + absolute timeout | `services/auth.service.js`, `middleware/auth.js` |
| Progressive account lockout (5 failed attempts → 15 min lock) layered on IP+email rate limiting | `services/auth.service.js`, `routes/v1/auth.routes.js` |
| MFA: TOTP enrollment/challenge, AES-256-GCM-encrypted secret at rest, hashed single-use recovery codes | `auth/mfa.js`, `auth/crypto.js` |
| JWT for mobile/API: short-lived access tokens, rotating refresh tokens with theft/reuse detection revoking the whole token family | `auth/jwt.js`, `repositories/refreshToken.repository.js` |
| Email verification & password reset via single-use, hashed, time-limited tokens; anti-enumeration generic responses | `services/auth.service.js` |
| "Recent authentication" re-check (current password) before password change / MFA disable | `services/auth.service.js` |
| "Log out everywhere" — destroys all Postgres-backed sessions + revokes all refresh tokens for a user | `config/session.js`, `services/auth.service.js` |
| Default RBAC role bootstrap (8 standard roles, ~90-permission catalog) on organization registration | `services/role.service.js`, `constants/permissions.js` |
| Audit logging on every auth-sensitive action (login, MFA, password change, etc.) | `services/audit.service.js` |

Verified end-to-end against a live Neon database: registration → email verification →
session login → MFA enrollment/challenge → JWT issuance → refresh rotation → reuse
detection revoking the token family → CSRF rejection → account lockout.

## Controls implemented at Phase 5 (authorization)

| Control | Where |
|---|---|
| `requirePermission`/`requireAnyPermission` middleware — re-derives the caller's effective permissions from live DB state on every request (never cached in session/JWT) | `middleware/authorize.js`, `services/authorization.service.js` |
| Organization-scoped queries via explicit `organizationId` parameters throughout the repository layer (`/users`, `/organizations`, `/roles`) | `repositories/*.js` |
| IDOR-safe lookups — a mismatched org returns 404, never 403 (doesn't confirm existence) | `repositories/user.repository.js` (`findUserById`) |
| Self-service restrictions: a user cannot change their own status or role | `services/user.service.js` |
| Mass-assignment protection — explicit field allow-lists in every update; the organization-update schema uses Zod `.strict()` to reject (422) unrecognized body keys outright rather than silently drop them | `repositories/organization.repository.js`, `validators/organization.validators.js` |
| Verified live: a role change takes effect on an already-open session's very next request, with no re-login required | — |

Verified end-to-end against a live Neon database: two organizations, an admin inviting a
user by role, an unprivileged role correctly denied `users:read`/`users:invite`/
`organizations:read`, self-role/self-status changes rejected, and a live role promotion
taking effect on an existing session immediately.

**Bug found and fixed during this pass:** invited users could never log in — they were
created with `status: 'pending'` (no separate email-verification step exists for invites),
and nothing ever flipped them to `active`. Completing the emailed "set your password" link
now activates a pending account (proof of email ownership), guarded at the database level
(`WHERE status = 'pending'`) so it can never reactivate an account an admin deliberately
deactivated.

## Controls implemented at Phase 6 (Cloudinary document storage)

| Control | Where |
|---|---|
| Every asset uploaded as Cloudinary `type: authenticated` — the raw delivery URL is inert without a valid signature | `integrations/cloudinary/uploadService.js` |
| Server-side file validation: magic-byte sniffing (not extension/declared-type), cross-checked against the client's declared MIME type and filename extension; per-category size caps | `integrations/cloudinary/fileValidation.js` |
| Filename sanitization (path-traversal and control-character stripping) before it ever reaches a Cloudinary `public_id` or gets stored | `integrations/cloudinary/fileValidation.js` |
| Folder path built entirely from trusted, server-derived context (`organizationId`/`entityType`/`entityId` already authorized) — never from a client-supplied path | `integrations/cloudinary/uploadService.js` |
| Pluggable entity-ownership resolver — an upload target must be confirmed to belong to the caller's organization before any file touches Cloudinary; a mismatch is a 404, matching the IDOR convention everywhere else | `services/documentEntityResolver.js` |
| Time-boxed (5 min) signed access URLs, generated only after a full authorization check on the specific document row | `services/document.service.js` |
| Deletion always attempts real Cloudinary cleanup; on failure the row is kept as `deletion_failed` (excluded from every listing/access query) rather than either silently orphaning the asset or silently losing the record | `services/document.service.js` |
| Multer memory storage only — an uploaded file is never written to local disk | `middleware/upload.js` |

Verified end-to-end against the real Cloudinary account: upload → signed access URL returns
byte-identical content → the same asset's **unsigned** delivery URL returns 401 → a
**tampered signature** returns 401 → cross-organization access to both an existing
document (read) and an upload target (write) returns 404 → a text file renamed to `.png`
is rejected → a real PNG declared as `application/pdf` is rejected → deleting a document
is confirmed (via the Cloudinary Admin API directly) to actually remove the asset, not
leave it orphaned → a role lacking `documents:create` is denied upload while a role with
only `documents:read` can still list.

## Controls implemented at Phase 7 (core property/tenant/lease modules)

| Control | Where |
|---|---|
| Resource-level authorization layered on top of `requirePermission`: assignment-scoped (property_manager/agent — via `PropertyAssignment`), ownership-scoped (owner — via `Owner.userId`), self-scoped (tenant — via `Tenant.userId`), org-wide (administrator/accountant/maintenance_manager/auditor) | `services/resourceAccess.service.js` |
| Every denial from the above is a 404, never a 403 — matches the IDOR-safe convention everywhere else in the codebase | `services/resourceAccess.service.js` |
| No-double-booking business rule enforced in TWO independent layers: an application-level check-then-act inside a transaction, and the database-level partial unique index (`leases_unit_id_active_unique`) as a second line of defense against a race between concurrent activations | `services/lease.service.js` |
| Lease renewal never mutates a historical record in place — it closes the old row out as `renewed` and creates a new `active` row, preserving what was actually agreed at each point in time | `services/lease.service.js` |
| A lease in `terminated`/`expired`/`renewed` status is immutable — edits are rejected | `services/lease.service.js` |
| Unit `occupied` status is never client-settable directly — it's a side effect of lease activation/termination only | `services/unit.service.js` |
| Document uploads/downloads/deletes attached to a property/unit/lease/tenant now re-check resource-level access, not just the generic `documents:*` permission — a property_manager holding `documents:create` still can't attach a file to a property they aren't assigned to | `services/documentEntityResolver.js` (extended from Phase 6) |
| Mass-assignment protection continues via explicit per-resource updatable-field allow-lists in every repository | `repositories/*.repository.js` |

Verified end-to-end against a live Neon database with three organizations and five roles:
a property_manager denied all access to a property before assignment and granted it
immediately after; an owner denied access before being set as a property's owner and
granted it immediately after; a tenant able to see their own lease from the moment it's
created (even in `draft`) but denied `leases:terminate`; the full lease lifecycle
(draft → active → terminated, and draft → active → renewed) including a confirmed-blocked
double-booking attempt (409) and a confirmed-blocked edit of an immutable renewed lease
(409); a building-deletion attempt blocked while it has an occupied unit (409); and
cross-organization access to a property returning 404 from a second, independently
registered organization.

**Operational incident during this phase (not a security finding, but recorded here for
transparency):** generating a new migration's SQL required `prisma migrate diff`, which was
mistakenly given the real database connection as `--shadow-database-url`. Prisma treats a
shadow database as disposable and resets it — since it was pointed at the live database,
all data (structure unaffected) was wiped. Recovery and the corrected procedure are
documented in [../database/migrations.md](../database/migrations.md). No production data
was involved; this was a development database mid-build.

## Controls implemented at Phase 8 (finance)

| Control | Where |
|---|---|
| Server-authoritative financial calculation — `total`/`balance`/`amountPaid` are never accepted from the client, only computed from `subtotal`/`tax`/recorded payments | `services/invoice.service.js`, `repositories/invoice.repository.js` |
| Payment idempotency — a client-supplied `idempotencyKey`, checked before any write, makes a retried submission return the original payment instead of creating a duplicate | `services/payment.service.js` |
| Race-safe balance updates — an atomic DB-side increment (`amountPaid: { increment: delta }`) rather than read-then-write in application code, so two concurrent payments against the same invoice can't produce a lost update; the over-payment guard is checked against the post-increment row inside the same transaction | `repositories/invoice.repository.js` (`applyPaymentDelta`) |
| Refund/reversal never deletes or overwrites the original payment — it flips status to `refunded` (permanent history) and reverses the invoice's balance via the same atomic delta mechanism, in one transaction | `services/payment.service.js` |
| Void is blocked on any invoice with recorded payments — refund first, so the financial trail always explains a balance of zero | `services/invoice.service.js` |
| Expense approval workflow as an explicit state machine (`pending_approval → approved/rejected`, `approved → paid`) — no status skips | `services/expense.service.js` |
| The same property-scoped/self-scoped/org-wide authorization pattern from Phase 7 extended to invoices, payments, and expenses via a shared `getFinanceScope` helper | `services/resourceAccess.service.js` |

Verified end-to-end against a live Neon database: an invoice generated from an active lease
(with a real bug caught and fixed — the auto-computed due date landed in the past when
generated mid-month; now rolls forward to the lease's next due day); a partial payment
correctly moving an invoice to `partially_paid`; resubmitting the same idempotency key
returning the identical payment with the balance unchanged; an over-payment attempt
rejected (400); the invoice reaching `paid` once fully settled; a refund correctly
reversing the invoice back to `partially_paid` while preserving the original payment row as
`refunded`; a second refund attempt on the same payment rejected (409); a void attempt on
an invoice with recorded payments rejected (409); the full expense lifecycle
(`pending_approval → approved → paid`, with `mark-paid` correctly rejected before approval);
the financial summary report producing correct revenue/expense/net-income figures that
exclude the refunded payment; and a tenant correctly seeing only their own invoices while
being denied `payments:create`/`expenses:read` outright.

## Controls implemented at Phase 9 (operations)

| Control | Where |
|---|---|
| A tenant reporting a maintenance issue can never target an arbitrary unit id — they must actually hold (or have held) a lease on that unit, and the property/tenant are derived server-side from it, not accepted from the client | `services/maintenanceRequest.service.js` |
| Maintenance request and work order statuses form an explicit state machine, each transition validated server-side (`open → in_review → assigned`, work-order creation gated on `assigned`, `start`/`complete`/`cancel` each requiring the correct prior status) | `services/maintenanceRequest.service.js`, `services/workOrder.service.js` |
| Completing a work order cascades the parent maintenance request to `completed` and, when an actual cost is recorded, automatically drafts a matching `pending_approval` Expense — extending Phase 8's approval workflow rather than bypassing it; the expense step fails open (logged, not thrown) so a bookkeeping issue can never block recording that real-world work is done | `services/workOrder.service.js` |
| All 7 entity types added since Phase 6 (invoice, payment, expense, maintenance_request, work_order, inspection, vendor) now have a document-resolver entry, closing the gap where those resources existed without document-attachment authorization | `services/documentEntityResolver.js` |
| The shared role-scoping helper (`property_manager`/`agent` via assignment, `owner` via ownership, `tenant` via self, org-wide roles unrestricted) extended to maintenance requests and inspections — renamed from `getFinanceScope` to `getRestrictedScope` since it's no longer finance-specific | `services/resourceAccess.service.js` |

Verified end-to-end against a live Neon database, chained through the full real-world
workflow: a tenant filing a request against their own unit → a property manager (scoped by
assignment, not administrator) reviewing and self-assigning it → creating a work order for
a vendor with a scheduled date (correctly cascading the request to `scheduled`) → starting
it (cascading to `in_progress`) → completing it with an actual cost (cascading the request
to `completed` with `resolvedAt` set, **and** automatically producing a `pending_approval`
expense correctly linked to the property, vendor, and Maintenance category) → an inspection
scheduled and completed. Permission boundaries confirmed throughout: a tenant denied
`work-orders:read`/`vendors:read` outright while still seeing their own (by then completed)
request in their list; a second organization's admin getting 404 on the first organization's
maintenance request.

## Controls implemented at Phase 10 (dashboard, reports, notifications)

| Control | Where |
|---|---|
| `GET /dashboard` and every report endpoint reuse the exact same `getRestrictedScope` role-scoping as every other property-hierarchy resource — a property_manager's KPIs are computed only from their assigned properties, an owner's only from their portfolio, a tenant gets a structurally different (personal, not aggregate) response shape entirely | `services/dashboard.service.js`, `services/financialReport.service.js` |
| `GET /audit-logs` is gated behind `audit-logs:read`, which only `administrator` and `auditor` hold by default — every other role has no route to the audit trail at all | `constants/permissions.js`, `routes/v1/auditLogs.routes.js` |
| Notifications are inherently self-scoped — every query in `notification.service.js` filters by the caller's own `userId`, so there is no cross-user read/write path to another user's notifications regardless of role | `services/notification.service.js` |
| Notification creation (`notify()`) never fails the operation that triggered it — errors are logged and swallowed, the same failure posture as `audit.service.js` | `services/notification.service.js` |

Verified end-to-end against a live Neon database: a staff dashboard showing correct
aggregate KPIs (property/unit counts, occupancy rate, active/expiring leases, outstanding
balance, monthly revenue/expenses/net income, open/emergency maintenance counts, recent
payments) computed from real data built up across Phases 7-9; a tenant's dashboard showing
only their own balance/payments/maintenance, structurally different from the staff view; a
payment recorded live and its notification appearing instantly in the tenant's own list,
correctly absent from an unrelated staff member's list; mark-as-read correctly updating the
unread count; and `audit-logs:read` denied to a tenant (403) while returning real audit
history to an administrator.

**Bug found and fixed during this pass:** the rent-collection report summed `balance` across
*every* invoice regardless of status, including voided ones — since voiding only requires
`amountPaid` to be zero (not resetting `balance`), a voided invoice's stale balance was
inflating "total outstanding" by its full original amount. Fixed to exclude `void` from all
three report totals (billed/collected/outstanding), matching the dashboard's already-correct
`sumOutstandingBalance` aggregate, which never had this bug.

## Phase 11 — automated test suite

Every manual verification performed live in Phases 4–10 (via curl against a running server)
is now codified as an automated, repeatable Supertest suite that exercises the real Express
app in-process against the actual live Neon database — 112 tests across 14 files, all
passing. See [README.md](../../README.md#testing) for the breakdown and how to run each
tier. Highlights:

- **IDOR/BOLA**: cross-organization access denied (404) across property, building, unit,
  owner, tenant, lease, invoice, vendor, and maintenance request — both read and write paths.
- **CSRF**: missing header, mismatched header/cookie, and untrusted Origin all rejected;
  JWT-authenticated routes correctly carry no such requirement.
- **Injection**: classic SQL injection payloads in search parameters neither error nor leak
  data (Prisma parameterizes everything); stored payloads (script tags, operator-shaped
  strings) round-trip as inert literal text.
- **JWT attacks**: a token signed with a different secret, an `alg: none` token, and a
  tampered-payload/reused-signature token are all rejected.
- **Brute force**: repeated failed logins lock the account even when the correct password
  is finally supplied.
- **Mass assignment**: unrecognized fields (a smuggled `status`, `organizationId`, or
  `role`) are rejected outright, not silently dropped.
- **Malicious uploads**: spoofed content, path-traversal filenames, and confirmation that an
  uploaded asset's raw Cloudinary URL never appears in any API response.

**Three real bugs found and fixed while writing this suite** (beyond the report-total bug
already logged above):
1. My own test helper was re-fetching the CSRF cookie mid-flow; the server only issues it
   once per session, so "re-priming" found nothing and silently broke every multi-step test.
2. `user.validators.js`, `auth.validators.js`, and `document.validators.js` were missing the
   `.strict()` mass-assignment guard that every other create/update schema in the codebase
   already had — an inconsistency this suite caught by testing the convention explicitly.
3. `idor-bola.test.js` itself had a classic `it.each()` pitfall: the URL array was built
   from `beforeAll`-populated ids, but `it.each()` evaluates its argument during test
   *collection*, which runs before `beforeAll` — every request silently targeted
   `/api/v1/<resource>/undefined`. It "failed" (422, not 404), so it wasn't a silent false
   pass, but it wasn't testing what it claimed to. Fixed by resolving ids inside each test
   body instead of baking them into the case array.

Also fixed for test-suite correctness (not a vulnerability): the JWT-tampering test
originally "escalated" a user to `administrator` when they already held that role, making
the tamper a no-op that trivially "succeeded." Changed to retarget the `org` claim instead —
a real cross-tenant impersonation attempt.

## Controls landing in later phases (tracked, not yet implemented)

| Control | Phase |
|---|---|
| Automated recurring invoice generation (a scheduled job, not just the manual/triggered `generate-invoice` endpoint) | Not yet scheduled — see `docs/api/api-guide.md` |
| End-to-end (browser-driven, against the frontend) tests (`tests/e2e`) | After the frontend is built |
| Row-Level Security rollout | Staged, post-frontend (see authorization.md §5) |

## Non-negotiables enforced by convention (see also CLAUDE.md-equivalent review checklist)

- No repository function queries an organization-owned table without an explicit
  `organizationId` parameter.
- No controller touches Prisma directly.
- No secret (`CLOUDINARY_API_SECRET`, `JWT_*_SECRET`, `SESSION_SECRET`, `DATABASE_URL`)
  is ever sent in an API response or referenced from `client/`.
- No `git commit` includes `.env` (enforced by `.gitignore`; verify before every commit).
