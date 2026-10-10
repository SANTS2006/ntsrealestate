import { AppError } from '../utils/AppError.js';
import { backfillRoleProfiles } from './roleProfile.service.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createTenant, findTenantById, findTenantByUserId, findTenantsByOrganization,
  countTenantsByOrganization, updateTenant, setTenantStatus, countTenantPropertyMatch,
} from '../repositories/tenant.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { findBuildingById, findBuildingsByIds } from '../repositories/building.repository.js';
import { findUnitById, findUnitsByIds } from '../repositories/unit.repository.js';
import { getCoverImageUrls } from './document.service.js';
import { getRestrictedScope } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { prisma } from '../config/database.js';
import { listRentalsForTenant } from './rental.service.js';

// Keeps tenant_rentals in step with the building/unit a staff member picked
// on the tenant form: that place becomes one of the tenant's rentals (added
// next to any they already have, never replacing them).
async function syncRentalFromResidence(organizationId, tenantId, { buildingId, unitId }) {
  if (!buildingId && !unitId) return;
  const building = buildingId
    ? await prisma.building.findFirst({ where: { id: buildingId, property: { organizationId } }, select: { propertyId: true } })
    : null;
  if (!building) return;
  const exists = await prisma.tenantRental.findFirst({
    where: { tenantId, status: 'active', ...(unitId ? { unitId } : { buildingId, unitId: null }) },
  });
  if (!exists) {
    await prisma.tenantRental.create({
      data: { organizationId, tenantId, propertyId: building.propertyId, buildingId, unitId: unitId ?? null, source: 'staff' },
    });
  }
}

function serializeTenant(tenant) {
  return {
    id: tenant.id,
    userId: tenant.userId,
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email,
    phone: tenant.phone,
    emergencyContact: tenant.emergencyContact,
    status: tenant.status,
    accountStatus: tenant.user?.status ?? null,
    buildingId: tenant.buildingId,
    unitId: tenant.unitId,
  };
}

// Enriches a page of tenants with display-only fields a card needs: a
// signed cover photo and the building/unit names behind their ids (the
// serialized tenant only carries the raw ids). Batched so a page of 20
// tenants costs a handful of queries, not 40.
async function attachTenantCardFields(organizationId, tenants) {
  const buildingIds = [...new Set(tenants.map((t) => t.buildingId).filter(Boolean))];
  const unitIds = [...new Set(tenants.map((t) => t.unitId).filter(Boolean))];

  const [coverUrls, buildings, units] = await Promise.all([
    getCoverImageUrls(organizationId, 'tenant', tenants.map((t) => t.id)),
    findBuildingsByIds(buildingIds),
    findUnitsByIds(unitIds),
  ]);
  const buildingNames = new Map(buildings.map((b) => [b.id, b.name]));
  const unitNumbers = new Map(units.map((u) => [u.id, u.unitNumber]));

  return tenants.map((t) => ({
    ...t,
    coverImageUrl: coverUrls.get(t.id) ?? null,
    buildingName: t.buildingId ? (buildingNames.get(t.buildingId) ?? null) : null,
    unitNumber: t.unitId ? (unitNumbers.get(t.unitId) ?? null) : null,
  }));
}

// A tenant's "current residence" link is a convenience reference, not a
// substitute for Lease history — but it still must not point at a
// building/unit outside the caller's organization. If a unit is given, its
// building is used as the authoritative buildingId (a client-supplied
// mismatched buildingId is silently corrected, never trusted standalone).
async function resolveResidence(organizationId, { buildingId, unitId }) {
  if (unitId) {
    const unit = await findUnitById(unitId, organizationId);
    if (!unit) throw AppError.badRequest('The specified unit does not exist in this organization.');
    return { unitId, buildingId: unit.buildingId };
  }
  if (buildingId) {
    const building = await findBuildingById(buildingId, organizationId);
    if (!building) throw AppError.badRequest('The specified building does not exist in this organization.');
    return { buildingId, unitId: null };
  }
  return { buildingId: null, unitId: null };
}

// A `tenant`-role caller only ever sees their own record (mirrors
// owner.service.js's equivalent restriction). `agent`/`owner` callers see
// only tenants whose current-residence building/unit falls within their
// assigned/owned properties (getRestrictedScope -> propertyIds); org-wide
// roles are unaffected (scope.propertyIds is undefined for them).
export async function listTenants(organizationId, actingUser, { page, pageSize, skip, take, search, status, unitId, buildingId }) {
  await backfillRoleProfiles(organizationId);
  if (actingUser.roles.includes('tenant') && !actingUser.roles.includes('administrator')) {
    const own = await findTenantByUserId(actingUser.id, organizationId);
    const tenants = own ? await attachTenantCardFields(organizationId, [serializeTenant(own)]) : [];
    return { tenants, meta: buildPaginationMeta({ page: 1, pageSize: 1, total: own ? 1 : 0 }) };
  }

  const scope = await getRestrictedScope(actingUser, organizationId);
  const [tenants, total] = await Promise.all([
    findTenantsByOrganization(organizationId, { skip, take, search, status, unitId, buildingId, propertyIds: scope.propertyIds }),
    countTenantsByOrganization(organizationId, { search, status, unitId, buildingId, propertyIds: scope.propertyIds }),
  ]);
  const enriched = await attachTenantCardFields(organizationId, tenants.map(serializeTenant));
  return { tenants: enriched, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getTenant(id, organizationId, actingUser) {
  const tenant = await findTenantById(id, organizationId);
  if (!tenant) throw AppError.notFound('Tenant not found.');
  const withRentals = async () => ({ ...serializeTenant(tenant), rentals: await listRentalsForTenant(tenant.id, organizationId) });

  if (actingUser.roles.includes('tenant') && !actingUser.roles.includes('administrator')) {
    if (tenant.userId !== actingUser.id) throw AppError.notFound('Tenant not found.');
    return withRentals();
  }

  const scope = await getRestrictedScope(actingUser, organizationId);
  if (scope.propertyIds) {
    const matches = await countTenantPropertyMatch(tenant.id, scope.propertyIds);
    if (matches === 0) throw AppError.notFound('Tenant not found.');
  }
  return withRentals();
}

export async function createTenantRecord(organizationId, body, actingUser, req) {
  if (body.userId) {
    const user = await findUserById(body.userId, organizationId);
    if (!user) throw AppError.badRequest('The specified user does not exist in this organization.');
  }

  const residence = await resolveResidence(organizationId, { buildingId: body.buildingId, unitId: body.unitId });

  const tenant = await createTenant({
    organizationId,
    userId: body.userId ?? null,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email ?? null,
    phone: body.phone ?? null,
    emergencyContact: body.emergencyContact ?? null,
    ...residence,
  });

  await syncRentalFromResidence(organizationId, tenant.id, residence);
  await audit({ organizationId, userId: actingUser.id, action: 'tenant.created', entityType: 'tenant', entityId: tenant.id, newValues: { firstName: tenant.firstName, lastName: tenant.lastName }, req });
  return serializeTenant(tenant);
}

export async function updateTenantRecord(id, organizationId, body, actingUser, req) {
  const existing = await findTenantById(id, organizationId);
  if (!existing) throw AppError.notFound('Tenant not found.');

  let residence = {};
  if (body.buildingId !== undefined || body.unitId !== undefined) {
    residence = await resolveResidence(organizationId, { buildingId: body.buildingId, unitId: body.unitId });
  }

  await updateTenant(id, organizationId, { ...body, ...residence });
  await syncRentalFromResidence(organizationId, id, residence);
  await audit({ organizationId, userId: actingUser.id, action: 'tenant.updated', entityType: 'tenant', entityId: id, newValues: body, req });
  return getTenant(id, organizationId, actingUser);
}

export async function setTenantActiveStatus(id, organizationId, status, actingUser, req) {
  const existing = await findTenantById(id, organizationId);
  if (!existing) throw AppError.notFound('Tenant not found.');

  await setTenantStatus(id, organizationId, status);
  await audit({ organizationId, userId: actingUser.id, action: 'tenant.status_changed', entityType: 'tenant', entityId: id, oldValues: { status: existing.status }, newValues: { status }, req });
  return getTenant(id, organizationId, actingUser);
}
