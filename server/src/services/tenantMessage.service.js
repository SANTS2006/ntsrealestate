import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createTenantMessage, findTenantMessagesForRecipient, countTenantMessagesForRecipient,
  findTenantMessagesForOrganization, countTenantMessagesForOrganization,
  findTenantMessageById, markTenantMessageRead, findTenantMessagesForTenant, countTenantMessagesForTenant, findMaintenanceManagerIds,
} from '../repositories/tenantMessage.repository.js';
import { findTenantByUserId, findPropertyIdForTenant } from '../repositories/tenant.repository.js';
import { findAgentAssignmentsForProperty } from '../repositories/propertyAssignment.repository.js';
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

// One tenant compose action can reach more than one agent (a property can
// have multiple assigned agents) — a TenantMessage row is created per
// recipient so each agent's inbox query stays a simple recipientId filter,
// and each gets their own in-app notification + email.
export async function sendTenantMessage(actingUser, content) {
  const tenant = await findTenantByUserId(actingUser.id, actingUser.organizationId);
  if (!tenant) throw AppError.badRequest('No tenant record is linked to your account. Contact an administrator.');

  const propertyId = await findPropertyIdForTenant(tenant.id, actingUser.organizationId);
  if (!propertyId) throw AppError.badRequest('You are not currently linked to a property. Contact an administrator.');

  // Reaches the agents on the property and every maintenance manager; the
  // administrator sees all tenant messages in the organisation-wide feed.
  const assignments = await findAgentAssignmentsForProperty(propertyId, actingUser.organizationId);
  const managerIds = await findMaintenanceManagerIds(actingUser.organizationId);
  const recipientIds = [...new Set([...assignments.map((a) => a.userId), ...managerIds])];
  if (recipientIds.length === 0) throw AppError.badRequest('No property or maintenance manager is available for your property yet. Contact an administrator.');

  const property = await findPropertyById(propertyId, actingUser.organizationId);
  const tenantName = `${tenant.firstName} ${tenant.lastName}`;

  await Promise.all(recipientIds.map((userId) =>
    createTenantMessage({ organizationId: actingUser.organizationId, tenantId: tenant.id, recipientId: userId, propertyId, content })
  ));

  for (const userId of recipientIds) {
    await notify({
      organizationId: actingUser.organizationId, userId, type: 'tenant_message',
      title: `New message from ${tenantName}`, message: `${property?.name ? `[${property.name}] ` : ''}${content}`,
    });
  }

  return { sent: recipientIds.length };
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
