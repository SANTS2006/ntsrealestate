import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../server/src/config/database.js';
import { requestRental } from '../../../server/src/services/rental.service.js';
import { refundPayment } from '../../../server/src/services/payment.service.js';

// Many people acting at the same instant, against the real database, in a
// throwaway organisation that is removed afterwards. The point of each test is
// that the DATABASE decides the winner, so the outcome is the same however the
// requests interleave.

const tag = `conc${Date.now()}`;
let org; let admin; const renters = [];
let unit; let building;

async function wipe(orgId) {
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.tenantRental.deleteMany({ where: { organizationId: orgId } });
  await prisma.tenant.deleteMany({ where: { organizationId: orgId } });
  await prisma.property.deleteMany({ where: { organizationId: orgId } });
  await prisma.user.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
}

beforeAll(async () => {
  org = await prisma.organization.create({ data: { name: `Conc ${tag}`, slug: tag, email: `${tag}@example.test` } });
  const mk = (n) => prisma.user.create({ data: { organizationId: org.id, firstName: n, lastName: 'T', email: `${tag}-${n}-${randomBytes(2).toString('hex')}@example.test`, passwordHash: 'x', status: 'active', emailVerified: true } });
  admin = { id: (await mk('Admin')).id, organizationId: org.id, roles: ['administrator'] };
  for (let i = 0; i < 8; i += 1) renters.push({ id: (await mk(`R${i}`)).id, organizationId: org.id, roles: ['tenant'] });
  const property = await prisma.property.create({ data: { organizationId: org.id, name: 'P', propertyCode: `P${tag}`, propertyType: 'house', structureType: 'whole', status: 'active', city: 'X', address: '1 Road' } });
  building = await prisma.building.create({ data: { propertyId: property.id, name: 'P', isImplicit: true } });
  unit = await prisma.unit.create({ data: { buildingId: building.id, unitNumber: 'Whole', isWhole: true, monthlyRent: 500, status: 'available', offerRent: true } });
}, 120_000);

afterAll(async () => { if (org) await wipe(org.id).catch((e) => console.error('cleanup failed for', tag, e.message)); }, 120_000);

describe('simultaneous rentals of the same place', () => {
  it('lets exactly one of eight renters win; the others are told it is taken', async () => {
    const results = await Promise.allSettled(renters.map((r) => requestRental(r, { unitId: unit.id }, {})));
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(7);
    expect(lost.every((l) => l.reason.statusCode === 409)).toBe(true);
    expect(await prisma.tenantRental.count({ where: { unitId: unit.id, status: 'active' } })).toBe(1);
    expect((await prisma.unit.findUnique({ where: { id: unit.id } })).status).toBe('occupied');
  }, 120_000);
});

describe('simultaneous refunds of one payment', () => {
  it('reverses it once; the rest are refused', async () => {
    const tenant = await prisma.tenant.findFirst({ where: { organizationId: org.id } });
    const payment = await prisma.payment.create({
      data: { organizationId: org.id, tenantId: tenant.id, amount: 100, currency: 'USD', paymentDate: new Date(), paymentMethod: 'cash', status: 'completed' },
    });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => refundPayment(payment.id, org.id, { reason: 'test' }, admin, {})));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected' && r.reason.statusCode === 409)).toHaveLength(4);
    expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('refunded');
  }, 120_000);
});
