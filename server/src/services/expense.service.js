import { deleteDocumentsFor } from './recordCleanup.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createExpense, findExpenseById, findExpensesByOrganization, countExpensesByOrganization, setExpenseStatus,
} from '../repositories/expense.repository.js';
import { findExpenseCategoryById } from '../repositories/expenseCategory.repository.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { audit } from './audit.service.js';

function serializeExpense(expense) {
  return {
    id: expense.id,
    propertyId: expense.propertyId,
    categoryId: expense.categoryId,
    vendorId: expense.vendorId,
    amount: expense.amount,
    currency: expense.currency,
    expenseDate: expense.expenseDate,
    description: expense.description,
    status: expense.status,
    receiptDocumentId: expense.receiptDocumentId,
    createdAt: expense.createdAt,
    ...(expense.category ? { category: { id: expense.category.id, name: expense.category.name } } : {}),
  };
}

async function loadExpenseWithAccess(id, organizationId, actingUser) {
  const expense = await findExpenseById(id, organizationId);
  if (!expense) throw AppError.notFound('Expense not found.');

  if (expense.propertyId) {
    const property = await findPropertyById(expense.propertyId, organizationId);
    if (property) await assertPropertyAccess(property, actingUser);
  }
  return expense;
}

export async function listExpenses(organizationId, actingUser, { page, pageSize, skip, take, status, propertyId, categoryId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = scope.propertyIds;

  const [expenses, total] = await Promise.all([
    findExpensesByOrganization(organizationId, { skip, take, status, propertyId, categoryId, propertyIds }),
    countExpensesByOrganization(organizationId, { status, propertyId, categoryId, propertyIds }),
  ]);
  return { expenses: expenses.map(serializeExpense), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getExpense(id, organizationId, actingUser) {
  const expense = await loadExpenseWithAccess(id, organizationId, actingUser);
  return serializeExpense(expense);
}

export async function createExpenseRecord(organizationId, body, actingUser, req) {
  const category = await findExpenseCategoryById(body.categoryId, organizationId);
  if (!category) throw AppError.badRequest('The specified expense category does not exist in this organization.');

  if (body.propertyId) {
    const property = await findPropertyById(body.propertyId, organizationId);
    if (!property) throw AppError.badRequest('The specified property does not exist in this organization.');
    await assertPropertyAccess(property, actingUser);
  }

  const expense = await createExpense({
    organizationId,
    propertyId: body.propertyId ?? null,
    categoryId: body.categoryId,
    vendorId: body.vendorId ?? null,
    amount: body.amount,
    currency: body.currency ?? 'USD',
    expenseDate: body.expenseDate,
    description: body.description ?? null,
    receiptDocumentId: body.receiptDocumentId ?? null,
    status: 'pending_approval',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'expense.created', entityType: 'expense', entityId: expense.id, newValues: { amount: expense.amount, categoryId: body.categoryId }, req });
  return getExpense(expense.id, organizationId, actingUser);
}

async function transitionExpense(id, organizationId, actingUser, req, { from, to, verb, auditAction }) {
  const expense = await loadExpenseWithAccess(id, organizationId, actingUser);
  if (!from.includes(expense.status)) {
    throw AppError.conflict(`Cannot ${verb} an expense with status "${expense.status}".`);
  }

  await setExpenseStatus(id, to);
  await audit({ organizationId, userId: actingUser.id, action: `expense.${auditAction}`, entityType: 'expense', entityId: id, oldValues: { status: expense.status }, newValues: { status: to }, req });
  return getExpense(id, organizationId, actingUser);
}

export const approveExpense = (id, organizationId, actingUser, req) =>
  transitionExpense(id, organizationId, actingUser, req, { from: ['pending_approval'], to: 'approved', verb: 'approve', auditAction: 'approved' });

export const rejectExpense = (id, organizationId, actingUser, req) =>
  transitionExpense(id, organizationId, actingUser, req, { from: ['pending_approval'], to: 'rejected', verb: 'reject', auditAction: 'rejected' });

export const markExpensePaid = (id, organizationId, actingUser, req) =>
  transitionExpense(id, organizationId, actingUser, req, { from: ['approved'], to: 'paid', verb: 'mark paid', auditAction: 'marked_paid' });

// Approved or paid expenses are part of the books and are never erased —
// only ones still awaiting a decision (or rejected) can be deleted.
export async function deleteExpense(id, organizationId, actingUser, req) {
  const expense = await loadExpenseWithAccess(id, organizationId, actingUser);
  if (!['pending_approval', 'rejected'].includes(expense.status)) {
    throw AppError.conflict('Approved or paid expenses cannot be deleted. Reject it first if it was entered in error.');
  }
  await deleteDocumentsFor(organizationId, 'expense', id);
  await prisma.expense.delete({ where: { id: expense.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'expense.deleted', entityType: 'expense', entityId: null, oldValues: { amount: String(expense.amount) }, req });
  return { deleted: true };
}
