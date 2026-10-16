import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../server/src/config/database.js';
import { requestDeal, updateDealStatus, getDeal } from '../../../server/src/services/deal.service.js';
import { setPlan, renewDeal, requestRenewal, endDeal, runRentalReminders } from '../../../server/src/services/rentalWorkflow.service.js';
import { recordPayment, refundPayment } from '../../../server/src/services/payment.service.js';
import { findAvailableUnitsPublic } from '../../../server/src/repositories/publicListing.repository.js';

// The rent / lease lifecycle end to end, against the real database in a
// throwaway organisation that is removed afterwards.

const tag = `wf${Date.now()}`;
let org; const u = {}; const unit = {}; let property; let building;
const req = {};
const as = (user, roles) => ({ id: user.id, organizationId: org.id, roles });
const listed = async (id) => (await findAvailableUnitsPublic(org.id, { skip: 0, take: 500 })).some((x) => x.id === id);
const status = async (id) => (await prisma.unit.findUnique({ where: { id } })).status;
const userStatus = async (user) => (await prisma.user.findUnique({ where: { id: user.id } })).status;
const dayOffset = (days) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days); return d; };

async function wipe(id) {
  await prisma.payment.deleteMany({ where: { organizationId: id } });
  await prisma.deal.deleteMany({ where: { organizationId: id } });
  await prisma.lease.deleteMany({ where: { organizationId: id } });
  await prisma.tenantRental.deleteMany({ where: { organizationId: id } });
  await prisma.propertyAssignment.deleteMany({ where: { organizationId: id } });
  await prisma.notification.deleteMany({ where: { organizationId: id } });
  await prisma.auditLog.deleteMany({ where: { organizationId: id } });
  await prisma.tenant.deleteMany({ where: { organizationId: id } });
  await prisma.property.deleteMany({ where: { organizationId: id } });
  await prisma.userRole.deleteMany({ where: { user: { organizationId: id } } });
  await prisma.role.deleteMany({ where: { organizationId: id } });
  await prisma.user.deleteMany({ where: { organizationId: id } });
  await prisma.organization.delete({ where: { id } });
}

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: tag, slug: tag, email: `${tag}@example.test` } });
  const roles = {};
  for (const name of ['administrator', 'agent', 'tenant']) roles[name] = await prisma.role.create({ data: { organizationId: org.id, name } });
  const mk = async (n, role) => {
    const user = await prisma.user.create({ data: { organizationId: org.id, firstName: n, lastName: 'T', email: `${tag}-${n}-${randomBytes(2).toString('hex')}@example.test`, passwordHash: 'x', status: 'active', emailVerified: true } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: roles[role].id } });
    return user;
  };
  u.admin = await mk('admin', 'administrator');
  u.agent = await mk('agent', 'agent');
  u.stranger = await mk('stranger', 'agent');
  for (const n of ['ta', 'tb', 'tc', 'td']) u[n] = await mk(n, 'tenant');
  property = await prisma.property.create({ data: { organizationId: org.id, name: 'Court', propertyCode: `P${tag}`, propertyType: 'apartment', structureType: 'units', status: 'active', city: 'X', address: '1 Road' } });
  building = await prisma.building.create({ data: { propertyId: property.id, name: 'Court', isImplicit: true } });
  await prisma.propertyAssignment.create({ data: { organizationId: org.id, propertyId: property.id, userId: u.agent.id } });
  for (const n of ['u1', 'u2', 'u3', 'u4', 'u5']) {
    unit[n] = await prisma.unit.create({ data: { buildingId: building.id, unitNumber: n.toUpperCase(), monthlyRent: 500, status: 'available', offerRent: true, offerLease: n === 'u2', leasePrice: n === 'u2' ? 6000 : null, leaseTermMonths: n === 'u2' ? 12 : null } });
  }
}, 300_000);

afterAll(async () => { if (org) await wipe(org.id).catch((e) => console.error('cleanup failed', tag, e.message)); }, 300_000);

describe('rent: request → plan → payments → renew → end', () => {
  let deal; let payment;

  it('a request holds the house and waits for the agent', async () => {
    const res = await requestDeal(as(u.ta, ['tenant']), { kind: 'rent', unitId: unit.u1.id }, req);
    deal = res.deal;
    expect(deal.status).toBe('pending');
    expect(await status(unit.u1.id)).toBe('occupied');
    expect(await listed(unit.u1.id)).toBe(false);
    expect(await prisma.notification.count({ where: { userId: u.admin.id, type: 'deal_request' } })).toBeGreaterThan(0);
  }, 300_000);

  it('the agent sets a monthly plan; the schedule is created and some of it is already overdue', async () => {
    const d = await setPlan(deal.id, { startDate: dayOffset(-40), termMonths: 6, frequency: 'monthly', installmentAmount: 500, securityDeposit: 1000 }, org.id, as(u.admin, ['administrator']), req);
    expect(d.installments).toHaveLength(6);
    expect(d.plan).toMatchObject({ frequency: 'monthly', installmentAmount: 500, securityDeposit: 1000, total: 6 });
    expect(d.plan.overdueCount).toBe(2);
    expect(d.installments.filter((i) => i.status === 'overdue')).toHaveLength(2);
  }, 300_000);

  it('approving makes it active, and keeps the plan the agent set', async () => {
    const d = await updateDealStatus(deal.id, 'approved', org.id, as(u.admin, ['administrator']), req);
    expect(d.status).toBe('approved');
    expect(d.installments).toHaveLength(6);
  }, 300_000);

  it('every payment is entered against the earliest instalments; a refund puts them back', async () => {
    const admin = as(u.admin, ['administrator']);
    const pay = await recordPayment(org.id, { dealId: deal.id, amount: 750, paymentMethod: 'cash', idempotencyKey: randomBytes(8).toString('hex') }, admin, req);
    payment = pay;
    let d = await getDeal(deal.id, org.id, admin);
    expect(d.installments.slice(0, 2).map((i) => [i.status === 'paid' ? 'paid' : i.paidAmount > 0 ? 'partial' : i.status, i.paidAmount])).toEqual([['paid', 500], ['partial', 250]]);
    expect(d.payments).toHaveLength(1);

    await refundPayment(payment.id, org.id, { reason: 'test' }, admin, req);
    d = await getDeal(deal.id, org.id, admin);
    expect(d.installments.every((i) => i.paidAmount === 0)).toBe(true);
    expect(d.installments[0].status).toBe('overdue');

    await recordPayment(org.id, { dealId: deal.id, amount: 1000, paymentMethod: 'bank_transfer', idempotencyKey: randomBytes(8).toString('hex') }, admin, req);
    d = await getDeal(deal.id, org.id, admin);
    expect(d.installments.slice(0, 2).every((i) => i.status === 'paid')).toBe(true);
    expect(d.plan.overdueCount).toBe(0);
  }, 300_000);

  it('a plan with payments on it cannot be replaced', async () => {
    await expect(setPlan(deal.id, { termMonths: 3, frequency: 'monthly', installmentAmount: 400 }, org.id, as(u.admin, ['administrator']), req)).rejects.toThrow(/already been recorded/i);
  }, 240_000);

  it('only an agent connected to the property can manage it; others do not even see it', async () => {
    await expect(endDeal(deal.id, { reason: 'moved_out' }, org.id, as(u.stranger, ['agent']), req)).rejects.toThrow(/not found/i);
    await expect(renewDeal(deal.id, {}, org.id, as(u.stranger, ['agent']), req)).rejects.toThrow(/not found/i);
  }, 240_000);

  it('the customer asks to renew, the agent renews, and the schedule carries on', async () => {
    const asked = await requestRenewal(deal.id, org.id, as(u.ta, ['tenant']), req);
    expect(asked.plan.renewalRequestedAt).not.toBeNull();
    await expect(requestRenewal(deal.id, org.id, as(u.tb, ['tenant']), req)).rejects.toThrow();

    const before = await getDeal(deal.id, org.id, as(u.admin, ['administrator']));
    const lastDue = before.installments.at(-1).dueDate;
    const d = await renewDeal(deal.id, { termMonths: 6 }, org.id, as(u.agent, ['agent']), req);
    expect(d.installments).toHaveLength(12);
    expect(d.installments[6].sequence).toBe(7);
    expect(new Date(d.installments[6].dueDate) > new Date(lastDue)).toBe(true);
    expect(d.plan.renewalCount).toBe(1);
    expect(d.plan.renewalRequestedAt).toBeNull();
    expect(new Date(d.plan.endDate) > new Date(before.plan.endDate)).toBe(true);
  }, 300_000);

  it('reminders go out once per instalment, however often they run', async () => {
    await prisma.dealInstallment.updateMany({ where: { dealId: deal.id, sequence: 3 }, data: { dueDate: dayOffset(-3), status: 'pending' } });
    const first = await runRentalReminders();
    expect(first.overdue).toBeGreaterThanOrEqual(1);
    expect(await prisma.notification.count({ where: { userId: u.ta.id, type: 'rent_overdue' } })).toBeGreaterThanOrEqual(1);
    const again = await runRentalReminders();
    expect(again.overdue).toBe(0);
  }, 300_000);

  it('ending it frees the house for the website, cancels what was not paid, and closes the customer\'s access', async () => {
    const d = await endDeal(deal.id, { reason: 'moved_out', note: 'Left on good terms' }, org.id, as(u.agent, ['agent']), req);
    expect(d.status).toBe('completed');
    expect(d.endReason).toBe('moved_out');
    expect(d.accessClosed).toBe(true);
    expect(await status(unit.u1.id)).toBe('available');
    expect(await listed(unit.u1.id)).toBe(true);
    expect(await prisma.tenantRental.count({ where: { unitId: unit.u1.id, status: 'active' } })).toBe(0);
    const left = await prisma.dealInstallment.findMany({ where: { dealId: deal.id } });
    expect(left.some((i) => i.status === 'cancelled')).toBe(true);
    expect(left.filter((i) => i.status === 'paid')).toHaveLength(2); // history kept
    expect(await userStatus(u.ta)).toBe('inactive');
    expect(await prisma.notification.count({ where: { userId: u.ta.id, title: { contains: 'ended' } } })).toBe(1);
  }, 300_000);

  it('no more payments once it has ended, and it cannot be ended twice', async () => {
    await expect(recordPayment(org.id, { dealId: deal.id, amount: 100, paymentMethod: 'cash', idempotencyKey: randomBytes(8).toString('hex') }, as(u.admin, ['administrator']), req)).rejects.toThrow(/ended/i);
    await expect(endDeal(deal.id, { reason: 'cancelled' }, org.id, as(u.admin, ['administrator']), req)).rejects.toThrow(/already ended/i);
  }, 240_000);

  it('the freed house can be rented by someone else', async () => {
    const res = await requestDeal(as(u.tc, ['tenant']), { kind: 'rent', unitId: unit.u1.id }, req);
    expect(res.deal.status).toBe('pending');
    expect(await status(unit.u1.id)).toBe('occupied');
    await endDeal(res.deal.id, { reason: 'cancelled' }, org.id, as(u.admin, ['administrator']), req); // clean up for the next tests
  }, 300_000);
});

describe('a customer who still rents something else keeps their access', () => {
  it('ending one of two rentals leaves them signed in; ending the last one closes it', async () => {
    const tb = as(u.tb, ['tenant']);
    const a = (await requestDeal(tb, { kind: 'rent', unitId: unit.u3.id }, req)).deal;
    const b = (await requestDeal(tb, { kind: 'rent', unitId: unit.u4.id }, req)).deal;
    const admin = as(u.admin, ['administrator']);
    const first = await endDeal(a.id, { reason: 'cancelled' }, org.id, admin, req);
    expect(first.accessClosed).toBe(false);
    expect(await userStatus(u.tb)).toBe('active');
    expect(await status(unit.u3.id)).toBe('available');
    expect(await status(unit.u4.id)).toBe('occupied');
    const last = await endDeal(b.id, { reason: 'cancelled' }, org.id, admin, req);
    expect(last.accessClosed).toBe(true);
    expect(await userStatus(u.tb)).toBe('inactive');
    expect(await listed(unit.u4.id)).toBe(true);
  }, 240_000);
});

describe('lease: request → approve (yearly plan) → cancel', () => {
  it('runs through and releases the house', async () => {
    const admin = as(u.admin, ['administrator']);
    const res = await requestDeal(as(u.td, ['tenant']), { kind: 'lease', unitId: unit.u2.id }, req);
    expect(res.deal.status).toBe('pending');
    expect(await status(unit.u2.id)).toBe('reserved');
    const approved = await updateDealStatus(res.deal.id, 'approved', org.id, admin, req);
    expect(approved.plan).toMatchObject({ frequency: 'yearly', installmentAmount: 6000, total: 1 });
    expect(await status(unit.u2.id)).toBe('occupied');
    expect((await prisma.lease.findUnique({ where: { id: approved.leaseId } })).status).toBe('active');

    const ended = await endDeal(res.deal.id, { reason: 'cancelled', note: 'Changed their mind' }, org.id, admin, req);
    expect(ended.status).toBe('cancelled');
    expect((await prisma.lease.findUnique({ where: { id: approved.leaseId } })).status).toBe('terminated');
    expect(await status(unit.u2.id)).toBe('available');
    expect(await listed(unit.u2.id)).toBe(true);
    expect(await userStatus(u.td)).toBe('inactive');
  }, 240_000);
});
