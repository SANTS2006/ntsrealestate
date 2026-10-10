import { prisma } from '../config/database.js';

export function createTenantMessage(data) {
  return prisma.tenantMessage.create({ data });
}

export function findTenantMessagesForRecipient(recipientId, organizationId, { skip, take }) {
  return prisma.tenantMessage.findMany({
    where: { recipientId, organizationId },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true } },
      property: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countTenantMessagesForRecipient(recipientId, organizationId) {
  return prisma.tenantMessage.count({ where: { recipientId, organizationId } });
}

// Admin org-wide feed — every tenant message, regardless of recipient, with
// both the sender and recipient attached. Query-mode, not row duplication;
// gated in tenantMessage.service.js#listInbox on the administrator role.
export function findTenantMessagesForOrganization(organizationId, { skip, take }) {
  return prisma.tenantMessage.findMany({
    where: { organizationId },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true } },
      recipient: { select: { id: true, firstName: true, lastName: true } },
      property: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countTenantMessagesForOrganization(organizationId) {
  return prisma.tenantMessage.count({ where: { organizationId } });
}

const DETAIL_INCLUDE = {
  tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true } },
  recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
  property: { select: { id: true, name: true, city: true } },
};

export function findTenantMessageById(id, organizationId) {
  return prisma.tenantMessage.findFirst({ where: { id, organizationId }, include: DETAIL_INCLUDE });
}

export function markTenantMessageRead(id) {
  return prisma.tenantMessage.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
}

// A tenant's own sent messages, newest first.
export function findTenantMessagesForTenant(tenantId, organizationId, { skip, take }) {
  return prisma.tenantMessage.findMany({
    where: { tenantId, organizationId },
    include: { recipient: { select: { id: true, firstName: true, lastName: true } }, property: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countTenantMessagesForTenant(tenantId, organizationId) {
  return prisma.tenantMessage.count({ where: { tenantId, organizationId } });
}

// Everyone with the maintenance-manager role in the organisation.
export async function findMaintenanceManagerIds(organizationId) {
  const rows = await prisma.userRole.findMany({
    where: { role: { organizationId, name: 'maintenance_manager' }, user: { organizationId } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
