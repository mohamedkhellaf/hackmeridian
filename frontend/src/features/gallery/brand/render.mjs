/**
 * Writes the PNG brand files in `public/` from `brand.html`, with Playwright.
 *
 *   node src/features/gallery/brand/render.mjs [devServerUrl]
 *
 * Run it from `frontend/` with the Vite dev server up (default http://localhost:5173). The page draws with the
 * real components and tokens; this script only takes the pictures. `favicon.svg` is hand-written and not
 * produced here.
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '../../../..')
const require = createRequire(resolve(frontend, 'package.json'))
const { chromium } = require('playwright')

const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const page_url = `${base}/src/features/gallery/brand/brand.html`
const out = resolve(frontend, 'public')

/** [file, query, pixel size, transparent ground] */
const ICONS = [
  ['favicon.png', 'asset=icon&ground=none', 32, true],
  ['apple-touch-icon.png', 'asset=icon&ground=paper', 180, false],
  ['icon-192.png', 'asset=icon&ground=paper', 192, false],
  ['icon-512.png', 'asset=icon&ground=paper', 512, false],
]

const browser = await chromium.launch()
try {
  for (const [file, query, size, transparent] of ICONS) {
    // The canvas is 512 px; the device scale factor brings it to the target size without resampling a bitmap.
    const context = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512, colorScheme: 'light' })
    const page = await context.newPage()
    await page.goto(`${page_url}?${query}`, { waitUntil: 'networkidle' })
    await page.locator('[data-brand-asset="icon"]').screenshot({ path: resolve(out, file), omitBackground: transparent })
    await context.close()
    console.log(`wrote public/${file} (${size} px)`)
  }

  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const page = await context.newPage()
  await page.goto(`${page_url}?asset=og`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('[data-brand-asset="og"]').screenshot({ path: resolve(out, 'og-card.png') })
  await context.close()
  console.log('wrote public/og-card.png (1200 by 630)')
} finally {
  await browser.close()
}
