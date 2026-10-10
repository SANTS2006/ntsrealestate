import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { DEFAULT_ROLE_TEMPLATES } from '../constants/permissions.js';
import { findAllPermissions, findPermissionsByNames } from '../repositories/permission.repository.js';
import {
  createRolesBulk, attachPermissionsBulk, findRolesByOrganization, findRoleByName, findRoleById,
  findRoleWithPermissionsById, createRole, updateRoleDescription, deleteRole, countUsersWithRole, setRolePermissions,
} from '../repositories/role.repository.js';
import { audit } from './audit.service.js';

function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.rolePermissions.map((rp) => rp.permission.name),
  };
}

export async function listRoles(organizationId) {
  const roles = await findRolesByOrganization(organizationId);
  return roles.map(serializeRole);
}

export async function getRole(id, organizationId) {
  const role = await findRoleWithPermissionsById(id, organizationId);
  if (!role) throw AppError.notFound('Role not found.');
  const userCount = await countUsersWithRole(id);
  return { ...serializeRole(role), userCount };
}

export async function createRoleRecord(organizationId, body, actingUser, req) {
  const existing = await findRoleByName(organizationId, body.name);
  if (existing) throw AppError.conflict('A role with this name already exists.');

  const role = await createRole(organizationId, { name: body.name, description: body.description ?? null, isSystem: false });
  await audit({ organizationId, userId: actingUser.id, action: 'role.created', entityType: 'role', entityId: role.id, newValues: { name: role.name }, req });
  return { id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, permissions: [] };
}

export async function updateRoleRecord(id, organizationId, body, actingUser, req) {
  const role = await findRoleById(id, organizationId);
  if (!role) throw AppError.notFound('Role not found.');

  await updateRoleDescription(id, organizationId, body.description ?? null);
  await audit({ organizationId, userId: actingUser.id, action: 'role.updated', entityType: 'role', entityId: id, newValues: body, req });
  return getRole(id, organizationId);
}

export async function deleteRoleRecord(id, organizationId, actingUser, req) {
  const role = await findRoleById(id, organizationId);
  if (!role) throw AppError.notFound('Role not found.');
  if (role.isSystem) throw AppError.badRequest('Built-in system roles cannot be deleted.');

  const usersHolding = await countUsersWithRole(id);
  if (usersHolding > 0) {
    throw AppError.conflict(`${usersHolding} user${usersHolding === 1 ? '' : 's'} currently hold this role. Reassign them before deleting it.`);
  }

  const result = await deleteRole(id, organizationId);
  if (result.count === 0) throw AppError.notFound('Role not found.');

  await audit({ organizationId, userId: actingUser.id, action: 'role.deleted', entityType: 'role', entityId: id, oldValues: { name: role.name }, req });
  return { deleted: true };
}

// Replaces the role's entire permission set to match `permissionNames` —
// see role.repository.js#setRolePermissions for why a full replace beats
// incremental add/remove for a checkbox-list admin UI.
export async function setRolePermissionsRecord(id, organizationId, permissionNames, actingUser, req) {
  const role = await findRoleById(id, organizationId);
  if (!role) throw AppError.notFound('Role not found.');
  // The administrator role is the only account of last resort in an
  // organization — letting its own permissions be edited risks every admin
  // locking themselves out of the system with no way back in, including out
  // of this very screen. It always keeps full access; every other role
  // (including other system-seeded ones) can be freely customized.
  if (role.name === 'administrator') {
    throw AppError.badRequest('The administrator role always keeps full access and cannot be modified.');
  }

  const permissions = await findPermissionsByNames(permissionNames);
  const foundNames = new Set(permissions.map((p) => p.name));
  const missing = permissionNames.filter((name) => !foundNames.has(name));
  if (missing.length > 0) throw AppError.badRequest(`Unknown permission(s): ${missing.join(', ')}`);

  await setRolePermissions(id, permissions.map((p) => p.id));
  await audit({ organizationId, userId: actingUser.id, action: 'role.permissions_changed', entityType: 'role', entityId: id, newValues: { permissionNames }, req });
  return getRole(id, organizationId);
}

// Seeds the standard role set (§22 of the requirements) for a newly-created
// organization, inside the same transaction as the organization/user
// creation — either the whole registration succeeds or none of it does.
//
// This runs in exactly 3 round trips (fetch permission catalog once, bulk
// create roles, bulk create role_permissions) rather than ~3 round trips
// *per role* — with 8 default roles, that's the difference between roughly
// 3 and roughly 24 sequential queries inside one interactive transaction.
// Neon's per-query network latency from a serverless-style connection makes
// that difference the gap between comfortably finishing and blowing past
// Prisma's interactive-transaction timeout (see auth.service.js, which also
// raises that timeout as a second line of defense).
export async function bootstrapDefaultRoles(organizationId, tx) {
  const allPermissions = await findAllPermissions(tx);
  const permissionIdByName = new Map(allPermissions.map((p) => [p.name, p.id]));

  const roleIds = {};
  const roleRows = [];
  const rolePermissionRows = [];

  for (const [name, template] of Object.entries(DEFAULT_ROLE_TEMPLATES)) {
    const roleId = randomUUID();
    roleIds[name] = roleId;
    roleRows.push({ id: roleId, organizationId, name, description: template.description, isSystem: true });

    for (const permissionName of template.permissions) {
      const permissionId = permissionIdByName.get(permissionName);
      if (permissionId) rolePermissionRows.push({ roleId, permissionId });
      // A missing permission name here means the catalog and the role
      // template have drifted (a bug to fix in constants/permissions.js),
      // not a runtime condition to throw on mid-registration.
    }
  }

  await createRolesBulk(roleRows, tx);
  await attachPermissionsBulk(rolePermissionRows, tx);

  return roleIds;
}
