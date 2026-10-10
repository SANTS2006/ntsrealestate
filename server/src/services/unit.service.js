import { AppError } from '../utils/AppError.js';
import { findBuildingById } from '../repositories/building.repository.js';
import {
  createUnit, findUnitById, findUnitsByBuilding, updateUnit, setUnitStatus, deleteUnit,
} from '../repositories/unit.repository.js';
import { findActiveLeaseForUnit } from '../repositories/lease.repository.js';
import { getCoverImageUrls } from './document.service.js';
import { assertPropertyAccess } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { prisma } from '../config/database.js';

// `occupied` is set only as a side effect of a lease being activated/ended
// (see lease.service.js) — never accepted directly through this API, so a
// caller can't desync a unit's status from what's actually leased.
const MANUALLY_SETTABLE_STATUSES = new Set(['available', 'reserved', 'under_maintenance', 'unavailable']);

function serializeUnit(unit) {
  return {
    id: unit.id,
    buildingId: unit.buildingId,
    unitNumber: unit.unitNumber,
    unitType: unit.unitType,
    floor: unit.floor,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    area: unit.area,
    monthlyRent: unit.monthlyRent,
    securityDeposit: unit.securityDeposit,
    status: unit.status,
    description: unit.description,
    isWhole: unit.isWhole,
    isShared: unit.isShared,
    offerRent: unit.offerRent,
    offerSale: unit.offerSale,
    offerLease: unit.offerLease,
    salePrice: unit.salePrice,
    leasePrice: unit.leasePrice,
    leaseTermMonths: unit.leaseTermMonths,
    furnished: unit.furnished,
    amenities: unit.amenities ?? [],
  };
}

// What a unit is offered for. Renting is the default; selling and leasing each
// need their own price. Prices of things not offered are cleared.
function assertOffers(offerRent, offerSale, offerLease, monthlyRent, salePrice, leasePrice) {
  if (!offerRent && !offerSale && !offerLease) throw AppError.badRequest('Choose at least one way to offer this: rent, sale or lease.');
  if (offerRent && !(Number(monthlyRent) > 0)) throw AppError.badRequest('Enter the monthly rent.');
  if (offerSale && !(Number(salePrice) > 0)) throw AppError.badRequest('Enter the sale price.');
  if (offerLease && !(Number(leasePrice) > 0)) throw AppError.badRequest('Enter the lease price.');
}

export function offerData(body) {
  const offerRent = body.offerRent ?? true;
  const offerSale = body.offerSale ?? false;
  const offerLease = body.offerLease ?? false;
  assertOffers(offerRent, offerSale, offerLease, body.monthlyRent, body.salePrice, body.leasePrice);
  return {
    offerRent, offerSale, offerLease,
    salePrice: offerSale ? body.salePrice : null,
    leasePrice: offerLease ? body.leasePrice : null,
    leaseTermMonths: offerLease ? (body.leaseTermMonths ?? 12) : null,
  };
}

async function loadBuildingWithAccess(buildingId, organizationId, actingUser) {
  const building = await findBuildingById(buildingId, organizationId);
  if (!building) throw AppError.notFound('Building not found.');
  await assertPropertyAccess(building.property, actingUser);
  return building;
}

export async function listUnits(buildingId, organizationId, actingUser, { status } = {}) {
  await loadBuildingWithAccess(buildingId, organizationId, actingUser);
  const units = await findUnitsByBuilding(buildingId, organizationId, { status });
  const coverUrls = await getCoverImageUrls(organizationId, 'unit', units.map((u) => u.id));
  return units.map((u) => ({ ...serializeUnit(u), coverImageUrl: coverUrls.get(u.id) ?? null }));
}

export async function getUnit(id, organizationId, actingUser) {
  const unit = await findUnitById(id, organizationId);
  if (!unit) throw AppError.notFound('Unit not found.');
  await assertPropertyAccess(unit.building.property, actingUser);
  return serializeUnit(unit);
}

export async function createUnitRecord(buildingId, organizationId, body, actingUser, req) {
  const building = await loadBuildingWithAccess(buildingId, organizationId, actingUser);
  if (building.property.structureType === 'whole' || building.property.structureType === 'buildings') {
    throw AppError.conflict('This property is rented as a whole, so it has no separate units. Edit its price and details instead.');
  }

  const unit = await createUnit({
    buildingId,
    unitNumber: body.unitNumber,
    unitType: body.unitType ?? null,
    floor: body.floor ?? null,
    bedrooms: body.bedrooms ?? null,
    bathrooms: body.bathrooms ?? null,
    area: body.area ?? null,
    monthlyRent: body.monthlyRent ?? 0,
    securityDeposit: body.securityDeposit ?? null,
    description: body.description ?? null,
    ...offerData(body),
    isShared: body.isShared ?? false,
    furnished: body.furnished ?? false,
    amenities: body.amenities ?? [],
  });

  await audit({ organizationId, userId: actingUser.id, action: 'unit.created', entityType: 'unit', entityId: unit.id, newValues: { unitNumber: unit.unitNumber, buildingId }, req });
  return serializeUnit(unit);
}

export async function updateUnitRecord(id, organizationId, body, actingUser, req) {
  const unit = await findUnitById(id, organizationId);
  if (!unit) throw AppError.notFound('Unit not found.');
  await assertPropertyAccess(unit.building.property, actingUser);

  if (['offerRent', 'offerSale', 'offerLease', 'salePrice', 'leasePrice', 'monthlyRent'].some((k) => body[k] !== undefined)) {
    const merged = {
      offerRent: body.offerRent ?? unit.offerRent, offerSale: body.offerSale ?? unit.offerSale, offerLease: body.offerLease ?? unit.offerLease,
      monthlyRent: body.monthlyRent ?? unit.monthlyRent, salePrice: body.salePrice ?? unit.salePrice, leasePrice: body.leasePrice ?? unit.leasePrice,
      leaseTermMonths: body.leaseTermMonths ?? unit.leaseTermMonths,
    };
    Object.assign(body, offerData(merged));
  }
  await updateUnit(id, organizationId, body);
  await audit({ organizationId, userId: actingUser.id, action: 'unit.updated', entityType: 'unit', entityId: id, newValues: body, req });
  return getUnit(id, organizationId, actingUser);
}

export async function setUnitManualStatus(id, organizationId, status, actingUser, req) {
  if (!MANUALLY_SETTABLE_STATUSES.has(status)) {
    throw AppError.badRequest(`Status "${status}" cannot be set directly — it is managed automatically by lease activity.`);
  }

  const unit = await findUnitById(id, organizationId);
  if (!unit) throw AppError.notFound('Unit not found.');
  await assertPropertyAccess(unit.building.property, actingUser);

  const activeLease = await findActiveLeaseForUnit(id);
  if (activeLease) {
    throw AppError.conflict('This unit has an active lease. Terminate the lease before changing its status.');
  }

  await setUnitStatus(id, status);
  await audit({ organizationId, userId: actingUser.id, action: 'unit.status_changed', entityType: 'unit', entityId: id, oldValues: { status: unit.status }, newValues: { status }, req });
  return getUnit(id, organizationId, actingUser);
}

export async function deleteUnitRecord(id, organizationId, actingUser, req) {
  const unit = await findUnitById(id, organizationId);
  if (!unit) throw AppError.notFound('Unit not found.');
  await assertPropertyAccess(unit.building.property, actingUser);

  if (unit.isWhole) throw AppError.conflict('This stands for the whole property or building. Delete the building or property instead.');
  if (unit.status === 'occupied') {
    throw AppError.conflict('This unit is currently occupied and cannot be deleted.');
  }

  await deleteUnit(id, organizationId);
  await audit({ organizationId, userId: actingUser.id, action: 'unit.deleted', entityType: 'unit', entityId: id, req });
  return { deleted: true };
}

// Ends the renter's hold on a unit (or a whole building rented as one) so it
// can be rented again and shows on the website. A running lease must be
// terminated first.
export async function endUnitRental(id, organizationId, actingUser, req) {
  const unit = await findUnitById(id, organizationId);
  if (!unit) throw AppError.notFound('Unit not found.');
  await assertPropertyAccess(unit.building.property, actingUser);

  const activeLease = await findActiveLeaseForUnit(id);
  if (activeLease) throw AppError.conflict('This unit has an active lease. Terminate the lease before ending the rental.');

  // A whole building rented as one is held at building level.
  const wholeBuilding = unit.isWhole && unit.building.property.structureType === 'buildings';
  const where = {
    organizationId, status: 'active',
    OR: [{ unitId: id }, ...(wholeBuilding ? [{ buildingId: unit.buildingId, unitId: null }] : [])],
  };
  const active = await prisma.tenantRental.findMany({ where, select: { id: true, tenantId: true } });
  if (active.length === 0 && unit.status !== 'occupied') throw AppError.conflict('This is not currently rented.');

  await prisma.$transaction([
    prisma.tenantRental.updateMany({ where, data: { status: 'ended', endedAt: new Date() } }),
    prisma.unit.updateMany({ where: wholeBuilding ? { buildingId: unit.buildingId } : { id }, data: { status: 'available' } }),
  ]);
  await audit({ organizationId, userId: actingUser.id, action: 'rental.ended', entityType: 'unit', entityId: id, oldValues: { status: unit.status, rentals: active.map((r) => r.id) }, newValues: { status: 'available' }, req });
  return getUnit(id, organizationId, actingUser);
}
