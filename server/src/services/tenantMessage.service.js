import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createTenantMessage, findTenantMessagesForRecipient, countTenantMessagesForRecipient,
  findTenantMessagesForOrganization, countTenantMessagesForOrganization,
  findTenantMessageById, markTenantMessageRead, findTenantMessagesForTenant, countTenantMessagesForTenant,
} from '../repositories/tenantMessage.repository.js';
import { findTenantByUserId, findPropertyIdForTenant } from '../repositories/tenant.repository.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { notify } from './notification.service.js';
import { prisma } from '../config/database.js';

function serializeMessage(message) {
  return {
    id: message.id,
    content: message.content,
    readAt: message.readAt,
    createdAt: message.createdAt,
    ...(message.tenant ? { tenant: { id: message.tenant.id, firstName: message.tenant.firstName, lastName: message.tenant.lastName } } : {}),
    ...(message.recipient ? { recipient: { id: message.recipient.id, firstName: message.recipient.firstName, lastName: message.recipient.lastName } } : {}),
    ...(message.property ? { property: { id: message.property.id, name: message.property.name } } : {}),
  };
}

// Who a tenant's message reaches: the agents connected to the places the
// tenant rents or leases (assigned to the property, or linked to its owner),
// and the administrators, who also see every message in their own feed. A
// TenantMessage row is created per recipient so each person's inbox stays a
// simple "addressed to me" filter. With no agent connected yet, the message
// goes to the administrators, so it is never lost.
async function connectedPropertyIds(tenant, organizationId) {
  const [rentals, deals, leases] = await Promise.all([
    prisma.tenantRental.findMany({ where: { tenantId: tenant.id, organizationId, status: 'active' }, select: { propertyId: true } }),
    prisma.deal.findMany({ where: { tenantId: tenant.id, organizationId, kind: { in: ['rent', 'lease'] }, status: { in: ['pending', 'approved'] }, propertyId: { not: null } }, select: { propertyId: true } }),
    prisma.lease.findMany({ where: { tenantId: tenant.id, organizationId, status: { in: ['active', 'expiring_soon', 'draft'] } }, select: { unit: { select: { building: { select: { propertyId: true } } } } } }),
  ]);
  const ids = new Set([...rentals.map((r) => r.propertyId), ...deals.map((d) => d.propertyId), ...leases.map((l) => l.unit?.building?.propertyId)].filter(Boolean));
  const primary = await findPropertyIdForTenant(tenant.id, organizationId);
  if (primary) ids.add(primary);
  return [...ids];
}

async function agentsForProperties(propertyIds, organizationId) {
  if (propertyIds.length === 0) return [];
  const [assigned, viaOwner] = await Promise.all([
    prisma.propertyAssignment.findMany({
      where: { organizationId, propertyId: { in: propertyIds }, user: { status: 'active', userRoles: { some: { role: { name: 'agent' } } } } },
      select: { userId: true },
    }),
    prisma.ownerAgent.findMany({
      where: { organizationId, status: 'active', agent: { status: 'active' }, owner: { properties: { some: { id: { in: propertyIds } } } } },
      select: { agentUserId: true },
    }),
  ]);
  return [...new Set([...assigned.map((a) => a.userId), ...viaOwner.map((o) => o.agentUserId)])];
}

export async function sendTenantMessage(actingUser, content) {
  const organizationId = actingUser.organizationId;
  const tenant = await findTenantByUserId(actingUser.id, organizationId);
  if (!tenant) throw AppError.badRequest('No tenant record is linked to your account. Contact an administrator.');

  const propertyIds = await connectedPropertyIds(tenant, organizationId);
  const agentIds = await agentsForProperties(propertyIds, organizationId);
  const admins = await prisma.user.findMany({
    where: { organizationId, status: 'active', userRoles: { some: { role: { name: 'administrator' } } } },
    select: { id: true }, take: 25,
  });
  const adminIds = admins.map((a) => a.id);

  // Rows: the agents; and the administrators too when there is nobody else (they see the org-wide feed regardless).
  const rowRecipients = agentIds.length > 0 ? agentIds : adminIds;
  if (rowRecipients.length === 0) throw AppError.badRequest('No agent or administrator is available to receive your message yet. Please try again later.');

  const propertyId = propertyIds[0] ?? null;
  const property = propertyId ? await findPropertyById(propertyId, organizationId) : null;
  const tenantName = `${tenant.firstName} ${tenant.lastName}`;

  await Promise.all(rowRecipients.map((userId) =>
    createTenantMessage({ organizationId, tenantId: tenant.id, recipientId: userId, propertyId, content })
  ));

  const notifyIds = [...new Set([...agentIds, ...adminIds])];
  await Promise.all(notifyIds.map((userId) => notify({
    organizationId, userId, type: 'tenant_message',
    title: `New message from ${tenantName}`, message: `${property?.name ? `[${property.name}] ` : ''}${content}`,
  })));

  return { sent: rowRecipients.length, notified: notifyIds.length };
}

export async function listInbox(organizationId, actingUser, { page, pageSize, skip, take }) {
  // A tenant sees the messages they have sent.
  if (actingUser.roles.includes('tenant') && !actingUser.roles.some((r) => ['administrator', 'agent', 'owner', 'maintenance_manager'].includes(r))) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    if (!tenant) return { messages: [], meta: buildPaginationMeta({ page, pageSize, total: 0 }) };
    const [messages, total] = await Promise.all([
      findTenantMessagesForTenant(tenant.id, organizationId, { skip, take }),
      countTenantMessagesForTenant(tenant.id, organizationId),
    ]);
    // one row per send, not one per recipient
    const seen = new Set();
    const unique = messages.filter((m) => { const k = `${m.createdAt.getTime()}|${m.content}`; if (seen.has(k)) return false; seen.add(k); return true; });
    return { messages: unique.map(serializeMessage), meta: buildPaginationMeta({ page, pageSize, total }) };
  }
  if (actingUser.roles.includes('administrator')) {
    const [messages, total] = await Promise.all([
      findTenantMessagesForOrganization(organizationId, { skip, take }),
      countTenantMessagesForOrganization(organizationId),
    ]);
    return { messages: messages.map(serializeMessage), meta: buildPaginationMeta({ page, pageSize, total }) };
  }

  const [messages, total] = await Promise.all([
    findTenantMessagesForRecipient(actingUser.id, organizationId, { skip, take }),
    countTenantMessagesForRecipient(actingUser.id, organizationId),
  ]);
  return { messages: messages.map(serializeMessage), meta: buildPaginationMeta({ page, pageSize, total }) };
}

// One message in full — for the administrator (any), a recipient, or the
// tenant who sent it.
export async function getMessage(id, actingUser) {
  const m = await findTenantMessageById(id, actingUser.organizationId);
  if (!m) throw AppError.notFound('Message not found.');
  const isAdmin = actingUser.roles.includes('administrator');
  const isRecipient = m.recipientId === actingUser.id;
  const isSender = m.tenant?.userId === actingUser.id;
  if (!isAdmin && !isRecipient && !isSender) throw AppError.notFound('Message not found.');
  if (isRecipient && !m.readAt) {
    await markTenantMessageRead(id);
    m.readAt = new Date();
  }
  // Everyone the same message reached, for the details view.
  const siblings = await prisma.tenantMessage.findMany({
    where: { organizationId: actingUser.organizationId, tenantId: m.tenantId, content: m.content, createdAt: { gte: new Date(m.createdAt.getTime() - 60000), lte: new Date(m.createdAt.getTime() + 60000) } },
    select: { recipient: { select: { firstName: true, lastName: true } }, readAt: true },
  });
  return {
    ...serializeMessage(m),
    tenant: { id: m.tenant.id, firstName: m.tenant.firstName, lastName: m.tenant.lastName, email: m.tenant.email, phone: m.tenant.phone },
    property: m.property ? { id: m.property.id, name: m.property.name, city: m.property.city } : null,
    recipient: { id: m.recipient.id, firstName: m.recipient.firstName, lastName: m.recipient.lastName, email: m.recipient.email },
    sentTo: siblings.map((x) => ({ name: `${x.recipient.firstName} ${x.recipient.lastName}`, readAt: x.readAt })),
    viewerIsSender: isSender,
  };
}
