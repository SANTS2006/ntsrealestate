import { AppError } from '../utils/AppError.js';
import { backfillRoleProfiles } from './roleProfile.service.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createOwner, findOwnerById, findOwnerByUserId, findOwnersByOrganization,
  countOwnersByOrganization, updateOwner, setOwnerStatus, countOwnerPropertiesInScope,
} from '../repositories/owner.repository.js';
import { countPropertiesGroupedByOwner } from '../repositories/property.repository.js';
import { findUserById, findUserByEmailGlobal } from '../repositories/user.repository.js';
import { inviteUser } from './user.service.js';
import { getCoverImageUrls } from './document.service.js';
import { getRestrictedScope } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { prisma } from '../config/database.js';

const isTenantOnly = (user) => user.roles.includes('tenant') && !user.roles.includes('administrator');

// Property ids a tenant has rented — the only owners they may see are those
// who own one of these.
async function tenantPropertyIds(user, organizationId) {
  const rows = await prisma.tenantRental.findMany({
    where: { organizationId, status: 'active', tenant: { userId: user.id } },
    select: { propertyId: true },
  });
  return [...new Set(rows.map((r) => r.propertyId))];
}

function serializeOwner(owner) {
  return {
    id: owner.id,
    userId: owner.userId,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    address: owner.address,
    status: owner.status,
    accountStatus: owner.user?.status ?? null,
  };
}

// Enriches a page of owners with display-only fields a card needs: a
// signed cover photo and how many properties they currently own.
async function attachOwnerCardFields(organizationId, owners) {
  const ownerIds = owners.map((o) => o.id);
  const [coverUrls, propertyCounts] = await Promise.all([
    getCoverImageUrls(organizationId, 'owner', ownerIds),
    countPropertiesGroupedByOwner(organizationId, ownerIds),
  ]);
  const countByOwner = new Map(propertyCounts.map((row) => [row.ownerId, row._count._all]));

  return owners.map((o) => ({
    ...o,
    coverImageUrl: coverUrls.get(o.id) ?? null,
    propertyCount: countByOwner.get(o.id) ?? 0,
  }));
}

// An `owner`-role caller only ever sees their own record — they have no
// reason to browse other owners at all. An `agent` sees only owners who
// have at least one property within their assigned scope (getRestrictedScope
// -> propertyIds). Org-wide roles (administrator, accountant,
// maintenance_manager, auditor) see the full directory, unchanged. See
// docs/security/authorization.md.
export async function listOwners(organizationId, actingUser, { page, pageSize, skip, take, search, status }) {
  await backfillRoleProfiles(organizationId);
  if (actingUser.roles.includes('owner') && !actingUser.roles.includes('administrator')) {
    const own = await findOwnerByUserId(actingUser.id, organizationId);
    const owners = own ? await attachOwnerCardFields(organizationId, [serializeOwner(own)]) : [];
    return { owners, meta: buildPaginationMeta({ page: 1, pageSize: 1, total: own ? 1 : 0 }) };
  }

  const scope = isTenantOnly(actingUser)
    ? { propertyIds: await tenantPropertyIds(actingUser, organizationId) }
    : await getRestrictedScope(actingUser, organizationId);
  const agentUserId = actingUser.roles.includes('agent') ? actingUser.id : undefined;
  const [owners, total] = await Promise.all([
    findOwnersByOrganization(organizationId, { skip, take, search, status, propertyIds: scope.propertyIds, agentUserId }),
    countOwnersByOrganization(organizationId, { search, status, propertyIds: scope.propertyIds, agentUserId }),
  ]);
  const enriched = await attachOwnerCardFields(organizationId, owners.map(serializeOwner));
  return { owners: enriched, meta: buildPaginationMeta({ page, pageSize, total }) };
}

// Names only, for dropdowns (e.g. "which owner does this property belong to"):
// the same people the caller may see in the full list — everyone for an
// administrator, the owners an agent works for, a tenant's own landlords, an
// owner's own record — without the photos and property counts that make the
// full list slow to build.
export async function listOwnerOptions(organizationId, actingUser) {
  await backfillRoleProfiles(organizationId);
  if (actingUser.roles.includes('owner') && !actingUser.roles.includes('administrator')) {
    const own = await findOwnerByUserId(actingUser.id, organizationId);
    return own ? [{ id: own.id, name: own.name }] : [];
  }
  const scope = isTenantOnly(actingUser)
    ? { propertyIds: await tenantPropertyIds(actingUser, organizationId) }
    : await getRestrictedScope(actingUser, organizationId);
  const agentUserId = actingUser.roles.includes('agent') ? actingUser.id : undefined;
  const owners = await findOwnersByOrganization(organizationId, { skip: 0, take: 500, status: 'active', propertyIds: scope.propertyIds, agentUserId });
  return owners.map((o) => ({ id: o.id, name: o.name }));
}

export async function getOwner(id, organizationId, actingUser) {
  const owner = await findOwnerById(id, organizationId);
  if (!owner) throw AppError.notFound('Owner not found.');

  if (actingUser.roles.includes('owner') && !actingUser.roles.includes('administrator')) {
    if (owner.userId !== actingUser.id) throw AppError.notFound('Owner not found.');
    return serializeOwner(owner);
  }

  const scope = isTenantOnly(actingUser)
    ? { propertyIds: await tenantPropertyIds(actingUser, organizationId) }
    : await getRestrictedScope(actingUser, organizationId);
  if (scope.propertyIds) {
    const matches = await countOwnerPropertiesInScope(owner.id, scope.propertyIds, actingUser.roles.includes('agent') ? actingUser.id : undefined);
    if (matches === 0) throw AppError.notFound('Owner not found.');
  }
  return serializeOwner(owner);
}

// Adding an owner creates their login too and emails them an invitation (in
// the company's own branding) whose link opens a page to choose a password
// and activate the account — exactly like adding an agent. Until they accept
// they appear in the users list as pending. Passing an existing `userId`
// links that account instead and sends nothing.
export async function createOwnerRecord(organizationId, body, actingUser, req, invitedBy) {
  let userId = body.userId ?? null;
  let invited = false;

  if (userId) {
    const user = await findUserById(userId, organizationId);
    if (!user) throw AppError.badRequest('The specified user does not exist in this organization.');
  } else {
    if (!body.email) throw AppError.badRequest('An email address is needed to invite the owner.');
    if (await findUserByEmailGlobal(body.email)) throw AppError.conflict('A user with this email already exists.');
    const [firstName, ...rest] = body.name.trim().split(/\s+/);
    const created = await inviteUser(
      { organizationId, invitedBy, firstName, lastName: rest.join(' ') || '-', email: body.email, roleName: 'owner' },
      req,
    );
    userId = created.id;
    invited = true;
  }

  const owner = await createOwner({
    organizationId,
    userId,
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
  });

  await audit({ organizationId, userId: actingUser.id, action: 'owner.created', entityType: 'owner', entityId: owner.id, newValues: { name: owner.name }, req });
  return { ...serializeOwner(owner), invited };
}

export async function updateOwnerRecord(id, organizationId, body, actingUser, req) {
  const existing = await findOwnerById(id, organizationId);
  if (!existing) throw AppError.notFound('Owner not found.');

  await updateOwner(id, organizationId, body);
  await audit({ organizationId, userId: actingUser.id, action: 'owner.updated', entityType: 'owner', entityId: id, newValues: body, req });
  return getOwner(id, organizationId, actingUser);
}

export async function setOwnerActiveStatus(id, organizationId, status, actingUser, req) {
  const existing = await findOwnerById(id, organizationId);
  if (!existing) throw AppError.notFound('Owner not found.');

  await setOwnerStatus(id, organizationId, status);
  await audit({ organizationId, userId: actingUser.id, action: 'owner.status_changed', entityType: 'owner', entityId: id, oldValues: { status: existing.status }, newValues: { status }, req });
  return getOwner(id, organizationId, actingUser);
}
