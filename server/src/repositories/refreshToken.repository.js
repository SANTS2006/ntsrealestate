import { prisma } from '../config/database.js';
import { hashToken } from '../auth/crypto.js';

export function createRefreshToken({ userId, rawToken, familyId, expiresAt, ipAddress, userAgent }) {
  return prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(rawToken), familyId, expiresAt, ipAddress, userAgent },
  });
}

export function findActiveRefreshTokenByRawToken(rawToken) {
  return prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(rawToken) },
  });
}

export function markRefreshTokenReplaced(id, replacedById) {
  return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date(), replacedById } });
}

export function revokeRefreshTokenFamily(familyId) {
  return prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function revokeAllRefreshTokensForUser(userId) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
