import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newAgent, primeCsrf, extractCookie } from './helpers/testApp.js';
import { authedPost, registerVerifiedOrg, uniqueSuffix, lastEmailTo, extractToken } from './helpers/testUser.js';
import { deleteTestOrganization } from './helpers/cleanup.js';
import { authenticator } from 'otplib';

const suffix = uniqueSuffix();
const email = `auth-test-${suffix}@rems-test.local`;
const password = 'Correct-Falcon-Runway9';

let ctx;
const extraOrgIds = [];

beforeAll(async () => {
  ctx = await registerVerifiedOrg({ orgName: `AuthTestOrg-${suffix}`, email, password });
});

afterAll(async () => {
  await deleteTestOrganization(ctx?.organizationId);
  await Promise.all(extraOrgIds.map((id) => deleteTestOrganization(id)));
});

describe('registration', () => {
  it('rejects a second registration with the same email (anti-duplicate, not just anti-enumeration)', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const res = await authedPost(agent, csrf, '/api/v1/auth/register', {
      firstName: 'Dup', lastName: 'User', email, password, agreedToTerms: true,
    });
    expect(res.status).toBe(409);
  });

  it('rejects a password that fails the server-side policy regardless of client validation', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const res = await authedPost(agent, csrf, '/api/v1/auth/register', {
      firstName: 'Weak', lastName: 'User',
      email: `weak-${suffix}@rems-test.local`, password: 'short', agreedToTerms: true,
    });
    expect(res.status).toBe(422);
  });
});

describe('login', () => {
  it('blocks login before email verification', async () => {
    const unverifiedEmail = `unverified-${suffix}@rems-test.local`;
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const registerRes = await authedPost(agent, csrf, '/api/v1/auth/register', {
      firstName: 'Un', lastName: 'Verified', email: unverifiedEmail, password, agreedToTerms: true,
    });
    extraOrgIds.push(registerRes.body.data.organization.id);
    const res = await authedPost(agent, csrf, '/api/v1/auth/login', { email: unverifiedEmail, password });
    expect(res.status).toBe(403);
  });

  it('gives an identical generic error for a wrong password and for a nonexistent account (anti-enumeration)', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    const wrongPasswordRes = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password: 'Wrong-Password-123' });
    const noSuchUserRes = await authedPost(agent, csrf, '/api/v1/auth/login', { email: `nobody-${suffix}@rems-test.local`, password: 'Wrong-Password-123' });

    expect(wrongPasswordRes.status).toBe(401);
    expect(noSuchUserRes.status).toBe(401);
    expect(wrongPasswordRes.body.error.message).toBe(noSuchUserRes.body.error.message);
  });

  it('issues a fresh session id on every login (regenerate-on-login, the actual fixation defense)', async () => {
    // express-session never sets a cookie before something writes to
    // req.session (saveUninitialized: false), and nothing in this app
    // touches req.session before authentication succeeds — so there is no
    // pre-login session id an attacker could plant here in the first
    // place. What *is* verifiable, and what's actually implemented
    // (services/auth.service.js's establishSession calls
    // req.session.regenerate() unconditionally), is that two separate
    // logins on the same agent never reuse a session id.
    const agent = newAgent();
    const firstCsrf = await primeCsrf(agent);
    const firstLogin = await authedPost(agent, firstCsrf, '/api/v1/auth/login', { email, password });
    const firstSessionCookie = extractCookie(firstLogin, 'rems.sid');
    expect(firstSessionCookie).toBeTruthy();

    await authedPost(agent, firstCsrf, '/api/v1/auth/logout');

    // logout only clears the session cookie (see auth.controller.js) — the
    // CSRF cookie is untouched, so the original token is still valid.
    const secondLogin = await authedPost(agent, firstCsrf, '/api/v1/auth/login', { email, password });
    const secondSessionCookie = extractCookie(secondLogin, 'rems.sid');

    expect(secondSessionCookie).toBeTruthy();
    expect(secondSessionCookie).not.toBe(firstSessionCookie);
  });

  it('/auth/me reflects the authenticated principal after login', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
    const meRes = await agent.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.organizationId).toBe(ctx.organizationId);
    expect(meRes.body.data.roles).toContain('administrator');
  });

  it('logout destroys the session — a subsequent authenticated call fails', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);

    await authedPost(agent, csrf, '/api/v1/auth/logout');
    const afterLogout = await agent.get('/api/v1/auth/me');
    expect(afterLogout.status).toBe(401);
  });
});

describe('MFA', () => {
  it('enroll -> confirm -> subsequent login requires a TOTP code -> challenge completes it', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });

    const enrollRes = await authedPost(agent, csrf, '/api/v1/auth/mfa/enroll');
    expect(enrollRes.status).toBe(200);
    const secret = enrollRes.body.data.secret;

    const confirmRes = await authedPost(agent, csrf, '/api/v1/auth/mfa/confirm', { code: authenticator.generate(secret) });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.recoveryCodes.length).toBeGreaterThan(0);

    await authedPost(agent, csrf, '/api/v1/auth/logout');

    const secondLogin = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.data.mfaRequired).toBe(true);

    const challengeRes = await authedPost(agent, csrf, '/api/v1/auth/mfa/challenge', {
      mfaToken: secondLogin.body.data.mfaToken,
      code: authenticator.generate(secret),
    });
    expect(challengeRes.status).toBe(200);
    expect(challengeRes.body.data.user.mfaEnabled).toBe(true);

    // Cleanup: disable MFA so later tests in this file can log in without it.
    await authedPost(agent, csrf, '/api/v1/auth/mfa/disable', { password, code: authenticator.generate(secret) });
  });
});

describe('JWT (mobile/API clients)', () => {
  // /auth/token and /auth/token/refresh carry no cookie credential, so
  // (unlike every session-based route in this file) they take no CSRF
  // header — a bare agent.post(...) is the accurate shape of a real
  // mobile/API client request here.
  it('issues an access+refresh token pair and accepts the access token as a Bearer credential', async () => {
    const res = await newAgent().post('/api/v1/auth/token').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();

    const meRes = await newAgent().get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.organizationId).toBe(ctx.organizationId);
  });

  it('rotates the refresh token and detects reuse of an already-rotated one', async () => {
    const tokenRes = await newAgent().post('/api/v1/auth/token').send({ email, password });
    const originalRefresh = tokenRes.body.data.refreshToken;

    const refreshRes = await newAgent().post('/api/v1/auth/token/refresh').send({ refreshToken: originalRefresh });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.refreshToken).not.toBe(originalRefresh);

    const reuseRes = await newAgent().post('/api/v1/auth/token/refresh').send({ refreshToken: originalRefresh });
    expect(reuseRes.status).toBe(401);

    // Reuse detection revokes the whole family — even the token issued by
    // the legitimate rotation above must now be rejected too.
    const secondUseOfNewToken = await newAgent().post('/api/v1/auth/token/refresh').send({ refreshToken: refreshRes.body.data.refreshToken });
    expect(secondUseOfNewToken.status).toBe(401);
  });
});

describe('password reset', () => {
  it('completes a forgot-password -> reset -> login-with-new-password flow', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);

    const forgotRes = await authedPost(agent, csrf, '/api/v1/auth/forgot-password', { email });
    expect(forgotRes.status).toBe(200);

    const resetToken = extractToken(lastEmailTo(email)?.text);
    expect(resetToken).toBeTruthy();

    const newPassword = 'Correct-Otter-Bridge2';
    const resetRes = await authedPost(agent, csrf, '/api/v1/auth/reset-password', { token: resetToken, newPassword });
    expect(resetRes.status).toBe(200);

    const loginRes = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password: newPassword });
    expect(loginRes.status).toBe(200);

    // Restore the original password so later describe blocks (which run
    // after this one in file order) keep working against the shared fixture.
    await authedPost(agent, csrf, '/api/v1/auth/change-password', { currentPassword: newPassword, newPassword: password });
  });

  it('the same reset token cannot be used twice', async () => {
    const agent = newAgent();
    const csrf = await primeCsrf(agent);
    await authedPost(agent, csrf, '/api/v1/auth/forgot-password', { email });
    const resetToken = extractToken(lastEmailTo(email)?.text);

    const first = await authedPost(agent, csrf, '/api/v1/auth/reset-password', { token: resetToken, newPassword: 'Correct-Otter-Bridge3' });
    expect(first.status).toBe(200);

    const second = await authedPost(agent, csrf, '/api/v1/auth/reset-password', { token: resetToken, newPassword: 'Correct-Otter-Bridge4' });
    expect(second.status).toBe(400);

    // Restore original password (the first reset above changed it).
    const loginAgent = newAgent();
    const loginCsrf = await primeCsrf(loginAgent);
    await authedPost(loginAgent, loginCsrf, '/api/v1/auth/login', { email, password: 'Correct-Otter-Bridge3' });
    await authedPost(loginAgent, loginCsrf, '/api/v1/auth/change-password', { currentPassword: 'Correct-Otter-Bridge3', newPassword: password });
  });
});
