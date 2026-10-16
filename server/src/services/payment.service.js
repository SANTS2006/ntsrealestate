import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createPayment, findPaymentById, findPaymentByIdempotencyKey, findPaymentsByOrganization,
  countPaymentsByOrganization,
} from '../repositories/payment.repository.js';
import { findTenantById } from '../repositories/tenant.repository.js';
import { findInvoiceById, applyPaymentDelta } from '../repositories/invoice.repository.js';
import { findLeaseById } from '../repositories/lease.repository.js';
import { recomputeInstallments } from '../repositories/dealInstallment.repository.js';
import { findOrganizationById } from '../repositories/organization.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { getSalesScope } from './salesScope.service.js';
import { loadDealForPayment } from './deal.service.js';
import { unitTitle } from '../utils/unitLabel.js';

function serializePayment(payment) {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    leaseId: payment.leaseId,
    invoiceId: payment.invoiceId,
    dealId: payment.dealId,
    ...(payment.deal ? {
      deal: {
        id: payment.deal.id, kind: payment.deal.kind,
        title: payment.deal.unit ? unitTitle(payment.deal.unit) : payment.deal.land?.title ?? 'Listing',
      },
    } : {}),
    amount: payment.amount,
    currency: payment.currency,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    status: payment.status,
    notes: payment.notes,
    createdAt: payment.createdAt,
    ...(payment.tenant ? { tenant: { id: payment.tenant.id, firstName: payment.tenant.firstName, lastName: payment.tenant.lastName } } : {}),
  };
}

async function loadPaymentWithAccess(id, organizationId, actingUser) {
  const payment = await findPaymentById(id, organizationId);
  if (!payment) throw AppError.notFound('Payment not found.');

  if (actingUser.roles.includes('tenant')) {
    const scope = await getRestrictedScope(actingUser, organizationId);
    if (scope.tenantId !== payment.tenantId) throw AppError.notFound('Payment not found.');
    return payment;
  }
  if (payment.leaseId) {
    const lease = await findLeaseById(payment.leaseId, organizationId);
    if (lease) await assertPropertyAccess(lease.unit.building.property, actingUser);
  }
  if (payment.dealId) await loadDealForPayment(payment.dealId, organizationId, actingUser);
  return payment;
}

export async function listPayments(organizationId, actingUser, { page, pageSize, skip, take, status, tenantId, invoiceId, dealId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const effectiveTenantId = scope.tenantId ?? tenantId;
  const propertyIds = scope.propertyIds;
  // Payments on deals (renting, buying, leasing) follow the owner as well as the property.
  const ownerIds = propertyIds ? (await getSalesScope(actingUser, organizationId)).ownerIds : undefined;

  const [payments, total] = await Promise.all([
    findPaymentsByOrganization(organizationId, { skip, take, status, tenantId: effectiveTenantId, invoiceId, propertyIds, ownerIds, dealId }),
    countPaymentsByOrganization(organizationId, { status, tenantId: effectiveTenantId, invoiceId, propertyIds, ownerIds, dealId }),
  ]);
  return { payments: payments.map(serializePayment), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getPayment(id, organizationId, actingUser) {
  const payment = await loadPaymentWithAccess(id, organizationId, actingUser);
  return serializePayment(payment);
}

// Raw (unserialized) payment + organization, for the PDF receipt renderer —
// same access check as getPayment, but the receipt needs the full Decimal
// amount and the org's real name, not the API's JSON-serialized shape.
export async function getPaymentForReceipt(id, organizationId, actingUser) {
  const payment = await loadPaymentWithAccess(id, organizationId, actingUser);
  if (!['completed', 'refunded'].includes(payment.status)) {
    throw AppError.conflict(`A receipt is only available for a completed or refunded payment (current status: ${payment.status}).`);
  }
  const organization = await findOrganizationById(organizationId);
  return { payment, organization };
}

// Records a payment and, if it's tied to an invoice, applies it to that
// invoice's running balance — both inside one transaction, so a payment can
// never exist without its invoice reflecting it (or vice versa).
//
// Idempotency: a client-supplied `idempotencyKey` (recommended for any
// payment-recording UI/integration prone to retries — double-clicks, flaky
// networks) is checked BEFORE any writes; a repeat of the same key returns
// the original payment instead of creating a second one. This is the
// concrete implementation of "prevent duplicate payment processing" from
// docs/security/security-architecture.md.
export async function recordPayment(organizationId, body, actingUser, req) {
  if (body.idempotencyKey) {
    const existing = await findPaymentByIdempotencyKey(body.idempotencyKey);
    if (existing && existing.organizationId === organizationId) {
      return getPayment(existing.id, organizationId, actingUser);
    }
  }

  // A payment on a deal (renting, buying, leasing a house or buying land)
  // belongs to the deal's customer.
  let deal = null;
  if (body.dealId) {
    deal = await loadDealForPayment(body.dealId, organizationId, actingUser);
    if (deal.status === 'cancelled') throw AppError.conflict('This deal was cancelled, so no payment can be recorded on it.');
    if (deal.status === 'completed' && deal.kind !== 'buy') throw AppError.conflict('This rental or lease has ended, so no payment can be recorded on it.');
    body = { ...body, tenantId: deal.tenantId };
    if (deal.kind !== 'rent') {
      const paidRows = await prisma.payment.aggregate({ where: { dealId: deal.id, status: 'completed' }, _sum: { amount: true } });
      const remaining = Number(deal.price) - Number(paidRows._sum.amount ?? 0);
      if (Number(body.amount) > remaining + 0.001) {
        throw AppError.badRequest(`Payment amount (${body.amount}) exceeds what is still owed on this deal (${remaining.toFixed(2)}).`);
      }
    }
  }
  if (!body.tenantId) throw AppError.badRequest('Choose who is paying.');

  const tenant = await findTenantById(body.tenantId, organizationId);
  if (!tenant) throw AppError.badRequest('The specified tenant does not exist in this organization.');

  let invoice = null;
  if (body.invoiceId) {
    invoice = await findInvoiceById(body.invoiceId, organizationId);
    if (!invoice) throw AppError.badRequest('The specified invoice does not exist in this organization.');
    if (invoice.tenantId !== body.tenantId) throw AppError.badRequest('This invoice does not belong to the specified tenant.');
    if (invoice.status === 'void') throw AppError.conflict('Cannot record a payment against a void invoice.');
    if (invoice.lease) await assertPropertyAccess(invoice.lease.unit.building.property, actingUser);

    const amount = Number(body.amount);
    if (amount > Number(invoice.balance)) {
      throw AppError.badRequest(`Payment amount (${amount}) exceeds the invoice's outstanding balance (${invoice.balance}).`);
    }
  } else if (body.leaseId) {
    const lease = await findLeaseById(body.leaseId, organizationId);
    if (!lease) throw AppError.badRequest('The specified lease does not exist in this organization.');
    await assertPropertyAccess(lease.unit.building.property, actingUser);
  }

  let payment;
  try {
    payment = await prisma.$transaction(async (tx) => {
    // Two payments arriving together must not both pass the "what is still
    // owed" check: lock the deal's row so they take turns, then look again.
    if (deal && deal.kind !== 'rent') {
      await tx.$queryRaw`SELECT id FROM deals WHERE id = ${deal.id}::uuid FOR UPDATE`;
      const paid = await tx.payment.aggregate({ where: { dealId: deal.id, status: 'completed' }, _sum: { amount: true } });
      const owed = Number(deal.price) - Number(paid._sum.amount ?? 0);
      if (Number(body.amount) > owed + 0.001) throw AppError.conflict(`Payment amount (${body.amount}) exceeds what is still owed on this deal (${owed.toFixed(2)}).`);
    }
    const created = await createPayment({
      organizationId,
      tenantId: body.tenantId,
      leaseId: body.leaseId ?? invoice?.leaseId ?? null,
      invoiceId: body.invoiceId ?? null,
      dealId: deal?.id ?? null,
      amount: body.amount,
      currency: body.currency ?? 'USD',
      paymentDate: body.paymentDate ?? new Date(),
      paymentMethod: body.paymentMethod,
      reference: body.reference ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
      notes: body.notes ?? null,
      status: 'completed',
    }, tx);

    if (body.invoiceId) {
      await applyPaymentDelta(body.invoiceId, Number(body.amount), tx);
    }
    // Every payment on a rent or lease is entered against its payment plan.
    if (deal) await recomputeInstallments(tx, deal.id);

    return created;
    }, { timeout: 20_000 });
  } catch (err) {
    // The same idempotency key arriving twice at once: the loser gets the winner's payment.
    if (err?.code === 'P2002' && body.idempotencyKey) {
      const existing = await findPaymentByIdempotencyKey(body.idempotencyKey);
      if (existing && existing.organizationId === organizationId) return getPayment(existing.id, organizationId, actingUser);
    }
    throw err;
  }

  await audit({ organizationId, userId: actingUser.id, action: 'payment.recorded', entityType: 'payment', entityId: payment.id, newValues: { amount: payment.amount, invoiceId: payment.invoiceId }, req });
  await notify({
    organizationId, userId: tenant.userId, type: 'payment_received',
    title: 'Payment received', message: `A payment of ${payment.currency} ${payment.amount} was recorded on your account.`,
  });
  return getPayment(payment.id, organizationId, actingUser);
}

// A refund never deletes or overwrites the original payment row — it flips
// its status to `refunded` (permanent history of what happened) and
// reverses the effect on the linked invoice's balance in the same
// transaction. See docs/security/security-architecture.md's
// financial-integrity section.
export async function refundPayment(id, organizationId, body, actingUser, req) {
  const payment = await loadPaymentWithAccess(id, organizationId, actingUser);
  if (payment.status !== 'completed') {
    throw AppError.conflict(`Only a completed payment can be refunded (current status: ${payment.status}).`);
  }

  await prisma.$transaction(async (tx) => {
    const flipped = await tx.payment.updateMany({
      where: { id, status: 'completed' },
      data: { status: 'refunded', notes: body?.reason ? `${payment.notes ?? ''}\nRefund reason: ${body.reason}`.trim() : payment.notes },
    });
    if (flipped.count === 0) throw AppError.conflict('This payment was already refunded.');
    if (payment.invoiceId) {
      await applyPaymentDelta(payment.invoiceId, -Number(payment.amount), tx);
    }
    if (payment.dealId) await recomputeInstallments(tx, payment.dealId);
  }, { timeout: 20_000 });

  await audit({ organizationId, userId: actingUser.id, action: 'payment.refunded', entityType: 'payment', entityId: id, oldValues: { status: 'completed' }, newValues: { status: 'refunded', reason: body?.reason }, req });
  return getPayment(id, organizationId, actingUser);
}

// Only a payment that never settled (pending or failed) can be deleted; a
// completed one is refunded instead so the books stay truthful.
export async function deletePayment(id, organizationId, actingUser, req) {
  const payment = await loadPaymentWithAccess(id, organizationId, actingUser);
  if (!['pending', 'failed'].includes(payment.status)) {
    throw AppError.conflict('Only pending or failed payments can be deleted. Refund a completed payment instead.');
  }
  await prisma.payment.delete({ where: { id: payment.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'payment.deleted', entityType: 'payment', entityId: null, req });
  return { deleted: true };
}
