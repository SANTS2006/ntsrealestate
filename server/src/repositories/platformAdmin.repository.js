import { prisma } from '../config/database.js';
import { hashToken } from '../auth/crypto.js';

// PlatformAdmin has no organizationId — it is deliberately outside the
// tenant-scoping convention used everywhere else in repositories/. Every
// query here is platform-wide by construction.

export function findPlatformAdminByEmail(email) {
  return prisma.platformAdmin.findUnique({ where: { email: email.toLowerCase() } });
}

export function findPlatformAdminById(id) {
  return prisma.platformAdmin.findUnique({ where: { id } });
}

export function createPlatformAdmin(data) {
  return prisma.platformAdmin.create({ data: { ...data, email: data.email.toLowerCase() } });
}

export function recordPlatformAdminFailedLogin(id, { lock, lockedUntil }) {
  return prisma.platformAdmin.update({
    where: { id },
    data: {
      failedLoginAttempts: { increment: 1 },
      ...(lock ? { lockedUntil } : {}),
    },
  });
}

export function resetPlatformAdminFailedLogins(id) {
  return prisma.platformAdmin.update({
    where: { id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}

export function findAllPlatformAdmins() {
  return prisma.platformAdmin.findMany({ orderBy: { createdAt: 'asc' } });
}

export function countActivePlatformAdmins() {
  return prisma.platformAdmin.count({ where: { isActive: true } });
}

export function updatePlatformAdmin(id, data) {
  return prisma.platformAdmin.update({ where: { id }, data });
}

export function setPlatformAdminPassword(id, passwordHash) {
  return prisma.platformAdmin.update({
    where: { id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });
}

// ── Password reset / invite tokens ──────────────────────────────────────

export function createPlatformAdminResetToken(platformAdminId, rawToken, expiresAt) {
  return prisma.platformAdminPasswordResetToken.create({
    data: { platformAdminId, tokenHash: hashToken(rawToken), expiresAt },
  });
}

export function findValidPlatformAdminResetToken(rawToken) {
  return prisma.platformAdminPasswordResetToken.findFirst({
    where: { tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
  });
}

export function invalidatePlatformAdminResetTokens(platformAdminId) {
  return prisma.platformAdminPasswordResetToken.updateMany({
    where: { platformAdminId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export function markPlatformAdminResetTokenUsed(id) {
  return prisma.platformAdminPasswordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}

// The default platform admin is simply the first one ever created.
export function findDefaultPlatformAdmin() {
  return prisma.platformAdmin.findFirst({ orderBy: { createdAt: 'asc' } });
}

export function deletePlatformAdminById(id) {
  return prisma.platformAdmin.delete({ where: { id } });
}
