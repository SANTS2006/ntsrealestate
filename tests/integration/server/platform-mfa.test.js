import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { prisma } from '../../../server/src/config/database.js';
import { hashPassword } from '../../../server/src/auth/password.js';
import { decryptSecret } from '../../../server/src/auth/crypto.js';
import { signMfaChallengeToken } from '../../../server/src/auth/jwt.js';
import { loginPlatformAdmin } from '../../../server/src/services/platformAdmin.service.js';
import * as mfa from '../../../server/src/services/platformAdminMfa.service.js';

// Two-factor sign-in for platform admins, against the real database, with
// throwaway admins that are removed afterwards.

const PASSWORD = 'Correct-Horse-Battery-9';
const req = () => ({ ip: '127.0.0.1', id: 'test', session: { regenerate: (cb) => cb(), save: (cb) => cb() } });
let admin; let other; let secret; let recoveryCodes;
const code = () => authenticator.generate(secret);

beforeAll(async () => {
  const mk = async (n) => prisma.platformAdmin.create({ data: { firstName: n, lastName: 'Mfa', email: `mfa-${n.toLowerCase()}-${randomBytes(3).toString('hex')}@example.test`, passwordHash: await hashPassword(PASSWORD) } });
  admin = await mk('One'); other = await mk('Two');
}, 60_000);

afterAll(async () => {
  await prisma.platformAdmin.deleteMany({ where: { id: { in: [admin?.id, other?.id].filter(Boolean) } } }).catch(() => {});
}, 60_000);

describe('platform admin two-factor authentication', () => {
  it('signs in with just a password while it is off', async () => {
    const res = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    expect(res.admin.id).toBe(admin.id);
    expect(res.admin.mfaEnabled).toBe(false);
  }, 60_000);

  it('turns on only after a correct code, and shows recovery codes once', async () => {
    const enrolled = await mfa.enroll(admin, req());
    expect(enrolled.otpAuthUrl).toMatch(/^otpauth:\/\/totp\//);
    secret = enrolled.secret;
    expect((await prisma.platformAdmin.findUnique({ where: { id: admin.id } })).mfaEnabled).toBe(false); // not on yet
    await expect(mfa.confirm(admin, '000000', req())).rejects.toThrow(/not correct/i);
    const done = await mfa.confirm(admin, code(), req());
    expect(done.enabled).toBe(true);
    recoveryCodes = done.recoveryCodes;
    expect(recoveryCodes).toHaveLength(8);
    const row = await prisma.platformAdmin.findUnique({ where: { id: admin.id } });
    expect(row.mfaEnabled).toBe(true);
    expect(row.mfaSecretEncrypted).not.toContain(secret); // encrypted at rest
    expect(decryptSecret(row.mfaSecretEncrypted)).toBe(secret);
    const stored = await prisma.platformAdminRecoveryCode.findMany({ where: { platformAdminId: admin.id } });
    expect(stored.some((r) => recoveryCodes.some((c) => r.codeHash.includes(c)))).toBe(false); // only hashes stored
  }, 90_000);

  it('does not create a session after the password alone', async () => {
    const r = req();
    const res = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, r);
    expect(res.mfaRequired).toBe(true);
    expect(res.admin).toBeUndefined();
    expect(r.session.platformAdminId).toBeUndefined();
    expect(typeof res.mfaToken).toBe('string');
  }, 60_000);

  it('completes sign-in with a correct authenticator code', async () => {
    const { mfaToken } = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    const r = req();
    const res = await mfa.completeChallenge({ mfaToken, code: code() }, r);
    expect(res.admin.id).toBe(admin.id);
    expect(r.session.platformAdminId).toBe(admin.id);
  }, 60_000);

  it('rejects a wrong code and a ticket that was not made for platform sign-in', async () => {
    const { mfaToken } = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    await expect(mfa.completeChallenge({ mfaToken, code: '111111' }, req())).rejects.toThrow(/not correct/i);
    const tenantStyle = signMfaChallengeToken(admin.id); // purpose "mfa_challenge" (company users)
    await expect(mfa.completeChallenge({ mfaToken: tenantStyle, code: code() }, req())).rejects.toThrow(/Invalid/i);
    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }, 60_000);

  it('accepts a recovery code once only', async () => {
    const { mfaToken } = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    const first = await mfa.completeChallenge({ mfaToken, code: recoveryCodes[0] }, req());
    expect(first.usedRecoveryCode).toBe(true);
    await expect(mfa.completeChallenge({ mfaToken, code: recoveryCodes[0] }, req())).rejects.toThrow(/not correct/i);
    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }, 60_000);

  it('locks the account after repeated wrong codes', async () => {
    const { mfaToken } = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    for (let i = 0; i < 5; i += 1) await expect(mfa.completeChallenge({ mfaToken, code: '222222' }, req())).rejects.toThrow();
    await expect(mfa.completeChallenge({ mfaToken, code: code() }, req())).rejects.toThrow(/locked/i);
    await prisma.platformAdmin.update({ where: { id: admin.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }, 120_000);

  it('turning it off needs the password and a code', async () => {
    await expect(mfa.disable(admin, { password: 'wrong-password-1', code: code() }, req())).rejects.toThrow(/password/i);
    await expect(mfa.disable(admin, { password: PASSWORD, code: '123123' }, req())).rejects.toThrow(/not correct/i);
    await mfa.disable(admin, { password: PASSWORD, code: code() }, req());
    const row = await prisma.platformAdmin.findUnique({ where: { id: admin.id } });
    expect(row.mfaEnabled).toBe(false);
    expect(row.mfaSecretEncrypted).toBeNull();
    expect(await prisma.platformAdminRecoveryCode.count({ where: { platformAdminId: admin.id } })).toBe(0);
    const res = await loginPlatformAdmin({ email: admin.email, password: PASSWORD }, req());
    expect(res.admin.id).toBe(admin.id); // back to password only
  }, 90_000);

  it('lets another admin reset a locked-out colleague, but not themselves', async () => {
    const e = await mfa.enroll(other, req());
    secret = e.secret;
    await mfa.confirm(other, code(), req());
    await expect(mfa.resetFor(other.id, other, req())).rejects.toThrow(/Disable option/);
    await mfa.resetFor(other.id, admin, req());
    expect((await prisma.platformAdmin.findUnique({ where: { id: other.id } })).mfaEnabled).toBe(false);
    const actions = (await prisma.platformAuditLog.findMany({ where: { targetId: other.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toContain('auth.mfa_reset_by_admin');
  }, 90_000);
});
