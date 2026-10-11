import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { verifyPassword } from '../auth/password.js';
import { verifyMfaChallengeToken } from '../auth/jwt.js';
import {
  generateTotpSecret, buildOtpAuthUrl, encryptTotpSecret, verifyTotpCode, generateRecoveryCodes, hashRecoveryCode,
} from '../auth/mfa.js';
import { platformAudit } from './platformAudit.service.js';
import { establishPlatformSession, PLATFORM_MFA_PURPOSE } from './platformAdmin.service.js';
import { recordPlatformAdminFailedLogin } from '../repositories/platformAdmin.repository.js';

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ISSUER = 'NTS Real Estate System (Platform)';

// Step 1 of turning two-factor on: a new secret is stored (still switched off)
// and returned once so it can be scanned. Nothing changes at sign-in yet.
export async function enroll(adminRef, req) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminRef.id } });
  if (!admin) throw AppError.notFound();
  if (admin.mfaEnabled) throw AppError.conflict('Two-factor authentication is already on.');
  const secret = generateTotpSecret();
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { mfaSecretEncrypted: encryptTotpSecret(secret) } });
  await platformAudit({ actor: adminRef, action: 'auth.mfa_enrollment_started', targetType: 'platform_admin', targetId: admin.id, req });
  return { secret, otpAuthUrl: buildOtpAuthUrl(secret, admin.email, ISSUER) };
}

// Step 2: a correct code from the app proves it is set up; only then it is
// switched on, and one-time recovery codes are shown (once; stored hashed).
export async function confirm(adminRef, code, req) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminRef.id } });
  if (!admin?.mfaSecretEncrypted) throw AppError.badRequest('Start setting up two-factor authentication first.');
  if (admin.mfaEnabled) throw AppError.conflict('Two-factor authentication is already on.');
  if (!verifyTotpCode(admin.mfaSecretEncrypted, code)) throw AppError.badRequest('That code is not correct. Please try again.');

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.platformAdmin.update({ where: { id: admin.id }, data: { mfaEnabled: true } }),
    prisma.platformAdminRecoveryCode.deleteMany({ where: { platformAdminId: admin.id } }),
    prisma.platformAdminRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ platformAdminId: admin.id, codeHash: hashRecoveryCode(c) })) }),
  ]);
  await platformAudit({ actor: adminRef, action: 'auth.mfa_enabled', targetType: 'platform_admin', targetId: admin.id, req });
  return { enabled: true, recoveryCodes };
}

// Turning it off needs the password AND a current code, so a stolen session
// alone cannot remove the protection.
export async function disable(adminRef, { password, code }, req) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminRef.id } });
  if (!admin?.mfaEnabled) throw AppError.conflict('Two-factor authentication is not on.');
  if (!(await verifyPassword(admin.passwordHash, password))) throw AppError.unauthorized('Your password is not correct.');
  if (!verifyTotpCode(admin.mfaSecretEncrypted, code)) throw AppError.badRequest('That code is not correct.');
  await clear(admin.id);
  await platformAudit({ actor: adminRef, action: 'auth.mfa_disabled', targetType: 'platform_admin', targetId: admin.id, req });
  return { disabled: true };
}

async function clear(adminId) {
  await prisma.$transaction([
    prisma.platformAdmin.update({ where: { id: adminId }, data: { mfaEnabled: false, mfaSecretEncrypted: null } }),
    prisma.platformAdminRecoveryCode.deleteMany({ where: { platformAdminId: adminId } }),
  ]);
}

// Another admin can switch off a locked-out colleague's two-factor (they then
// sign in with their password and set it up again). Audited under both names.
export async function resetFor(targetId, actingAdmin, req) {
  if (targetId === actingAdmin.id) throw AppError.badRequest('Use the Disable option in My account for your own sign-in.');
  const target = await prisma.platformAdmin.findUnique({ where: { id: targetId } });
  if (!target) throw AppError.notFound('Administrator not found.');
  if (!target.mfaEnabled) throw AppError.conflict('Two-factor authentication is not on for this administrator.');
  await clear(targetId);
  await platformAudit({ actor: actingAdmin, action: 'auth.mfa_reset_by_admin', targetType: 'platform_admin', targetId, targetLabel: target.email, req });
  return { reset: true };
}

// Second step of sign-in.
export async function completeChallenge({ mfaToken, code }, req) {
  const payload = verifyMfaChallengeToken(mfaToken, PLATFORM_MFA_PURPOSE);
  const admin = await prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.isActive || !admin.mfaEnabled || !admin.mfaSecretEncrypted) throw AppError.unauthorized('Invalid sign-in. Please start again.');
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw AppError.forbidden('This account is temporarily locked due to repeated failed attempts. Please try again later.');
  }

  let recovery = null;
  const valid = verifyTotpCode(admin.mfaSecretEncrypted, code);
  if (!valid) {
    recovery = await prisma.platformAdminRecoveryCode.findFirst({ where: { platformAdminId: admin.id, codeHash: hashRecoveryCode(code ?? ''), usedAt: null } });
  }
  if (!valid && !recovery) {
    const attempts = admin.failedLoginAttempts + 1;
    const lock = attempts >= MAX_FAILED;
    await recordPlatformAdminFailedLogin(admin.id, { lock, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : undefined });
    await platformAudit({ actor: admin, action: 'auth.mfa_failed', targetType: 'platform_admin', targetId: admin.id, req });
    throw AppError.unauthorized('That code is not correct.');
  }
  if (recovery) {
    // The conditional update means one recovery code can be spent only once, even by simultaneous requests.
    const spent = await prisma.platformAdminRecoveryCode.updateMany({ where: { id: recovery.id, usedAt: null }, data: { usedAt: new Date() } });
    if (spent.count === 0) throw AppError.unauthorized('That code is not correct.');
    await platformAudit({ actor: admin, action: 'auth.mfa_recovery_code_used', targetType: 'platform_admin', targetId: admin.id, req });
  }
  const result = await establishPlatformSession(admin, req);
  return { ...result, usedRecoveryCode: Boolean(recovery) };
}
