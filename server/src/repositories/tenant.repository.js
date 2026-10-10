import { prisma } from '../config/database.js';

export function createTenant(data) {
  return prisma.tenant.create({ data });
}

export function findTenantById(id, organizationId) {
  return prisma.tenant.findFirst({ where: { id, organizationId } });
}

export function findTenantByUserId(userId, organizationId) {
  return prisma.tenant.findFirst({ where: { userId, organizationId } });
}

// `propertyIds` (from resourceAccess.service.js#getRestrictedScope) scopes
// via the tenant's "current residence" convenience link (see the Tenant
// model's comment in schema.prisma) — a tenant with neither buildingId nor
// unitId set matches neither OR branch, so an unlinked tenant is invisible
// to a scoped (agent/owner) caller, same as it must be for an empty
// propertyIds array (`in: []` matches nothing, never "no filter").
function buildTenantListWhere(organizationId, { search, status, unitId, buildingId, propertyIds }) {
  // `AND` (rather than two top-level `OR` keys) — a plain object literal can
  // only hold one `OR` key, so spreading a second `{ OR: [...] }` for search
  // would silently clobber the propertyIds scoping filter whenever both are
  // active at once.
  const and = [];
  if (propertyIds) {
    and.push({
      OR: [
        { building: { propertyId: { in: propertyIds } } },
        { unit: { building: { propertyId: { in: propertyIds } } } },
        { rentals: { some: { propertyId: { in: propertyIds }, status: 'active' } } },
      ],
    });
  }
  if (search) {
    and.push({
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(unitId ? { unitId } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function findTenantsByOrganization(organizationId, { skip, take, search, status, unitId, buildingId, propertyIds }) {
  return prisma.tenant.findMany({ where: buildTenantListWhere(organizationId, { search, status, unitId, buildingId, propertyIds }), include: { user: { select: { status: true } } }, orderBy: { lastName: 'asc' }, skip, take });
}

export function countTenantsByOrganization(organizationId, { search, status, unitId, buildingId, propertyIds }) {
  return prisma.tenant.count({ where: buildTenantListWhere(organizationId, { search, status, unitId, buildingId, propertyIds }) });
}

// Used by tenant.service.js#getTenant to check a scoped caller's (agent's/
// owner's) access to a single tenant record: is their building/unit link
// within the caller's propertyIds?
export function countTenantPropertyMatch(tenantId, propertyIds) {
  return prisma.tenant.count({
    where: {
      id: tenantId,
      OR: [
        { building: { propertyId: { in: propertyIds } } },
        { unit: { building: { propertyId: { in: propertyIds } } } },
        { rentals: { some: { propertyId: { in: propertyIds }, status: 'active' } } },
      ],
    },
  });
}

// Resolves a tenant's current property via the same building/unit
// convenience link buildTenantListWhere scopes by above — used by
// tenantMessage.service.js to find who a tenant's message should reach.
// Returns null for a tenant with neither link set, same "resolves to
// nothing" posture as the rest of this file.
export async function findPropertyIdForTenant(tenantId, organizationId) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, organizationId },
    select: {
      building: { select: { propertyId: true } },
      unit: { select: { building: { select: { propertyId: true } } } },
    },
  });
  return tenant?.building?.propertyId ?? tenant?.unit?.building?.propertyId ?? null;
}

// Single-tenant lookup for "who lives here" scenarios (e.g. auto-loading
// the resident to notify when scheduling an inspection) — a unit is
// expected to have at most one current tenant, so this returns the first
// match rather than a list.
export function findTenantByUnitId(unitId, organizationId) {
  return prisma.tenant.findFirst({ where: { organizationId, unitId } });
}

const UPDATABLE_TENANT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'emergencyContact', 'buildingId', 'unitId'];

export function updateTenant(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_TENANT_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.tenant.updateMany({ where: { id, organizationId }, data: update });
}

export function setTenantStatus(id, organizationId, status) {
  return prisma.tenant.updateMany({ where: { id, organizationId }, data: { status } });
}

export function linkTenantUser(id, organizationId, userId) {
  return prisma.tenant.updateMany({ where: { id, organizationId }, data: { userId } });
}
