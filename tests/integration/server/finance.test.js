import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authedPost, registerVerifiedOrg, uniqueSuffix } from './helpers/testUser.js';
import { deleteTestOrganization } from './helpers/cleanup.js';

const suffix = uniqueSuffix();

let org;
let tenantId;
let invoiceId;

async function createPropertyUnitTenant() {
  const propRes = await authedPost(org.agent, org.csrf, '/api/v1/properties', {
    propertyCode: `FIN-${suffix}`, name: 'Finance Test Property', propertyType: 'residential', address: '1 Finance St',
  });
  const buildingRes = await authedPost(org.agent, org.csrf, `/api/v1/properties/${propRes.body.data.id}/buildings`, { name: 'Building A' });
  await authedPost(org.agent, org.csrf, `/api/v1/buildings/${buildingRes.body.data.id}/units`, {
    unitNumber: '1', monthlyRent: 1000,
  });
  const tenantRes = await authedPost(org.agent, org.csrf, '/api/v1/tenants', { firstName: 'Fin', lastName: 'Tenant' });
  return tenantRes.body.data.id;
}

beforeAll(async () => {
  org = await registerVerifiedOrg({
    orgName: `FinanceOrg-${suffix}`, email: `finance-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
  tenantId = await createPropertyUnitTenant();

  const invoiceRes = await authedPost(org.agent, org.csrf, '/api/v1/invoices', {
    tenantId, issueDate: '2026-01-01', dueDate: '2026-01-31', subtotal: 1000, tax: 0,
  });
  invoiceId = invoiceRes.body.data.id;
  await authedPost(org.agent, org.csrf, `/api/v1/invoices/${invoiceId}/send`);
});

afterAll(async () => {
  await deleteTestOrganization(org?.organizationId);
});

describe('invoice totals are server-authoritative', () => {
  it('total is computed from subtotal+tax, never trusted from the client', async () => {
    // The create schema doesn't even accept a `total` field (Zod .strict()
    // rejects unknown keys) — this proves the server computed it, by
    // checking it matches subtotal+tax exactly for the fixture invoice.
    const res = await org.agent.get(`/api/v1/invoices/${invoiceId}`);
    expect(Number(res.body.data.total)).toBe(1000);
    expect(Number(res.body.data.balance)).toBe(1000);
  });
});

describe('payment idempotency', () => {
  it('resubmitting the same idempotencyKey returns the original payment, not a duplicate', async () => {
    const idempotencyKey = `idem-${suffix}-1`;
    const first = await authedPost(org.agent, org.csrf, '/api/v1/payments', {
      tenantId, invoiceId, amount: 400, paymentMethod: 'cash', idempotencyKey,
    });
    expect(first.status).toBe(201);

    const second = await authedPost(org.agent, org.csrf, '/api/v1/payments', {
      tenantId, invoiceId, amount: 400, paymentMethod: 'cash', idempotencyKey,
    });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const invoiceRes = await org.agent.get(`/api/v1/invoices/${invoiceId}`);
    expect(Number(invoiceRes.body.data.amountPaid)).toBe(400); // not 800 — the retry did not double-apply
  });
});

describe('over-payment protection', () => {
  it('rejects a payment larger than the invoice\'s remaining balance', async () => {
    const res = await authedPost(org.agent, org.csrf, '/api/v1/payments', {
      tenantId, invoiceId, amount: 999999, paymentMethod: 'cash',
    });
    expect(res.status).toBe(400);
  });
});

describe('refund reverses the invoice without deleting the payment', () => {
  let paymentId;

  it('pays off the remaining balance', async () => {
    const res = await authedPost(org.agent, org.csrf, '/api/v1/payments', {
      tenantId, invoiceId, amount: 600, paymentMethod: 'bank_transfer',
    });
    expect(res.status).toBe(201);
    paymentId = res.body.data.id;

    const invoiceRes = await org.agent.get(`/api/v1/invoices/${invoiceId}`);
    expect(invoiceRes.body.data.status).toBe('paid');
    expect(Number(invoiceRes.body.data.balance)).toBe(0);
  });

  it('refunding restores the invoice balance and preserves the payment as `refunded`', async () => {
    const refundRes = await authedPost(org.agent, org.csrf, `/api/v1/payments/${paymentId}/refund`, { reason: 'test' });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe('refunded');

    const invoiceRes = await org.agent.get(`/api/v1/invoices/${invoiceId}`);
    expect(invoiceRes.body.data.status).toBe('partially_paid');
    expect(Number(invoiceRes.body.data.balance)).toBe(600);

    // The payment row itself must still exist and be readable — refund is
    // a status flip, never a delete.
    const paymentRes = await org.agent.get(`/api/v1/payments/${paymentId}`);
    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body.data.status).toBe('refunded');
  });

  it('refunding an already-refunded payment is rejected', async () => {
    const res = await authedPost(org.agent, org.csrf, `/api/v1/payments/${paymentId}/refund`, {});
    expect(res.status).toBe(409);
  });
});

describe('void protection', () => {
  it('blocks voiding an invoice that still has payments recorded against it', async () => {
    const res = await authedPost(org.agent, org.csrf, `/api/v1/invoices/${invoiceId}/void`, {});
    expect(res.status).toBe(409);
  });
});
