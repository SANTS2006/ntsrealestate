// Pure helpers for rent and lease payment plans — no database, so they can be
// tested on their own. Money is handled in whole cents to avoid float drift.

export const toCents = (v) => Math.round(Number(v) * 100);
export const fromCents = (c) => c / 100;

// Same day next month, clamped to the end of shorter months (31 Jan + 1 month = 28/29 Feb).
export function addMonthsUtc(date, months) {
  const base = new Date(date);
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return first;
}

export const startOfTodayUtc = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export const FREQUENCY_MONTHS = { monthly: 1, yearly: 12 };

// How many payments a term holds: monthly = one per month, yearly = one per
// started year.
export function installmentCount(termMonths, frequency) {
  const step = FREQUENCY_MONTHS[frequency];
  if (!step) throw new Error('Unknown payment frequency.');
  return Math.max(1, Math.ceil(termMonths / step));
}

// The schedule for a term, starting at `startDate`. `firstSequence` and
// `firstDue` let a renewal carry on from where the last plan stopped.
export function buildSchedule({ startDate, termMonths, frequency, amount, firstSequence = 1, firstDue = startDate }) {
  const step = FREQUENCY_MONTHS[frequency];
  const count = installmentCount(termMonths, frequency);
  return Array.from({ length: count }, (_, i) => ({
    sequence: firstSequence + i,
    dueDate: addMonthsUtc(firstDue, step * i),
    amount: fromCents(toCents(amount)),
  }));
}

// Spreads the money received over the instalments, earliest first. Cancelled
// instalments take nothing. Returns what each instalment should now say.
export function allocatePayments(installments, totalPaid) {
  let remaining = toCents(totalPaid);
  return [...installments].sort((a, b) => a.sequence - b.sequence).map((it) => {
    if (it.status === 'cancelled') return { ...it, paidAmount: 0 };
    const due = toCents(it.amount);
    const applied = Math.min(remaining, due);
    remaining -= applied;
    const status = applied >= due ? 'paid' : applied > 0 ? 'partial' : 'pending';
    return { ...it, paidAmount: fromCents(applied), status };
  });
}

// What to show: an unpaid instalment whose date has passed is "overdue".
export function describeInstallments(installments, today = startOfTodayUtc()) {
  return installments.map((it) => {
    const open = it.status === 'pending' || it.status === 'partial';
    const overdue = open && new Date(it.dueDate) < today;
    return { ...it, displayStatus: overdue ? 'overdue' : it.status, balance: it.status === 'cancelled' ? 0 : Math.max(fromCents(toCents(it.amount) - toCents(it.paidAmount)), 0) };
  });
}

export function summarizeInstallments(installments, today = startOfTodayUtc()) {
  const described = describeInstallments(installments, today);
  const open = described.filter((i) => i.status === 'pending' || i.status === 'partial').sort((a, b) => a.sequence - b.sequence);
  const overdue = open.filter((i) => i.displayStatus === 'overdue');
  const live = described.filter((i) => i.status !== 'cancelled');
  return {
    total: live.length,
    paidCount: live.filter((i) => i.status === 'paid').length,
    next: open[0] ? { id: open[0].id, sequence: open[0].sequence, dueDate: open[0].dueDate, amountDue: open[0].balance } : null,
    overdueCount: overdue.length,
    overdueAmount: fromCents(overdue.reduce((sum, i) => sum + toCents(i.balance), 0)),
  };
}
