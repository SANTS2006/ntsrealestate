import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { unitTitle } from '../utils/unitLabel.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { getSalesScope, dealScopeWhere, dealStaffUserIds } from './salesScope.service.js';
import { ensureTenantRecord, requestRental } from './rental.service.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const KIND_LABEL = { rent: 'rent', buy: 'buy', lease: 'lease' };

const DEAL_INCLUDE = {
  tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true } },
  unit: { include: { building: { include: { property: true } } } },
  land: { select: { id: true, title: true, city: true, region: true, area: true, areaUnit: true } },
};

function subjectOf(deal) {
  if (deal.unit) {
    return { type: 'unit', id: deal.unit.id, title: unitTitle(deal.unit), propertyId: deal.unit.building.propertyId, propertyName: deal.unit.building.property.name, city: deal.unit.building.property.city };
  }
  if (deal.land) {
    return { type: 'land', id: deal.land.id, title: deal.land.title, city: deal.land.city, region: deal.land.region, area: num(deal.land.area), areaUnit: deal.land.areaUnit };
  }
  return { type: 'unknown', title: 'Removed listing' };
}

function serializeDeal(deal, paid = 0) {
  const price = num(deal.price);
  return {
    id: deal.id,
    kind: deal.kind,
    status: deal.status,
    price,
    termMonths: deal.termMonths,
    paid,
    balance: Math.max(price - paid, 0),
    notes: deal.notes,
    leaseId: deal.leaseId,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    tenant: deal.tenant ? { id: deal.tenant.id, name: `${deal.tenant.firstName} ${deal.tenant.lastName}`.trim(), email: deal.tenant.email, phone: deal.tenant.phone } : null,
    subject: subjectOf(deal),
  };
}

async function paidByDeal(dealIds) {
  const map = new Map();
  if (dealIds.length === 0) return map;
  const rows = await prisma.payment.groupBy({ by: ['dealId'], where: { dealId: { in: dealIds }, status: 'completed' }, _sum: { amount: true } });
  for (const r of rows) map.set(r.dealId, num(r._sum.amount) ?? 0);
  return map;
}

// ── asking for a deal (a customer on the website / their own account) ─────

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// A signed-in customer asks to rent, buy or lease a house, or to buy a land.
//   rent  -> registers the rental straight away (as before) and opens a deal so
//            rent payments can be recorded against it
//   buy   -> reserves the house / land and opens a purchase to be approved
//   lease -> reserves the house, opens the deal and a draft lease that shows
//            up in My Leases and in the Leases module until it is activated
export async function requestDeal(actingUser, { kind, unitId, landId, notes }, req) {
  if (!actingUser.roles.includes('tenant')) {
    throw AppError.forbidden('Only customer accounts can do this. Sign in with a tenant account, or create one from the link.');
  }
  const organizationId = actingUser.organizationId;
  if (!unitId && !landId) throw AppError.badRequest('Choose a house or a land.');
  if (landId && kind !== 'buy') throw AppError.badRequest('Land can only be bought.');

  // ---- renting a house: the existing rental flow, plus a deal for payments ----
  if (kind === 'rent') {
    const { rental, alreadyHeld } = await requestRental(actingUser, { unitId }, req);
    const unit = await prisma.unit.findFirst({ where: { id: unitId }, include: { building: { include: { property: true } } } });
    const tenant = await prisma.tenant.findFirst({ where: { userId: actingUser.id, organizationId } });
    let deal = await prisma.deal.findFirst({ where: { tenantId: tenant.id, unitId, kind: 'rent', status: { not: 'cancelled' } }, include: DEAL_INCLUDE });
    if (!deal) {
      deal = await prisma.deal.create({
        data: {
          organizationId, kind: 'rent', status: 'approved', tenantId: tenant.id, unitId, propertyId: unit.building.propertyId,
          ownerId: unit.building.property.ownerId, price: unit.monthlyRent,
        },
        include: DEAL_INCLUDE,
      });
    }
    return { deal: serializeDeal(deal), rental, alreadyHeld };
  }

  const tenant = await ensureTenantRecord(actingUser, prisma);

  // ---- buying land ----
  if (landId) {
    const land = await prisma.land.findFirst({ where: { id: landId, organizationId } });
    if (!land) throw AppError.notFound('That land is not available.');
    const mine = await prisma.deal.findFirst({ where: { tenantId: tenant.id, landId, kind: 'buy', status: { not: 'cancelled' } }, include: DEAL_INCLUDE });
    if (mine) return { deal: serializeDeal(mine, (await paidByDeal([mine.id])).get(mine.id) ?? 0), alreadyHeld: true };
    if (land.status !== 'available') throw AppError.conflict('That land is no longer available.');

    const deal = await prisma.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: { organizationId, kind: 'buy', status: 'pending', tenantId: tenant.id, landId, ownerId: land.ownerId, price: land.price, notes: notes ?? null },
        include: DEAL_INCLUDE,
      });
      await tx.land.update({ where: { id: landId }, data: { status: 'reserved' } });
      return created;
    });
    await announce(deal, { ownerId: land.ownerId, propertyId: null }, `${tenant.firstName} ${tenant.lastName} wants to buy the land "${land.title}".`, req, actingUser);
    return { deal: serializeDeal(deal), alreadyHeld: false };
  }

  // ---- buying or leasing a house ----
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, building: { property: { organizationId, status: 'active' } } },
    include: { building: { include: { property: true } } },
  });
  if (!unit) throw AppError.notFound('That house is not available.');

  const mine = await prisma.deal.findFirst({ where: { tenantId: tenant.id, unitId, kind, status: { not: 'cancelled' } }, include: DEAL_INCLUDE });
  if (mine) return { deal: serializeDeal(mine, (await paidByDeal([mine.id])).get(mine.id) ?? 0), alreadyHeld: true };

  if (kind === 'buy' && !(unit.offerSale && Number(unit.salePrice) > 0)) throw AppError.conflict('This house is not for sale.');
  if (kind === 'lease' && !(unit.offerLease && Number(unit.leasePrice) > 0)) throw AppError.conflict('This house is not offered on lease.');
  if (unit.status !== 'available') throw AppError.conflict('That house is no longer available.');

  const termMonths = kind === 'lease' ? (unit.leaseTermMonths ?? 12) : null;
  const price = kind === 'buy' ? unit.salePrice : unit.leasePrice;
  const property = unit.building.property;

  const deal = await prisma.$transaction(async (tx) => {
    let leaseId = null;
    if (kind === 'lease') {
      const start = new Date();
      const lease = await tx.lease.create({
        data: {
          organizationId, unitId, tenantId: tenant.id, startDate: start, endDate: addMonths(start, termMonths),
          // The lease price is per year; the lease module works in monthly terms.
          monthlyRent: Math.round((Number(price) / 12) * 100) / 100, securityDeposit: unit.securityDeposit, paymentDueDay: 1, status: 'draft',
          terms: { source: 'website', kind: 'lease', leasePricePerYear: Number(price), termMonths },
        },
      });
      leaseId = lease.id;
    }
    const created = await tx.deal.create({
      data: {
        organizationId, kind, status: 'pending', tenantId: tenant.id, unitId, propertyId: property.id, ownerId: property.ownerId,
        leaseId, price, termMonths, notes: notes ?? null,
      },
      include: DEAL_INCLUDE,
    });
    await tx.unit.update({ where: { id: unitId }, data: { status: 'reserved' } });
    return created;
  }, { timeout: 20_000 });

  await announce(deal, { ownerId: property.ownerId, propertyId: property.id }, `${tenant.firstName} ${tenant.lastName} wants to ${KIND_LABEL[kind]} ${unitTitle(unit)}.`, req, actingUser);
  return { deal: serializeDeal(deal), alreadyHeld: false };
}

async function announce(deal, { ownerId, propertyId }, message, req, actingUser) {
  await audit({ organizationId: deal.organizationId, userId: actingUser.id, action: 'deal.requested', entityType: 'deal', entityId: deal.id, newValues: { kind: deal.kind, price: num(deal.price) }, req });
  const recipients = await dealStaffUserIds(deal.organizationId, { ownerId, propertyId });
  await Promise.all(recipients.map((userId) => notify({
    organizationId: deal.organizationId, userId, type: 'deal_request', title: `New ${KIND_LABEL[deal.kind]} request`, message,
  })));
}

// ── reading ────────────────────────────────────────────────────────────────

async function loadDeal(id, organizationId, actingUser) {
  const scope = await getSalesScope(actingUser, organizationId);
  const deal = await prisma.deal.findFirst({ where: { id, organizationId, ...dealScopeWhere(scope) }, include: DEAL_INCLUDE });
  if (!deal) throw AppError.notFound('Deal not found.');
  return deal;
}

export async function listDeals(organizationId, actingUser, { page, pageSize, skip, take, kind, status, search }) {
  const scope = await getSalesScope(actingUser, organizationId);
  const where = {
    organizationId,
    ...dealScopeWhere(scope),
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(search ? { tenant: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } } : {}),
  };
  const [deals, total] = await Promise.all([
    prisma.deal.findMany({ where, include: DEAL_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.deal.count({ where }),
  ]);
  const paid = await paidByDeal(deals.map((d) => d.id));
  return { deals: deals.map((d) => serializeDeal(d, paid.get(d.id) ?? 0)), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getDeal(id, organizationId, actingUser) {
  const deal = await loadDeal(id, organizationId, actingUser);
  const [paid, payments] = await Promise.all([
    paidByDeal([id]),
    prisma.payment.findMany({ where: { dealId: id }, orderBy: { paymentDate: 'desc' }, take: 100 }),
  ]);
  return {
    ...serializeDeal(deal, paid.get(id) ?? 0),
    payments: payments.map((p) => ({ id: p.id, amount: num(p.amount), currency: p.currency, paymentDate: p.paymentDate, paymentMethod: p.paymentMethod, reference: p.reference, status: p.status })),
  };
}

// For the payment service: load a deal the caller may act on.
export async function loadDealForPayment(id, organizationId, actingUser) {
  return loadDeal(id, organizationId, actingUser);
}

// ── managing ───────────────────────────────────────────────────────────────

const TRANSITIONS = { pending: ['approved', 'cancelled'], approved: ['completed', 'cancelled'], completed: [], cancelled: [] };

export async function updateDealStatus(id, status, organizationId, actingUser, req) {
  const deal = await loadDeal(id, organizationId, actingUser);
  if (!TRANSITIONS[deal.status].includes(status)) {
    throw AppError.conflict(`A ${deal.status} deal cannot be marked ${status}.`);
  }
  const paid = (await paidByDeal([id])).get(id) ?? 0;
  if (status === 'completed' && deal.kind === 'buy' && paid < Number(deal.price)) {
    throw AppError.conflict('Record the full payment before completing a purchase.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({ where: { id }, data: { status } });

    if (deal.kind === 'lease' && deal.leaseId) {
      if (status === 'approved') {
        const conflict = await tx.lease.findFirst({ where: { unitId: deal.unitId, status: 'active', id: { not: deal.leaseId } } });
        if (conflict) throw AppError.conflict('This house already has another active lease.');
        await tx.lease.update({ where: { id: deal.leaseId }, data: { status: 'active' } });
        await tx.unit.update({ where: { id: deal.unitId }, data: { status: 'occupied' } });
      }
      if (status === 'cancelled') {
        const lease = await tx.lease.findUnique({ where: { id: deal.leaseId } });
        if (lease?.status === 'draft') {
          await tx.deal.update({ where: { id }, data: { leaseId: null } });
          await tx.lease.delete({ where: { id: deal.leaseId } });
        } else if (lease?.status === 'active') {
          await tx.lease.update({ where: { id: deal.leaseId }, data: { status: 'terminated' } });
        }
      }
    }

    if (deal.unitId && deal.kind !== 'rent') {
      if (status === 'cancelled') await tx.unit.update({ where: { id: deal.unitId }, data: { status: 'available' } });
      if (status === 'completed' && deal.kind === 'buy') await tx.unit.update({ where: { id: deal.unitId }, data: { status: 'unavailable' } });
    }
    if (deal.landId) {
      if (status === 'cancelled') await tx.land.update({ where: { id: deal.landId }, data: { status: 'available' } });
      if (status === 'completed') await tx.land.update({ where: { id: deal.landId }, data: { status: 'sold' } });
    }
  }, { timeout: 20_000 });

  await audit({ organizationId, userId: actingUser.id, action: `deal.${status}`, entityType: 'deal', entityId: id, oldValues: { status: deal.status }, newValues: { status }, req });
  if (deal.tenant?.userId) {
    const what = subjectOf(deal).title;
    await notify({
      organizationId, userId: deal.tenant.userId, type: 'deal_update', title: `Your ${KIND_LABEL[deal.kind]} request was ${status}`,
      message: `${what}: your ${KIND_LABEL[deal.kind]} request is now ${status}.`,
    });
  }
  return getDeal(id, organizationId, actingUser);
}

