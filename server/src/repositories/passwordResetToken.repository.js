import { prisma } from '../config/database.js';
import { hashToken } from '../auth/crypto.js';

export function createPasswordResetToken(userId, rawToken, expiresAt, tx = prisma) {
  return tx.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });
}

export function findValidPasswordResetToken(rawToken) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
  });
}

export function markPasswordResetTokenUsed(id) {
  return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
}

export function invalidateOutstandingResetTokens(userId) {
  return prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
