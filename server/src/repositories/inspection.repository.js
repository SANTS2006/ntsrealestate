import { prisma } from '../config/database.js';

export function createInspection(data) {
  return prisma.inspection.create({ data });
}

export function findInspectionById(id, organizationId) {
  return prisma.inspection.findFirst({ where: { id, organizationId }, include: { property: true, unit: true, building: true } });
}

function buildInspectionListWhere(organizationId, { status, type, propertyId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
  };
}

export function findInspectionsByOrganization(organizationId, { skip, take, status, type, propertyId, propertyIds }) {
  return prisma.inspection.findMany({
    where: buildInspectionListWhere(organizationId, { status, type, propertyId, propertyIds }),
    include: { property: { select: { name: true } }, unit: { select: { unitNumber: true, isWhole: true } }, building: { select: { name: true, isImplicit: true } } },
    orderBy: { inspectionDate: 'desc' },
    skip,
    take,
  });
}

export function countInspectionsByOrganization(organizationId, { status, type, propertyId, propertyIds }) {
  return prisma.inspection.count({ where: buildInspectionListWhere(organizationId, { status, type, propertyId, propertyIds }) });
}

// Scheduled-but-not-yet-happened inspections due within [from, to] —
// distinct from countOverdueInspections, which looks the other direction
// (still scheduled but the date has already passed).
export function countUpcomingInspections(organizationId, { propertyIds, from, to }) {
  return prisma.inspection.count({
    where: {
      ...buildInspectionListWhere(organizationId, { status: 'scheduled', propertyIds }),
      inspectionDate: { gte: from, lte: to },
    },
  });
}

export function countOverdueInspections(organizationId, { propertyIds }) {
  return prisma.inspection.count({
    where: {
      ...buildInspectionListWhere(organizationId, { status: 'scheduled', propertyIds }),
      inspectionDate: { lt: new Date() },
    },
  });
}

const UPDATABLE_INSPECTION_FIELDS = ['inspectionDate', 'inspectorId', 'condition', 'notes'];

export function updateInspection(id, data) {
  const update = {};
  for (const field of UPDATABLE_INSPECTION_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.inspection.update({ where: { id }, data: update });
}

export function setInspectionStatus(id, status, extra = {}) {
  return prisma.inspection.update({ where: { id }, data: { status, ...extra } });
}
