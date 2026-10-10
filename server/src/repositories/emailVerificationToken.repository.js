import { prisma } from '../config/database.js';
import { hashToken } from '../auth/crypto.js';

export function createEmailVerificationToken(userId, rawToken, expiresAt, tx = prisma) {
  return tx.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });
}

export function findValidEmailVerificationToken(rawToken) {
  return prisma.emailVerificationToken.findFirst({
    where: { tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
  });
}

export function markEmailVerificationTokenUsed(id) {
  return prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
}

export function invalidateOutstandingVerificationTokens(userId) {
  return prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
