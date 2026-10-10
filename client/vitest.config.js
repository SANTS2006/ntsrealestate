import { defineConfig } from 'vitest/config';

// No client-side pure logic worth unit testing exists yet — the client so
// far is UI shell (Phase 1) with auth screens landing in a later phase.
// `passWithNoTests` avoids `npm test` hard-failing on an empty suite in the
// meantime; remove this once real test files exist here.
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
