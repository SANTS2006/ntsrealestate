import { prisma } from '../config/database.js';

export function createPayment(data, tx = prisma) {
  return tx.payment.create({ data });
}

export function findPaymentById(id, organizationId, tx = prisma) {
  return tx.payment.findFirst({ where: { id, organizationId }, include: { tenant: true, invoice: true, deal: true } });
}

export function findPaymentByIdempotencyKey(idempotencyKey, tx = prisma) {
  if (!idempotencyKey) return null;
  return tx.payment.findUnique({ where: { idempotencyKey } });
}

// A payment belongs to an owner's/agent's portfolio through its lease, or
// through the deal (renting, buying, leasing) it was recorded against.
function propertyScope(propertyIds, ownerIds) {
  if (!propertyIds && !ownerIds) return {};
  return {
    OR: [
      ...(propertyIds ? [{ lease: { unit: { building: { propertyId: { in: propertyIds } } } } }, { deal: { propertyId: { in: propertyIds } } }] : []),
      ...(ownerIds ? [{ deal: { ownerId: { in: ownerIds } } }] : []),
    ],
  };
}

function buildPaymentListWhere(organizationId, { status, tenantId, invoiceId, propertyIds, ownerIds, dealId }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(invoiceId ? { invoiceId } : {}),
    ...(dealId ? { dealId } : {}),
    ...propertyScope(propertyIds, ownerIds),
  };
}

export function findPaymentsByOrganization(organizationId, { skip, take, status, tenantId, invoiceId, propertyIds, ownerIds, dealId }) {
  return prisma.payment.findMany({
    where: buildPaymentListWhere(organizationId, { status, tenantId, invoiceId, propertyIds, ownerIds, dealId }),
    include: { tenant: true, deal: { include: { unit: { include: { building: { include: { property: true } } } }, land: { select: { title: true } } } } },
    orderBy: { paymentDate: 'desc' },
    skip,
    take,
  });
}

export function countPaymentsByOrganization(organizationId, { status, tenantId, invoiceId, propertyIds, ownerIds, dealId }) {
  return prisma.payment.count({ where: buildPaymentListWhere(organizationId, { status, tenantId, invoiceId, propertyIds, ownerIds, dealId }) });
}

export function setPaymentStatus(id, status, extra, tx = prisma) {
  return tx.payment.update({ where: { id }, data: { status, ...extra } });
}

// Revenue side of the financial summary report — sums completed payments
// only (never pending/failed/refunded/reversed) over an optional property
// scope and date range.
export function sumCompletedPayments(organizationId, { propertyIds, from, to }) {
  return prisma.payment.aggregate({
    where: {
      organizationId,
      status: 'completed',
      ...propertyScope(propertyIds, null),
      ...(from || to ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    _sum: { amount: true },
  });
}

// Raw rows (not aggregated) for the dashboard's monthly revenue trend —
// bucketing by month happens in dashboard.service.js since Prisma has no
// portable date-trunc groupBy.
export function findCompletedPaymentsSince(organizationId, { propertyIds, from }) {
  return prisma.payment.findMany({
    where: {
      organizationId,
      status: 'completed',
      paymentDate: { gte: from },
      ...propertyScope(propertyIds, null),
    },
    select: { amount: true, paymentDate: true },
  });
}
