import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authedPost, authedPatch, registerVerifiedOrg, inviteAndActivate, uniqueSuffix } from './helpers/testUser.js';
import { deleteTestOrganization } from './helpers/cleanup.js';

const suffix = uniqueSuffix();

let orgA;
let orgB;
let propertyId;

beforeAll(async () => {
  orgA = await registerVerifiedOrg({
    orgName: `AuthzOrgA-${suffix}`, email: `authz-a-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
  orgB = await registerVerifiedOrg({
    orgName: `AuthzOrgB-${suffix}`, email: `authz-b-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });

  const propRes = await authedPost(orgA.agent, orgA.csrf, '/api/v1/properties', {
    propertyCode: `AZ-${suffix}`, name: 'Authz Test Property', propertyType: 'residential', address: '1 Test St',
  });
  propertyId = propRes.body.data.id;
});

afterAll(async () => {
  await deleteTestOrganization(orgA?.organizationId);
  await deleteTestOrganization(orgB?.organizationId);
});

describe('organization isolation', () => {
  it('a second organization cannot read the first organization\'s property (404, not 403)', async () => {
    const res = await orgB.agent.get(`/api/v1/properties/${propertyId}`);
    expect(res.status).toBe(404);
  });

  it('a second organization cannot write to the first organization\'s property', async () => {
    const res = await authedPatch(orgB.agent, orgB.csrf, `/api/v1/properties/${propertyId}`, { name: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('a second organization\'s property list never includes the first organization\'s data', async () => {
    const res = await orgB.agent.get('/api/v1/properties');
    expect(res.status).toBe(200);
    expect(res.body.data.find((p) => p.id === propertyId)).toBeUndefined();
  });
});

describe('RBAC — role lacking a permission is denied, not silently scoped down', () => {
  let tenant;

  beforeAll(async () => {
    tenant = await inviteAndActivate(orgA.agent, orgA.csrf, {
      firstName: 'Rbac', lastName: 'Tenant', email: `rbac-tenant-${suffix}@rems-test.local`,
      role: 'tenant', password: 'Correct-Otter-Bridge5',
    });
  });

  it('a tenant is denied properties:create outright (403), independent of any resource-level scoping', async () => {
    const res = await authedPost(tenant.agent, tenant.csrf, '/api/v1/properties', {
      propertyCode: `SHOULD-FAIL-${suffix}`, name: 'x', propertyType: 'residential', address: 'x',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a tenant is denied users:invite outright', async () => {
    const res = await authedPost(tenant.agent, tenant.csrf, '/api/v1/users/invite', {
      firstName: 'x', lastName: 'y', email: `escalation-${suffix}@rems-test.local`, role: 'administrator',
    });
    expect(res.status).toBe(403);
  });
});

describe('self-service restrictions', () => {
  it('a user cannot change their own role', async () => {
    const res = await authedPatch(orgA.agent, orgA.csrf, `/api/v1/users/${orgA.userId}/role`, { role: 'tenant' });
    expect(res.status).toBe(403);
  });

  it('a user cannot change their own account status', async () => {
    const res = await authedPatch(orgA.agent, orgA.csrf, `/api/v1/users/${orgA.userId}/status`, { status: 'inactive' });
    expect(res.status).toBe(403);
  });
});

describe('resource-level scoping — property_manager sees only assigned properties', () => {
  let manager;
  let unassignedPropertyId;

  beforeAll(async () => {
    manager = await inviteAndActivate(orgA.agent, orgA.csrf, {
      firstName: 'Scoped', lastName: 'Manager', email: `scoped-pm-${suffix}@rems-test.local`,
      role: 'property_manager', password: 'Correct-Otter-Bridge6',
    });
    const propRes = await authedPost(orgA.agent, orgA.csrf, '/api/v1/properties', {
      propertyCode: `UNASSIGNED-${suffix}`, name: 'Not Assigned To PM', propertyType: 'residential', address: '2 Test St',
    });
    unassignedPropertyId = propRes.body.data.id;
  });

  it('is denied a property they are not assigned to, even though they hold properties:read', async () => {
    const res = await manager.agent.get(`/api/v1/properties/${unassignedPropertyId}`);
    expect(res.status).toBe(404);
  });

  it('gains access the moment an administrator assigns them, with no re-login required', async () => {
    const assignRes = await authedPost(orgA.agent, orgA.csrf, `/api/v1/properties/${unassignedPropertyId}/assignments`, { userId: manager.userId });
    expect(assignRes.status).toBe(200);

    const res = await manager.agent.get(`/api/v1/properties/${unassignedPropertyId}`);
    expect(res.status).toBe(200);
  });
});
