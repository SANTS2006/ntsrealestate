import { prisma } from '../config/database.js';

export function findRoleByName(organizationId, name, tx = prisma) {
  return tx.role.findFirst({ where: { organizationId, name } });
}

export function createRole(organizationId, { name, description, isSystem = false }, tx = prisma) {
  return tx.role.create({ data: { organizationId, name, description, isSystem } });
}

// Bulk variant — see role.service.js#bootstrapDefaultRoles. `rows` must
// already carry client-generated `id`s (Prisma's `@default(uuid())` is
// generated client-side, so this is safe) since `createMany` doesn't return
// the created rows, and the caller needs the ids to link permissions next.
export function createRolesBulk(rows, tx = prisma) {
  return tx.role.createMany({ data: rows });
}

export function attachPermissionsBulk(rolePermissionRows, tx = prisma) {
  if (rolePermissionRows.length === 0) return Promise.resolve();
  return tx.rolePermission.createMany({ data: rolePermissionRows, skipDuplicates: true });
}

export function assignRoleToUser(userId, roleId, tx = prisma) {
  return tx.userRole.create({ data: { userId, roleId } });
}

export function findRolesForUser(userId, tx = prisma) {
  return tx.userRole.findMany({ where: { userId }, include: { role: true } });
}

// Used by middleware/authorize.js to re-derive the caller's effective
// permission set fresh on every request from `roles` (never trusted from a
// cached session/token value) — see docs/security/authorization.md §3.
export async function findPermissionNamesForRoles(organizationId, roleNames) {
  if (roleNames.length === 0) return [];
  const rows = await prisma.rolePermission.findMany({
    where: { role: { organizationId, name: { in: roleNames } } },
    select: { permission: { select: { name: true } } },
  });
  return [...new Set(rows.map((r) => r.permission.name))];
}

export function findRolesByOrganization(organizationId) {
  return prisma.role.findMany({
    where: { organizationId },
    include: { rolePermissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });
}

export function findRoleById(id, organizationId) {
  return prisma.role.findFirst({ where: { id, organizationId } });
}

export function findRoleWithPermissionsById(id, organizationId) {
  return prisma.role.findFirst({
    where: { id, organizationId },
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export function updateRoleDescription(id, organizationId, description) {
  return prisma.role.updateMany({ where: { id, organizationId }, data: { description } });
}

// System roles (the seeded defaults) are excluded here at the query level —
// deleteMany simply matches zero rows for one rather than needing a
// separate guard clause, so a caller can't accidentally delete one by
// racing a status check.
export function deleteRole(id, organizationId) {
  return prisma.role.deleteMany({ where: { id, organizationId, isSystem: false } });
}

export function countUsersWithRole(roleId) {
  return prisma.userRole.count({ where: { roleId } });
}

// Replaces a role's entire permission set in one transaction — the admin UI
// works off a checkbox list of the full catalog, so "save" naturally means
// "make it match exactly this set" rather than incremental add/remove calls.
export function setRolePermissions(roleId, permissionIds) {
  return prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    ...(permissionIds.length > 0
      ? [prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })), skipDuplicates: true })]
      : []),
  ]);
}

// This codebase models a user as holding exactly one role at a time (the
// underlying user_roles table is many-to-many for future flexibility, but
// nothing in the product surface exposes multi-role assignment yet) — so
// changing a user's role means atomically clearing any existing assignment
// and creating the new one, not merely adding a row.
export function replaceUserRole(userId, newRoleId) {
  return prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.create({ data: { userId, roleId: newRoleId } }),
  ]);
}

export function addRoleToUser(userId, roleId) {
  return prisma.userRole.createMany({ data: [{ userId, roleId }], skipDuplicates: true });
}

export function removeRoleFromUser(userId, roleId) {
  return prisma.userRole.deleteMany({ where: { userId, roleId } });
}
