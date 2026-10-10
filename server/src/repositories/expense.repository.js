import { prisma } from '../config/database.js';

export function createExpense(data) {
  return prisma.expense.create({ data });
}

export function findExpenseById(id, organizationId) {
  return prisma.expense.findFirst({ where: { id, organizationId }, include: { category: true, property: true } });
}

function buildExpenseListWhere(organizationId, { status, propertyId, categoryId, propertyIds }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
  };
}

export function findExpensesByOrganization(organizationId, { skip, take, status, propertyId, categoryId, propertyIds }) {
  return prisma.expense.findMany({
    where: buildExpenseListWhere(organizationId, { status, propertyId, categoryId, propertyIds }),
    include: { category: true },
    orderBy: { expenseDate: 'desc' },
    skip,
    take,
  });
}

export function countExpensesByOrganization(organizationId, { status, propertyId, categoryId, propertyIds }) {
  return prisma.expense.count({ where: buildExpenseListWhere(organizationId, { status, propertyId, categoryId, propertyIds }) });
}

export function setExpenseStatus(id, status) {
  return prisma.expense.update({ where: { id }, data: { status } });
}

// Sums approved (and paid) expenses for the financial summary report —
// grouped so the report can compute net income without loading every row.
export function sumApprovedExpenses(organizationId, { propertyIds, from, to }) {
  return prisma.expense.aggregate({
    where: {
      organizationId,
      status: { in: ['approved', 'paid'] },
      ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
      ...(from || to ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    _sum: { amount: true },
  });
}

// Raw rows for the dashboard's monthly revenue-vs-expenses trend — see
// findCompletedPaymentsSince in payment.repository.js for the same pattern.
export function findApprovedExpensesSince(organizationId, { propertyIds, from }) {
  return prisma.expense.findMany({
    where: {
      organizationId,
      status: { in: ['approved', 'paid'] },
      expenseDate: { gte: from },
      ...(propertyIds ? { propertyId: { in: propertyIds } } : {}),
    },
    select: { amount: true, expenseDate: true },
  });
}
