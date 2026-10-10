import { prisma } from '../config/database.js';

export function createWorkOrder(data) {
  return prisma.workOrder.create({ data });
}

export function findWorkOrderById(id, organizationId) {
  return prisma.workOrder.findFirst({
    where: { id, organizationId },
    include: { maintenanceRequest: { include: { property: true } }, vendor: true },
  });
}

export function findWorkOrdersByMaintenanceRequest(maintenanceRequestId, organizationId) {
  return prisma.workOrder.findMany({ where: { maintenanceRequestId, organizationId }, orderBy: { scheduledDate: 'asc' } });
}

function buildWorkOrderListWhere(organizationId, { status, vendorId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(propertyIds ? { maintenanceRequest: { propertyId: { in: propertyIds } } } : {}),
  };
}

export function findWorkOrdersByOrganization(organizationId, { skip, take, status, vendorId, propertyIds }) {
  return prisma.workOrder.findMany({
    where: buildWorkOrderListWhere(organizationId, { status, vendorId, propertyIds }),
    include: { maintenanceRequest: true, vendor: true },
    orderBy: { scheduledDate: 'asc' },
    skip,
    take,
  });
}

export function countWorkOrdersByOrganization(organizationId, { status, vendorId, propertyIds }) {
  return prisma.workOrder.count({ where: buildWorkOrderListWhere(organizationId, { status, vendorId, propertyIds }) });
}

export async function getWorkOrderStatusSummary(organizationId, { propertyIds } = {}) {
  const rows = await prisma.workOrder.groupBy({
    by: ['status'],
    where: buildWorkOrderListWhere(organizationId, { propertyIds }),
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

const UPDATABLE_WORK_ORDER_FIELDS = ['vendorId', 'assignedStaffId', 'scheduledDate', 'estimatedCost'];

export function updateWorkOrder(id, data) {
  const update = {};
  for (const field of UPDATABLE_WORK_ORDER_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.workOrder.update({ where: { id }, data: update });
}

export function setWorkOrderStatus(id, status, extra = {}) {
  return prisma.workOrder.update({ where: { id }, data: { status, ...extra } });
}
