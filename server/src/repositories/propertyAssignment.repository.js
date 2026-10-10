import { prisma } from '../config/database.js';

// An agent can reach a property when it is directly assigned to them OR it
// belongs to an owner they hold an active link to (see OwnerAgent).
export async function isUserAssignedToProperty(propertyId, userId) {
  const row = await prisma.propertyAssignment.findUnique({
    where: { propertyId_userId: { propertyId, userId } },
  });
  if (row) return true;
  const viaOwner = await prisma.property.count({
    where: { id: propertyId, owner: { agentLinks: { some: { agentUserId: userId, status: 'active' } } } },
  });
  return viaOwner > 0;
}

export function findAssignmentsForProperty(propertyId, organizationId) {
  return prisma.propertyAssignment.findMany({
    where: { propertyId, organizationId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

// Narrows findAssignmentsForProperty to just the assigned users who
// actually hold the `agent` role — a property can have staff assigned for
// other reasons (e.g. an inspector picked from the same assignment list),
// but a tenant's message should only ever reach the property's manager(s).
export function findAgentAssignmentsForProperty(propertyId, organizationId) {
  return prisma.propertyAssignment.findMany({
    where: { propertyId, organizationId, user: { userRoles: { some: { role: { name: 'agent' } } } } },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
  });
}

// Every agent in the organization, for the public site's team page — not
// scoped to any one property (findAgentAssignmentsForProperty above is a
// per-property lookup for a listing's "contact this agent" card).
export function findAllAgents(organizationId) {
  return prisma.user.findMany({
    where: { organizationId, status: 'active', userRoles: { some: { role: { name: 'agent' } } } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    orderBy: { firstName: 'asc' },
  });
}

export function assignUserToProperty(propertyId, userId, organizationId) {
  return prisma.propertyAssignment.upsert({
    where: { propertyId_userId: { propertyId, userId } },
    update: {},
    create: { propertyId, userId, organizationId },
  });
}

export function unassignUserFromProperty(propertyId, userId, organizationId) {
  return prisma.propertyAssignment.deleteMany({ where: { propertyId, userId, organizationId } });
}

// Every property a given user is assigned to, within their organization —
// used to scope a property_manager/agent's list view (see
// property.service.js#listProperties).
export async function findPropertyIdsAssignedToUser(userId, organizationId) {
  const [assigned, viaOwners] = await Promise.all([
    prisma.propertyAssignment.findMany({ where: { userId, organizationId }, select: { propertyId: true } }),
    prisma.property.findMany({
      where: { organizationId, owner: { agentLinks: { some: { agentUserId: userId, status: 'active' } } } },
      select: { id: true },
    }),
  ]);
  const ids = new Set(assigned.map((a) => a.propertyId));
  for (const p of viaOwners) ids.add(p.id);
  return [...ids].map((propertyId) => ({ propertyId }));
}
