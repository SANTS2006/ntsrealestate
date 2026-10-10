import { prisma } from '../config/database.js';

export function createProperty(data) {
  return prisma.property.create({ data });
}

export function findPropertyById(id, organizationId) {
  return prisma.property.findFirst({ where: { id, organizationId } });
}

function buildPropertyListWhere(organizationId, { search, status, ownerId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(propertyIds ? { id: { in: propertyIds } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { propertyCode: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

// `propertyIds`, when provided, additionally restricts the list to that set
// — used to scope a property_manager/agent's listing to only their assigned
// properties (see property.service.js). `undefined` means "no restriction
// beyond organization" (administrator/accountant/maintenance_manager/
// auditor), which is different from an empty array (which would correctly
// return zero rows for a user assigned to nothing).
export function findPropertiesByOrganization(organizationId, { skip, take, search, status, ownerId, propertyIds }) {
  return prisma.property.findMany({
    where: buildPropertyListWhere(organizationId, { search, status, ownerId, propertyIds }),
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countPropertiesByOrganization(organizationId, { search, status, ownerId, propertyIds }) {
  return prisma.property.count({ where: buildPropertyListWhere(organizationId, { search, status, ownerId, propertyIds }) });
}

// Per-owner property counts for a batch of owners (an owner card's "N
// properties" stat) — one grouped query instead of one count() per row.
export function countPropertiesGroupedByOwner(organizationId, ownerIds) {
  if (ownerIds.length === 0) return Promise.resolve([]);
  return prisma.property.groupBy({
    by: ['ownerId'],
    where: { organizationId, ownerId: { in: ownerIds } },
    _count: { _all: true },
  });
}

const UPDATABLE_PROPERTY_FIELDS = [
  'name', 'propertyType', 'description', 'address', 'city', 'region', 'country',
  'latitude', 'longitude', 'yearBuilt', 'ownerId', 'amenities', 'isShared',
];

export function updateProperty(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_PROPERTY_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.property.update({ where: { id }, data: update });
}

export function setPropertyStatus(id, organizationId, status) {
  return prisma.property.updateMany({ where: { id, organizationId }, data: { status } });
}

// Occupancy/unit-count summary for a property's dashboard card — computed
// with a single grouped query rather than loading every unit into Node.
export async function getPropertyUnitSummary(propertyId) {
  const rows = await prisma.unit.groupBy({
    by: ['status'],
    where: { building: { propertyId } },
    _count: { _all: true },
  });
  const summary = { total: 0, available: 0, occupied: 0, reserved: 0, under_maintenance: 0, unavailable: 0 };
  for (const row of rows) {
    summary[row.status] = row._count._all;
    summary.total += row._count._all;
  }
  return summary;
}
