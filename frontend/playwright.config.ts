import { defineConfig, devices } from '@playwright/test'

const PORT = 5174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Chromium only. PW_CHANNEL=chrome reuses an installed Chrome when the bundled download is unavailable.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Empty contract id keeps the app on the in-memory mock client.
    env: { VITE_E2E: '1', VITE_OPTIONS_CONTRACT_ID: '' },
    reuseExistingServer: !process.env.CI,
  },
})
