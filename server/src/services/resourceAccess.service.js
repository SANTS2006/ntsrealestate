import { AppError } from '../utils/AppError.js';
import { findOwnerByUserId } from '../repositories/owner.repository.js';
import { findTenantByUserId } from '../repositories/tenant.repository.js';
import { isUserAssignedToProperty, findPropertyIdsAssignedToUser } from '../repositories/propertyAssignment.repository.js';
import { findPropertiesByOrganization } from '../repositories/property.repository.js';

// Steps 4-6 of the authorization formula (ownership/assignment/resource
// state) from docs/security/authorization.md, layered on top of the
// role/permission check `requirePermission` already ran in middleware.
// A caller reaching these functions has already proven they hold e.g.
// `properties:read` in the organization — this narrows *which* rows within
// that organization they may actually touch.
//
// Every function here takes the already-loaded (org-scoped) row and throws
// AppError.notFound (never .forbidden) on a denied match, matching the
// IDOR-safe convention used everywhere else: a caller with the right
// permission but the wrong assignment/ownership sees "not found," not
// "forbidden" — it doesn't confirm anything about a resource outside their
// reach beyond what a real database miss would reveal.

// administrator/accountant/maintenance_manager/auditor operate org-wide —
// their `requirePermission` pass is the whole authorization check for
// property-hierarchy resources; they never consult assignment/ownership.
const ORG_WIDE_PROPERTY_ROLES = new Set(['administrator', 'accountant', 'maintenance_manager', 'auditor']);
const ASSIGNMENT_SCOPED_ROLES = new Set(['agent']);

// A "no Owner/Tenant record yet" scope must resolve to a filter that
// guarantees zero rows — never omitting the filter (which would silently
// mean "no restriction," i.e. org-wide access). The nil UUID is
// syntactically valid for a `db.Uuid` column (so Postgres accepts it in an
// equality filter without erroring, unlike a plain sentinel string such as
// '__none__') and Prisma's `@default(uuid())` never generates it, so it can
// never collide with a real row.
export const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

function hasAnyRole(actingUser, roleSet) {
  return actingUser.roles.some((r) => roleSet.has(r));
}

// property: the loaded (org-scoped) Property row.
export async function assertPropertyAccess(property, actingUser) {
  if (hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) return;

  if (hasAnyRole(actingUser, ASSIGNMENT_SCOPED_ROLES)) {
    const assigned = await isUserAssignedToProperty(property.id, actingUser.id);
    if (!assigned) throw AppError.notFound('Property not found.');
    return;
  }

  if (actingUser.roles.includes('owner')) {
    const owner = await findOwnerByUserId(actingUser.id, actingUser.organizationId);
    if (!owner || property.ownerId !== owner.id) throw AppError.notFound('Property not found.');
    return;
  }

  // Any other role (e.g. tenant) has no standing route to a bare property
  // record at all.
  throw AppError.forbidden();
}

// Convenience for callers that only have a tenantId, not a loaded Tenant
// row — used by the lease/tenant self-access checks below.
export async function assertOwnTenantRecord(tenantId, actingUser) {
  if (!actingUser.roles.includes('tenant')) return false; // not a tenant-scoped caller at all
  const tenant = await findTenantByUserId(actingUser.id, actingUser.organizationId);
  if (!tenant || tenant.id !== tenantId) throw AppError.notFound('Not found.');
  return true;
}

// Shared by every property-hierarchy *listing* (leases, invoices, payments,
// expenses, maintenance requests, inspections, ...): resolves what a
// restricted role's query should be narrowed to, so each service doesn't
// re-derive the same role branching. Returns one of:
//   { tenantId }     - self-scoped (tenant); NO_MATCH_ID if they have no
//                       Tenant record yet, which must resolve to zero rows,
//                       never "no filter" (org-wide).
//   { propertyIds }  - assignment- or ownership-scoped (agent, owner);
//                       always an array, possibly empty.
//   {}               - org-wide (administrator/accountant/
//                       maintenance_manager/auditor) — no extra filter.
export async function getRestrictedScope(actingUser, organizationId) {
  if (hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) return {};

  if (actingUser.roles.includes('tenant')) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    return { tenantId: tenant?.id ?? NO_MATCH_ID };
  }

  if (hasAnyRole(actingUser, ASSIGNMENT_SCOPED_ROLES)) {
    const assignments = await findPropertyIdsAssignedToUser(actingUser.id, organizationId);
    return { propertyIds: assignments.map((a) => a.propertyId) };
  }

  if (actingUser.roles.includes('owner')) {
    const owner = await findOwnerByUserId(actingUser.id, organizationId);
    const ownedProperties = owner ? await findPropertiesByOrganization(organizationId, { ownerId: owner.id, skip: 0, take: 1000 }) : [];
    return { propertyIds: ownedProperties.map((p) => p.id) };
  }

  // Any other role has no standing scope at all — resolve to "nothing."
  return { propertyIds: [] };
}

export { ORG_WIDE_PROPERTY_ROLES, ASSIGNMENT_SCOPED_ROLES };
