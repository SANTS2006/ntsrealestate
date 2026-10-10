import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export function createInvoice(data, tx = prisma) {
  return tx.invoice.create({ data });
}

export function findInvoiceById(id, organizationId, tx = prisma) {
  return tx.invoice.findFirst({
    where: { id, organizationId },
    include: { tenant: true, lease: { include: { unit: { include: { building: { include: { property: true } } } } } } },
  });
}

export function countInvoicesForOrganization(organizationId, tx = prisma) {
  return tx.invoice.count({ where: { organizationId } });
}

export function findInvoiceByNumber(organizationId, invoiceNumber) {
  return prisma.invoice.findFirst({ where: { organizationId, invoiceNumber }, select: { id: true } });
}

// Total unpaid balance across every non-final invoice in scope — the
// dashboard's "outstanding rent" KPI.
export function sumOutstandingBalance(organizationId, { propertyIds, tenantId }) {
  return prisma.invoice.aggregate({
    where: {
      organizationId,
      status: { in: ['sent', 'partially_paid', 'overdue'] },
      ...(tenantId ? { tenantId } : {}),
      ...(propertyIds ? { lease: { unit: { building: { propertyId: { in: propertyIds } } } } } : {}),
    },
    _sum: { balance: true },
  });
}

function buildInvoiceListWhere(organizationId, { status, tenantId, leaseId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(leaseId ? { leaseId } : {}),
    ...(propertyIds ? { lease: { unit: { building: { propertyId: { in: propertyIds } } } } } : {}),
  };
}

export function findInvoicesByOrganization(organizationId, { skip, take, status, tenantId, leaseId, propertyIds }) {
  return prisma.invoice.findMany({
    where: buildInvoiceListWhere(organizationId, { status, tenantId, leaseId, propertyIds }),
    include: { tenant: true },
    orderBy: { issueDate: 'desc' },
    skip,
    take,
  });
}

export function countInvoicesByOrganization(organizationId, { status, tenantId, leaseId, propertyIds }) {
  return prisma.invoice.count({ where: buildInvoiceListWhere(organizationId, { status, tenantId, leaseId, propertyIds }) });
}

const UPDATABLE_DRAFT_FIELDS = ['dueDate', 'subtotal', 'tax', 'total', 'balance'];

export function updateDraftInvoice(id, data, tx = prisma) {
  const update = {};
  for (const field of UPDATABLE_DRAFT_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return tx.invoice.update({ where: { id }, data: update });
}

export function setInvoiceStatus(id, status, tx = prisma) {
  return tx.invoice.update({ where: { id }, data: { status } });
}

// Applies a payment (or its reversal, via a negative delta) to an invoice's
// running totals inside the caller's transaction — the only place invoice
// balances are ever mutated, so amountPaid/balance/status can never drift
// out of sync with the payments actually recorded against it.
//
// Uses an atomic DB-side increment (`{ increment: amountDelta }`, i.e.
// `SET amount_paid = amount_paid + $delta`) rather than reading amountPaid
// into application code and writing back a computed value. That
// read-then-write shape is vulnerable to a lost update under concurrent
// payments: two transactions could both read the same pre-payment balance
// before either commits. An atomic increment is evaluated by Postgres
// against each transaction's actual write-time value as concurrent updates
// to the same row serialize, so the guard below — checked against the
// *returned* post-increment row — is race-safe. If it fails, throwing here
// (inside the caller's transaction) rolls back the increment too.
export async function applyPaymentDelta(id, amountDelta, tx) {
  const updated = await tx.invoice.update({
    where: { id },
    data: { amountPaid: { increment: amountDelta } },
  });

  const newAmountPaid = Number(updated.amountPaid);
  const newBalance = Number(updated.total) - newAmountPaid;

  if (amountDelta > 0 && newBalance < -0.001) {
    throw AppError.conflict('This payment would exceed the invoice\'s outstanding balance.');
  }

  const newStatus = newAmountPaid <= 0 ? 'sent' : newBalance <= 0 ? 'paid' : 'partially_paid';
  return tx.invoice.update({
    where: { id },
    data: { balance: newBalance, status: newStatus },
  });
}
