// Set before anything else in this file runs — env.js's zod validation and
// mailer.js's test-mode email capture (see integrations/email/mailer.js)
// both key off NODE_ENV=test. Vitest forwards process.env to its worker
// pool, so setting it here (rather than relying on a shell-specific
// `NODE_ENV=test` prefix, which doesn't work the same way on Windows) is
// the cross-platform way to guarantee it's set before any test file
// imports the app.
process.env.NODE_ENV = 'test';

import { defineConfig } from 'vitest/config';

// Test files live under the repo-root `tests/` directory (per the required
// project structure), not inside `server/` itself — this config just points
// vitest at them when run from the server workspace (`npm run test
// --workspace server`).
export default defineConfig({
  test: {
    include: [
      '../tests/unit/server/**/*.test.js',
      '../tests/integration/server/**/*.test.js',
      '../tests/security/server/**/*.test.js',
    ],
    environment: 'node',
    // Integration/security tests hit the real Neon database over the
    // network (no local DB — see docs/architecture) — round trips of
    // several hundred ms to a couple of seconds are normal, and a
    // multi-step flow (register -> verify -> login -> ...) can take over
    // ten seconds. The default 5s timeout is tuned for local/mocked tests
    // and isn't realistic here.
    testTimeout: 30_000,
    // Hooks specifically need more headroom than individual tests: a
    // `beforeAll` that builds a rich fixture (idor-bola.test.js creates a
    // property, building, unit, owner, tenant, lease, invoice, vendor, and
    // maintenance request — nine sequential real HTTP requests, each its
    // own round trip to Neon) can run past 30s even though no single step
    // is slow in isolation. Measured full-file runtimes in this suite
    // range from ~20s to ~80s.
    hookTimeout: 90_000,
    // Integration/security suites share expensive per-file fixtures
    // (one registered organization reused across many `it()`s — see
    // tests/integration/server/helpers) rather than isolating at the
    // per-test level, so file-level (not full) parallelism is what
    // actually matters for wall-clock time; this keeps worker count sane
    // against Neon's connection limits.
    fileParallelism: false,
  },
});
