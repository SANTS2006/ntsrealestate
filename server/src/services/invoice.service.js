import { deleteDocumentsFor } from './recordCleanup.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createInvoice, findInvoiceById, findInvoicesByOrganization, countInvoicesByOrganization,
  countInvoicesForOrganization, findInvoiceByNumber, updateDraftInvoice, setInvoiceStatus,
} from '../repositories/invoice.repository.js';
import { findTenantById } from '../repositories/tenant.repository.js';
import { findLeaseById } from '../repositories/lease.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// The next date (from `from`, inclusive) whose day-of-month is `day` — this
// month's occurrence if it hasn't passed yet, otherwise next month's.
function nextOccurrenceOfDay(from, day) {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    return new Date(from.getFullYear(), from.getMonth() + 1, day);
  }
  return candidate;
}

function serializeInvoice(invoice) {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    leaseId: invoice.leaseId,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    balance: invoice.balance,
    status: invoice.status,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    ...(invoice.tenant ? { tenant: { id: invoice.tenant.id, firstName: invoice.tenant.firstName, lastName: invoice.tenant.lastName } } : {}),
  };
}

// Sequential, human-readable, and collision-safe: retries on the rare race
// where two invoices are created in the same instant (the (organizationId,
// invoiceNumber) unique constraint is the actual guarantee; this loop just
// avoids surfacing that as a raw 500 to the caller).
async function generateInvoiceNumber(organizationId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await countInvoicesForOrganization(organizationId);
    const candidate = `INV-${String(count + 1 + attempt).padStart(6, '0')}`;
    const exists = await findInvoiceByNumber(organizationId, candidate);
    if (!exists) return candidate;
  }
  throw AppError.internal('Could not generate a unique invoice number. Please try again.');
}

async function loadInvoiceWithAccess(id, organizationId, actingUser) {
  const invoice = await findInvoiceById(id, organizationId);
  if (!invoice) throw AppError.notFound('Invoice not found.');

  if (actingUser.roles.includes('tenant')) {
    const scope = await getRestrictedScope(actingUser, organizationId);
    if (scope.tenantId !== invoice.tenantId) throw AppError.notFound('Invoice not found.');
    return invoice;
  }
  if (invoice.lease) {
    await assertPropertyAccess(invoice.lease.unit.building.property, actingUser);
  }
  // An invoice with no lease attached has no property to scope by — only
  // organization-wide roles (who already passed requirePermission) can
  // reach a leaseless invoice at all; assignment/ownership-scoped roles
  // never see it, matching the "resolve to nothing when scope can't be
  // determined" default in getRestrictedScope.
  return invoice;
}

export async function listInvoices(organizationId, actingUser, { page, pageSize, skip, take, status, tenantId, leaseId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const effectiveTenantId = scope.tenantId ?? tenantId;
  const propertyIds = scope.propertyIds;

  const [invoices, total] = await Promise.all([
    findInvoicesByOrganization(organizationId, { skip, take, status, tenantId: effectiveTenantId, leaseId, propertyIds }),
    countInvoicesByOrganization(organizationId, { status, tenantId: effectiveTenantId, leaseId, propertyIds }),
  ]);
  return { invoices: invoices.map(serializeInvoice), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getInvoice(id, organizationId, actingUser) {
  const invoice = await loadInvoiceWithAccess(id, organizationId, actingUser);
  return serializeInvoice(invoice);
}

export async function createInvoiceRecord(organizationId, body, actingUser, req) {
  const tenant = await findTenantById(body.tenantId, organizationId);
  if (!tenant) throw AppError.badRequest('The specified tenant does not exist in this organization.');

  let lease = null;
  if (body.leaseId) {
    lease = await findLeaseById(body.leaseId, organizationId);
    if (!lease) throw AppError.badRequest('The specified lease does not exist in this organization.');
    await assertPropertyAccess(lease.unit.building.property, actingUser);
    if (lease.tenantId !== body.tenantId) throw AppError.badRequest('This lease does not belong to the specified tenant.');
  }

  // Server-authoritative — a client-supplied `total` is never trusted, see
  // docs/security/security-architecture.md's financial-integrity section.
  const subtotal = round2(body.subtotal);
  const tax = round2(body.tax ?? 0);
  const total = round2(subtotal + tax);

  const invoiceNumber = await generateInvoiceNumber(organizationId);
  const invoice = await createInvoice({
    organizationId,
    tenantId: body.tenantId,
    leaseId: body.leaseId ?? null,
    invoiceNumber,
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    subtotal,
    tax,
    total,
    amountPaid: 0,
    balance: total,
    status: 'draft',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'invoice.created', entityType: 'invoice', entityId: invoice.id, newValues: { invoiceNumber, total }, req });
  return getInvoice(invoice.id, organizationId, actingUser);
}

// The core "recurring invoice" mechanic: generate an invoice directly from
// an active lease's rent terms, skipping the manual-draft step (a
// system-generated invoice from an already-agreed lease doesn't need a
// human to review it as a draft first). True scheduled/automatic recurrence
// (a cron job calling this once a month per active lease) is not yet wired
// up — see docs/api/api-guide.md for that gap.
export async function generateInvoiceFromLease(leaseId, organizationId, body, actingUser, req) {
  const lease = await findLeaseById(leaseId, organizationId);
  if (!lease) throw AppError.notFound('Lease not found.');
  await assertPropertyAccess(lease.unit.building.property, actingUser);
  if (lease.status !== 'active') throw AppError.conflict('Invoices can only be generated from an active lease.');

  const issueDate = body.issueDate ?? new Date();
  // Roll forward to the next occurrence of the lease's payment_due_day —
  // generating on the 29th for a due day of 1 must land on next month's
  // 1st, not this month's (which has already passed).
  const dueDate = body.dueDate ?? nextOccurrenceOfDay(issueDate, lease.paymentDueDay);
  const subtotal = round2(lease.monthlyRent);

  const invoiceNumber = await generateInvoiceNumber(organizationId);
  const invoice = await createInvoice({
    organizationId,
    tenantId: lease.tenantId,
    leaseId: lease.id,
    invoiceNumber,
    issueDate,
    dueDate,
    subtotal,
    tax: 0,
    total: subtotal,
    amountPaid: 0,
    balance: subtotal,
    status: 'sent',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'invoice.generated_from_lease', entityType: 'invoice', entityId: invoice.id, newValues: { leaseId, invoiceNumber, total: subtotal }, req });
  return getInvoice(invoice.id, organizationId, actingUser);
}

export async function updateInvoiceRecord(id, organizationId, body, actingUser, req) {
  const invoice = await loadInvoiceWithAccess(id, organizationId, actingUser);
  if (invoice.status !== 'draft') {
    throw AppError.conflict('Only a draft invoice can be edited — once sent, financial records are immutable except through void/payment/refund workflows.');
  }

  const subtotal = body.subtotal !== undefined ? round2(body.subtotal) : Number(invoice.subtotal);
  const tax = body.tax !== undefined ? round2(body.tax) : Number(invoice.tax);
  const total = round2(subtotal + tax);

  await updateDraftInvoice(id, { dueDate: body.dueDate, subtotal, tax, total, balance: total });
  await audit({ organizationId, userId: actingUser.id, action: 'invoice.updated', entityType: 'invoice', entityId: id, newValues: { subtotal, tax, total }, req });
  return getInvoice(id, organizationId, actingUser);
}

export async function sendInvoice(id, organizationId, actingUser, req) {
  const invoice = await loadInvoiceWithAccess(id, organizationId, actingUser);
  if (invoice.status !== 'draft') throw AppError.conflict(`Only a draft invoice can be sent (current status: ${invoice.status}).`);

  await setInvoiceStatus(id, 'sent');
  await audit({ organizationId, userId: actingUser.id, action: 'invoice.sent', entityType: 'invoice', entityId: id, newValues: { status: 'sent' }, req });
  if (invoice.tenant?.userId) {
    await notify({
      organizationId, userId: invoice.tenant.userId, type: 'invoice_sent',
      title: 'New invoice', message: `Invoice ${invoice.invoiceNumber} for ${invoice.total} is now due ${new Date(invoice.dueDate).toLocaleDateString()}.`,
    });
  }
  return getInvoice(id, organizationId, actingUser);
}

export async function voidInvoice(id, organizationId, body, actingUser, req) {
  const invoice = await loadInvoiceWithAccess(id, organizationId, actingUser);
  if (invoice.status === 'void') throw AppError.conflict('This invoice is already void.');
  if (Number(invoice.amountPaid) > 0) {
    throw AppError.conflict('This invoice has payments recorded against it and cannot be voided directly — refund the payment(s) first.');
  }

  await setInvoiceStatus(id, 'void');
  await audit({ organizationId, userId: actingUser.id, action: 'invoice.voided', entityType: 'invoice', entityId: id, oldValues: { status: invoice.status }, newValues: { status: 'void', reason: body?.reason }, req });
  return getInvoice(id, organizationId, actingUser);
}

// A draft was never issued, so it can simply be deleted. Once sent, an
// invoice is a financial record and is voided, not erased.
export async function deleteInvoice(id, organizationId, actingUser, req) {
  const invoice = await loadInvoiceWithAccess(id, organizationId, actingUser);
  if (invoice.status !== 'draft') {
    throw AppError.conflict('Only draft invoices can be deleted. Void an invoice that has been sent.');
  }
  await deleteDocumentsFor(organizationId, 'invoice', id);
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'invoice.deleted', entityType: 'invoice', entityId: null, req });
  return { deleted: true };
}
