import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { unitTitle } from '../utils/unitLabel.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { dealStaffUserIds } from './salesScope.service.js';
import { getDeal, loadDealForPayment } from './deal.service.js';
import { destroyAllSessionsForUser } from '../config/session.js';
import { revokeAllRefreshTokensForUser } from '../repositories/refreshToken.repository.js';
import { buildSchedule, addMonthsUtc, startOfTodayUtc, FREQUENCY_MONTHS, toCents, fromCents } from './dealPlan.js';

// The rent and lease workflow after a request has been made:
//   pending  --approve-->  approved (active) --renew--> approved (longer)
//      \                         \
//       \--cancel/reject--> cancelled        \--end (moved out / expired / cancelled)--> completed | cancelled
// Ending frees the house (it shows on the website again) and, when the
// customer has nothing else with the company, closes their access.

const RENT_OR_LEASE = ['rent', 'lease'];
const OPEN = ['pending', 'approved'];
const REASONS = { cancelled: 'cancelled', moved_out: 'moved out', expired: 'term finished' };

function assertRentOrLease(deal) {
  if (!RENT_OR_LEASE.includes(deal.kind)) throw AppError.badRequest('Only a rental or a lease has a payment plan and can be renewed or ended.');
}

const subjectName = (deal) => (deal.unit ? unitTitle(deal.unit) : 'the property');
const money = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── payment plan ──────────────────────────────────────────────────────────

function defaultPlan(deal) {
  const frequency = deal.kind === 'lease' ? 'yearly' : 'monthly';
  return {
    startDate: startOfTodayUtc(),
    termMonths: deal.termMonths ?? 12,
    frequency,
    installmentAmount: Number(deal.installmentAmount ?? deal.price),
  };
}

// Sets (or replaces) the plan: when the term runs, how often the customer pays
// and how much. Replaceable only while no money has been paid against it.
export async function setPlan(id, body, organizationId, actingUser, req) {
  const deal = await loadDealForPayment(id, organizationId, actingUser);
  assertRentOrLease(deal);
  if (!OPEN.includes(deal.status)) throw AppError.conflict('This deal is finished, so its plan can no longer be changed.');
  const paidAny = await prisma.dealInstallment.count({ where: { dealId: id, paidAmount: { gt: 0 } } });
  if (paidAny > 0) throw AppError.conflict('Payments have already been recorded against this plan. Renew the deal to add more time instead.');

  const startDate = body.startDate ?? startOfTodayUtc();
  const schedule = buildSchedule({ startDate, termMonths: body.termMonths, frequency: body.frequency, amount: body.installmentAmount });
  const endDate = addMonthsUtc(startDate, body.termMonths);

  await prisma.$transaction(async (tx) => {
    await tx.dealInstallment.deleteMany({ where: { dealId: id } });
    await tx.dealInstallment.createMany({ data: schedule.map((s) => ({ dealId: id, sequence: s.sequence, dueDate: s.dueDate, amount: s.amount })) });
    await tx.deal.update({
      where: { id },
      data: {
        startDate, endDate, termMonths: body.termMonths, paymentFrequency: body.frequency, installmentAmount: body.installmentAmount,
        securityDeposit: body.securityDeposit ?? deal.securityDeposit,
      },
    });
    if (deal.leaseId) {
      await tx.lease.update({
        where: { id: deal.leaseId },
        data: { startDate, endDate, monthlyRent: fromCents(Math.round(toCents(body.installmentAmount) / FREQUENCY_MONTHS[body.frequency])), securityDeposit: body.securityDeposit ?? undefined },
      });
    }
  }, { timeout: 20_000 });

  await audit({ organizationId, userId: actingUser.id, action: 'deal.plan_set', entityType: 'deal', entityId: id, newValues: { ...body, installments: schedule.length }, req });
  if (deal.tenant?.userId) {
    await notify({
      organizationId, userId: deal.tenant.userId, type: 'deal_update', title: 'Your payment plan was set',
      message: `${subjectName(deal)}: ${money(body.installmentAmount)} ${body.frequency === 'monthly' ? 'every month' : 'every year'} for ${body.termMonths} months, ${schedule.length} payment${schedule.length === 1 ? '' : 's'} in all.`,
    });
  }
  return getDeal(id, organizationId, actingUser);
}

// A rent or lease that is approved with no plan yet gets a sensible default
// (monthly for rent, yearly for a lease) that the agent can change.
export async function ensurePlan(dealId) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || !RENT_OR_LEASE.includes(deal.kind)) return;
  const existing = await prisma.dealInstallment.count({ where: { dealId } });
  if (existing > 0 || deal.paymentFrequency) return;
  const plan = defaultPlan(deal);
  const schedule = buildSchedule({ startDate: plan.startDate, termMonths: plan.termMonths, frequency: plan.frequency, amount: plan.installmentAmount });
  await prisma.$transaction([
    prisma.dealInstallment.createMany({ data: schedule.map((s) => ({ dealId, sequence: s.sequence, dueDate: s.dueDate, amount: s.amount })) }),
    prisma.deal.update({
      where: { id: dealId },
      data: { startDate: plan.startDate, endDate: addMonthsUtc(plan.startDate, plan.termMonths), termMonths: plan.termMonths, paymentFrequency: plan.frequency, installmentAmount: plan.installmentAmount },
    }),
  ]);
}

// ── renewing ──────────────────────────────────────────────────────────────

// The customer asks for more time. It goes to their agent, who decides.
export async function requestRenewal(id, organizationId, actingUser, req) {
  const deal = await loadDealForPayment(id, organizationId, actingUser);
  assertRentOrLease(deal);
  if (deal.tenant?.userId !== actingUser.id) throw AppError.forbidden('Only the customer can ask to renew their own rental.');
  if (deal.status !== 'approved') throw AppError.conflict('Only an active rental or lease can be renewed.');
  if (deal.renewalRequestedAt) return getDeal(id, organizationId, actingUser);

  await prisma.deal.update({ where: { id }, data: { renewalRequestedAt: new Date() } });
  await audit({ organizationId, userId: actingUser.id, action: 'deal.renewal_requested', entityType: 'deal', entityId: id, req });
  const staff = await dealStaffUserIds(organizationId, { ownerId: deal.ownerId, propertyId: deal.propertyId });
  await Promise.all(staff.map((userId) => notify({
    organizationId, userId, type: 'deal_update', title: 'Renewal requested',
    message: `${deal.tenant.firstName} ${deal.tenant.lastName} would like to renew ${subjectName(deal)}.`,
  })));
  return getDeal(id, organizationId, actingUser);
}

// Adds more time to an active rental or lease: more instalments carry on from
// the last one, the end date moves out, and the history stays on the same deal.
export async function renewDeal(id, body, organizationId, actingUser, req) {
  let deal = await loadDealForPayment(id, organizationId, actingUser);
  assertRentOrLease(deal);
  if (deal.status !== 'approved') throw AppError.conflict('Only an active rental or lease can be renewed.');
  await ensurePlan(id);
  deal = await loadDealForPayment(id, organizationId, actingUser);

  const frequency = body.frequency ?? deal.paymentFrequency;
  const amount = body.installmentAmount ?? Number(deal.installmentAmount);
  const termMonths = body.termMonths ?? deal.termMonths ?? 12;
  const last = await prisma.dealInstallment.findFirst({ where: { dealId: id }, orderBy: { sequence: 'desc' } });
  const firstDue = last ? addMonthsUtc(last.dueDate, FREQUENCY_MONTHS[deal.paymentFrequency ?? frequency]) : startOfTodayUtc();
  const schedule = buildSchedule({ startDate: firstDue, termMonths, frequency, amount, firstSequence: (last?.sequence ?? 0) + 1, firstDue });
  const baseEnd = deal.endDate ?? firstDue;
  const endDate = addMonthsUtc(baseEnd, termMonths);

  await prisma.$transaction(async (tx) => {
    await tx.dealInstallment.createMany({ data: schedule.map((s) => ({ dealId: id, sequence: s.sequence, dueDate: s.dueDate, amount: s.amount })) });
    await tx.deal.update({
      where: { id },
      data: { endDate, paymentFrequency: frequency, installmentAmount: amount, renewalCount: { increment: 1 }, renewalRequestedAt: null },
    });
    if (deal.leaseId) await tx.lease.update({ where: { id: deal.leaseId }, data: { endDate, status: 'active' } });
  }, { timeout: 20_000 });

  await audit({ organizationId, userId: actingUser.id, action: 'deal.renewed', entityType: 'deal', entityId: id, newValues: { termMonths, frequency, amount, newEndDate: endDate }, req });
  if (deal.tenant?.userId) {
    await notify({
      organizationId, userId: deal.tenant.userId, type: 'deal_update', title: 'Your rental was renewed',
      message: `${subjectName(deal)} now runs until ${endDate.toISOString().slice(0, 10)}. ${schedule.length} new payment${schedule.length === 1 ? '' : 's'} of ${money(amount)} were added.`,
    });
  }
  return getDeal(id, organizationId, actingUser);
}

// ── ending ────────────────────────────────────────────────────────────────

// Ends a rental or lease (or turns down a request): the house is released and
// shows on the website again, unpaid future instalments are cancelled, and if
// the customer has nothing else with the company their access is closed.
export async function endDeal(id, { reason, note }, organizationId, actingUser, req) {
  const deal = await loadDealForPayment(id, organizationId, actingUser);
  assertRentOrLease(deal);
  if (!OPEN.includes(deal.status)) throw AppError.conflict('This deal has already ended.');

  const wasPending = deal.status === 'pending';
  const finalReason = wasPending ? 'cancelled' : reason;
  const finalStatus = finalReason === 'cancelled' ? 'cancelled' : 'completed';
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id },
      data: { status: finalStatus, endedAt: now, endReason: finalReason, endNote: note ?? null, endedById: actingUser.id, renewalRequestedAt: null },
    });
    await tx.dealInstallment.updateMany({ where: { dealId: id, status: 'pending', paidAmount: 0 }, data: { status: 'cancelled' } });

    if (deal.kind === 'rent' && deal.unitId) {
      await tx.tenantRental.updateMany({ where: { tenantId: deal.tenantId, unitId: deal.unitId, status: 'active' }, data: { status: 'ended', endedAt: now } });
    }
    if (deal.kind === 'lease' && deal.leaseId) {
      const lease = await tx.lease.findUnique({ where: { id: deal.leaseId } });
      if (lease?.status === 'draft') {
        await tx.deal.update({ where: { id }, data: { leaseId: null } });
        await tx.lease.delete({ where: { id: deal.leaseId } });
      } else if (lease && !['terminated', 'expired'].includes(lease.status)) {
        await tx.lease.update({ where: { id: deal.leaseId }, data: { status: finalReason === 'expired' ? 'expired' : 'terminated' } });
      }
    }
    if (deal.unitId) {
      // Free the house only if no one else still holds it (a shared place may have other renters).
      const [otherRentals, otherLeases, otherDeals] = await Promise.all([
        tx.tenantRental.count({ where: { unitId: deal.unitId, status: 'active' } }),
        tx.lease.count({ where: { unitId: deal.unitId, status: { in: ['active', 'expiring_soon'] }, id: { not: deal.leaseId ?? undefined } } }),
        tx.deal.count({ where: { unitId: deal.unitId, id: { not: id }, kind: { in: RENT_OR_LEASE }, status: { in: OPEN } } }),
      ]);
      if (otherRentals + otherLeases + otherDeals === 0) {
        await tx.unit.updateMany({ where: { id: deal.unitId, status: { in: ['occupied', 'reserved'] } }, data: { status: 'available' } });
      }
    }
  }, { timeout: 20_000 });

  await audit({ organizationId, userId: actingUser.id, action: `deal.${finalReason === 'cancelled' ? 'cancelled' : 'ended'}`, entityType: 'deal', entityId: id, oldValues: { status: deal.status }, newValues: { status: finalStatus, reason: finalReason, note }, req });

  const label = REASONS[finalReason];
  const staff = (await dealStaffUserIds(organizationId, { ownerId: deal.ownerId, propertyId: deal.propertyId })).filter((u) => u !== actingUser.id);
  await Promise.all(staff.map((userId) => notify({
    organizationId, userId, type: 'deal_update', title: `${wasPending ? 'Request declined' : 'Rental ended'}`,
    message: `${subjectName(deal)} (${deal.tenant.firstName} ${deal.tenant.lastName}): ${label}. It is available again.`,
  })));
  if (deal.tenant?.userId) {
    await notify({
      organizationId, userId: deal.tenant.userId, type: 'deal_update', title: wasPending ? 'Your request was declined' : `Your ${deal.kind} has ended`,
      message: `${subjectName(deal)}: ${label}.${note ? ` ${note}` : ''}`,
    });
  }

  const access = await closeAccessIfFinished(deal.tenantId, organizationId, actingUser, req);
  return { ...(await getDeal(id, organizationId, actingUser)), accessClosed: access.closed };
}

// A customer with no rental, lease or open request left no longer needs to sign
// in: login is switched off and every session is ended. (If the same person
// also holds another role in the company — say an agent — only the tenant role
// is taken away and the account stays.) Reactivating the user in Users restores access.
export async function closeAccessIfFinished(tenantId, organizationId, actingUser, req) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.userId) return { closed: false };
  const [openDeals, rentals, leases] = await Promise.all([
    prisma.deal.count({ where: { tenantId, status: { in: OPEN } } }),
    prisma.tenantRental.count({ where: { tenantId, status: 'active' } }),
    prisma.lease.count({ where: { tenantId, status: { in: ['active', 'expiring_soon', 'draft'] } } }),
  ]);
  if (openDeals + rentals + leases > 0) return { closed: false };

  const user = await prisma.user.findUnique({ where: { id: tenant.userId }, include: { userRoles: { include: { role: true } } } });
  if (!user || user.status === 'inactive') return { closed: false };
  const others = user.userRoles.filter((ur) => ur.role.name !== 'tenant');
  if (others.length > 0) {
    await prisma.userRole.deleteMany({ where: { userId: user.id, role: { name: 'tenant' } } });
    await audit({ organizationId, userId: actingUser.id, action: 'user.tenant_role_removed', entityType: 'user', entityId: user.id, newValues: { reason: 'tenancy ended' }, req });
    return { closed: false, roleRemoved: true };
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: 'inactive' } });
  await destroyAllSessionsForUser(user.id);
  await revokeAllRefreshTokensForUser(user.id);
  await audit({ organizationId, userId: actingUser.id, action: 'user.deactivated_move_out', entityType: 'user', entityId: user.id, newValues: { reason: 'no rental, lease or request left' }, req });
  logger.info({ userId: user.id }, 'tenant access closed after move-out');
  return { closed: true };
}

// ── reminders ─────────────────────────────────────────────────────────────

// Called on a timer by every server instance. A reminder is "claimed" with a
// single UPDATE … RETURNING (skipping rows another instance holds), so each
// instalment is announced exactly once however many servers are running.
export async function runRentalReminders() {
  const claimedDue = await prisma.$queryRaw`
    WITH due AS (
      SELECT i.id FROM deal_installments i JOIN deals d ON d.id = i.deal_id
      WHERE i.status IN ('pending', 'partial') AND i.reminded_at IS NULL AND d.status = 'approved'
        AND i.due_date >= CURRENT_DATE AND i.due_date <= CURRENT_DATE + 3
      LIMIT 200 FOR UPDATE OF i SKIP LOCKED)
    UPDATE deal_installments i SET reminded_at = now() FROM due WHERE i.id = due.id
    RETURNING i.id, i.deal_id AS "dealId", i.due_date AS "dueDate", (i.amount - i.paid_amount)::float AS "balance"`;
  const claimedOverdue = await prisma.$queryRaw`
    WITH late AS (
      SELECT i.id FROM deal_installments i JOIN deals d ON d.id = i.deal_id
      WHERE i.status IN ('pending', 'partial') AND i.overdue_notified_at IS NULL AND d.status = 'approved' AND i.due_date < CURRENT_DATE
      LIMIT 200 FOR UPDATE OF i SKIP LOCKED)
    UPDATE deal_installments i SET overdue_notified_at = now() FROM late WHERE i.id = late.id
    RETURNING i.id, i.deal_id AS "dealId", i.due_date AS "dueDate", (i.amount - i.paid_amount)::float AS "balance"`;

  const load = async (dealId) => prisma.deal.findUnique({
    where: { id: dealId },
    include: { tenant: { select: { userId: true, firstName: true, lastName: true } }, unit: { include: { building: { include: { property: true } } } } },
  });
  for (const row of claimedDue) {
    const deal = await load(row.dealId);
    if (!deal?.tenant?.userId) continue;
    await notify({
      organizationId: deal.organizationId, userId: deal.tenant.userId, type: 'rent_due', title: 'A payment is due soon',
      message: `${subjectName(deal)}: ${money(row.balance)} is due on ${new Date(row.dueDate).toISOString().slice(0, 10)}.`,
    });
  }
  for (const row of claimedOverdue) {
    const deal = await load(row.dealId);
    if (!deal) continue;
    const when = new Date(row.dueDate).toISOString().slice(0, 10);
    if (deal.tenant?.userId) {
      await notify({ organizationId: deal.organizationId, userId: deal.tenant.userId, type: 'rent_overdue', title: 'A payment is overdue', message: `${subjectName(deal)}: ${money(row.balance)} was due on ${when}.` });
    }
    const staff = await dealStaffUserIds(deal.organizationId, { ownerId: deal.ownerId, propertyId: deal.propertyId });
    await Promise.all(staff.map((userId) => notify({
      organizationId: deal.organizationId, userId, type: 'rent_overdue', title: 'Overdue payment',
      message: `${deal.tenant.firstName} ${deal.tenant.lastName} — ${subjectName(deal)}: ${money(row.balance)} was due on ${when}.`,
    })));
  }
  return { reminded: claimedDue.length, overdue: claimedOverdue.length };
}

let reminderTimer = null;
export function startRentalReminders() {
  if (reminderTimer || process.env.NODE_ENV === 'test') return;
  const tick = () => runRentalReminders().catch((err) => logger.error({ err }, 'rental reminders failed'));
  setTimeout(tick, 30_000).unref();
  reminderTimer = setInterval(tick, 30 * 60 * 1000);
  reminderTimer.unref();
}
export function stopRentalReminders() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
}
