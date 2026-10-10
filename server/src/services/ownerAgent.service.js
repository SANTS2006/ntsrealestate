import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { findUserByEmailGlobal } from '../repositories/user.repository.js';
import { inviteUser } from './user.service.js';
import { purgeUser } from './userPurge.service.js';
import { getPropertyContacts } from './propertyContacts.service.js';
import { audit } from './audit.service.js';

const AGENT_SELECT = { id: true, firstName: true, lastName: true, email: true, phone: true, status: true };

function serializeLink(link) {
  return {
    linkId: link.id,
    status: link.status,
    createdAt: link.createdAt,
    owner: link.owner ? { id: link.owner.id, name: link.owner.name } : undefined,
    agent: {
      userId: link.agent.id,
      firstName: link.agent.firstName,
      lastName: link.agent.lastName,
      email: link.agent.email,
      phone: link.agent.phone,
      accountStatus: link.agent.status,
    },
  };
}

const isAdmin = (user) => user.roles.includes('administrator');

// The Owner record an owner-role caller acts as. Administrators act on any
// owner in their organization; nobody else manages links.
async function ownerForCaller(actingUser, organizationId, requestedOwnerId) {
  if (isAdmin(actingUser)) {
    if (!requestedOwnerId) throw AppError.badRequest('Choose which owner this agent works for.');
    const owner = await prisma.owner.findFirst({ where: { id: requestedOwnerId, organizationId } });
    if (!owner) throw AppError.badRequest('That owner does not exist in this organization.');
    return owner;
  }
  if (actingUser.roles.includes('owner')) {
    const owner = await prisma.owner.findFirst({ where: { userId: actingUser.id, organizationId } });
    if (!owner) throw AppError.forbidden('No owner profile is associated with your account.');
    return owner;
  }
  throw AppError.forbidden();
}

// A link the caller is allowed to manage: administrators any in their
// organization, owners only their own. Anything else is "not found" — the
// existence of someone else's agent relationships is never confirmed.
async function loadManagedLink(linkId, actingUser, organizationId) {
  const link = await prisma.ownerAgent.findFirst({
    where: { id: linkId, organizationId },
    include: { owner: true, agent: { select: AGENT_SELECT } },
  });
  if (!link) throw AppError.notFound('Agent not found.');
  if (!isAdmin(actingUser)) {
    const own = actingUser.roles.includes('owner')
      ? await prisma.owner.findFirst({ where: { userId: actingUser.id, organizationId }, select: { id: true } })
      : null;
    if (!own || own.id !== link.ownerId) throw AppError.notFound('Agent not found.');
  }
  return link;
}

// Who the caller may see:
//   administrator - every owner-agent link in the organization
//   owner         - their own agents
//   agent         - the owners they work for (their own links)
//   tenant        - only the agents looking after places registered to them
export async function listAgentLinks(actingUser, organizationId) {
  const include = { owner: true, agent: { select: AGENT_SELECT } };

  if (isAdmin(actingUser)) {
    const links = await prisma.ownerAgent.findMany({ where: { organizationId }, include, orderBy: { createdAt: 'desc' } });
    const linkedIds = new Set(links.map((l) => l.agentUserId));
    const unlinked = await prisma.user.findMany({
      where: { organizationId, id: { notIn: [...linkedIds] }, userRoles: { some: { role: { name: 'agent' } } } },
      select: AGENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return [
      ...links.map(serializeLink),
      ...unlinked.map((a) => ({
        linkId: null, status: 'unlinked', createdAt: null, owner: undefined,
        agent: { userId: a.id, firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone, accountStatus: a.status },
      })),
    ];
  }
  if (actingUser.roles.includes('owner')) {
    const owner = await prisma.owner.findFirst({ where: { userId: actingUser.id, organizationId } });
    if (!owner) return [];
    const links = await prisma.ownerAgent.findMany({ where: { organizationId, ownerId: owner.id }, include, orderBy: { createdAt: 'desc' } });
    return links.map(serializeLink);
  }
  if (actingUser.roles.includes('agent')) {
    const links = await prisma.ownerAgent.findMany({ where: { organizationId, agentUserId: actingUser.id }, include, orderBy: { createdAt: 'desc' } });
    return links.map(serializeLink);
  }
  if (actingUser.roles.includes('tenant')) {
    const rentals = await prisma.tenantRental.findMany({
      where: { organizationId, status: 'active', tenant: { userId: actingUser.id } },
      select: { propertyId: true },
    });
    const seen = new Map();
    for (const propertyId of new Set(rentals.map((r) => r.propertyId))) {
      const { agents } = await getPropertyContacts(propertyId, organizationId);
      for (const a of agents) seen.set(a.userId, a);
    }
    return [...seen.values()].map((a) => ({
      linkId: null, status: 'active', owner: undefined,
      agent: { userId: a.userId, firstName: a.name.split(' ')[0], lastName: a.name.split(' ').slice(1).join(' '), email: a.email, phone: a.phone, accountStatus: 'active' },
    }));
  }
  return [];
}

// Adds an agent for an owner. If the email already belongs to an agent in
// this organization they are simply linked (an agent can serve many
// owners); otherwise a new agent account is created and invited by email.
export async function addAgent(actingUser, organizationId, { firstName, lastName, email, ownerId }, invitedBy, req) {
  const owner = await ownerForCaller(actingUser, organizationId, ownerId);

  let agentUserId;
  const existing = await findUserByEmailGlobal(email);
  if (existing) {
    if (existing.organizationId !== organizationId) throw AppError.conflict('A user with this email already exists.');
    const roles = await prisma.userRole.findMany({ where: { userId: existing.id }, include: { role: true } });
    if (!roles.some((r) => r.role.name === 'agent')) throw AppError.conflict('A user with this email already exists and is not an agent.');
    agentUserId = existing.id;
  } else {
    const created = await inviteUser({ organizationId, invitedBy, firstName, lastName, email, roleName: 'agent' }, req);
    agentUserId = created.id;
  }

  const duplicate = await prisma.ownerAgent.findUnique({ where: { ownerId_agentUserId: { ownerId: owner.id, agentUserId } } });
  if (duplicate) throw AppError.conflict('This agent is already linked to that owner.');

  const link = await prisma.ownerAgent.create({
    data: { organizationId, ownerId: owner.id, agentUserId },
    include: { owner: true, agent: { select: AGENT_SELECT } },
  });
  await audit({ organizationId, userId: actingUser.id, action: 'agent.linked', entityType: 'owner', entityId: owner.id, newValues: { agentUserId }, req });
  return serializeLink(link);
}

export async function updateAgent(linkId, actingUser, organizationId, { firstName, lastName, phone }, req) {
  const link = await loadManagedLink(linkId, actingUser, organizationId);
  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (phone !== undefined) data.phone = phone;
  if (Object.keys(data).length === 0) throw AppError.badRequest('Nothing to update.');

  await prisma.user.update({ where: { id: link.agentUserId }, data });
  await audit({ organizationId, userId: actingUser.id, action: 'agent.updated', entityType: 'user', entityId: link.agentUserId, newValues: data, req });
  return serializeLink(await prisma.ownerAgent.findUnique({ where: { id: linkId }, include: { owner: true, agent: { select: AGENT_SELECT } } }));
}

// Deactivating only turns off THIS owner's link: the agent loses access to
// this owner's properties and tenants but keeps working for their other
// owners. (Deactivating the whole account is an organization-admin action.)
export async function setAgentLinkStatus(linkId, actingUser, organizationId, status, req) {
  const link = await loadManagedLink(linkId, actingUser, organizationId);
  const updated = await prisma.ownerAgent.update({
    where: { id: link.id }, data: { status },
    include: { owner: true, agent: { select: AGENT_SELECT } },
  });
  await audit({ organizationId, userId: actingUser.id, action: 'agent.link_status_changed', entityType: 'owner', entityId: link.ownerId, oldValues: { status: link.status }, newValues: { status, agentUserId: link.agentUserId }, req });
  return serializeLink(updated);
}

// Removes the agent from this owner. If that leaves the agent with no other
// owner and no directly assigned property, their account has no purpose left
// and is deleted completely (as if they never existed); otherwise only the
// link goes and the agent carries on elsewhere.
export async function removeAgent(linkId, actingUser, organizationId, req) {
  const link = await loadManagedLink(linkId, actingUser, organizationId);
  await prisma.ownerAgent.delete({ where: { id: link.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'agent.unlinked', entityType: 'owner', entityId: link.ownerId, oldValues: { agentUserId: link.agentUserId }, req });

  const [otherLinks, assignments] = await Promise.all([
    prisma.ownerAgent.count({ where: { agentUserId: link.agentUserId } }),
    prisma.propertyAssignment.count({ where: { userId: link.agentUserId } }),
  ]);
  let accountDeleted = false;
  if (otherLinks === 0 && assignments === 0) {
    await purgeUser(link.agentUserId, organizationId, actingUser, req);
    accountDeleted = true;
  }
  return { removed: true, accountDeleted };
}
