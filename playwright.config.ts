import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    // A dedicated, unusual port — reuseExistingServer must never silently attach to some
    // other project's dev server already running on a common port like 3000.
    baseURL: 'http://localhost:3491',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm start --port 3491',
    url: 'http://localhost:3491',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // NEXT_PUBLIC_* vars are inlined at build time, so this must be set for the build step
    // too — exposes window.__map (see components/map/marker-layer.tsx) for e2e assertions
    // without shipping it in a real production build.
    env: { NEXT_PUBLIC_E2E: 'true' },
  },
  // iPhone 15 is the default project — mobile is the target, not an afterthought.
  projects: [
    { name: 'iPhone 15', use: { ...devices['iPhone 15'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
