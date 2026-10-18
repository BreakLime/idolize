import { defineConfig } from '@playwright/test';

// E2E tests drive the built app (npm run build first) against the live TIDAL API with an isolated profile.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 10 * 60_000,
  workers: 1,
  reporter: [['list']],
});
