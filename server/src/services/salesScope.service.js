import { prisma } from '../config/database.js';
import { findOwnerByUserId } from '../repositories/owner.repository.js';
import { findTenantByUserId } from '../repositories/tenant.repository.js';
import { findPropertyIdsAssignedToUser } from '../repositories/propertyAssignment.repository.js';
import { NO_MATCH_ID, ORG_WIDE_PROPERTY_ROLES } from './resourceAccess.service.js';

// Who may see which lands and deals (and the payments recorded against them):
//   administrator & other organization-wide roles -> everything
//   owner  -> what belongs to them (their properties, their lands)
//   agent  -> what belongs to the owners they work for, plus properties they are assigned to
//   tenant -> only their own deals
// Returns { orgWide: true } | { tenantId } | { ownerIds, propertyIds }.
export async function getSalesScope(actingUser, organizationId) {
  const roles = actingUser.roles;
  if (roles.some((r) => ORG_WIDE_PROPERTY_ROLES.has(r))) return { orgWide: true };

  if (roles.includes('agent')) {
    const [links, assigned] = await Promise.all([
      prisma.ownerAgent.findMany({ where: { organizationId, agentUserId: actingUser.id, status: 'active' }, select: { ownerId: true } }),
      findPropertyIdsAssignedToUser(actingUser.id, organizationId),
    ]);
    return { ownerIds: links.map((l) => l.ownerId), propertyIds: assigned.map((a) => a.propertyId) };
  }

  if (roles.includes('owner')) {
    const owner = await findOwnerByUserId(actingUser.id, organizationId);
    if (!owner) return { ownerIds: [], propertyIds: [] };
    const props = await prisma.property.findMany({ where: { organizationId, ownerId: owner.id }, select: { id: true } });
    return { ownerIds: [owner.id], propertyIds: props.map((p) => p.id) };
  }

  if (roles.includes('tenant')) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    return { tenantId: tenant?.id ?? NO_MATCH_ID };
  }

  return { ownerIds: [], propertyIds: [] };
}

// A Prisma `where` fragment for deals, from a scope.
export function dealScopeWhere(scope) {
  if (scope.orgWide) return {};
  if (scope.tenantId) return { tenantId: scope.tenantId };
  return {
    OR: [
      { propertyId: { in: scope.propertyIds?.length ? scope.propertyIds : [NO_MATCH_ID] } },
      { ownerId: { in: scope.ownerIds?.length ? scope.ownerIds : [NO_MATCH_ID] } },
    ],
  };
}

// Everyone who should hear about something on a deal: administrators, the
// owner, the owner's agents and agents assigned to the property.
export async function dealStaffUserIds(organizationId, { ownerId, propertyId }) {
  const ids = new Set();
  const admins = await prisma.user.findMany({
    where: { organizationId, status: 'active', userRoles: { some: { role: { name: 'administrator' } } } },
    select: { id: true }, take: 25,
  });
  admins.forEach((a) => ids.add(a.id));
  if (ownerId) {
    const owner = await prisma.owner.findFirst({ where: { id: ownerId, organizationId }, select: { userId: true } });
    if (owner?.userId) ids.add(owner.userId);
    const links = await prisma.ownerAgent.findMany({ where: { organizationId, ownerId, status: 'active' }, select: { agentUserId: true } });
    links.forEach((l) => ids.add(l.agentUserId));
  }
  if (propertyId) {
    const assigned = await prisma.propertyAssignment.findMany({ where: { organizationId, propertyId }, select: { userId: true } });
    assigned.forEach((a) => ids.add(a.userId));
  }
  return [...ids];
}
