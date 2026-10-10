import { prisma } from '../config/database.js';

// Building has no organization_id column of its own (see
// docs/database/database-design.md) — organization scoping is enforced via
// a nested filter through its parent Property on every query here. Every
// function still takes organizationId explicitly, matching the convention
// used everywhere else, even though it's applied one join away.

export function createBuilding(data) {
  return prisma.building.create({ data });
}

// Includes the parent property so callers (building.service.js) can run
// assertPropertyAccess() without a second round trip.
export function findBuildingById(id, organizationId) {
  return prisma.building.findFirst({
    where: { id, property: { organizationId } },
    include: { property: true },
  });
}

// Batch id+propertyId pairs for a set of properties — used by
// property.service.js to compute a per-property building count and, via
// unit.repository.js#getUnitSummaryByBuildingIds, a per-property unit
// summary, without an N+1 query per row of the properties list.
// Display-name lookup for a scattered set of building ids (e.g. the
// buildings a page of tenants happen to reference) — not scoped to one
// property, unlike findBuildingsByProperty.
export function findBuildingsByIds(ids) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.building.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}

export function findBuildingsByProperties(propertyIds) {
  if (propertyIds.length === 0) return Promise.resolve([]);
  return prisma.building.findMany({
    where: { propertyId: { in: propertyIds } },
    select: { id: true, propertyId: true },
  });
}

export function countBuildingsByOrganization(organizationId, { propertyIds } = {}) {
  return prisma.building.count({
    where: { property: { organizationId, ...(propertyIds ? { id: { in: propertyIds } } : {}) } },
  });
}

export function findBuildingsByProperty(propertyId, organizationId) {
  return prisma.building.findMany({
    where: { propertyId, property: { organizationId } },
    orderBy: { name: 'asc' },
  });
}

const UPDATABLE_BUILDING_FIELDS = ['name', 'code', 'floors', 'description', 'isShared'];

export function updateBuilding(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_BUILDING_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.building.updateMany({ where: { id, property: { organizationId } }, data: update });
}

export function deleteBuilding(id, organizationId) {
  return prisma.building.deleteMany({ where: { id, property: { organizationId } } });
}
