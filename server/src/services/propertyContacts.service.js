import { prisma } from '../config/database.js';

const CONTACT_SELECT = { id: true, firstName: true, lastName: true, email: true, phone: true, status: true };

// Everyone responsible for a property, for a tenant to see and talk to:
//   - its owner (the Owner record's login, if it has one), and
//   - its agents: users with the agent role who are assigned to the property
//     directly, plus agents with an ACTIVE link to the property's owner.
// Only active accounts are returned. Deliberately minimal fields — a tenant
// learns who looks after their home, nothing more about them.
export async function getPropertyContacts(propertyId, organizationId) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: {
      id: true,
      ownerId: true,
      owner: { select: { id: true, name: true, email: true, phone: true, user: { select: CONTACT_SELECT } } },
    },
  });
  if (!property) return { owner: null, agents: [] };

  const [assigned, linked] = await Promise.all([
    prisma.propertyAssignment.findMany({
      where: { propertyId, organizationId, user: { status: 'active', userRoles: { some: { role: { name: 'agent' } } } } },
      select: { user: { select: CONTACT_SELECT } },
    }),
    property.ownerId
      ? prisma.ownerAgent.findMany({
          where: { ownerId: property.ownerId, organizationId, status: 'active', agent: { status: 'active' } },
          select: { agent: { select: CONTACT_SELECT } },
        })
      : [],
  ]);

  const agents = new Map();
  for (const row of assigned) agents.set(row.user.id, row.user);
  for (const row of linked) agents.set(row.agent.id, row.agent);

  const ownerUser = property.owner?.user?.status === 'active' ? property.owner.user : null;
  return {
    owner: property.owner
      ? {
          name: property.owner.name,
          email: property.owner.email,
          phone: property.owner.phone,
          userId: ownerUser?.id ?? null,
        }
      : null,
    agents: [...agents.values()].map((a) => ({ userId: a.id, name: `${a.firstName} ${a.lastName}`, email: a.email, phone: a.phone })),
  };
}

// User ids (owner + agents) who should be told about something happening at
// a property, e.g. a new rental request.
export async function getPropertyStaffUserIds(propertyId, organizationId) {
  const { owner, agents } = await getPropertyContacts(propertyId, organizationId);
  return [...new Set([owner?.userId, ...agents.map((a) => a.userId)].filter(Boolean))];
}
