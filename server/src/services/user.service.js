import { prisma } from '../config/database.js';
import { ensureRoleProfile } from './roleProfile.service.js';
import { AppError } from '../utils/AppError.js';
import { serializeUser } from '../utils/serializers.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { hashPassword } from '../auth/password.js';
import { generateRawToken } from '../auth/crypto.js';
import {
  findUsersByOrganization, countUsersByOrganization, findUserById,
  createUser, findUserByEmailGlobal, setUserStatus,
} from '../repositories/user.repository.js';
import { findRoleByName, assignRoleToUser, replaceUserRole, findRolesForUser, addRoleToUser, removeRoleFromUser } from '../repositories/role.repository.js';
import { createPasswordResetToken } from '../repositories/passwordResetToken.repository.js';
import { sendMail } from '../integrations/email/mailer.js';
import { inviteEmail } from '../integrations/email/templates.js';
import { audit } from './audit.service.js';
import { generateUniqueReferralCode } from '../utils/referralCode.js';

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function roleNamesFor(userId) {
  const userRoles = await findRolesForUser(userId);
  return userRoles.map((ur) => ur.role.name);
}

export async function listUsers(organizationId, { page, pageSize, skip, take, search, status }) {
  const [users, total] = await Promise.all([
    findUsersByOrganization(organizationId, { skip, take, search, status }),
    countUsersByOrganization(organizationId, { search, status }),
  ]);

  return {
    users: users.map((u) => serializeUser(u, u.userRoles.map((ur) => ur.role.name))),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getUser(id, organizationId) {
  const user = await findUserById(id, organizationId);
  if (!user) throw AppError.notFound('User not found.');
  return serializeUser(user, await roleNamesFor(user.id));
}

// The invited user never receives a usable initial password — a random,
// never-transmitted value is hashed and stored purely to satisfy the
// not-null passwordHash column; the only way into the account is the
// emailed "set your password" link (the same PasswordResetToken mechanism
// forgot-password uses, just with a longer TTL appropriate for an invite).
export async function inviteUser({ organizationId, invitedBy, firstName, lastName, email, roleName }, req) {
  const existing = await findUserByEmailGlobal(email);
  if (existing) throw AppError.conflict('A user with this email already exists.');

  const role = await findRoleByName(organizationId, roleName);
  if (!role) throw AppError.badRequest(`Role "${roleName}" does not exist in this organization.`);

  const unusablePassword = generateRawToken(32);
  const passwordHash = await hashPassword(unusablePassword);
  const referralCode = await generateUniqueReferralCode(firstName);

  const { user, rawToken } = await prisma.$transaction(async (tx) => {
    const created = await createUser({ organizationId, firstName, lastName, email, passwordHash, status: 'pending', referralCode }, tx);
    await assignRoleToUser(created.id, role.id, tx);
    const token = generateRawToken();
    await createPasswordResetToken(created.id, token, new Date(Date.now() + INVITE_TOKEN_TTL_MS), tx);
    return { user: created, rawToken: token };
  });

  const { subject, html, text } = inviteEmail(rawToken, { org: invitedBy.organization, invitedByName: invitedBy.name, roleLabel: `${/^[aeiou]/i.test(roleName) ? 'an' : 'a'} ${roleName.replace(/_/g, ' ')}` });
  await sendMail({ to: user.email, subject, html, text });

  await audit({
    organizationId, userId: invitedBy.id, action: 'user.invited', entityType: 'user', entityId: user.id,
    newValues: { email: user.email, role: roleName }, req,
  });

  return serializeUser(user, [roleName]);
}

// A user can never change their own status through this path — see
// docs/security/authorization.md §7 ("self-service restrictions"). This is
// enforced here, not just in the UI, since hiding a button is not a
// security boundary.
export async function updateUserStatus(targetUserId, organizationId, status, actingUser, req) {
  if (targetUserId === actingUser.id) {
    throw AppError.forbidden('You cannot change your own account status.');
  }

  const target = await findUserById(targetUserId, organizationId);
  if (!target) throw AppError.notFound('User not found.');

  const result = await setUserStatus(targetUserId, organizationId, status);
  if (result.count === 0) throw AppError.notFound('User not found.');

  await audit({
    organizationId, userId: actingUser.id, action: 'user.status_changed', entityType: 'user', entityId: targetUserId,
    oldValues: { status: target.status }, newValues: { status }, req,
  });

  return getUser(targetUserId, organizationId);
}

// A user can never elevate (or otherwise change) their own role — same
// rationale as updateUserStatus above.
export async function updateUserRole(targetUserId, organizationId, roleName, actingUser, req) {
  if (targetUserId === actingUser.id) {
    throw AppError.forbidden('You cannot change your own role.');
  }

  const target = await findUserById(targetUserId, organizationId);
  if (!target) throw AppError.notFound('User not found.');

  const role = await findRoleByName(organizationId, roleName);
  if (!role) throw AppError.badRequest(`Role "${roleName}" does not exist in this organization.`);

  const previousRoles = await roleNamesFor(targetUserId);
  await replaceUserRole(targetUserId, role.id);
  await ensureRoleProfile(targetUserId, organizationId, roleName);

  await audit({
    organizationId, userId: actingUser.id, action: 'user.role_changed', entityType: 'user', entityId: targetUserId,
    oldValues: { roles: previousRoles }, newValues: { roles: [roleName] }, req,
  });

  return getUser(targetUserId, organizationId);
}

// A person can hold more than one role (say, agent and owner) and switch
// between them. These add and remove one role without touching the others.
export async function addUserRole(targetUserId, organizationId, roleName, actingUser, req) {
  if (targetUserId === actingUser.id) throw AppError.forbidden('You cannot change your own roles.');
  const target = await findUserById(targetUserId, organizationId);
  if (!target) throw AppError.notFound('User not found.');
  const role = await findRoleByName(organizationId, roleName);
  if (!role) throw AppError.badRequest(`Role "${roleName}" does not exist in this organization.`);
  const previousRoles = await roleNamesFor(targetUserId);
  await addRoleToUser(targetUserId, role.id);
  await ensureRoleProfile(targetUserId, organizationId, roleName);
  await audit({ organizationId, userId: actingUser.id, action: 'user.role_added', entityType: 'user', entityId: targetUserId, oldValues: { roles: previousRoles }, newValues: { roles: [...new Set([...previousRoles, roleName])] }, req });
  return getUser(targetUserId, organizationId);
}

export async function removeUserRole(targetUserId, organizationId, roleName, actingUser, req) {
  if (targetUserId === actingUser.id) throw AppError.forbidden('You cannot change your own roles.');
  const target = await findUserById(targetUserId, organizationId);
  if (!target) throw AppError.notFound('User not found.');
  const role = await findRoleByName(organizationId, roleName);
  if (!role) throw AppError.badRequest(`Role "${roleName}" does not exist in this organization.`);
  const previousRoles = await roleNamesFor(targetUserId);
  if (!previousRoles.includes(roleName)) return getUser(targetUserId, organizationId);
  if (previousRoles.length <= 1) throw AppError.badRequest('A user must keep at least one role.');
  await removeRoleFromUser(targetUserId, role.id);
  await audit({ organizationId, userId: actingUser.id, action: 'user.role_removed', entityType: 'user', entityId: targetUserId, oldValues: { roles: previousRoles }, newValues: { roles: previousRoles.filter((r) => r !== roleName) }, req });
  return getUser(targetUserId, organizationId);
}
