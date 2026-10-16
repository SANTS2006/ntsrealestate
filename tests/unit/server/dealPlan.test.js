import { describe, it, expect } from 'vitest';
import {
  addMonthsUtc, buildSchedule, allocatePayments, describeInstallments, summarizeInstallments, installmentCount,
} from '../../../server/src/services/dealPlan.js';

const d = (s) => new Date(`${s}T00:00:00Z`);
const iso = (date) => date.toISOString().slice(0, 10);

describe('payment plan schedule', () => {
  it('adds months without skipping short months', () => {
    expect(iso(addMonthsUtc(d('2026-01-31'), 1))).toBe('2026-02-28');
    expect(iso(addMonthsUtc(d('2028-01-31'), 1))).toBe('2028-02-29'); // leap year
    expect(iso(addMonthsUtc(d('2026-11-15'), 3))).toBe('2027-02-15');
  });

  it('monthly: one payment per month of the term, on the same day', () => {
    const s = buildSchedule({ startDate: d('2026-03-10'), termMonths: 4, frequency: 'monthly', amount: 500 });
    expect(s.map((x) => iso(x.dueDate))).toEqual(['2026-03-10', '2026-04-10', '2026-05-10', '2026-06-10']);
    expect(s.map((x) => x.sequence)).toEqual([1, 2, 3, 4]);
    expect(s.every((x) => x.amount === 500)).toBe(true);
  });

  it('yearly: one payment per started year', () => {
    expect(installmentCount(12, 'yearly')).toBe(1);
    expect(installmentCount(24, 'yearly')).toBe(2);
    expect(installmentCount(18, 'yearly')).toBe(2);
    const s = buildSchedule({ startDate: d('2026-03-10'), termMonths: 24, frequency: 'yearly', amount: 6000 });
    expect(s.map((x) => iso(x.dueDate))).toEqual(['2026-03-10', '2027-03-10']);
  });

  it('a renewal carries on the numbering and the dates', () => {
    const s = buildSchedule({ startDate: d('2026-09-10'), termMonths: 2, frequency: 'monthly', amount: 500, firstSequence: 7, firstDue: d('2026-09-10') });
    expect(s.map((x) => x.sequence)).toEqual([7, 8]);
    expect(iso(s[0].dueDate)).toBe('2026-09-10');
  });

  it('rejects an unknown frequency', () => {
    expect(() => buildSchedule({ startDate: d('2026-01-01'), termMonths: 3, frequency: 'weekly', amount: 1 })).toThrow();
  });
});

describe('allocating payments to instalments', () => {
  const plan = (n) => Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, sequence: i + 1, amount: 500, paidAmount: 0, status: 'pending', dueDate: d('2026-01-01') }));

  it('fills the earliest instalments first, with a partial one in between', () => {
    const out = allocatePayments(plan(4), 1250);
    expect(out.map((i) => [i.status, i.paidAmount])).toEqual([['paid', 500], ['paid', 500], ['partial', 250], ['pending', 0]]);
  });
  it('is exact in cents (no float drift)', () => {
    const items = plan(3).map((i) => ({ ...i, amount: 333.33 }));
    const out = allocatePayments(items, 0.1 + 0.2 + 999.69);
    expect(out.map((i) => i.status)).toEqual(['paid', 'paid', 'paid']);
  });
  it('a refund simply recomputes: less money, earlier instalments stay paid', () => {
    expect(allocatePayments(plan(3), 500).map((i) => i.status)).toEqual(['paid', 'pending', 'pending']);
    expect(allocatePayments(plan(3), 0).map((i) => i.status)).toEqual(['pending', 'pending', 'pending']);
  });
  it('never allocates to a cancelled instalment', () => {
    const items = plan(3); items[1].status = 'cancelled';
    expect(allocatePayments(items, 1000).map((i) => i.status)).toEqual(['paid', 'cancelled', 'paid']);
  });
  it('extra money beyond the schedule is not invented into an instalment', () => {
    const out = allocatePayments(plan(2), 5000);
    expect(out.map((i) => i.paidAmount)).toEqual([500, 500]);
  });
});

describe('what is shown', () => {
  const today = d('2026-06-15');
  const rows = [
    { id: 'a', sequence: 1, amount: 500, paidAmount: 500, status: 'paid', dueDate: d('2026-05-15') },
    { id: 'b', sequence: 2, amount: 500, paidAmount: 200, status: 'partial', dueDate: d('2026-06-01') },
    { id: 'c', sequence: 3, amount: 500, paidAmount: 0, status: 'pending', dueDate: d('2026-07-01') },
    { id: 'x', sequence: 4, amount: 500, paidAmount: 0, status: 'cancelled', dueDate: d('2026-08-01') },
  ];
  it('marks unpaid past-due instalments overdue and cancelled ones have no balance', () => {
    const out = describeInstallments(rows, today);
    expect(out.map((i) => i.displayStatus)).toEqual(['paid', 'overdue', 'pending', 'cancelled']);
    expect(out[1].balance).toBe(300);
    expect(out[3].balance).toBe(0);
  });
  it('summarises the next due and what is overdue', () => {
    const s = summarizeInstallments(rows, today);
    expect(s).toMatchObject({ total: 3, paidCount: 1, overdueCount: 1, overdueAmount: 300 });
    expect(s.next).toMatchObject({ id: 'b', amountDue: 300 });
  });
});
