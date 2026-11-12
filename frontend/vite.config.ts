import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

/**
 * `%SITE_URL%` in index.html: the public origin for the social card (`og:image` wants an absolute address).
 * Set VITE_SITE_URL at deploy time; without it the address stays root-relative.
 */
function siteUrl(origin: string): Plugin {
  return { name: 'stellsec:site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', origin.replace(/\/+$/, '')) }
}

/**
 * Each Phosphor icon module carries six weights; `src/ui/icons.ts` draws only two (Regular at 16 px, Light from
 * 20 px). The icons are on every route's critical path, so a build keeps those two and drops the other four
 * drawings: about 90 kB less JavaScript before compression. An icon definition that does not look as expected is
 * left untouched, with a warning. If the ui kit ever needs another weight, add it to `ICON_WEIGHTS`.
 */
const ICON_WEIGHTS = new Set(['regular', 'light'])
function iconWeights(): Plugin {
  return {
    name: 'stellsec:icon-weights',
    apply: 'build',
    transform(code, id) {
      if (!/@phosphor-icons\/react\/dist\/defs\/[^/]+\.es\.js$/.test(id)) return null
      let dropped = 0
      const kept = code.replace(/\n {2}\[\n {4}"(\w+)",\n[\s\S]*?\n {2}\],?/g, (entry, weight: string) => {
        if (ICON_WEIGHTS.has(weight)) return entry
        dropped += 1
        return ''
      })
      const expected = dropped === 6 - ICON_WEIGHTS.size && [...ICON_WEIGHTS].every((weight) => kept.includes(`"${weight}"`))
      if (!expected) this.warn(`Unexpected icon definition, all weights kept: ${id}`)
      return expected ? { code: kept, map: null } : null
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Pinned at build time, also when unset, so the bundler can fold the branches written against them:
  //   VITE_ENABLE_PRO           no Margin routes and no Margin chunk in a default build;
  //   VITE_OPTIONS_CONTRACT_ID  a live build drops the mock market, a mock build drops the Soroban client;
  //   VITE_PRO_CONTRACT_ID      a live Margin build drops the 1 MB fixture file, a fixture build the live client;
  //   VITE_E2E                  only a test build carries the test wallet, its window hook and the crash route.
  const pinned = ['VITE_ENABLE_PRO', 'VITE_OPTIONS_CONTRACT_ID', 'VITE_PRO_CONTRACT_ID', 'VITE_E2E'] as const
  const define = Object.fromEntries(pinned.map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] ?? '')]))
  return {
    plugins: [react(), siteUrl(env.VITE_SITE_URL ?? ''), iconWeights()],
    define,
    css: { transformer: 'lightningcss', modules: { localsConvention: 'camelCaseOnly' } },
    build: {
      cssMinify: 'lightningcss',
      rolldownOptions: {
        // One HTML entry: every route, `/design` included, is served by index.html (see vercel.json).
        input: { main: resolve(import.meta.dirname, 'index.html') },
        // Everything under src/ except the entry folder is imported through barrels (`from '../ui'`, the ticket's
        // public index). Declaring those modules free of import-time side effects lets the bundler follow only
        // the bindings a chunk really uses: the landing page loads the handful of components it draws instead of
        // the whole kit with all of Base UI. Stylesheets are not covered by the rule, and the entry imports
        // `ui/index.css` itself. A module outside src/app must therefore never be imported for its side effect
        // alone (`import './x'`).
        treeshake: { moduleSideEffects: [{ test: /\/src\/(?!app\/).*\.tsx?$/, sideEffects: false }] },
        output: {
          codeSplitting: {
            groups: [
              // The ticket's URL mappers are used by pages that never open a ticket (the landing builds a link
              // with them). On their own they are 1 kB; left to the bundler they come with the whole ticket.
              { name: 'ticket-links', test: /\/src\/features\/ticket\/intent\.ts$/, priority: 30 },
              // Libraries every route needs, in chunks whose names change only when the library does.
              { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\//, priority: 20 },
              { name: 'tanstack', test: /node_modules\/@tanstack\//, priority: 10 },
            ],
          },
        },
      },
    },
    // src/core/payoff imports ../packages/payoff (outside the frontend root) by relative path.
    server: { fs: { allow: ['..'] } },
  }
})
