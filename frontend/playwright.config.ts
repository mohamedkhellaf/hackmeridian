import { defineConfig, devices } from '@playwright/test'
import { guideSeen } from './e2e/guideState'

// PW_PORT picks the port. With a dev server already running there (reuseExistingServer), the suite runs against
// it: `PW_PORT=5199 npx playwright test e2e/shell.spec.ts`. Otherwise Playwright starts its own on that port.
const PORT = Number(process.env.PW_PORT ?? 5174)
// PW_CHANNEL=chrome reuses an installed Chrome when the bundled Chromium download is unavailable.
const channel = process.env.PW_CHANNEL || undefined

// Several runs may share this checkout at the same time (one per person or agent, each on its own spec). Each
// run gets its own output folder, or one run's cleanup deletes the traces another is still writing. The id is
// set once in the runner and inherited by its workers.
process.env.PW_RUN_ID ??= `${Date.now().toString(36)}-${process.pid}`

export default defineConfig({
  testDir: './e2e',
  outputDir: `test-results/run-${process.env.PW_RUN_ID}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Every spec runs as a returning visitor: the welcome guide has been seen (e2e/guideState.ts).
    storageState: guideSeen(`http://localhost:${PORT}`),
    trace: 'retain-on-failure',
    // Motion is tested by eye, not here: with reduced motion a scan or a screenshot never lands mid-transition.
    contextOptions: { reducedMotion: 'reduce' },
  },
  // Two projects, Chromium only. A test runs on the desktop unless its title (or its describe) carries a tag:
  //   @phone  runs at 390 x 844 only;   @both  runs in both.
  projects: [
    {
      name: 'desktop',
      grepInvert: /@phone/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel },
    },
    {
      name: 'phone',
      grep: /@phone|@both/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, channel },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Empty contract ids keep the app on the in-memory mock client and Margin on fixtures; VITE_E2E=1 swaps the
    // wallet kit for the test wallet.
    env: { VITE_E2E: '1', VITE_OPTIONS_CONTRACT_ID: '', VITE_ENABLE_PRO: '1', VITE_PRO_CONTRACT_ID: '' },
    reuseExistingServer: !process.env.CI,
  },
})
