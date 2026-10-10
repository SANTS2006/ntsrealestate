import { prisma } from '../config/database.js';

// Same story as Building — no organization_id column; every query filters
// through building -> property -> organizationId.

export function createUnit(data) {
  return prisma.unit.create({ data });
}

export function findUnitById(id, organizationId) {
  return prisma.unit.findFirst({
    where: { id, building: { property: { organizationId } } },
    include: { building: { include: { property: true } } },
  });
}

export function findUnitsByBuilding(buildingId, organizationId, { status } = {}) {
  return prisma.unit.findMany({
    where: { buildingId, building: { property: { organizationId } }, ...(status ? { status } : {}) },
    orderBy: { unitNumber: 'asc' },
  });
}

const UPDATABLE_UNIT_FIELDS = [
  'unitNumber', 'unitType', 'floor', 'bedrooms', 'bathrooms', 'area',
  'monthlyRent', 'securityDeposit', 'description', 'furnished', 'amenities',
  'offerRent', 'offerSale', 'offerLease', 'salePrice', 'leasePrice', 'leaseTermMonths', 'isShared',
];

export function updateUnit(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_UNIT_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.unit.updateMany({ where: { id, building: { property: { organizationId } } }, data: update });
}

export function setUnitStatus(id, status, tx = prisma) {
  return tx.unit.update({ where: { id }, data: { status } });
}

export function deleteUnit(id, organizationId) {
  return prisma.unit.deleteMany({ where: { id, building: { property: { organizationId } } } });
}

// Occupancy summary across every unit visible to a caller's scope (all
// units in the org, or just those under `propertyIds`) — used by
// dashboard.service.js. Same shape/rationale as
// property.repository.js#getPropertyUnitSummary, just not limited to one
// property.
// Raw (buildingId, status) counts for a batch of buildings — the caller
// (property.service.js) folds these into a per-property summary using a
// buildingId -> propertyId map, since Unit has no propertyId column of its
// own to group by directly.
// Display-name lookup for a scattered set of unit ids — same rationale as
// building.repository.js#findBuildingsByIds.
export function findUnitsByIds(ids) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.unit.findMany({ where: { id: { in: ids } }, select: { id: true, unitNumber: true } });
}

export function getUnitSummaryByBuildingIds(buildingIds) {
  if (buildingIds.length === 0) return Promise.resolve([]);
  return prisma.unit.groupBy({
    by: ['buildingId', 'status'],
    where: { buildingId: { in: buildingIds } },
    _count: { _all: true },
  });
}

export async function getUnitSummaryForScope(organizationId, propertyIds) {
  const rows = await prisma.unit.groupBy({
    by: ['status'],
    where: {
      building: {
        property: { organizationId, ...(propertyIds ? { id: { in: propertyIds } } : {}) },
      },
    },
    _count: { _all: true },
  });
  const summary = { total: 0, available: 0, occupied: 0, reserved: 0, under_maintenance: 0, unavailable: 0 };
  for (const row of rows) {
    summary[row.status] = row._count._all;
    summary.total += row._count._all;
  }
  return summary;
}
