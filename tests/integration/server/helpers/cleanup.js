import { prisma } from './testApp.js';
import { destroyCloudinaryAsset } from '../../../../server/src/integrations/cloudinary/uploadService.js';

// Deletes everything created under a test organization, in dependency
// order, then the organization itself. This exists because most
// organization-owned tables use `onDelete: Restrict` from Organization
// deliberately (see docs/database/database-design.md) — a plain
// `prisma.organization.delete()` would fail with a foreign-key violation
// the moment any child row exists, which is correct production behavior
// but means test cleanup has to be explicit.
//
// IMPORTANT: this is test-suite-only infrastructure. It is never imported
// by application code, and it only ever deletes rows scoped to a single
// organizationId that the test itself created — never a broad/unscoped
// delete. See docs/database/migrations.md for the incident that happened
// earlier in this project from an unrelated (migration-tooling) mistake;
// this helper is deliberately conservative in the opposite direction.
export async function deleteTestOrganization(organizationId) {
  if (!organizationId) return;

  await prisma.payment.deleteMany({ where: { organizationId } });
  await prisma.invoice.deleteMany({ where: { organizationId } });
  await prisma.workOrder.deleteMany({ where: { organizationId } });
  await prisma.maintenanceRequest.deleteMany({ where: { organizationId } });
  await prisma.inspection.deleteMany({ where: { organizationId } });
  await prisma.expense.deleteMany({ where: { organizationId } });
  await prisma.expenseCategory.deleteMany({ where: { organizationId } });
  await prisma.lease.deleteMany({ where: { organizationId } });
  await prisma.propertyAssignment.deleteMany({ where: { organizationId } });

  const buildings = await prisma.building.findMany({ where: { property: { organizationId } }, select: { id: true } });
  const buildingIds = buildings.map((b) => b.id);
  if (buildingIds.length > 0) {
    await prisma.unit.deleteMany({ where: { buildingId: { in: buildingIds } } });
    await prisma.building.deleteMany({ where: { id: { in: buildingIds } } });
  }
  await prisma.property.deleteMany({ where: { organizationId } });

  // Documents own a real Cloudinary asset each (file-upload.test.js
  // creates several) — destroy those before deleting the metadata rows,
  // exactly like production deletion does (services/document.service.js),
  // so the test suite never leaves orphaned files in Cloudinary storage.
  const documents = await prisma.document.findMany({
    where: { organizationId },
    select: { cloudinaryPublicId: true, cloudinaryResourceType: true },
  });
  await Promise.all(documents.map((d) => destroyCloudinaryAsset({ publicId: d.cloudinaryPublicId, resourceType: d.cloudinaryResourceType })));
  await prisma.document.deleteMany({ where: { organizationId } });
  await prisma.vendor.deleteMany({ where: { organizationId } });
  await prisma.owner.deleteMany({ where: { organizationId } });
  await prisma.tenant.deleteMany({ where: { organizationId } });
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });

  // User-owned rows that reference organizationId only transitively
  // (through the user) — deleted before the users themselves.
  const users = await prisma.user.findMany({ where: { organizationId }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.mfaRecoveryCode.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  }
  await prisma.user.deleteMany({ where: { organizationId } });

  // Roles/role_permissions cascade automatically from the organization
  // delete (onDelete: Cascade) — no explicit step needed for them.
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {
    // If this still fails, something this helper doesn't yet account for
    // referenced the org — surfacing as a loud test-suite warning is more
    // useful than silently leaving orphaned data, but it must never take
    // down the test run itself (afterAll cleanup failing shouldn't mask
    // the actual test results).
    // eslint-disable-next-line no-console
    console.warn(`deleteTestOrganization: could not delete organization ${organizationId} — some rows may remain.`);
  });
}
