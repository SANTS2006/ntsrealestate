import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';

// Sign in with Google for platform admins: existing admins only, linked to one
// Google account, two-factor still required. Google's token check is replaced.
const google = { current: null };
vi.mock('../../../server/src/auth/google.js', () => ({ verifyGoogleCredential: async () => google.current }));

const { prisma } = await import('../../../server/src/config/database.js');
const { loginPlatformAdminWithGoogle } = await import('../../../server/src/services/platformAdmin.service.js');
const { hashPassword } = await import('../../../server/src/auth/password.js');

const req = () => ({ ip: '127.0.0.1', id: 't', session: { regenerate: (cb) => cb(), save: (cb) => cb() } });
const as = (email, sub) => { google.current = { sub, email, firstName: 'G', lastName: 'T' }; };
const created = [];
const mk = async (name, extra = {}) => {
  const a = await prisma.platformAdmin.create({ data: { firstName: name, lastName: 'G', email: `pg-${name}-${randomBytes(3).toString('hex')}@example.test`, passwordHash: await hashPassword('Correct-Horse-Battery-9'), ...extra } });
  created.push(a.id);
  return a;
};

afterAll(async () => { await prisma.platformAdmin.deleteMany({ where: { id: { in: created } } }).catch(() => {}); }, 60_000);

describe('platform admin sign in with Google', () => {
  let admin;
  beforeAll(async () => { admin = await mk('one'); }, 60_000);

  it('signs in an existing admin and links the Google account', async () => {
    as(admin.email, 'g-sub-1');
    const r = req();
    const res = await loginPlatformAdminWithGoogle({ credential: 'c' }, r);
    expect(res.admin.id).toBe(admin.id);
    expect(r.session.platformAdminId).toBe(admin.id);
    expect((await prisma.platformAdmin.findUnique({ where: { id: admin.id } })).googleSub).toBe('g-sub-1');
  }, 90_000);

  it('only that Google account works afterwards', async () => {
    as(admin.email, 'g-sub-other');
    await expect(loginPlatformAdminWithGoogle({ credential: 'c' }, req())).rejects.toThrow(/different Google account/i);
  }, 60_000);

  it('never creates an admin: an unknown address is refused', async () => {
    as(`nobody-${randomBytes(3).toString('hex')}@example.test`, 'g-sub-x');
    await expect(loginPlatformAdminWithGoogle({ credential: 'c' }, req())).rejects.toThrow(/No platform admin account/i);
  }, 60_000);

  it('a deactivated admin cannot sign in', async () => {
    const off = await mk('off', { isActive: false });
    as(off.email, 'g-sub-off');
    await expect(loginPlatformAdminWithGoogle({ credential: 'c' }, req())).rejects.toThrow(/deactivated/i);
  }, 60_000);

  it('two-factor is still required', async () => {
    const m = await mk('mfa', { mfaEnabled: true, mfaSecretEncrypted: 'x' });
    as(m.email, 'g-sub-mfa');
    const r = req();
    const res = await loginPlatformAdminWithGoogle({ credential: 'c' }, r);
    expect(res.mfaRequired).toBe(true);
    expect(typeof res.mfaToken).toBe('string');
    expect(r.session.platformAdminId).toBeUndefined();
  }, 60_000);
});
