import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../server/src/config/database.js';
import { sendTenantMessage, listInbox } from '../../../server/src/services/tenantMessage.service.js';

// Who receives a tenant's message: the agents connected to the tenant (and
// only them), and the administrators. Throwaway organisation, removed afterwards.

const tag = `tmr${Date.now()}`;
let org; const u = {}; let tenant; let property;
const page = { page: 1, pageSize: 50, skip: 0, take: 50 };

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: tag, slug: tag, email: `${tag}@example.test` } });
  const roles = {};
  for (const name of ['administrator', 'agent', 'tenant']) roles[name] = await prisma.role.create({ data: { organizationId: org.id, name } });
  const mk = async (n, role) => {
    const user = await prisma.user.create({ data: { organizationId: org.id, firstName: n, lastName: 'T', email: `${tag}-${n}-${randomBytes(2).toString('hex')}@example.test`, passwordHash: 'x', status: 'active', emailVerified: true } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roles[role].id } });
    return user;
  };
  u.admin = await mk('admin', 'administrator');
  u.agent = await mk('agent', 'agent');
  u.stranger = await mk('stranger', 'agent');
  u.tenantUser = await mk('tenant', 'tenant');
  tenant = await prisma.tenant.create({ data: { organizationId: org.id, userId: u.tenantUser.id, firstName: 'Ten', lastName: 'Ant', email: u.tenantUser.email } });
  property = await prisma.property.create({ data: { organizationId: org.id, name: 'Home', propertyCode: `P${tag}`, propertyType: 'house', structureType: 'whole', status: 'active', city: 'X', address: '1 Road' } });
}, 90_000);

afterAll(async () => {
  if (!org) return;
  const id = org.id;
  await prisma.tenantMessage.deleteMany({ where: { organizationId: id } });
  await prisma.notification.deleteMany({ where: { organizationId: id } });
  await prisma.tenantRental.deleteMany({ where: { organizationId: id } });
  await prisma.propertyAssignment.deleteMany({ where: { organizationId: id } });
  await prisma.tenant.deleteMany({ where: { organizationId: id } });
  await prisma.property.deleteMany({ where: { organizationId: id } });
  await prisma.userRole.deleteMany({ where: { user: { organizationId: id } } });
  await prisma.role.deleteMany({ where: { organizationId: id } });
  await prisma.user.deleteMany({ where: { organizationId: id } });
  await prisma.organization.delete({ where: { id } }).catch((e) => console.error('cleanup failed', tag, e.message));
}, 90_000);

const actor = (user, roles) => ({ id: user.id, organizationId: org.id, roles });

describe('tenant message routing', () => {
  it('with no agent connected yet, still reaches the administrators', async () => {
    const res = await sendTenantMessage(actor(u.tenantUser, ['tenant']), 'Hello, anyone there?');
    expect(res.sent).toBe(1);
    const adminInbox = await listInbox(org.id, actor(u.admin, ['administrator']), page);
    expect(adminInbox.messages.map((m) => m.content)).toContain('Hello, anyone there?');
    expect(await prisma.notification.count({ where: { userId: u.admin.id, type: 'tenant_message' } })).toBe(1);
  }, 90_000);

  it('goes to the agent assigned to the tenant\'s home, and not to other agents', async () => {
    await prisma.tenantRental.create({ data: { organizationId: org.id, tenantId: tenant.id, propertyId: property.id, status: 'active' } });
    await prisma.propertyAssignment.create({ data: { organizationId: org.id, propertyId: property.id, userId: u.agent.id } });
    await sendTenantMessage(actor(u.tenantUser, ['tenant']), 'The tap is leaking');

    const agentInbox = await listInbox(org.id, actor(u.agent, ['agent']), page);
    expect(agentInbox.messages.map((m) => m.content)).toEqual(['The tap is leaking']);
    const strangerInbox = await listInbox(org.id, actor(u.stranger, ['agent']), page);
    expect(strangerInbox.messages).toHaveLength(0);

    const adminInbox = await listInbox(org.id, actor(u.admin, ['administrator']), page);
    expect(adminInbox.messages.map((m) => m.content)).toEqual(expect.arrayContaining(['The tap is leaking', 'Hello, anyone there?']));
    expect(await prisma.notification.count({ where: { userId: u.admin.id, title: { contains: 'Ten Ant' } } })).toBeGreaterThanOrEqual(2);
    expect(await prisma.notification.count({ where: { userId: u.stranger.id } })).toBe(0);
  }, 90_000);

  it('the tenant sees what they sent', async () => {
    const mine = await listInbox(org.id, actor(u.tenantUser, ['tenant']), page);
    expect(mine.messages.length).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
