import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { platformAudit } from './platformAudit.service.js';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The type is read from the file's own bytes; the browser's claim and the
// filename are ignored.
export async function setAvatar(admin, file, req) {
  if (!file?.buffer?.length) throw AppError.badRequest('Choose an image to upload.');
  if (file.buffer.length > MAX_AVATAR_BYTES) throw AppError.badRequest('The image is too large. The limit is 2 MB.');
  const sniffed = await fileTypeFromBuffer(file.buffer);
  if (!sniffed || !ALLOWED.has(sniffed.mime)) throw AppError.badRequest('Use a JPEG, PNG or WebP image.');

  const now = new Date();
  await prisma.$transaction([
    prisma.platformAdminAvatar.upsert({
      where: { platformAdminId: admin.id },
      create: { platformAdminId: admin.id, mimeType: sniffed.mime, data: file.buffer },
      update: { mimeType: sniffed.mime, data: file.buffer, updatedAt: now },
    }),
    prisma.platformAdmin.update({ where: { id: admin.id }, data: { avatarUpdatedAt: now } }),
  ]);
  await platformAudit({ actor: admin, action: 'auth.avatar_changed', targetType: 'platform_admin', targetId: admin.id, req });
  return { avatarUpdatedAt: now };
}

export async function removeAvatar(admin, req) {
  await prisma.$transaction([
    prisma.platformAdminAvatar.deleteMany({ where: { platformAdminId: admin.id } }),
    prisma.platformAdmin.update({ where: { id: admin.id }, data: { avatarUpdatedAt: null } }),
  ]);
  await platformAudit({ actor: admin, action: 'auth.avatar_removed', targetType: 'platform_admin', targetId: admin.id, req });
  return { avatarUpdatedAt: null };
}

export async function getAvatar(adminId) {
  const row = await prisma.platformAdminAvatar.findUnique({ where: { platformAdminId: adminId } });
  if (!row) throw AppError.notFound('No profile picture.');
  return { mimeType: row.mimeType, data: Buffer.from(row.data) };
}
