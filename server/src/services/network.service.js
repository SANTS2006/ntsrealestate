import { prisma } from '../config/database.js';

const fullName = (u) => `${u.firstName} ${u.lastName}`.trim();
const uniqueBy = (items, key) => [...new Map(items.map((i) => [i[key], i])).values()];

// Everything in the organization and how it is connected — owners, agents,
// tenants, properties, staff and invited-but-not-yet-active people — for the
// administrator. One request, assembled in memory from a handful of batched
// queries, so a person is shown together with who they are linked to:
//   owner  -> their properties, their agents, the tenants renting from them
//   agent  -> the owners they work for, the properties they look after, tenants
//   tenant -> what they rent, who owns it, which agents look after it
//   property -> its owner, agents, tenants
export async function getNetwork(organizationId) {
  await backfillRoleProfiles(organizationId);
  const [owners, tenants, properties, ownerAgents, assignments, rentals, users] = await Promise.all([
    prisma.owner.findMany({ where: { organizationId }, include: { user: { select: { status: true, createdAt: true } } }, orderBy: { name: 'asc' } }),
    prisma.tenant.findMany({ where: { organizationId }, include: { user: { select: { status: true, createdAt: true } } }, orderBy: { lastName: 'asc' } }),
    prisma.property.findMany({
      where: { organizationId },
      select: { id: true, propertyCode: true, name: true, ownerId: true, status: true, city: true, buildings: { select: { id: true, units: { select: { id: true, status: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.ownerAgent.findMany({ where: { organizationId }, include: { agent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } } } }),
    prisma.propertyAssignment.findMany({ where: { organizationId }, select: { propertyId: true, userId: true } }),
    prisma.tenantRental.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true, tenantId: true, propertyId: true, source: true, createdAt: true, building: { select: { name: true } }, unit: { select: { unitNumber: true } } },
    }),
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, createdAt: true, lastLoginAt: true, userRoles: { select: { role: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const propById = new Map(properties.map((p) => [p.id, p]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const roleNames = (u) => u.userRoles.map((r) => r.role.name);

  const agentUsers = users.filter((u) => roleNames(u).includes('agent'));

  // Per-agent: owners they serve (active links) + properties (direct assignment or owned by a served owner).
  const ownersByAgent = new Map();
  for (const l of ownerAgents) {
    if (!ownersByAgent.has(l.agentUserId)) ownersByAgent.set(l.agentUserId, []);
    ownersByAgent.get(l.agentUserId).push({ id: l.ownerId, linkStatus: l.status });
  }
  const propsByAgent = new Map();
  const addAgentProp = (agentId, propertyId) => {
    if (!propsByAgent.has(agentId)) propsByAgent.set(agentId, new Set());
    propsByAgent.get(agentId).add(propertyId);
  };
  for (const a of assignments) if (userById.get(a.userId) && roleNames(userById.get(a.userId)).includes('agent')) addAgentProp(a.userId, a.propertyId);
  for (const l of ownerAgents) {
    if (l.status !== 'active') continue;
    for (const p of properties) if (p.ownerId === l.ownerId) addAgentProp(l.agentUserId, p.id);
  }

  // Per-property: agents (derived above, reversed) and active tenants.
  const agentsByProperty = new Map();
  for (const [agentId, set] of propsByAgent) {
    for (const pid of set) {
      if (!agentsByProperty.has(pid)) agentsByProperty.set(pid, []);
      agentsByProperty.get(pid).push(agentId);
    }
  }
  const rentalsByTenant = new Map();
  const rentalsByProperty = new Map();
  for (const r of rentals) {
    if (!rentalsByTenant.has(r.tenantId)) rentalsByTenant.set(r.tenantId, []);
    rentalsByTenant.get(r.tenantId).push(r);
    if (!rentalsByProperty.has(r.propertyId)) rentalsByProperty.set(r.propertyId, []);
    rentalsByProperty.get(r.propertyId).push(r);
  }
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const agentRef = (id) => { const u = userById.get(id); return u ? { userId: u.id, name: fullName(u), status: u.status } : null; };
  const ownerRef = (id) => { const o = ownerById.get(id); return o ? { id: o.id, name: o.name } : null; };
  const tenantRef = (id) => { const t = tenantById.get(id); return t ? { id: t.id, name: `${t.firstName} ${t.lastName}`.trim() } : null; };
  const propRef = (id) => { const p = propById.get(id); return p ? { id: p.id, name: p.name, code: p.propertyCode } : null; };

  const outOwners = owners.map((o) => {
    const props = properties.filter((p) => p.ownerId === o.id);
    const tenantIds = uniqueBy(props.flatMap((p) => (rentalsByProperty.get(p.id) ?? []).map((r) => ({ id: r.tenantId }))), 'id');
    return {
      id: o.id, name: o.name, email: o.email, phone: o.phone, status: o.status,
      accountStatus: o.user?.status ?? null, hasLogin: Boolean(o.userId), invitedAt: o.user?.createdAt ?? null,
      properties: props.map((p) => propRef(p.id)),
      agents: ownerAgents.filter((l) => l.ownerId === o.id).map((l) => ({ ...agentRef(l.agentUserId), linkStatus: l.status })),
      tenants: tenantIds.map((t) => tenantRef(t.id)).filter(Boolean),
    };
  });

  const outAgents = agentUsers.map((u) => {
    const propIds = [...(propsByAgent.get(u.id) ?? [])];
    const tenantIds = uniqueBy(propIds.flatMap((pid) => (rentalsByProperty.get(pid) ?? []).map((r) => ({ id: r.tenantId }))), 'id');
    return {
      userId: u.id, name: fullName(u), email: u.email, phone: u.phone, accountStatus: u.status,
      owners: (ownersByAgent.get(u.id) ?? []).map((l) => ({ ...ownerRef(l.id), linkStatus: l.linkStatus })).filter((o) => o.id),
      properties: propIds.map(propRef).filter(Boolean),
      tenants: tenantIds.map((t) => tenantRef(t.id)).filter(Boolean),
    };
  });

  const outTenants = tenants.map((t) => {
    const rs = rentalsByTenant.get(t.id) ?? [];
    const propIds = [...new Set(rs.map((r) => r.propertyId))];
    return {
      id: t.id, name: `${t.firstName} ${t.lastName}`.trim(), email: t.email, phone: t.phone, status: t.status,
      accountStatus: t.user?.status ?? null, hasLogin: Boolean(t.userId), invitedAt: t.user?.createdAt ?? null,
      rentals: rs.map((r) => ({ property: propRef(r.propertyId), building: r.building?.name ?? null, unit: r.unit?.unitNumber ?? null, source: r.source })),
      owners: uniqueBy(propIds.map((pid) => propById.get(pid)?.ownerId).filter(Boolean).map(ownerRef).filter(Boolean), 'id'),
      agents: uniqueBy(propIds.flatMap((pid) => agentsByProperty.get(pid) ?? []).map(agentRef).filter(Boolean), 'userId'),
    };
  });

  const outProperties = properties.map((p) => {
    const units = p.buildings.flatMap((b) => b.units);
    return {
      id: p.id, code: p.propertyCode, name: p.name, city: p.city, status: p.status,
      owner: p.ownerId ? ownerRef(p.ownerId) : null,
      agents: (agentsByProperty.get(p.id) ?? []).map(agentRef).filter(Boolean),
      tenants: uniqueBy((rentalsByProperty.get(p.id) ?? []).map((r) => tenantRef(r.tenantId)).filter(Boolean), 'id'),
      buildings: p.buildings.length, units: units.length, occupiedUnits: units.filter((x) => x.status === 'occupied').length,
    };
  });

  // Everyone with a login who is not an owner, agent or tenant (administrators,
  // accountants, maintenance managers, auditors...).
  const people = users.map((u) => ({ id: u.id, name: fullName(u), email: u.email, phone: u.phone, status: u.status, roles: roleNames(u), invitedAt: u.createdAt, lastLoginAt: u.lastLoginAt }));
  const staff = people.filter((u) => !u.roles.some((r) => ['owner', 'agent', 'tenant'].includes(r)));
  const pending = people.filter((u) => u.status === 'pending');

  return {
    totals: {
      owners: outOwners.length, agents: outAgents.length, tenants: outTenants.length, properties: outProperties.length,
      users: people.length, staff: staff.length, pending: pending.length, links: ownerAgents.length, activeRentals: rentals.length,
    },
    owners: outOwners,
    agents: outAgents,
    tenants: outTenants,
    properties: outProperties,
    everyone: people,
    staff,
    pending,
  };
}
import { backfillRoleProfiles } from './roleProfile.service.js';
