import { prisma } from '../config/database.js';

export function createMaintenanceRequest(data) {
  return prisma.maintenanceRequest.create({ data });
}

export function findMaintenanceRequestById(id, organizationId) {
  return prisma.maintenanceRequest.findFirst({
    where: { id, organizationId },
    include: { property: true, unit: true, tenant: true },
  });
}

function buildMaintenanceListWhere(organizationId, { status, priority, propertyId, tenantId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}),
    ...(priority ? { priority } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
  };
}

export function findMaintenanceRequestsByOrganization(organizationId, { skip, take, status, priority, propertyId, tenantId, propertyIds }) {
  return prisma.maintenanceRequest.findMany({
    where: buildMaintenanceListWhere(organizationId, { status, priority, propertyId, tenantId, propertyIds }),
    orderBy: [{ priority: 'desc' }, { reportedAt: 'desc' }],
    skip,
    take,
  });
}

export function countMaintenanceRequestsByOrganization(organizationId, { status, priority, propertyId, tenantId, propertyIds }) {
  return prisma.maintenanceRequest.count({ where: buildMaintenanceListWhere(organizationId, { status, priority, propertyId, tenantId, propertyIds }) });
}

export async function getMaintenanceRequestStatusSummary(organizationId, { propertyIds } = {}) {
  const rows = await prisma.maintenanceRequest.groupBy({
    by: ['status'],
    where: buildMaintenanceListWhere(organizationId, { propertyIds }),
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

export function updateMaintenanceRequestStatus(id, status, extra = {}) {
  return prisma.maintenanceRequest.update({ where: { id }, data: { status, ...extra } });
}

export function assignMaintenanceRequest(id, assignedTo) {
  return prisma.maintenanceRequest.update({ where: { id }, data: { assignedTo, status: 'assigned' } });
}
