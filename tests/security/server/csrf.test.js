import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newAgent, primeCsrf } from '../../integration/server/helpers/testApp.js';
import { authedPost, registerVerifiedOrg, uniqueSuffix } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

const suffix = uniqueSuffix();
let org;

beforeAll(async () => {
  org = await registerVerifiedOrg({
    orgName: `CsrfOrg-${suffix}`, email: `csrf-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
});

afterAll(async () => {
  await deleteTestOrganization(org?.organizationId);
});

describe('double-submit CSRF protection on session-authenticated routes', () => {
  it('rejects a state-changing request with no CSRF header at all', async () => {
    const res = await org.agent.post('/api/v1/properties')
      .set('Origin', 'http://localhost:5173')
      .send({ propertyCode: `NOCSRF-${suffix}`, name: 'x', propertyType: 'residential', address: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a request whose header value does not match the csrf_token cookie', async () => {
    const res = await org.agent.post('/api/v1/properties')
      .set('X-CSRF-Token', 'attacker-supplied-token-that-does-not-match-the-cookie')
      .set('Origin', 'http://localhost:5173')
      .send({ propertyCode: `BADCSRF-${suffix}`, name: 'x', propertyType: 'residential', address: 'x' });
    expect(res.status).toBe(403);
  });

  it('accepts the request once the header correctly mirrors the cookie (control case — proves the two rejections above are the CSRF check, not something else)', async () => {
    const res = await authedPost(org.agent, org.csrf, '/api/v1/properties', {
      propertyCode: `GOODCSRF-${suffix}`, name: 'x', propertyType: 'residential', address: 'x',
    });
    expect(res.status).toBe(201);
  });

  it('a request from an untrusted Origin is rejected before CSRF is even considered', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const res = await agent.post('/api/v1/properties')
      .set('X-CSRF-Token', csrf)
      .set('Origin', 'https://attacker.example')
      .send({ propertyCode: `EVIL-${suffix}`, name: 'x', propertyType: 'residential', address: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('JWT-authenticated routes carry no CSRF requirement (no ambient cookie credential to forge)', () => {
  it('a Bearer-authenticated request succeeds with no CSRF header at all', async () => {
    const tokenRes = await newAgent().post('/api/v1/auth/token').send({ email: org.email, password: org.password });
    const res = await newAgent().get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenRes.body.data.accessToken}`);
    expect(res.status).toBe(200);
  });
});
