import { prisma } from '../config/database.js';

// Audit remarks are append-only by design, same as audit_logs — this
// repository deliberately exposes no update/delete function.
export function createAuditRemark(entry) {
  return prisma.auditRemark.create({
    data: entry,
    include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export function findAuditRemarksByOrganization(organizationId, { skip, take }) {
  return prisma.auditRemark.findMany({
    where: { organizationId },
    include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countAuditRemarksByOrganization(organizationId) {
  return prisma.auditRemark.count({ where: { organizationId } });
}
