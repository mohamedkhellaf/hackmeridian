import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // src/payoff imports ../packages/payoff (outside the frontend root) by relative path.
  server: { fs: { allow: ['..'] } },
})
