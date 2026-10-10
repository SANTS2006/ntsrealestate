import { prisma } from '../config/database.js';

export function replaceRecoveryCodes(userId, codeHashes, tx = prisma) {
  return tx.$transaction([
    tx.mfaRecoveryCode.deleteMany({ where: { userId } }),
    tx.mfaRecoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) }),
  ]);
}

export function findUnusedRecoveryCode(userId, codeHash) {
  return prisma.mfaRecoveryCode.findFirst({ where: { userId, codeHash, usedAt: null } });
}

export function markRecoveryCodeUsed(id) {
  return prisma.mfaRecoveryCode.update({ where: { id }, data: { usedAt: new Date() } });
}

export function deleteAllRecoveryCodes(userId, tx = prisma) {
  return tx.mfaRecoveryCode.deleteMany({ where: { userId } });
}
