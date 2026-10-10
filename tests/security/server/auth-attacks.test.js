import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { newAgent, primeCsrf } from '../../integration/server/helpers/testApp.js';
import { authedPost, registerVerifiedOrg, uniqueSuffix, lastEmailTo, extractToken } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

const suffix = uniqueSuffix();
let org;
const extraOrgIds = [];

beforeAll(async () => {
  org = await registerVerifiedOrg({
    orgName: `AttackOrg-${suffix}`, email: `attack-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
});

afterAll(async () => {
  await deleteTestOrganization(org?.organizationId);
  await Promise.all(extraOrgIds.map((id) => deleteTestOrganization(id)));
});

describe('forged / malformed JWTs', () => {
  it('rejects a token signed with a different (attacker-known) secret', async () => {
    const forged = jwt.sign(
      { sub: org.userId, org: org.organizationId, roles: ['administrator'] },
      'attacker-guessed-or-leaked-wrong-secret-value-padding',
      { algorithm: 'HS256', expiresIn: '15m', issuer: 'rems-api', audience: 'rems-clients' }
    );
    const res = await newAgent().get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an unsigned "alg: none" token even with an otherwise-valid-looking payload', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: org.userId, org: org.organizationId, roles: ['administrator'],
      iss: 'rems-api', aud: 'rems-clients', exp: Math.floor(Date.now() / 1000) + 900,
    })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await newAgent().get('/api/v1/auth/me').set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token whose payload was tampered with after signing (cross-org impersonation attempt)', async () => {
    const tokenRes = await newAgent().post('/api/v1/auth/token').send({ email: org.email, password: org.password });
    const [header, , signature] = tokenRes.body.data.accessToken.split('.');

    // `org.userId` is already an administrator in `org.organizationId` —
    // re-asserting the same role would be a no-op tamper that "succeeds"
    // for the wrong reason. Retargeting the `org` claim to a different
    // (fabricated) organization id is a real forgery attempt: it's exactly
    // what an attacker holding a legitimate low-privilege token would try,
    // to make middleware/auth.js's org-match check pass against a
    // different tenant. The signature, still computed over the original
    // payload, must not validate against this changed one.
    const realPayload = JSON.parse(Buffer.from(tokenRes.body.data.accessToken.split('.')[1], 'base64url').toString());
    const forgedPayload = Buffer.from(JSON.stringify({ ...realPayload, org: '00000000-0000-4000-8000-000000000000' })).toString('base64url');
    const tampered = `${header}.${forgedPayload}.${signature}`;

    const res = await newAgent().get('/api/v1/auth/me').set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed but nonsensical Bearer value', async () => {
    const res = await newAgent().get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a completely missing credential', async () => {
    const res = await newAgent().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('brute-force account lockout', () => {
  it('locks the account after repeated failed attempts, even with the correct password on the next try', async () => {
    const email = `lockout-${suffix}@rems-test.local`;
    const password = 'Correct-Otter-Bridge7';
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const registerRes = await authedPost(agent, csrf, '/api/v1/auth/register', {
      firstName: 'Lock', lastName: 'Out', email, password, agreedToTerms: true,
    });
    extraOrgIds.push(registerRes.body.data.organization.id);

    // Verify so the failure path under test is genuinely "wrong password
    // against a real, usable account," not "unverified account."
    const token = extractToken(lastEmailTo(email)?.text);
    await authedPost(agent, csrf, '/api/v1/auth/verify-email', { token });

    for (let i = 0; i < 5; i += 1) {
      const res = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password: 'wrong-password-attempt' });
      expect(res.status).toBe(401);
    }

    const finalAttempt = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
    expect(finalAttempt.status).toBe(403);
    expect(finalAttempt.body.error.message).toMatch(/locked/i);
  });
});
