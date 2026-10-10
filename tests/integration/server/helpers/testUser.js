import { newAgent, primeCsrf } from './testApp.js';
import { sentEmails } from '../../../../server/src/integrations/email/mailer.js';

const ORIGIN = 'http://localhost:5173';

// Thin wrappers that always attach the CSRF header + a trusted Origin —
// every state-changing call in this suite goes through these rather than
// raw agent.post(...), so no test can accidentally exercise a
// not-quite-real request shape.
export const authedPost = (agent, csrf, path, body) => agent.post(path).set('X-CSRF-Token', csrf).set('Origin', ORIGIN).send(body ?? {});
export const authedPatch = (agent, csrf, path, body) => agent.patch(path).set('X-CSRF-Token', csrf).set('Origin', ORIGIN).send(body ?? {});
export const authedDelete = (agent, csrf, path) => agent.delete(path).set('X-CSRF-Token', csrf).set('Origin', ORIGIN);

function lastEmailTo(address) {
  for (let i = sentEmails.length - 1; i >= 0; i -= 1) {
    if (sentEmails[i].to === address) return sentEmails[i];
  }
  return null;
}

function extractToken(text) {
  const match = /token=([^&\s"]+)/.exec(text ?? '');
  return match ? match[1] : null;
}

// A unique-enough suffix per test run so repeated runs never collide on
// the (organizationId, email) / (organizationId, propertyCode) / etc.
// uniqueness constraints — tests never rely on a fixed, reused email.
export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Full register -> verify -> login flow for a brand-new organization,
// returning a ready-to-use authenticated agent plus the ids a test
// typically needs next. This is the single most common piece of test
// setup across the suite, so every file leans on it rather than
// reimplementing the flow.
export async function registerVerifiedOrg({ orgName, firstName = 'Admin', lastName = 'User', email, password }) {
  const agent = newAgent();
  // Fetched once and reused for the whole flow: the CSRF cookie is only
  // *set* by the server when the incoming request has none yet (see
  // middleware/csrf.js) — once an agent has it, every later response omits
  // Set-Cookie for it (the browser/agent just keeps resending the same
  // cookie), so re-"priming" mid-flow would only find a token in a
  // response that happens to (re)issue one, which most don't.
  const csrf = await primeCsrf(agent);

  const registerRes = await authedPost(agent, csrf, '/api/v1/auth/register', {
    firstName, lastName, email, password, agreedToTerms: true,
  });
  if (registerRes.status !== 201) {
    throw new Error(`registerVerifiedOrg: registration failed (${registerRes.status}): ${JSON.stringify(registerRes.body)}`);
  }
  const organizationId = registerRes.body.data.organization.id;
  const userId = registerRes.body.data.user.id;

  const verifyToken = extractToken(lastEmailTo(email)?.text);
  const verifyRes = await authedPost(agent, csrf, '/api/v1/auth/verify-email', { token: verifyToken });
  if (verifyRes.status !== 200) {
    throw new Error(`registerVerifiedOrg: verification failed: ${JSON.stringify(verifyRes.body)}`);
  }

  const loginRes = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
  if (loginRes.status !== 200) {
    throw new Error(`registerVerifiedOrg: login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return { agent, csrf, organizationId, userId, email, password };
}

// Invites a user with the given role into an already-authenticated admin's
// organization, then completes the invite (set-password) flow and logs
// them in — returning their own independent agent, matching how the real
// invite -> "set your password" -> sign-in flow works.
export async function inviteAndActivate(adminAgent, adminCsrf, { firstName, lastName, email, role, password }) {
  const inviteRes = await authedPost(adminAgent, adminCsrf, '/api/v1/users/invite', { firstName, lastName, email, role });
  if (inviteRes.status !== 201) {
    throw new Error(`inviteAndActivate: invite failed (${inviteRes.status}): ${JSON.stringify(inviteRes.body)}`);
  }
  const userId = inviteRes.body.data.id;

  const agent = newAgent();
  const csrf = await primeCsrf(agent);

  const setToken = extractToken(lastEmailTo(email)?.text);
  const resetRes = await authedPost(agent, csrf, '/api/v1/auth/reset-password', { token: setToken, newPassword: password });
  if (resetRes.status !== 200) {
    throw new Error(`inviteAndActivate: set-password failed: ${JSON.stringify(resetRes.body)}`);
  }

  const loginRes = await authedPost(agent, csrf, '/api/v1/auth/login', { email, password });
  if (loginRes.status !== 200) {
    throw new Error(`inviteAndActivate: login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return { agent, csrf, userId, email, password };
}

export { lastEmailTo, extractToken };
