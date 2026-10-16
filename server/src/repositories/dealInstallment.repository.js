import { prisma } from '../config/database.js';
import { allocatePayments, toCents } from '../services/dealPlan.js';

export function findInstallmentsForDeal(dealId, db = prisma) {
  return db.dealInstallment.findMany({ where: { dealId }, orderBy: { sequence: 'asc' } });
}

export function findInstallmentsForDeals(dealIds, db = prisma) {
  if (dealIds.length === 0) return Promise.resolve([]);
  return db.dealInstallment.findMany({ where: { dealId: { in: dealIds } }, orderBy: [{ dealId: 'asc' }, { sequence: 'asc' }] });
}

// Re-derives every instalment's paid amount from the payments actually on
// record (completed ones), earliest instalment first. Used after a payment is
// recorded AND after one is refunded, so the schedule can never drift from the
// money: it is always a pure function of the payments.
export async function recomputeInstallments(tx, dealId) {
  const [items, agg] = await Promise.all([
    tx.dealInstallment.findMany({ where: { dealId }, orderBy: { sequence: 'asc' } }),
    tx.payment.aggregate({ where: { dealId, status: 'completed' }, _sum: { amount: true } }),
  ]);
  if (items.length === 0) return [];
  const next = allocatePayments(items.map((i) => ({ ...i, amount: Number(i.amount), paidAmount: Number(i.paidAmount) })), Number(agg._sum.amount ?? 0));
  const now = new Date();
  for (const n of next) {
    const before = items.find((i) => i.id === n.id);
    if (before.status === n.status && toCents(before.paidAmount) === toCents(n.paidAmount)) continue;
    await tx.dealInstallment.update({
      where: { id: n.id },
      data: { paidAmount: n.paidAmount, status: n.status, paidAt: n.status === 'paid' ? (before.paidAt ?? now) : null },
    });
  }
  return next;
}
