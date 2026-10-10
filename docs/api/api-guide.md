# API Guide

## Base URL

`/api/v1` — all routes are versioned; a breaking change gets `/api/v2` rather than mutating
`v1` in place.

## Response envelope

Success:

```json
{ "success": true, "data": { }, "message": "Operation completed successfully" }
```

Error:

```json
{ "success": false, "error": { "code": "RESOURCE_NOT_FOUND", "message": "..." } }
```

`error.details` is present for validation errors (`VALIDATION_ERROR`, 422) as an array of
`{ path, message }`. No response ever includes a stack trace, SQL fragment, file path, or
internal error message in production (`NODE_ENV=production`) — see
`server/src/middleware/errorHandler.js`.

## Auth

- Browser clients: cookie session (`rems.sid`, HttpOnly/Secure/SameSite=Lax). State-changing
  requests (`POST`/`PUT`/`PATCH`/`DELETE`) must include the `X-CSRF-Token` header, echoing
  the readable `csrf_token` cookie set on first response — see
  `docs/security/authentication.md`.
- Mobile/external API clients: `Authorization: Bearer <access_token>` (JWT).

## Implemented so far

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Readiness probe — DB + Cloudinary config status |
| GET | `/health/live` | none | Liveness probe |
| POST | `/auth/register` | none | Create an organization + its first (administrator) user |
| POST | `/auth/verify-email` | none | Consume an email verification token |
| POST | `/auth/resend-verification` | none | Re-send verification email (generic response either way) |
| POST | `/auth/login` | none | Session login; returns `{ mfaRequired, mfaToken }` if MFA is enabled |
| POST | `/auth/mfa/challenge` | none (mfaToken) | Complete login with a TOTP code or recovery code |
| POST | `/auth/logout` | session | Destroy the current session |
| POST | `/auth/logout-all` | session/JWT | Destroy every session + revoke every refresh token for the user |
| GET | `/auth/me` | session/JWT | Full profile (id, name, email, status, MFA state, roles) — the client's "who am I" call on load, works for every role without needing `users:read` |
| POST | `/auth/change-password` | session/JWT | Requires current password; invalidates other sessions/tokens |
| POST | `/auth/forgot-password` | none | Request a password reset email (generic response either way) |
| POST | `/auth/reset-password` | none | Consume a reset token, set a new password |
| POST | `/auth/mfa/enroll` | session/JWT | Start TOTP enrollment — returns secret + otpauth URL |
| POST | `/auth/mfa/confirm` | session/JWT | Confirm enrollment with a code — returns recovery codes once |
| POST | `/auth/mfa/disable` | session/JWT | Requires password + a valid code |
| POST | `/auth/token` | none | JWT login (mobile/external API) — body may include `mfaCode` |
| POST | `/auth/token/refresh` | none (refreshToken) | Rotates the refresh token; detects reuse |
| POST | `/auth/token/revoke` | none (refreshToken) | Explicit logout for a JWT client |

All state-changing session-authenticated routes above require the `X-CSRF-Token` header
(see docs/security/authentication.md). JWT-only routes (`/token*`) don't, since they carry
no ambient cookie credential.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | `users:read` | Paginated, searchable, filterable by status |
| GET | `/users/:id` | `users:read` | Org-scoped — 404 (not 403) on a cross-org id |
| POST | `/users/invite` | `users:invite` | Creates a pending user + emails a "set your password" link |
| PATCH | `/users/:id/status` | `users:update` | Blocks changing your own status |
| PATCH | `/users/:id/role` | `users:change-role` | Blocks changing your own role |
| GET | `/organizations/me` | `organizations:read` | Only the caller's own organization — no `:id` route |
| PATCH | `/organizations/me` | `organizations:update` | Explicit field allow-list; unknown body keys are rejected (422), not silently dropped |
| GET | `/roles` | `roles:read` | Org's roles with their attached permissions |
| GET | `/permissions` | any authenticated user | The global permission catalog (not organization data) |
| POST | `/documents` | `documents:create` | Multipart upload (`file` field + `entityType`/`entityId`); server-validated by magic bytes, not extension |
| GET | `/documents` | `documents:read` | Paginated, filtered by `entityType`/`entityId` (both required) |
| GET | `/documents/:id/access-url` | `documents:download` | Returns a signed, 5-minute-expiry Cloudinary URL — never a permanent link |
| DELETE | `/documents/:id` | `documents:delete` | Deletes the Cloudinary asset first, then the metadata row |

`entityType` for `/documents` is one of the values in the Prisma `DocumentEntityType` enum;
`organization`, `user`, `property`, `unit`, `lease`, `tenant`, and `owner` are attachable
today (see `server/src/services/documentEntityResolver.js`); the rest activate as their
modules land in Phase 8+.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/POST | `/properties` | `properties:read`/`create` | List is pre-scoped to assignment/ownership for restricted roles |
| GET/PATCH | `/properties/:id` | `properties:read`/`update` | Includes a live unit-occupancy summary |
| DELETE | `/properties/:id` | `properties:delete` | Soft-archives (`status: archived`), never a hard delete |
| GET/POST | `/properties/:id/assignments` | `properties:update` | Manage which users a property_manager/agent role can see this property through |
| DELETE | `/properties/:id/assignments/:userId` | `properties:update` | |
| GET/POST | `/properties/:propertyId/buildings` | `buildings:read`/`create` | |
| GET/PATCH/DELETE | `/buildings/:id` | `buildings:read`/`update`/`delete` | Delete is blocked while any unit is occupied |
| GET/POST | `/buildings/:buildingId/units` | `units:read`/`create` | |
| GET/PATCH/DELETE | `/units/:id` | `units:read`/`update`/`delete` | |
| PATCH | `/units/:id/status` | `units:update` | `occupied` is rejected — it's lease-managed only |
| GET/POST | `/owners` | `owners:read`/`create` | An `owner`-role caller sees only their own record |
| GET/PATCH | `/owners/:id`, `/owners/:id/status` | `owners:read`/`update` | |
| GET/POST | `/tenants` | `tenants:read`/`create` | A `tenant`-role caller sees only their own record |
| GET/PATCH | `/tenants/:id`, `/tenants/:id/status` | `tenants:read`/`update` | |
| GET/POST | `/leases` | `leases:read`/`create` | List is pre-scoped per role (own lease / own properties / assigned properties / org-wide); created as `draft` |
| GET/PATCH | `/leases/:id` | `leases:read`/`update` | Update rejected once `terminated`/`expired`/`renewed` |
| POST | `/leases/:id/activate` | `leases:update` | Enforces no-double-booking (409 on conflict) |
| POST | `/leases/:id/terminate` | `leases:terminate` | Frees the unit |
| POST | `/leases/:id/renew` | `leases:renew` | Closes the old lease as `renewed`, creates a new `active` one |

| GET/POST | `/invoices` | `invoices:read`/`create` | Created as `draft`; `total`/`balance` are always server-computed |
| GET/PATCH | `/invoices/:id` | `invoices:read`/`update` | Edits rejected once no longer `draft` |
| POST | `/invoices/:id/send` | `invoices:update` | `draft → sent` |
| POST | `/invoices/:id/void` | `invoices:void` | Rejected if any payment is recorded against it |
| POST | `/leases/:leaseId/generate-invoice` | `invoices:create` | Generates from an active lease's rent terms, status `sent` immediately (no separate scheduler yet — see below) |
| GET/POST | `/payments` | `payments:read`/`create` | `POST` accepts an optional `idempotencyKey`; a repeat returns the original payment unchanged |
| GET | `/payments/:id` | `payments:read` | |
| POST | `/payments/:id/refund` | `payments:refund` | Reverses the invoice balance; the original payment row is kept as `refunded`, never deleted |
| GET/POST | `/expenses/categories` | `expenses:read`/`create` | 6 defaults seeded per new organization |
| GET/POST | `/expenses` | `expenses:read`/`create` | Created as `pending_approval` |
| GET | `/expenses/:id` | `expenses:read` | |
| POST | `/expenses/:id/approve`, `/reject` | `expenses:approve` | From `pending_approval` only |
| POST | `/expenses/:id/mark-paid` | `expenses:update` | From `approved` only |
| GET | `/reports/financial-summary` | `reports:read` | Revenue (completed payments) vs. expenses (approved+paid), optional `propertyId`/`from`/`to` |

**Known gap:** invoice generation from a lease is a manual/triggered action
(`POST /leases/:id/generate-invoice`), not yet an automated monthly recurrence — that needs
a scheduled job (a natural fit for `server/src/jobs/`, not yet built) calling the same
endpoint's underlying service function per active lease. Financial report output is JSON
only; CSV/PDF export from §38 of the requirements is not yet implemented.

| GET/POST | `/vendors` | `vendors:read`/`create` | Organization-wide directory, no property scoping |
| GET/PATCH | `/vendors/:id`, `/vendors/:id/status` | `vendors:read`/`update` | |
| GET/POST | `/maintenance` | `maintenance:read`/`create` | A tenant caller is forced to their own `tenantId`/derived `propertyId`; `unitId` must be one they hold/held a lease on |
| GET | `/maintenance/:id` | `maintenance:read` | |
| POST | `/maintenance/:id/review` | `maintenance:update` | `open → in_review` |
| POST | `/maintenance/:id/assign` | `maintenance:update` | `open`/`in_review` → `assigned` |
| POST | `/maintenance/:id/cancel` | `maintenance:update` | From any non-terminal status |
| GET/POST | `/maintenance/:maintenanceRequestId/work-orders` | `work-orders:read`/`create` | Creation requires the request to be `assigned`; a scheduled date cascades the request to `scheduled` |
| GET/PATCH | `/work-orders/:id` | `work-orders:read`/`update` | |
| POST | `/work-orders/:id/start` | `work-orders:update` | Cascades the parent request to `in_progress` |
| POST | `/work-orders/:id/complete` | `work-orders:update` | Cascades the parent request to `completed`; an `actualCost` auto-drafts a `pending_approval` Expense |
| POST | `/work-orders/:id/cancel` | `work-orders:update` | |
| GET/POST | `/inspections` | `inspections:read`/`create` | |
| GET/PATCH | `/inspections/:id` | `inspections:read`/`update` | |
| POST | `/inspections/:id/complete`, `/cancel` | `inspections:update` | |
| GET | `/dashboard` | any authenticated user | Role-scoped KPIs — a structurally different (personal) shape for `tenant` vs. everyone else |
| GET | `/reports/occupancy` | `reports:read` | Unit counts by status + occupancy rate, scoped |
| GET | `/reports/rent-collection` | `reports:read` | Invoice counts by status + billed/collected/outstanding totals (void invoices excluded from totals) |
| GET | `/reports/maintenance-summary` | `reports:read` | Request counts by status and priority |
| GET/POST | `/notifications` | any authenticated user | Always the caller's own — no permission gate needed, same as `GET /auth/me` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | any authenticated user | |
| GET | `/audit-logs` | `audit-logs:read` | `administrator`/`auditor` only by default; filterable by `action`/`entityType`/`userId`/`from`/`to` |

`/settings` has no dedicated resource — organization settings live in
`Organization.settings` (JSONB), managed via `PATCH /organizations/me` (Phase 5).

Every resource listed in the original requirements now has an implemented endpoint. The
remaining documented gaps are: automated recurring invoice generation (needs a scheduler —
see the finance section above), and CSV/PDF export for reports (JSON only today).

## Pagination / filtering (convention for every list endpoint, from Phase 7 on)

Query params: `page` (default 1), `pageSize` (default 20, max 100), `sort`, `order`
(`asc`/`desc`), plus resource-specific filters (`status`, `propertyId`, `dateFrom`,
`dateTo`, `search`). Response `meta`:

```json
{ "meta": { "page": 1, "pageSize": 20, "total": 143, "totalPages": 8 } }
```
