import { prisma } from '../config/database.js';

// A person invited from Users & Roles with the owner or tenant role needs the
// matching owner/tenant record, otherwise they would have a login but never
// show up in the Owners / Tenants lists (and could not be linked to
// properties). Agents have no profile of their own — they are connected to
// owners through owner-agent links. Safe to call repeatedly.
export async function ensureRoleProfile(userId, organizationId, roleName) {
  if (roleName !== 'owner' && roleName !== 'tenant') return;
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) return;

  if (roleName === 'owner') {
    const existing = await prisma.owner.findFirst({ where: { userId } });
    if (existing) return;
    await prisma.owner.create({
      data: { organizationId, userId, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, phone: user.phone },
    });
    return;
  }

  const existing = await prisma.tenant.findFirst({ where: { userId } });
  if (existing) return;
  await prisma.tenant.create({
    data: { organizationId, userId, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
  });
}

// Self-healing for people who were given the owner/tenant role before records
// were created automatically (or by any path that skipped it): anyone in the
// organization with the role but no matching record gets one, so they show up
// in the Owners / Tenants lists. Cheap when there is nothing to fix.
const lastBackfill = new Map();
export async function backfillRoleProfiles(organizationId) {
  // Lists call this on every load; there is rarely anything to fix, so do not
  // spend database round trips on it more than once a minute per company.
  if (Date.now() - (lastBackfill.get(organizationId) ?? 0) < 60_000) return;
  lastBackfill.set(organizationId, Date.now());
  const [owners, tenants] = await Promise.all([
    prisma.user.findMany({ where: { organizationId, owner: null, userRoles: { some: { role: { name: 'owner' } } } }, select: { id: true } }),
    prisma.user.findMany({ where: { organizationId, tenant: null, userRoles: { some: { role: { name: 'tenant' } } } }, select: { id: true } }),
  ]);
  for (const u of owners) await ensureRoleProfile(u.id, organizationId, 'owner');
  for (const u of tenants) await ensureRoleProfile(u.id, organizationId, 'tenant');
}
