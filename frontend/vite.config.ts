import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    // Strata Pro is behind VITE_ENABLE_PRO=1. Pinning the value at build time (also when unset) lets the bundler
    // drop the Pro chunk entirely from a default build.
    define: { 'import.meta.env.VITE_ENABLE_PRO': JSON.stringify(env.VITE_ENABLE_PRO ?? '') },
    // src/payoff imports ../packages/payoff (outside the frontend root) by relative path.
    server: { fs: { allow: ['..'] } },
  }
})
