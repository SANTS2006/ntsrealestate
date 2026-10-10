import { prisma } from '../config/database.js';

export function createOwner(data) {
  return prisma.owner.create({ data });
}

export function findOwnerById(id, organizationId) {
  return prisma.owner.findFirst({ where: { id, organizationId } });
}

export function findOwnerByUserId(userId, organizationId) {
  return prisma.owner.findFirst({ where: { userId, organizationId } });
}

// `propertyIds` (from resourceAccess.service.js#getRestrictedScope) is
// `undefined` for org-wide callers (no filter) vs. an array (possibly
// empty) for assignment-/ownership-scoped callers — an empty array must
// still narrow to zero rows via `some: { id: { in: [] } }`, never be
// treated as "no filter."
function buildOwnerListWhere(organizationId, { search, status, propertyIds, agentUserId }) {
  const and = [];
  if (propertyIds) {
    // In scope when they own something in scope, or (for an agent) the agent
    // is linked to them even before they own any property.
    and.push({
      OR: [
        { properties: { some: { id: { in: propertyIds } } } },
        ...(agentUserId ? [{ agentLinks: { some: { agentUserId, status: 'active' } } }] : []),
      ],
    });
  }
  if (search) {
    and.push({ OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] });
  }
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function findOwnersByOrganization(organizationId, { skip, take, search, status, propertyIds, agentUserId }) {
  return prisma.owner.findMany({ where: buildOwnerListWhere(organizationId, { search, status, propertyIds, agentUserId }), include: { user: { select: { status: true } } }, orderBy: { name: 'asc' }, skip, take });
}

export function countOwnersByOrganization(organizationId, { search, status, propertyIds, agentUserId }) {
  return prisma.owner.count({ where: buildOwnerListWhere(organizationId, { search, status, propertyIds, agentUserId }) });
}

// Used by owner.service.js#getOwner to check a scoped caller's (agent's)
// access to a single owner record: does this owner have at least one
// property within the caller's assigned propertyIds?
export function countOwnerPropertiesInScope(ownerId, propertyIds, agentUserId) {
  return prisma.property.count({ where: { ownerId, id: { in: propertyIds } } }).then(async (n) => {
    if (n > 0 || !agentUserId) return n;
    return prisma.ownerAgent.count({ where: { ownerId, agentUserId, status: 'active' } });
  });
}

const UPDATABLE_OWNER_FIELDS = ['name', 'email', 'phone', 'address'];

export function updateOwner(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_OWNER_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.owner.updateMany({ where: { id, organizationId }, data: update });
}

export function setOwnerStatus(id, organizationId, status) {
  return prisma.owner.updateMany({ where: { id, organizationId }, data: { status } });
}

export function linkOwnerUser(id, organizationId, userId) {
  return prisma.owner.updateMany({ where: { id, organizationId }, data: { userId } });
}
