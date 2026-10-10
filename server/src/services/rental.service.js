import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { getPropertyContacts, getPropertyStaffUserIds } from './propertyContacts.service.js';

function describe(rental) {
  const parts = [rental.property?.name, rental.building && !rental.building.isImplicit ? rental.building.name : null, rental.unit && !rental.unit.isWhole ? `Unit ${rental.unit.unitNumber}` : null].filter(Boolean);
  return parts.join(' — ');
}

const RENTAL_INCLUDE = {
  property: { select: { id: true, name: true, address: true, city: true } },
  building: { select: { id: true, name: true, isImplicit: true } },
  unit: { select: { id: true, unitNumber: true, isWhole: true, unitType: true, bedrooms: true, bathrooms: true, monthlyRent: true } },
};

function serializeRental(rental) {
  return {
    id: rental.id,
    status: rental.status,
    source: rental.source,
    createdAt: rental.createdAt,
    endedAt: rental.endedAt,
    kind: rental.unitId ? 'unit' : 'building',
    label: describe(rental),
    property: rental.property,
    building: rental.building,
    unit: rental.unit ? { ...rental.unit, monthlyRent: Number(rental.unit.monthlyRent) } : null,
  };
}

// The caller's one Tenant record, created on first use. A person is one
// tenant no matter how many places they rent — this never makes a second.
export async function ensureTenantRecord(user, tx) {
  const existing = await tx.tenant.findFirst({ where: { userId: user.id, organizationId: user.organizationId } });
  if (existing) return existing;

  const account = await tx.user.findUnique({ where: { id: user.id } });
  return tx.tenant.create({
    data: {
      organizationId: user.organizationId, userId: user.id,
      firstName: account.firstName, lastName: account.lastName, email: account.email, phone: account.phone,
    },
  });
}

// Registers the signed-in tenant against a unit (or a whole building):
//   - first request creates their Tenant record, pre-filled with the property,
//     building and unit they chose;
//   - any later request just adds another rental under the SAME tenant;
//   - asking for something they already have returns it unchanged.
// The owner and agents of that property are notified.
export async function requestRental(actingUser, { unitId, buildingId }, req) {
  if (!actingUser.roles.includes('tenant')) {
    throw AppError.forbidden('Only tenant accounts can rent a property. Sign in with a tenant account, or create one from the rental link.');
  }

  let target;
  // A shared property / building / unit may have several renters; anything
  // else goes to one person, and is then marked rented.
  let shared = false;
  if (unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, building: { property: { organizationId: actingUser.organizationId, status: 'active' } } },
      include: { building: { include: { property: true } } },
    });
    if (!unit) throw AppError.notFound('That unit is not available.');
    shared = unit.isShared || unit.building.isShared || unit.building.property.isShared;
    if (!shared) {
      const takenByOther = await prisma.tenantRental.findFirst({ where: { unitId, status: 'active', tenant: { userId: { not: actingUser.id } } } });
      if (takenByOther) throw AppError.conflict('That place has already been rented.');
    }
    if (unit.status !== 'available' && unit.status !== 'reserved') {
      // Still allow re-requesting something they already hold below.
      const held = await prisma.tenantRental.findFirst({ where: { unitId, tenant: { userId: actingUser.id }, status: 'active' } });
      if (!held) throw AppError.conflict('That unit is no longer available.');
    }
    target = { propertyId: unit.building.property.id, buildingId: unit.buildingId, unitId: unit.id };
  } else if (buildingId) {
    const building = await prisma.building.findFirst({
      where: { id: buildingId, property: { organizationId: actingUser.organizationId, status: 'active' } },
      include: { property: true },
    });
    if (!building) throw AppError.notFound('That building is not available.');
    shared = building.isShared || building.property.isShared;
    if (!shared) {
      const units = await prisma.unit.findMany({ where: { buildingId }, select: { status: true } });
      const takenByOther = await prisma.tenantRental.findFirst({ where: { buildingId, status: 'active', tenant: { userId: { not: actingUser.id } } } });
      if (takenByOther || units.some((u) => u.status === 'occupied')) throw AppError.conflict('That building has already been rented.');
    }
    target = { propertyId: building.propertyId, buildingId: building.id, unitId: null };
  } else {
    throw AppError.badRequest('Choose a unit or a building to rent.');
  }

  const { rental, tenant, created, alreadyHeld } = await prisma.$transaction(async (tx) => {
    // Two people asking for the same place at the same moment: lock it so they
    // take turns, then look again — the second one finds it already rented.
    if (!shared) {
      if (target.unitId) await tx.$queryRaw`SELECT id FROM units WHERE id = ${target.unitId}::uuid FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM buildings WHERE id = ${target.buildingId}::uuid FOR UPDATE`;
      const taken = await tx.tenantRental.findFirst({
        where: { status: 'active', tenant: { userId: { not: actingUser.id } }, ...(target.unitId ? { unitId: target.unitId } : { buildingId: target.buildingId }) },
      });
      if (taken) throw AppError.conflict(target.unitId ? 'That place has already been rented.' : 'That building has already been rented.');
    }
    const tenantRecord = await ensureTenantRecord(actingUser, tx);
    const duplicate = await tx.tenantRental.findFirst({
      where: {
        tenantId: tenantRecord.id, status: 'active',
        ...(target.unitId ? { unitId: target.unitId } : { buildingId: target.buildingId, unitId: null }),
      },
      include: RENTAL_INCLUDE,
    });
    if (duplicate) return { rental: duplicate, tenant: tenantRecord, created: false, alreadyHeld: true };

    const row = await tx.tenantRental.create({
      data: { organizationId: actingUser.organizationId, tenantId: tenantRecord.id, ...target, source: 'public_site' },
      include: RENTAL_INCLUDE,
    });
    // Rented: no one else can take it, and it leaves the website.
    if (!shared) {
      if (target.unitId) await tx.unit.update({ where: { id: target.unitId }, data: { status: 'occupied' } });
      else await tx.unit.updateMany({ where: { buildingId: target.buildingId }, data: { status: 'occupied' } });
    }
    // Keep the tenant's "primary residence" convenience fields filled from the
    // first rental, so existing screens that show a single place still work.
    if (!tenantRecord.unitId && !tenantRecord.buildingId) {
      await tx.tenant.update({ where: { id: tenantRecord.id }, data: { buildingId: target.buildingId, unitId: target.unitId } });
    }
    return { rental: row, tenant: tenantRecord, created: true, alreadyHeld: false };
  }, { timeout: 15_000 });

  if (created) {
    await audit({
      organizationId: actingUser.organizationId, userId: actingUser.id, action: 'rental.requested', entityType: 'tenant',
      entityId: tenant.id, newValues: { rentalId: rental.id, propertyId: target.propertyId, buildingId: target.buildingId, unitId: target.unitId }, req,
    });

    const recipients = await getPropertyStaffUserIds(target.propertyId, actingUser.organizationId);
    await Promise.all(recipients.map((userId) => notify({
      organizationId: actingUser.organizationId, userId, type: 'rental_request',
      title: 'New rental registered',
      message: `${tenant.firstName} ${tenant.lastName} registered to rent ${describe(rental)}.`,
    })));
  }

  return { rental: serializeRental(rental), alreadyHeld };
}

// A tenant's own rentals, each with the owner and agents looking after it.
export async function listMyRentals(actingUser) {
  const tenant = await prisma.tenant.findFirst({ where: { userId: actingUser.id, organizationId: actingUser.organizationId } });
  if (!tenant) return [];

  const rentals = await prisma.tenantRental.findMany({
    where: { tenantId: tenant.id, organizationId: actingUser.organizationId, status: 'active' },
    include: RENTAL_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  const contactsByProperty = new Map();
  for (const propertyId of new Set(rentals.map((r) => r.propertyId))) {
    contactsByProperty.set(propertyId, await getPropertyContacts(propertyId, actingUser.organizationId));
  }
  return rentals.map((r) => ({ ...serializeRental(r), contacts: contactsByProperty.get(r.propertyId) }));
}

// For staff viewing one tenant (scoping to what the staff member may see is
// the caller's job — see tenant.service.js).
export async function listRentalsForTenant(tenantId, organizationId) {
  const rentals = await prisma.tenantRental.findMany({
    where: { tenantId, organizationId },
    include: RENTAL_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return rentals.map(serializeRental);
}

// What a tenant is allowed to pick in any form that asks for a property,
// building or unit: only the ones they have rented.
export async function getTenantScopeOptions(actingUser) {
  const tenant = await prisma.tenant.findFirst({ where: { userId: actingUser.id, organizationId: actingUser.organizationId } });
  if (!tenant) return { properties: [], buildings: [], units: [] };

  const rentals = await prisma.tenantRental.findMany({
    where: { tenantId: tenant.id, status: 'active' },
    include: {
      property: { select: { id: true, name: true } },
      building: { select: { id: true, name: true, propertyId: true } },
      unit: { select: { id: true, unitNumber: true, buildingId: true } },
    },
  });

  const properties = new Map();
  const buildings = new Map();
  const units = new Map();
  for (const r of rentals) {
    properties.set(r.property.id, r.property);
    if (r.building) buildings.set(r.building.id, r.building);
    if (r.unit) units.set(r.unit.id, r.unit);
  }
  // Renting a whole building covers every unit in it.
  const wholeBuildingIds = rentals.filter((r) => !r.unitId && r.buildingId).map((r) => r.buildingId);
  if (wholeBuildingIds.length > 0) {
    const inside = await prisma.unit.findMany({
      where: { buildingId: { in: wholeBuildingIds } },
      select: { id: true, unitNumber: true, buildingId: true },
    });
    for (const u of inside) units.set(u.id, u);
  }
  return { properties: [...properties.values()], buildings: [...buildings.values()], units: [...units.values()] };
}
