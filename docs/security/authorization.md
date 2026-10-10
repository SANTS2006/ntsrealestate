# Authorization Architecture (RBAC + ABAC hybrid)

Authorization is evaluated server-side on **every** request. Hiding a sidebar link is a UX
convenience, never a security control.

> **Implementation status (Phase 7):** steps 1–3 (`requirePermission` /
> `requireAnyPermission` in `server/src/middleware/authorize.js`) are enforced on every
> route. Steps 4–6 (ownership/assignment/resource state) are now also implemented for the
> property hierarchy and leases — see `server/src/services/resourceAccess.service.js`: a
> `property_manager`/`agent` is scoped to properties they're explicitly assigned to (via
> the `PropertyAssignment` table), an `owner` is scoped to properties where
> `Property.ownerId` resolves back to their own `Owner` row, and a `tenant` is scoped to
> their own `Tenant` row and its leases. `administrator`/`accountant`/
> `maintenance_manager`/`auditor` remain organization-wide. The remaining resources
> (invoices, payments, expenses, maintenance, ...) apply the same pattern as they land in
> Phase 8+.

## 1. Decision formula

Every protected action is authorized by combining, in order:

```
1. Authentication      — is there a valid session/JWT?
2. Organization scope  — does the resource belong to the caller's organization_id?
3. Role                — does the caller hold a role permitted to perform this action?
4. Permission           — does that role grant the specific permission (resource:action)?
5. Ownership/assignment — for owner/tenant/agent roles, is the caller the owner/tenant/
                           assignee of *this specific* resource instance?
6. Resource state       — is the action valid given the resource's current state
                           (e.g. cannot pay an already-void invoice, cannot edit a
                           terminated lease)?
```

All six checks happen in the service layer (not just middleware), because step 3–6 often
require the loaded entity. Middleware handles 1–3 cheaply; services enforce 4–6 with the
actual row in hand.

## 2. Roles (baseline)

| Role                  | Scope                                                             |
|------------------------|--------------------------------------------------------------------|
| Super Administrator    | Cross-organization platform administration                        |
| Administrator          | Full access within their organization                             |
| Property Manager       | Properties/units/leases/tenants they are assigned to               |
| Accountant/Finance Mgr | Invoices, payments, expenses, financial reports (org-wide)         |
| Maintenance Manager    | Maintenance requests, work orders, vendors                         |
| Property Owner         | Read access to their own properties + financial reports            |
| Agent                  | Assigned properties/listings                                       |
| Tenant                 | Their own lease, invoices, payments, documents, maintenance requests |
| Auditor                | Read-only, org-wide, no write access anywhere                      |

Roles are **rows in the `roles` table per organization** (seeded defaults, but editable),
not hardcoded enum values, so an organization admin can create custom roles composed of the
fixed `permissions` catalog via `role_permissions`.

## 3. Permission naming

`resource:action` pairs, e.g. `properties:read`, `properties:write`, `leases:terminate`,
`payments:refund`, `documents:download`, `audit-logs:read`. Checked via a single
`requirePermission('resource:action')` middleware/service helper that resolves the caller's
effective permission set (role → role_permissions, cached per-request, never per-session to
avoid stale privilege after a role change).

## 4. Organization isolation

- Every organization-owned table carries `organization_id` (directly, or transitively via a
  parent that does — e.g. `units.organization_id` is derived through `buildings→properties`,
  but is denormalized onto frequently-queried child tables where it materially simplifies
  and hardens query scoping).
- The repository layer requires `organizationId` as an explicit parameter on every query
  function — there is no "query all X" helper without it. Code review / lint convention:
  a repository function touching a tenant table without an `organizationId` parameter is a
  defect.
- Session/JWT carries `organizationId`; it is **read from the authenticated principal**, never
  from the request body/query/params, preventing a user from asserting a different org.
- Row-Level Security (RLS) is evaluated as a defense-in-depth layer (§5) — the application
  layer is the primary control since Prisma's pooled connection model makes per-request
  `SET LOCAL` session variables non-trivial with pgbouncer transaction pooling; see §5 for
  the concrete recommendation.

## 5. Row-Level Security (RLS) — status

RLS is **designed for, not yet enabled** in Phase 1. Recommendation for when it's turned on:

- Policies keyed on a session variable (`app.current_org_id`) set via `SET LOCAL` inside each
  transaction, requiring the **direct** (non-pooled) Neon connection string for write
  transactions, since PgBouncer transaction-mode pooling can't safely carry session-local
  `SET` across statements from different logical requests.
- Migration strategy: enable RLS table-by-table starting with `documents` and `payments`
  (highest sensitivity), with policies mirroring the application-layer scoping, tested by the
  security test suite (`tests/security`) asserting cross-org access is denied even if the
  application-layer check were hypothetically bypassed.
- Until enabled, the application-layer scoping described in §4 is authoritative and mandatory.

## 6. IDOR/BOLA protection pattern

Every "fetch by ID" repository call is of the form
`findById(id, organizationId)` — a mismatched org simply returns "not found" (404), not 403,
to avoid confirming the resource's existence to an unauthorized caller (anti-enumeration).

## 7. Self-service restrictions

Enforced in the `users` service, never left to the client:

- A user cannot change their own `organization_id`.
- A user cannot change their own `role` (except Super Admin acting on non-self accounts).
- A user cannot self-approve their own expense/financial approval requests.
