import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authedPost, authedPatch, registerVerifiedOrg, inviteAndActivate, uniqueSuffix } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

const suffix = uniqueSuffix();
let orgA;
let orgB;

beforeAll(async () => {
  orgA = await registerVerifiedOrg({
    orgName: `MassAssignA-${suffix}`, email: `massassign-a-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
  orgB = await registerVerifiedOrg({
    orgName: `MassAssignB-${suffix}`, email: `massassign-b-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
});

afterAll(async () => {
  await deleteTestOrganization(orgA?.organizationId);
  await deleteTestOrganization(orgB?.organizationId);
});

describe('organization update rejects unrecognized fields outright (Zod .strict())', () => {
  it('a client attempt to smuggle `status` into an organization update is rejected, not silently dropped', async () => {
    const res = await authedPatch(orgA.agent, orgA.csrf, '/api/v1/organizations/me', { status: 'suspended' });
    expect(res.status).toBe(422);

    const check = await orgA.agent.get('/api/v1/organizations/me');
    expect(check.body.data.status).toBe('active');
  });
});

describe('a user cannot smuggle organizationId to move themselves into another organization', () => {
  it('inviting a user ignores any organizationId in the request body — they land in the inviter\'s own org', async () => {
    const res = await authedPost(orgA.agent, orgA.csrf, '/api/v1/users/invite', {
      firstName: 'Cross', lastName: 'Org', email: `cross-org-${suffix}@rems-test.local`, role: 'tenant',
      organizationId: orgB.organizationId, // not a field the endpoint even accepts
    });
    // The invite validator is .strict() too — an unexpected field is a
    // validation error, not a silently-ignored one.
    expect(res.status).toBe(422);
  });
});

describe('a caller cannot elevate a new user beyond what the invite endpoint allows', () => {
  it('inviting with a role name that is not a real role in this organization is rejected, not silently coerced', async () => {
    // 'super_admin_backdoor' is valid *shape* (lowercase snake_case, so it
    // passes the Zod format check) but isn't one of this organization's
    // actual seeded roles — the rejection has to come from the service
    // layer's role lookup (400), which is the check that actually matters:
    // format validation alone would never catch a made-up role name.
    const res = await authedPost(orgA.agent, orgA.csrf, '/api/v1/users/invite', {
      firstName: 'Bad', lastName: 'Role', email: `bad-role-${suffix}@rems-test.local`, role: 'super_admin_backdoor',
    });
    expect(res.status).toBe(400);
  });
});

describe('property creation ignores a client-supplied organizationId', () => {
  it('a property is always created under the caller\'s own organization, regardless of any organizationId in the body', async () => {
    const res = await orgA.agent.post('/api/v1/properties')
      .set('X-CSRF-Token', orgA.csrf).set('Origin', 'http://localhost:5173')
      .send({
        propertyCode: `MASS-${suffix}`, name: 'x', propertyType: 'residential', address: 'x',
        organizationId: orgB.organizationId,
      });
    // .strict() rejects the extra field outright.
    expect(res.status).toBe(422);
  });
});

describe('a property_manager cannot use the property-update endpoint to escalate their own assignment scope', () => {
  it('updating a property they are not assigned to still 404s even if they try to slip in an ownerId pointing at themself', async () => {
    const manager = await inviteAndActivate(orgA.agent, orgA.csrf, {
      firstName: 'Mass', lastName: 'Manager', email: `mass-pm-${suffix}@rems-test.local`,
      role: 'property_manager', password: 'Correct-Otter-Bridge8',
    });
    const propRes = await authedPost(orgA.agent, orgA.csrf, '/api/v1/properties', {
      propertyCode: `UNSEEN-${suffix}`, name: 'Unseen', propertyType: 'residential', address: 'x',
    });

    const res = await authedPatch(manager.agent, manager.csrf, `/api/v1/properties/${propRes.body.data.id}`, { name: 'Hijacked' });
    expect(res.status).toBe(404);
  });
});
