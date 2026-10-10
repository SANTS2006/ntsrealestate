import { prisma } from '../config/database.js';

// Permissions are a global catalog (not organization-scoped) — see
// src/constants/permissions.js for the source list. A per-row upsert loop
// (even batched into one transaction) costs one Neon round trip per
// permission — tens of seconds for a ~90-row catalog on every server start.
// `createMany` + `skipDuplicates` inserts everything missing in a single
// round trip; on the common "nothing changed" path it's a no-op. If a
// permission's description is edited in code later, that update needs an
// explicit migration/one-off script rather than happening implicitly here —
// an acceptable tradeoff for a catalog that's effectively append-only.
export function upsertPermissionCatalog(permissions) {
  return prisma.permission.createMany({ data: permissions, skipDuplicates: true });
}

export function findPermissionsByNames(names, tx = prisma) {
  return tx.permission.findMany({ where: { name: { in: names } } });
}

export function findAllPermissions(tx = prisma) {
  return tx.permission.findMany({ orderBy: { name: 'asc' } });
}

export function findPermissionByName(name) {
  return prisma.permission.findUnique({ where: { name } });
}

export function findPermissionById(id) {
  return prisma.permission.findUnique({ where: { id } });
}

export function createPermission(data) {
  return prisma.permission.create({ data });
}

export function updatePermissionDescription(id, description) {
  return prisma.permission.update({ where: { id }, data: { description } });
}

export function deletePermission(id) {
  return prisma.permission.delete({ where: { id } });
}

// Mirrors role.repository.js#countUsersWithRole — used to block deleting a
// permission that's still assigned to at least one role, rather than
// silently orphaning role_permissions rows.
export function countRolesWithPermission(permissionId) {
  return prisma.rolePermission.count({ where: { permissionId } });
}
