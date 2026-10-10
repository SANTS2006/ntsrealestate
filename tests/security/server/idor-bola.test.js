import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authedPost, registerVerifiedOrg, uniqueSuffix } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

// One rich fixture built under "victim" org, then every read/write below is
// attempted from a completely independent "attacker" org that has never
// interacted with it — the only thing they know is the victim's real UUIDs
// (the strongest-case attacker: guessed or leaked ids, not blind
// enumeration). Every one of these must resolve to 404, matching the
// IDOR-safe convention documented in docs/security/authorization.md: a
// caller with the right generic permission but the wrong organization
// fails identically to a caller asking about something that never existed.
const suffix = uniqueSuffix();

let victim;
let attacker;
let ids = {};

beforeAll(async () => {
  victim = await registerVerifiedOrg({
    orgName: `IdorVictim-${suffix}`, email: `idor-victim-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
  attacker = await registerVerifiedOrg({
    orgName: `IdorAttacker-${suffix}`, email: `idor-attacker-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });

  const property = await authedPost(victim.agent, victim.csrf, '/api/v1/properties', {
    propertyCode: `IDOR-${suffix}`, name: 'Victim Property', propertyType: 'residential', address: '1 Victim St',
  });
  const building = await authedPost(victim.agent, victim.csrf, `/api/v1/properties/${property.body.data.id}/buildings`, { name: 'Building A' });
  const unit = await authedPost(victim.agent, victim.csrf, `/api/v1/buildings/${building.body.data.id}/units`, { unitNumber: '1', monthlyRent: 1000 });
  const owner = await authedPost(victim.agent, victim.csrf, '/api/v1/owners', { name: 'Victim Owner' });
  const tenant = await authedPost(victim.agent, victim.csrf, '/api/v1/tenants', { firstName: 'Victim', lastName: 'Tenant' });
  const lease = await authedPost(victim.agent, victim.csrf, '/api/v1/leases', {
    unitId: unit.body.data.id, tenantId: tenant.body.data.id, startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 1000,
  });
  const invoice = await authedPost(victim.agent, victim.csrf, '/api/v1/invoices', {
    tenantId: tenant.body.data.id, issueDate: '2026-01-01', dueDate: '2026-01-31', subtotal: 1000,
  });
  const vendor = await authedPost(victim.agent, victim.csrf, '/api/v1/vendors', { name: 'Victim Vendor' });
  const maintenance = await authedPost(victim.agent, victim.csrf, '/api/v1/maintenance', {
    propertyId: property.body.data.id, title: 'Victim issue',
  });

  ids = {
    property: property.body.data.id,
    building: building.body.data.id,
    unit: unit.body.data.id,
    owner: owner.body.data.id,
    tenant: tenant.body.data.id,
    lease: lease.body.data.id,
    invoice: invoice.body.data.id,
    vendor: vendor.body.data.id,
    maintenance: maintenance.body.data.id,
  };
});

afterAll(async () => {
  await deleteTestOrganization(victim?.organizationId);
  await deleteTestOrganization(attacker?.organizationId);
});

describe('cross-organization read access (BOLA)', () => {
  // Deliberately a *static* array of (label, url segment, ids-key) triples
  // — it must not reference `ids` at all here, because `it.each(...)`
  // evaluates its argument during vitest's collection phase, which runs
  // BEFORE `beforeAll`. An earlier version of this test built full URL
  // strings from `ids.property` etc. right in this array, which silently
  // baked in `undefined` (ids hadn't been populated yet) for every case —
  // the resulting requests hit `/api/v1/properties/undefined`, which fails
  // UUID param validation (422) before authorization is ever reached,
  // making the test pass for the wrong reason... except it didn't even do
  // that, since 422 != 404 and correctly failed, just not for the reason
  // the test claimed to check. Fixed by resolving `ids[key]` inside the
  // test body, which runs after `beforeAll` has populated it.
  const RESOURCE_CASES = [
    ['property', 'properties', 'property'],
    ['building', 'buildings', 'building'],
    ['unit', 'units', 'unit'],
    ['owner', 'owners', 'owner'],
    ['tenant', 'tenants', 'tenant'],
    ['lease', 'leases', 'lease'],
    ['invoice', 'invoices', 'invoice'],
    ['vendor', 'vendors', 'vendor'],
    ['maintenance request', 'maintenance', 'maintenance'],
  ];

  it.each(RESOURCE_CASES)('a second organization gets 404 reading another organization\'s %s by id', async (_label, urlSegment, idKey) => {
    expect(ids[idKey]).toBeTruthy(); // guards against silently re-introducing the undefined-id bug
    const res = await attacker.agent.get(`/api/v1/${urlSegment}/${ids[idKey]}`);
    expect(res.status).toBe(404);
  });
});

describe('cross-organization write access (IDOR)', () => {
  it('cannot update another organization\'s property', async () => {
    const res = await attacker.agent.patch(`/api/v1/properties/${ids.property}`)
      .set('X-CSRF-Token', attacker.csrf).set('Origin', 'http://localhost:5173').send({ name: 'Pwned' });
    expect(res.status).toBe(404);
  });

  it('cannot record a payment against another organization\'s invoice', async () => {
    const res = await authedPost(attacker.agent, attacker.csrf, '/api/v1/payments', {
      tenantId: ids.tenant, invoiceId: ids.invoice, amount: 100, paymentMethod: 'cash',
    });
    // Rejected either as "tenant doesn't exist in this org" (400) or a
    // property-access denial resolving to 404 — either way, money can
    // never move against a record outside the caller's organization.
    expect([400, 404]).toContain(res.status);
  });

  it('cannot terminate another organization\'s lease', async () => {
    const res = await authedPost(attacker.agent, attacker.csrf, `/api/v1/leases/${ids.lease}/terminate`, {});
    expect(res.status).toBe(404);
  });

  it('cannot create a document attached to another organization\'s property', async () => {
    const res = await attacker.agent.post('/api/v1/documents')
      .set('X-CSRF-Token', attacker.csrf).set('Origin', 'http://localhost:5173')
      .field('entityType', 'property').field('entityId', ids.property)
      .attach('file', Buffer.from('not a real image'), 'test.png');
    expect(res.status).toBe(404);
  });
});
