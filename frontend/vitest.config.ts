import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Unit tests always run on the mock client and the Margin fixtures, whatever a local .env file sets for a
    // live build: no test may depend on, or reach, a deployed contract.
    env: { VITE_OPTIONS_CONTRACT_ID: '', VITE_PRO_CONTRACT_ID: '' },
  },
})
