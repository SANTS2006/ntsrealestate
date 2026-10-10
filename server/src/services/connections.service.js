import { prisma } from '../config/database.js';

const AGENT = { id: true, firstName: true, lastName: true, email: true, phone: true, status: true };
const agentOut = (u, extra = {}) => ({ userId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, phone: u.phone, accountStatus: u.status, ...extra });
const tenantOut = (t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim(), email: t.email, phone: t.phone, status: t.status });
const uniq = (items, key) => [...new Map(items.map((i) => [i[key], i])).values()];

// Who and what an owner is connected to. The caller has already been checked
// for access to this owner (owner.service.js#getOwner).
export async function getOwnerConnections(ownerId, organizationId) {
  const [properties, links] = await Promise.all([
    prisma.property.findMany({ where: { organizationId, ownerId }, select: { id: true, propertyCode: true, name: true, status: true } }),
    prisma.ownerAgent.findMany({ where: { organizationId, ownerId }, include: { agent: { select: AGENT } } }),
  ]);
  const propertyIds = properties.map((p) => p.id);
  const rentals = propertyIds.length
    ? await prisma.tenantRental.findMany({
      where: { organizationId, status: 'active', propertyId: { in: propertyIds } },
      select: { propertyId: true, unit: { select: { unitNumber: true } }, tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } },
    })
    : [];
  const assigned = propertyIds.length
    ? await prisma.propertyAssignment.findMany({ where: { organizationId, propertyId: { in: propertyIds } }, include: { user: { select: AGENT } } })
    : [];
  const propName = new Map(properties.map((p) => [p.id, p.name]));
  return {
    properties: properties.map((p) => ({ id: p.id, name: p.name, code: p.propertyCode, status: p.status })),
    agents: uniq([
      ...links.map((l) => agentOut(l.agent, { linkStatus: l.status })),
      ...assigned.map((a) => agentOut(a.user, { linkStatus: 'assigned' })),
    ], 'userId'),
    tenants: rentals.map((r) => ({ ...tenantOut(r.tenant), property: propName.get(r.propertyId), unit: r.unit?.unitNumber ?? null })),
  };
}

// What a tenant rents, who owns it and which agents look after it.
export async function getTenantConnections(tenantId, organizationId) {
  const rentals = await prisma.tenantRental.findMany({
    where: { organizationId, tenantId, status: 'active' },
    select: {
      source: true, building: { select: { name: true } }, unit: { select: { unitNumber: true } },
      property: { select: { id: true, name: true, propertyCode: true, owner: { select: { id: true, name: true, email: true, phone: true } } } },
    },
  });
  const ownerIds = [...new Set(rentals.map((r) => r.property.owner?.id).filter(Boolean))];
  const propertyIds = [...new Set(rentals.map((r) => r.property.id))];
  const [links, assigned] = await Promise.all([
    ownerIds.length ? prisma.ownerAgent.findMany({ where: { organizationId, ownerId: { in: ownerIds }, status: 'active' }, include: { agent: { select: AGENT } } }) : [],
    propertyIds.length ? prisma.propertyAssignment.findMany({ where: { organizationId, propertyId: { in: propertyIds } }, include: { user: { select: AGENT } } }) : [],
  ]);
  return {
    rentals: rentals.map((r) => ({ property: { id: r.property.id, name: r.property.name, code: r.property.propertyCode }, building: r.building?.name ?? null, unit: r.unit?.unitNumber ?? null, source: r.source })),
    owners: uniq(rentals.map((r) => r.property.owner).filter(Boolean), 'id'),
    agents: uniq([...links.map((l) => agentOut(l.agent)), ...assigned.map((a) => agentOut(a.user))], 'userId'),
  };
}
