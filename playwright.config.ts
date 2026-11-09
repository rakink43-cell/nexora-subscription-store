import { defineConfig, devices } from '@playwright/test'

/**
 * Two targets:
 *   • default (port 5173) — the app exactly as configured in `.env`
 *     (demo / setup / live, whichever is real). Used by smoke + live-setup.
 *   • `--project=demo` (port 5174) — the full UI suite on the bundled demo
 *     backend, which exercises sign-up, checkout and the admin panel with no
 *     database. Start it with `npm run dev:demo`.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const DEMO = process.env.DEMO_URL ?? 'http://localhost:5174'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], baseURL: BASE } },
    { name: 'demo', use: { ...devices['Desktop Chrome'], baseURL: DEMO }, testMatch: /nexora\.spec\.ts/ },
  ],
})

