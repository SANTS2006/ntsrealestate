import { prisma } from '../config/database.js';

export function createLease(data, tx = prisma) {
  return tx.lease.create({ data });
}

// Includes the full unit -> building -> property chain and the tenant, so
// callers can run resource-level authorization (assertPropertyAccess /
// tenant self-access) without extra round trips.
export function findLeaseById(id, organizationId) {
  return prisma.lease.findFirst({
    where: { id, organizationId },
    include: { unit: { include: { building: { include: { property: true } } } }, tenant: true },
  });
}

function buildLeaseListWhere(organizationId, { status, tenantId, unitId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(unitId ? { unitId } : {}),
    ...(propertyIds ? { unit: { building: { propertyId: { in: propertyIds } } } } : {}),
  };
}

export function findLeasesByOrganization(organizationId, { skip, take, status, tenantId, unitId, propertyIds }) {
  return prisma.lease.findMany({
    where: buildLeaseListWhere(organizationId, { status, tenantId, unitId, propertyIds }),
    include: { unit: { include: { building: { include: { property: true } } } }, tenant: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countLeasesByOrganization(organizationId, { status, tenantId, unitId, propertyIds }) {
  return prisma.lease.count({ where: buildLeaseListWhere(organizationId, { status, tenantId, unitId, propertyIds }) });
}

export function findActiveLeaseForUnit(unitId, tx = prisma) {
  return tx.lease.findFirst({ where: { unitId, status: 'active' } });
}

// Active leases ending within the next `withinDays` — the dashboard's
// "expiring soon" KPI. Deliberately a live query, not the `expiring_soon`
// enum value, since nothing yet transitions a lease into that status
// automatically (no scheduler exists — see docs/api/api-guide.md).
export function countExpiringLeases(organizationId, { propertyIds, withinDays = 30 }) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return prisma.lease.count({
    where: {
      organizationId,
      status: 'active',
      endDate: { gte: now, lte: cutoff },
      ...(propertyIds ? { unit: { building: { propertyId: { in: propertyIds } } } } : {}),
    },
  });
}

export function updateLeaseStatus(id, status, extra, tx = prisma) {
  return tx.lease.update({ where: { id }, data: { status, ...extra } });
}

const UPDATABLE_LEASE_FIELDS = ['monthlyRent', 'securityDeposit', 'paymentDueDay', 'endDate', 'terms'];

export function updateLease(id, data, tx = prisma) {
  const update = {};
  for (const field of UPDATABLE_LEASE_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return tx.lease.update({ where: { id }, data: update });
}
