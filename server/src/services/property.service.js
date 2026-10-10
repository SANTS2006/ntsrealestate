import { AppError } from '../utils/AppError.js';
import { offerData } from './unit.service.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  findPropertyById, findPropertiesByOrganization, countPropertiesByOrganization,
  updateProperty, setPropertyStatus, getPropertyUnitSummary,
} from '../repositories/property.repository.js';
import { findBuildingsByProperties } from '../repositories/building.repository.js';
import { getUnitSummaryByBuildingIds } from '../repositories/unit.repository.js';
import { getCoverImageUrls } from './document.service.js';
import { findOwnerByUserId } from '../repositories/owner.repository.js';
import {
  assignUserToProperty, unassignUserFromProperty,
  findAssignmentsForProperty, findPropertyIdsAssignedToUser,
} from '../repositories/propertyAssignment.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { assertPropertyAccess, ORG_WIDE_PROPERTY_ROLES, ASSIGNMENT_SCOPED_ROLES, NO_MATCH_ID } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { prisma } from '../config/database.js';

const EMPTY_UNIT_SUMMARY = { total: 0, available: 0, occupied: 0, reserved: 0, under_maintenance: 0, unavailable: 0 };

// Folds the batch building/unit rows fetched for a page of properties into
// a per-property { buildingCount, unitSummary, coverImageUrl } map. Kept
// separate from listProperties so the query shape above stays readable.
async function buildPropertyCardStats(organizationId, propertyIds) {
  const stats = new Map(propertyIds.map((id) => [id, { buildingCount: 0, unitSummary: { ...EMPTY_UNIT_SUMMARY }, coverImageUrl: null }]));
  if (propertyIds.length === 0) return stats;

  const buildings = await findBuildingsByProperties(propertyIds);
  const buildingToProperty = new Map(buildings.map((b) => [b.id, b.propertyId]));

  const [unitRows, coverUrls] = await Promise.all([
    getUnitSummaryByBuildingIds(buildings.map((b) => b.id)),
    getCoverImageUrls(organizationId, 'property', propertyIds),
  ]);

  for (const b of buildings) {
    stats.get(b.propertyId).buildingCount += 1;
  }
  for (const row of unitRows) {
    const propertyId = buildingToProperty.get(row.buildingId);
    const entry = stats.get(propertyId);
    if (!entry) continue;
    entry.unitSummary[row.status] = (entry.unitSummary[row.status] ?? 0) + row._count._all;
    entry.unitSummary.total += row._count._all;
  }
  for (const [propertyId, entry] of stats) {
    entry.coverImageUrl = coverUrls.get(propertyId) ?? null;
  }

  return stats;
}

function serializeProperty(property) {
  return {
    id: property.id,
    ownerId: property.ownerId,
    propertyCode: property.propertyCode,
    name: property.name,
    propertyType: property.propertyType,
    description: property.description,
    address: property.address,
    city: property.city,
    region: property.region,
    country: property.country,
    latitude: property.latitude,
    longitude: property.longitude,
    status: property.status,
    structureType: property.structureType,
    isShared: property.isShared,
    amenities: property.amenities ?? [],
    yearBuilt: property.yearBuilt,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

function hasAnyRole(actingUser, roleSet) {
  return actingUser.roles.some((r) => roleSet.has(r));
}

// Scopes the *listing* itself (not just per-row access) so a
// property_manager/agent's list is pre-filtered to their assignments rather
// than paging through rows they'd be denied on read anyway, and an owner's
// list is pre-filtered to their own portfolio.
export async function listProperties(organizationId, actingUser, { page, pageSize, skip, take, search, status }) {
  let ownerId;
  let propertyIds;

  if (hasAnyRole(actingUser, ASSIGNMENT_SCOPED_ROLES) && !hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) {
    const assignments = await findPropertyIdsAssignedToUser(actingUser.id, organizationId);
    propertyIds = assignments.map((a) => a.propertyId);
  } else if (actingUser.roles.includes('owner') && !hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) {
    const owner = await findOwnerByUserId(actingUser.id, organizationId);
    ownerId = owner?.id ?? NO_MATCH_ID; // no Owner record yet => guaranteed-empty result, not org-wide
  }

  const [properties, total] = await Promise.all([
    findPropertiesByOrganization(organizationId, { skip, take, search, status, ownerId, propertyIds }),
    countPropertiesByOrganization(organizationId, { search, status, ownerId, propertyIds }),
  ]);

  const cardStats = await buildPropertyCardStats(organizationId, properties.map((p) => p.id));

  return {
    properties: properties.map((p) => ({ ...serializeProperty(p), ...cardStats.get(p.id) })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getProperty(id, organizationId, actingUser) {
  const property = await findPropertyById(id, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  const unitSummary = await getPropertyUnitSummary(id);
  // For a whole property / a property with units only, the system keeps one
  // hidden building; the client needs its id to add or list units, and the
  // single unit that stands for a whole property.
  let implicitBuildingId = null;
  let wholeUnit = null;
  if (property.structureType === 'whole' || property.structureType === 'units') {
    const building = await prisma.building.findFirst({ where: { propertyId: id, isImplicit: true }, select: { id: true } });
    implicitBuildingId = building?.id ?? null;
    if (property.structureType === 'whole' && building) {
      const unit = await prisma.unit.findFirst({ where: { buildingId: building.id, isWhole: true } });
      if (unit) wholeUnit = { ...unit, monthlyRent: Number(unit.monthlyRent), securityDeposit: unit.securityDeposit === null ? null : Number(unit.securityDeposit), area: unit.area === null ? null : Number(unit.area), salePrice: unit.salePrice === null ? null : Number(unit.salePrice), leasePrice: unit.leasePrice === null ? null : Number(unit.leasePrice) };
    }
  }
  const coverUrls = await getCoverImageUrls(organizationId, 'property', [id]);
  return { ...serializeProperty(property), unitSummary, implicitBuildingId, wholeUnit, coverImageUrl: coverUrls.get(id) ?? null };
}

// Who a new property belongs to. An owner always creates their own; an agent
// may only create for an owner they hold an active link to; administrators
// choose freely (any owner in the organization, or none).
async function resolvePropertyOwnerId(organizationId, body, actingUser) {
  const orgWide = hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES);
  if (!orgWide && actingUser.roles.includes('owner')) {
    const owner = await findOwnerByUserId(actingUser.id, organizationId);
    if (!owner) throw AppError.forbidden('No owner profile is associated with your account.');
    return owner.id;
  }
  if (!orgWide && hasAnyRole(actingUser, ASSIGNMENT_SCOPED_ROLES)) {
    if (!body.ownerId) throw AppError.badRequest('Choose which owner this property belongs to.');
    const link = await prisma.ownerAgent.findFirst({
      where: { ownerId: body.ownerId, agentUserId: actingUser.id, organizationId, status: 'active' },
    });
    if (!link) throw AppError.badRequest('You can only add properties for owners you work for.');
    return body.ownerId;
  }
  if (body.ownerId) {
    const owner = await prisma.owner.findFirst({ where: { id: body.ownerId, organizationId } });
    if (!owner) throw AppError.badRequest('That owner does not exist in this organization.');
  }
  return body.ownerId ?? null;
}

export async function createPropertyRecord(organizationId, body, actingUser, req) {
  const ownerId = await resolvePropertyOwnerId(organizationId, body, actingUser);
  const structureType = body.structureType ?? 'buildings_units';
  const property = await prisma.$transaction(async (tx) => {
    const created = await tx.property.create({
      data: {
        organizationId,
        ownerId,
        propertyCode: body.propertyCode,
        name: body.name,
        propertyType: body.propertyType,
        description: body.description ?? null,
        address: body.address,
        city: body.city ?? null,
        region: body.region ?? null,
        country: body.country ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        yearBuilt: body.yearBuilt ?? null,
        structureType,
        isShared: body.isShared ?? false,
        amenities: body.amenities ?? [],
      },
    });
    // A whole property, or a property with units only, has no real buildings:
    // the system keeps one hidden building to hold its unit(s).
    if (structureType === 'whole' || structureType === 'units') {
      const building = await tx.building.create({ data: { propertyId: created.id, name: created.name, isImplicit: true } });
      if (structureType === 'whole') {
        const r = body.rental;
        await tx.unit.create({
          data: {
            buildingId: building.id, unitNumber: 'Whole property', isWhole: true,
            unitType: r.unitType ?? null, floor: r.floor ?? null, bedrooms: r.bedrooms ?? null, bathrooms: r.bathrooms ?? null,
            area: r.area ?? null, monthlyRent: r.monthlyRent ?? 0, securityDeposit: r.securityDeposit ?? null,
            description: r.description ?? null, furnished: r.furnished ?? false, amenities: r.amenities ?? [],
            ...offerData(r),
            isShared: r.isShared ?? body.isShared ?? false,
          },
        });
      }
    }
    return created;
  }, { timeout: 20_000 });

  // A property_manager/agent who creates a property is automatically
  // assigned to it — otherwise they'd immediately lose access to the record
  // they just made (assignment-scoped roles have no other route in).
  if (hasAnyRole(actingUser, ASSIGNMENT_SCOPED_ROLES) && !hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) {
    await assignUserToProperty(property.id, actingUser.id, organizationId);
  }

  await audit({ organizationId, userId: actingUser.id, action: 'property.created', entityType: 'property', entityId: property.id, newValues: { name: property.name, propertyCode: property.propertyCode }, req });
  return serializeProperty(property);
}

export async function updatePropertyRecord(id, organizationId, body, actingUser, req) {
  const property = await findPropertyById(id, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  const updated = await updateProperty(id, organizationId, body);
  await audit({ organizationId, userId: actingUser.id, action: 'property.updated', entityType: 'property', entityId: id, newValues: body, req });
  return serializeProperty(updated);
}

export async function archiveProperty(id, organizationId, actingUser, req) {
  const property = await findPropertyById(id, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  await setPropertyStatus(id, organizationId, 'archived');
  await audit({ organizationId, userId: actingUser.id, action: 'property.archived', entityType: 'property', entityId: id, oldValues: { status: property.status }, newValues: { status: 'archived' }, req });
  return { archived: true };
}

// ── Staff assignment (property_manager / agent scoping) ─────────────────

export async function listPropertyAssignments(propertyId, organizationId, actingUser) {
  const property = await findPropertyById(propertyId, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  const assignments = await findAssignmentsForProperty(propertyId, organizationId);
  return assignments.map((a) => ({ userId: a.userId, firstName: a.user.firstName, lastName: a.user.lastName, email: a.user.email, assignedAt: a.createdAt }));
}

export async function assignStaffToProperty(propertyId, organizationId, targetUserId, actingUser, req) {
  const property = await findPropertyById(propertyId, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  const targetUser = await findUserById(targetUserId, organizationId);
  if (!targetUser) throw AppError.badRequest('The specified user does not exist in this organization.');

  await assignUserToProperty(propertyId, targetUserId, organizationId);
  await audit({ organizationId, userId: actingUser.id, action: 'property.staff_assigned', entityType: 'property', entityId: propertyId, newValues: { userId: targetUserId }, req });
  return { assigned: true };
}

export async function unassignStaffFromProperty(propertyId, organizationId, targetUserId, actingUser, req) {
  const property = await findPropertyById(propertyId, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);

  await unassignUserFromProperty(propertyId, targetUserId, organizationId);
  await audit({ organizationId, userId: actingUser.id, action: 'property.staff_unassigned', entityType: 'property', entityId: propertyId, newValues: { userId: targetUserId }, req });
  return { unassigned: true };
}
