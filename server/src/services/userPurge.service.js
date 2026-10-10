import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { destroyCloudinaryAsset } from '../integrations/cloudinary/uploadService.js';
import { audit } from './audit.service.js';

// Permanently removes a user and everything that is theirs, so the system
// holds no trace they ever existed:
//   - the login, its roles, tokens, MFA data, sessions, notifications,
//     referrals (made or received) and audit entries about/by them;
//   - their tenant record with its leases, invoices, payments, maintenance
//     requests and messages (units they occupied become available again);
//   - their owner record (their properties stay with the organization, just
//     unowned);
//   - documents that are theirs (avatar, tenant/owner files), including the
//     stored files. Documents they merely uploaded on the organization's
//     behalf (e.g. property photos) are kept and reassigned to the person
//     doing the deletion;
//   - their agent assignments and any chat data (cascades from the user).
// The one thing recorded afterward is that a deletion happened, with no
// personal details. Irreversible by design.
export async function purgeUser(targetUserId, organizationId, actingUser, req) {
  if (targetUserId === actingUser.id) {
    throw AppError.forbidden('You cannot delete your own account.');
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId },
    include: {
      userRoles: { include: { role: true } },
      tenant: { select: { id: true } },
      owner: { select: { id: true } },
    },
  });
  if (!target) throw AppError.notFound('User not found.');

  const roleNames = target.userRoles.map((ur) => ur.role.name);

  // Never leave the organization without an administrator.
  if (roleNames.includes('administrator')) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        organizationId, id: { not: targetUserId }, status: 'active',
        userRoles: { some: { role: { name: 'administrator' } } },
      },
    });
    if (otherActiveAdmins === 0) {
      throw AppError.badRequest('This is the organization\'s only active administrator and cannot be deleted. Promote another administrator first.');
    }
  }

  const tenantId = target.tenant?.id ?? null;
  const ownerId = target.owner?.id ?? null;

  // Files to remove from storage once the database work has committed.
  const assetsToDestroy = [];

  await prisma.$transaction(async (tx) => {
    const ownEntityIds = [targetUserId, tenantId, ownerId].filter(Boolean);
    const ownDocuments = await tx.document.findMany({
      where: { organizationId, entityId: { in: ownEntityIds }, entityType: { in: ['user', 'tenant', 'owner'] } },
    });
    for (const doc of ownDocuments) {
      assetsToDestroy.push({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType });
    }
    await tx.document.deleteMany({ where: { id: { in: ownDocuments.map((d) => d.id) } } });
    // Everything else they uploaded belongs to the organization.
    await tx.document.updateMany({ where: { uploadedBy: targetUserId }, data: { uploadedBy: actingUser.id } });

    if (tenantId) {
      const leases = await tx.lease.findMany({ where: { tenantId }, select: { id: true, unitId: true, status: true } });
      const freedUnitIds = leases.filter((l) => l.status === 'active').map((l) => l.unitId);

      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.invoice.deleteMany({ where: { tenantId } });
      await tx.lease.deleteMany({ where: { tenantId } });
      await tx.maintenanceRequest.deleteMany({ where: { tenantId } }); // work orders cascade
      if (freedUnitIds.length > 0) {
        await tx.unit.updateMany({ where: { id: { in: freedUnitIds } }, data: { status: 'available' } });
      }
      await tx.tenant.delete({ where: { id: tenantId } }); // tenant messages cascade
    }

    if (ownerId) {
      await tx.owner.delete({ where: { id: ownerId } }); // properties.ownerId -> null
    }

    // Their private conversations go with them (the other person's copy too —
    // a conversation with someone who never existed cannot remain). Messages,
    // keys and files they sent cascade from the user row itself.
    await tx.chatRoom.deleteMany({ where: { type: 'direct', members: { some: { userId: targetUserId } } } });

    await tx.auditLog.deleteMany({
      where: { OR: [{ userId: targetUserId }, { entityType: 'user', entityId: targetUserId }] },
    });
    await tx.$executeRaw`DELETE FROM "session" WHERE sess->>'userId' = ${targetUserId}`;
    await tx.user.delete({ where: { id: targetUserId } });
  }, { timeout: 30_000 });

  for (const asset of assetsToDestroy) {
    await destroyCloudinaryAsset(asset).catch((err) => logger.error({ err }, 'failed to remove a deleted user\'s stored file'));
  }

  // Deliberately carries no name, email or id of the deleted person.
  await audit({
    organizationId, userId: actingUser.id, action: 'user.deleted', entityType: 'user', entityId: null,
    newValues: { roles: roleNames }, req,
  });

  return { deleted: true };
}
