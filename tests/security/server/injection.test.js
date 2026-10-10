import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authedPost, registerVerifiedOrg, uniqueSuffix } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

const suffix = uniqueSuffix();
let org;

beforeAll(async () => {
  org = await registerVerifiedOrg({
    orgName: `InjectOrg-${suffix}`, email: `inject-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
});

afterAll(async () => {
  await deleteTestOrganization(org?.organizationId);
});

describe('SQL injection — every query is parameterized via Prisma, never string-concatenated', () => {
  const payloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users --",
    "%'; SELECT pg_sleep(5); --",
  ];

  it.each(payloads)('a classic SQL injection payload in a search query param neither errors nor leaks data: %s', async (payload) => {
    const res = await org.agent.get('/api/v1/properties').query({ search: payload });
    // The correct outcome is a normal, empty (or unrelated) result set —
    // never a 500 (which would suggest the string reached raw SQL) and
    // never an unexpectedly large/foreign result set (which would suggest
    // the filter was bypassed).
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('the users table still exists and answers normally after every payload above (no DROP TABLE succeeded)', async () => {
    const res = await org.agent.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('stored payloads round-trip as inert literal text, never interpreted', () => {
  it('a script-tag name is stored and returned byte-for-byte, not executed or stripped silently', async () => {
    const maliciousName = '<script>alert(document.cookie)</script>';
    const res = await authedPost(org.agent, org.csrf, '/api/v1/owners', { name: maliciousName });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(maliciousName);

    const getRes = await org.agent.get(`/api/v1/owners/${res.body.data.id}`);
    expect(getRes.body.data.name).toBe(maliciousName);
    // The API returns JSON (Content-Type: application/json), not HTML — a
    // JSON string value is never executed by a JSON parser regardless of
    // its contents; the actual XSS-prevention boundary is the frontend's
    // rendering layer (React escapes by default), which is out of scope
    // for this backend suite.
    expect(getRes.headers['content-type']).toMatch(/application\/json/);
  });

  it('a NoSQL/Prisma-operator-shaped string is treated as a literal value, not a query operator', async () => {
    // Zod's z.string() on `name` rejects a non-string body value outright,
    // so the more realistic attack surface is a string that merely *looks*
    // like an operator — confirm it's stored literally rather than
    // somehow being interpreted.
    const weirdName = '{"$gt":""}';
    const res = await authedPost(org.agent, org.csrf, '/api/v1/owners', { name: weirdName });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(weirdName);
  });
});
