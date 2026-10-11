import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../server/src/config/database.js';
import { setIo } from '../../../server/src/realtime/hub.js';
import { notify, markAsRead, markAllAsRead } from '../../../server/src/services/notification.service.js';

// Each new notification is pushed to its owner's sockets as it is created.
// A fake socket server records what would be sent to whom.

const tag = `live${Date.now()}`;
let org; let user; let other;
const sent = [];
const fakeIo = { to(room) { return { emit: (event, payload) => sent.push({ room, event, payload }) }; } };

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: tag, slug: tag, email: `${tag}@example.test` } });
  const mk = (n) => prisma.user.create({ data: { organizationId: org.id, firstName: n, lastName: 'T', email: `${tag}-${n}-${randomBytes(2).toString('hex')}@example.test`, passwordHash: 'x', status: 'active', emailVerified: true } });
  user = await mk('a'); other = await mk('b');
  setIo(fakeIo);
}, 60_000);

afterAll(async () => {
  setIo(null);
  if (org) {
    await prisma.notification.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
  }
}, 60_000);

describe('live notifications', () => {
  it('pushes a new notification to its owner only, with the full notification', async () => {
    await notify({ organizationId: org.id, userId: user.id, type: 'system', title: 'Hello', message: 'World', sendEmail: false });
    expect(sent).toHaveLength(1);
    expect(sent[0].room).toBe(`actor:u:${user.id}`);
    expect(sent[0].event).toBe('notification:new');
    expect(sent[0].payload).toMatchObject({ title: 'Hello', message: 'World', type: 'system', readAt: null });
    expect(typeof sent[0].payload.id).toBe('string');
    expect(sent.some((s) => s.room.includes(other.id))).toBe(false);
  }, 60_000);

  it('tells the owner\'s other tabs when something is read', async () => {
    sent.length = 0;
    const id = (await prisma.notification.findFirst({ where: { userId: user.id } })).id;
    await markAsRead(id, user.id);
    expect(sent).toEqual([{ room: `actor:u:${user.id}`, event: 'notification:read', payload: { id } }]);
    sent.length = 0;
    await markAllAsRead(user.id, org.id);
    expect(sent[0]).toMatchObject({ room: `actor:u:${user.id}`, event: 'notification:read-all' });
  }, 60_000);

  it('still creates the notification when sockets are unavailable or throw', async () => {
    setIo({ to() { throw new Error('socket server down'); } });
    await notify({ organizationId: org.id, userId: user.id, type: 'system', title: 'Quiet', message: 'No socket', sendEmail: false });
    expect(await prisma.notification.count({ where: { userId: user.id, title: 'Quiet' } })).toBe(1);
    setIo(null);
    await notify({ organizationId: org.id, userId: user.id, type: 'system', title: 'Offline', message: 'No server', sendEmail: false });
    expect(await prisma.notification.count({ where: { userId: user.id, title: 'Offline' } })).toBe(1);
  }, 60_000);
});
