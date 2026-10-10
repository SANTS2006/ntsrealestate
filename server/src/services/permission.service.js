import { AppError } from '../utils/AppError.js';
import { PERMISSIONS, DEFAULT_ROLE_TEMPLATES } from '../constants/permissions.js';
import { prisma } from '../config/database.js';
import {
  createPermission, findPermissionByName, findPermissionById, findAllPermissions,
  upsertPermissionCatalog, updatePermissionDescription, deletePermission, countRolesWithPermission,
} from '../repositories/permission.repository.js';
import { audit } from './audit.service.js';
import { logger } from '../config/logger.js';

// The Permission model has no `isSystem` column — the seeded catalog
// (constants/permissions.js) is the source of truth for which names are
// built-in. Anything not in that set was added later via the admin UI.
const SEEDED_NAMES = new Set(PERMISSIONS.map((p) => p.name));

function serializePermission(permission) {
  return { id: permission.id, name: permission.name, description: permission.description, isSystem: SEEDED_NAMES.has(permission.name) };
}

// Called once at server startup (see server.js) — ensures every permission
// in the static catalog exists as a row before anything else runs, since
// role bootstrapping and requirePermission() both assume the catalog is
// already populated. skipDuplicates makes this a no-op after the first run.
export async function ensurePermissionCatalogSeeded() {
  await upsertPermissionCatalog(PERMISSIONS);
  logger.info(`Permission catalog ready (${PERMISSIONS.length} permissions).`);
}

// Gives every organization's built-in roles any permission their template now
// lists (for example when a new module is added). ADDITIVE only — nothing is
// ever taken away, so roles an administrator customized keep what they have.
export async function syncBuiltInRoleGrants() {
  const perms = await prisma.permission.findMany({ select: { id: true, name: true } });
  const byName = new Map(perms.map((p) => [p.name, p.id]));
  const roles = await prisma.role.findMany({
    where: { isSystem: true, name: { in: Object.keys(DEFAULT_ROLE_TEMPLATES) } },
    include: { rolePermissions: { select: { permissionId: true } } },
  });
  let granted = 0;
  for (const role of roles) {
    const have = new Set(role.rolePermissions.map((rp) => rp.permissionId));
    const rows = DEFAULT_ROLE_TEMPLATES[role.name].permissions
      .map((name) => byName.get(name))
      .filter((id) => id && !have.has(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    if (rows.length > 0) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
      granted += rows.length;
    }
  }
  if (granted > 0) logger.info(`Granted ${granted} new permission(s) to built-in roles.`);
}

// Permissions are a global catalog, not organization-scoped (see
// permission.repository.js) — every organization sees the same list, same
// as the built-in seeded set.
export async function listPermissions() {
  const permissions = await findAllPermissions();
  return permissions.map(serializePermission);
}

export async function createPermissionRecord(organizationId, body, actingUser, req) {
  const existing = await findPermissionByName(body.name);
  if (existing) throw AppError.conflict('A permission with this name already exists.');

  const permission = await createPermission({ name: body.name, description: body.description ?? null });
  await audit({ organizationId, userId: actingUser.id, action: 'permission.created', entityType: 'permission', entityId: permission.id, newValues: { name: permission.name }, req });
  return serializePermission(permission);
}

export async function updatePermissionRecord(id, organizationId, body, actingUser, req) {
  const permission = await findPermissionById(id);
  if (!permission) throw AppError.notFound('Permission not found.');
  if (SEEDED_NAMES.has(permission.name)) {
    throw AppError.badRequest('Built-in permissions cannot be edited.');
  }

  const updated = await updatePermissionDescription(id, body.description ?? null);
  await audit({ organizationId, userId: actingUser.id, action: 'permission.updated', entityType: 'permission', entityId: id, newValues: body, req });
  return serializePermission(updated);
}

export async function deletePermissionRecord(id, organizationId, actingUser, req) {
  const permission = await findPermissionById(id);
  if (!permission) throw AppError.notFound('Permission not found.');
  if (SEEDED_NAMES.has(permission.name)) {
    throw AppError.badRequest('Built-in permissions cannot be deleted.');
  }

  const rolesUsingIt = await countRolesWithPermission(id);
  if (rolesUsingIt > 0) {
    throw AppError.conflict(`${rolesUsingIt} role${rolesUsingIt === 1 ? '' : 's'} currently use this permission. Remove it from those roles before deleting it.`);
  }

  await deletePermission(id);
  await audit({ organizationId, userId: actingUser.id, action: 'permission.deleted', entityType: 'permission', entityId: id, oldValues: { name: permission.name }, req });
  return { deleted: true };
}
