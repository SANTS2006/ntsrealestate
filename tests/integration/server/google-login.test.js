import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Sign in with Google, end to end against the real database: Google's token
// check is replaced (it needs Google itself), everything after it is real.
const google = { current: null };
vi.mock('../../../server/src/auth/google.js', () => ({ verifyGoogleCredential: async () => google.current }));

const { prisma } = await import('../../../server/src/config/database.js');
const { loginWithGoogle } = await import('../../../server/src/services/auth.service.js');
const { hashPassword } = await import('../../../server/src/auth/password.js');

const tag = `gl${Date.now()}`;
let org; let other;
const req = () => ({ ip: '127.0.0.1', id: 't', session: { regenerate: (cb) => cb(), save: (cb) => cb() } });
const as = (email, sub, extra = {}) => { google.current = { sub, email, firstName: 'Gee', lastName: 'Tester', ...extra }; };
const mkUser = async (organizationId, email, extra = {}) => prisma.user.create({
  data: { organizationId, firstName: 'U', lastName: 'T', email, passwordHash: await hashPassword('Correct-Horse-Battery-9'), status: 'active', emailVerified: true, ...extra },
});

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: tag, slug: tag, email: `${tag}@example.test` } });
  other = await prisma.organization.create({ data: { name: `${tag}b`, slug: `${tag}b`, email: `${tag}b@example.test` } });
  await prisma.role.create({ data: { organizationId: org.id, name: 'tenant' } });
}, 90_000);

afterAll(async () => {
  for (const o of [org, other]) {
    if (!o) continue;
    await prisma.auditLog.deleteMany({ where: { organizationId: o.id } });
    await prisma.userRole.deleteMany({ where: { user: { organizationId: o.id } } });
    await prisma.role.deleteMany({ where: { organizationId: o.id } });
    await prisma.user.deleteMany({ where: { organizationId: o.id } });
    await prisma.organization.delete({ where: { id: o.id } }).catch(() => {});
  }
}, 90_000);

describe('sign in with Google', () => {
  it('login mode does not create accounts', async () => {
    as(`new-${tag}@example.test`, 'sub-new');
    await expect(loginWithGoogle({ credential: 'c', mode: 'login' }, org, req())).rejects.toThrow(/No account was found/i);
    expect(await prisma.user.count({ where: { email: `new-${tag}@example.test` } })).toBe(0);
  }, 90_000);

  it('register mode needs the terms, then creates an active customer and signs them in', async () => {
    as(`new-${tag}@example.test`, 'sub-new');
    await expect(loginWithGoogle({ credential: 'c', mode: 'register' }, org, req())).rejects.toThrow(/agree/i);
    const r = req();
    const res = await loginWithGoogle({ credential: 'c', mode: 'register', agreedToTerms: true }, org, r);
    expect(res.user.roles).toEqual(['tenant']);
    expect(r.session.userId).toBe(res.user.id);
    const row = await prisma.user.findUnique({ where: { id: res.user.id } });
    expect(row).toMatchObject({ status: 'active', emailVerified: true, googleSub: 'sub-new', organizationId: org.id });
    expect(row.termsAcceptedAt).not.toBeNull();
  }, 120_000);

  it('the same Google account signs in again without creating another user', async () => {
    as(`new-${tag}@example.test`, 'sub-new');
    const res = await loginWithGoogle({ credential: 'c', mode: 'login' }, org, req());
    expect(res.user.email).toBe(`new-${tag}@example.test`);
    expect(await prisma.user.count({ where: { email: `new-${tag}@example.test` } })).toBe(1);
  }, 90_000);

  it('an existing password account is linked the first time, then only that Google account works', async () => {
    const email = `old-${tag}@example.test`;
    const u = await mkUser(org.id, email);
    as(email, 'sub-old');
    await loginWithGoogle({ credential: 'c', mode: 'login' }, org, req());
    expect((await prisma.user.findUnique({ where: { id: u.id } })).googleSub).toBe('sub-old');
    as(email, 'sub-someone-else');
    await expect(loginWithGoogle({ credential: 'c', mode: 'login' }, org, req())).rejects.toThrow(/different Google account/i);
  }, 120_000);

  it('an address that belongs to another company is treated like an unknown one', async () => {
    await mkUser(other.id, `elsewhere-${tag}@example.test`);
    as(`elsewhere-${tag}@example.test`, 'sub-else');
    await expect(loginWithGoogle({ credential: 'c', mode: 'login' }, org, req())).rejects.toThrow(/No account was found/i);
    await expect(loginWithGoogle({ credential: 'c', mode: 'register', agreedToTerms: true }, org, req())).rejects.toThrow(/No account was found/i);
  }, 90_000);

  it('a deactivated account cannot sign in this way either', async () => {
    const email = `off-${tag}@example.test`;
    await mkUser(org.id, email, { status: 'inactive' });
    as(email, 'sub-off');
    await expect(loginWithGoogle({ credential: 'c', mode: 'login' }, org, req())).rejects.toThrow(/deactivated/i);
  }, 90_000);

  it('an account with two-factor on still has to give the code', async () => {
    const email = `mfa-${tag}@example.test`;
    await mkUser(org.id, email, { mfaEnabled: true, mfaSecretEncrypted: 'x' });
    as(email, 'sub-mfa');
    const r = req();
    const res = await loginWithGoogle({ credential: 'c', mode: 'login' }, org, r);
    expect(res.mfaRequired).toBe(true);
    expect(r.session.userId).toBeUndefined();
  }, 90_000);

  it('a pending invited user is activated: Google has confirmed their address', async () => {
    const email = `pending-${tag}@example.test`;
    const u = await mkUser(org.id, email, { status: 'pending', emailVerified: false });
    as(email, 'sub-pending');
    await loginWithGoogle({ credential: 'c', mode: 'login' }, org, req());
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toMatchObject({ status: 'active', emailVerified: true });
  }, 90_000);

  it('a deactivated company accepts nothing', async () => {
    as(`x-${tag}@example.test`, 'sub-x');
    await expect(loginWithGoogle({ credential: 'c', mode: 'login' }, { ...org, status: 'inactive' }, req())).rejects.toThrow(/deactivated/i);
  }, 60_000);
});
