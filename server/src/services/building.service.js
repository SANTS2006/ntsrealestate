import { AppError } from '../utils/AppError.js';
import { offerData } from './unit.service.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { prisma } from '../config/database.js';
import {
  findBuildingById, findBuildingsByProperty, updateBuilding, deleteBuilding,
} from '../repositories/building.repository.js';
import { findUnitsByBuilding, getUnitSummaryByBuildingIds } from '../repositories/unit.repository.js';
import { getCoverImageUrls } from './document.service.js';
import { assertPropertyAccess } from './resourceAccess.service.js';
import { audit } from './audit.service.js';

const EMPTY_UNIT_SUMMARY = { total: 0, available: 0, occupied: 0, reserved: 0, under_maintenance: 0, unavailable: 0 };

function serializeBuilding(building) {
  return { id: building.id, propertyId: building.propertyId, name: building.name, code: building.code, floors: building.floors, description: building.description, isImplicit: building.isImplicit, isShared: building.isShared };
}

// The rentable details of a building that is rented as a whole (properties of
// the "buildings" kind) live on its one automatic unit.
function serializeWholeUnit(unit) {
  if (!unit) return null;
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    unitId: unit.id, offerRent: unit.offerRent, offerSale: unit.offerSale, offerLease: unit.offerLease, salePrice: num(unit.salePrice), leasePrice: num(unit.leasePrice), leaseTermMonths: unit.leaseTermMonths, monthlyRent: num(unit.monthlyRent), securityDeposit: num(unit.securityDeposit), bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
    area: num(unit.area), floor: unit.floor, unitType: unit.unitType, furnished: unit.furnished, amenities: unit.amenities ?? [], status: unit.status,
  };
}

function rentalToUnitData(r) {
  const data = {};
  for (const k of ['unitType', 'floor', 'bedrooms', 'bathrooms', 'area', 'monthlyRent', 'securityDeposit', 'description', 'furnished', 'amenities', 'offerRent', 'offerSale', 'offerLease', 'salePrice', 'leasePrice', 'leaseTermMonths']) {
    if (r[k] !== undefined) data[k] = r[k];
  }
  return data;
}

async function loadPropertyWithAccess(propertyId, organizationId, actingUser) {
  const property = await findPropertyById(propertyId, organizationId);
  if (!property) throw AppError.notFound('Property not found.');
  await assertPropertyAccess(property, actingUser);
  return property;
}

export async function listBuildings(propertyId, organizationId, actingUser) {
  await loadPropertyWithAccess(propertyId, organizationId, actingUser);
  const buildings = await findBuildingsByProperty(propertyId, organizationId);
  const buildingIds = buildings.map((b) => b.id);

  const [unitRows, coverUrls, wholeUnits] = await Promise.all([
    getUnitSummaryByBuildingIds(buildingIds),
    getCoverImageUrls(organizationId, 'building', buildingIds),
    buildingIds.length ? prisma.unit.findMany({ where: { buildingId: { in: buildingIds }, isWhole: true } }) : [],
  ]);
  const wholeByBuilding = new Map(wholeUnits.map((u) => [u.buildingId, u]));

  const unitSummaryByBuilding = new Map(buildingIds.map((id) => [id, { ...EMPTY_UNIT_SUMMARY }]));
  for (const row of unitRows) {
    const summary = unitSummaryByBuilding.get(row.buildingId);
    summary[row.status] = (summary[row.status] ?? 0) + row._count._all;
    summary.total += row._count._all;
  }

  return buildings.map((b) => ({
    ...serializeBuilding(b),
    unitSummary: unitSummaryByBuilding.get(b.id),
    coverImageUrl: coverUrls.get(b.id) ?? null,
    rental: serializeWholeUnit(wholeByBuilding.get(b.id)),
  }));
}

export async function getBuilding(id, organizationId, actingUser) {
  const building = await findBuildingById(id, organizationId);
  if (!building) throw AppError.notFound('Building not found.');
  await assertPropertyAccess(building.property, actingUser);
  const whole = await prisma.unit.findFirst({ where: { buildingId: id, isWhole: true } });
  return { ...serializeBuilding(building), rental: serializeWholeUnit(whole) };
}

export async function createBuildingRecord(propertyId, organizationId, body, actingUser, req) {
  const property = await loadPropertyWithAccess(propertyId, organizationId, actingUser);
  if (property.structureType === 'whole' || property.structureType === 'units') {
    throw AppError.conflict('This property is not set up with buildings.');
  }
  if (property.structureType === 'buildings' && !body.rental) {
    throw AppError.badRequest('Enter the price and details for this building.');
  }

  const building = await prisma.$transaction(async (tx) => {
    const created = await tx.building.create({ data: { propertyId, name: body.name, code: body.code ?? null, floors: body.floors ?? null, description: body.description ?? null, isShared: body.isShared ?? false } });
    // In a "buildings" property each building is rented as a whole: one
    // automatic unit carries its price, bedrooms, bathrooms and facilities.
    if (property.structureType === 'buildings') {
      await tx.unit.create({ data: { buildingId: created.id, unitNumber: 'Whole building', isWhole: true, monthlyRent: body.rental.monthlyRent ?? 0, ...rentalToUnitData(body.rental), ...offerData(body.rental) } });
    }
    return created;
  }, { timeout: 20_000 });
  await audit({ organizationId, userId: actingUser.id, action: 'building.created', entityType: 'building', entityId: building.id, newValues: { name: building.name, propertyId }, req });
  return serializeBuilding(building);
}

export async function updateBuildingRecord(id, organizationId, body, actingUser, req) {
  const building = await findBuildingById(id, organizationId);
  if (!building) throw AppError.notFound('Building not found.');
  await assertPropertyAccess(building.property, actingUser);

  const { rental, ...buildingFields } = body;
  await updateBuilding(id, organizationId, buildingFields);
  if (rental && building.property.structureType === 'buildings') {
    const current = await prisma.unit.findFirst({ where: { buildingId: id, isWhole: true } });
    const merged = { ...current, ...rental };
    await prisma.unit.updateMany({ where: { buildingId: id, isWhole: true }, data: { ...rentalToUnitData(rental), ...offerData(merged) } });
  }
  await audit({ organizationId, userId: actingUser.id, action: 'building.updated', entityType: 'building', entityId: id, newValues: body, req });
  return getBuilding(id, organizationId, actingUser);
}

export async function deleteBuildingRecord(id, organizationId, actingUser, req) {
  const building = await findBuildingById(id, organizationId);
  if (!building) throw AppError.notFound('Building not found.');
  await assertPropertyAccess(building.property, actingUser);
  if (building.isImplicit) throw AppError.conflict('This is the property itself and cannot be deleted as a building.');

  // Deleting a building cascades to its units at the database level — block
  // it here if any unit currently has an active lease, so a lease record
  // never gets silently orphaned by a structural change elsewhere.
  const units = await findUnitsByBuilding(id, organizationId);
  const hasOccupiedUnit = units.some((u) => u.status === 'occupied');
  if (hasOccupiedUnit) {
    throw AppError.conflict('This building has an occupied unit with an active lease and cannot be deleted.');
  }

  await deleteBuilding(id, organizationId);
  await audit({ organizationId, userId: actingUser.id, action: 'building.deleted', entityType: 'building', entityId: id, req });
  return { deleted: true };
}
