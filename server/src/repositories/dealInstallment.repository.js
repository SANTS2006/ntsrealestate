import { Prisma } from '@prisma/client';
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
  // One statement for all changed instalments: a payment must not hold its
  // transaction open for a round trip per instalment (a long plan on a slow
  // connection would run out of time and the payment would be lost).
  const changed = next.filter((n) => {
    const before = items.find((i) => i.id === n.id);
    return before.status !== n.status || toCents(before.paidAmount) !== toCents(n.paidAmount);
  });
  if (changed.length > 0) {
    const values = Prisma.join(changed.map((n) => Prisma.sql`(${n.id}::uuid, ${n.paidAmount}::numeric, ${n.status}::text)`));
    await tx.$executeRaw`
      UPDATE deal_installments di
      SET paid_amount = v.paid, status = v.status,
          paid_at = CASE WHEN v.status = 'paid' THEN COALESCE(di.paid_at, now()) ELSE NULL END
      FROM (VALUES ${values}) AS v(id, paid, status)
      WHERE di.id = v.id`;
  }
  return next;
}
