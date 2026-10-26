import { expect, test } from '@playwright/test'
import { CHART_TEXT, DEMO_TEXT, ISSUER_TEXT, MOCK_TEXT, PREMIUM_TEXT, connect, countVisible, goTo, openApp, openBuyDialogForSeed } from './helpers.ts'
import type { NavName } from './helpers.ts'

const ROUTES: NavName[] = ['Markets', 'Protect', 'Write', 'Positions', 'Collateral', 'Issuer']

// Old disclaimers that the de-slop pass removed; none may come back anywhere.
const RETIRED = [
  'Demo environment on Stellar Testnet',
  'Mock data: no contract connected',
  'Mock mode — no contract',
  'Issuer controls',
  'not a guarantee against issuer action',
  'not refunded',
  'not a market price',
]

test('footer carries the demo and mock notices once on every route; dialog-only disclosures stay out of pages', async ({ page }) => {
  await openApp(page)
  await connect(page)
  for (const name of ROUTES) {
    await goTo(page, name)
    const footer = page.getByRole('contentinfo')
    await expect(footer).toContainText(DEMO_TEXT)
    await expect(footer).toContainText(MOCK_TEXT)
    expect(await countVisible(page, DEMO_TEXT), `${name}: demo notice`).toBe(1)
    expect(await countVisible(page, MOCK_TEXT), `${name}: mock notice`).toBe(1)
    // Issuer, premium and chart disclosures live only in the Buy dialog.
    const main = page.getByRole('main')
    await expect(main, `${name}: issuer line`).not.toContainText(/can freeze|claw it back/)
    await expect(main, `${name}: premium note`).not.toContainText(/Not refundable/i)
    await expect(main, `${name}: chart caption`).not.toContainText(/Hypothetical/i)
    for (const old of RETIRED) await expect(page.locator('body'), `${name}: ${old}`).not.toContainText(old)
  }
})

test('the open Buy dialog states the issuer, premium and chart disclosures exactly once', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog', { name: 'Buy FUND put' })
  await expect(dialog).toContainText(ISSUER_TEXT)
  await expect(dialog).toContainText(PREMIUM_TEXT)
  await expect(dialog.locator('figure figcaption')).toHaveText(CHART_TEXT)
  // The premium note sits in the premium row.
  await expect(dialog.locator('dl div').filter({ hasText: /^Premium/ })).toContainText(PREMIUM_TEXT)
  for (const s of [ISSUER_TEXT, PREMIUM_TEXT, CHART_TEXT, DEMO_TEXT, MOCK_TEXT]) expect(await countVisible(page, s), s).toBe(1)
  // Behind the dialog, the Markets page itself carries none of them.
  await expect(page.getByRole('main')).not.toContainText(/can freeze|claw it back|Not refundable|Hypothetical/)
  for (const old of RETIRED) await expect(page.locator('body')).not.toContainText(old)
})

test('collateral page is honest about mock data and shows owed vs held', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Collateral')
  await expect(page.getByRole('heading', { level: 1, name: 'Collateral' })).toBeVisible()
  // Mock-data honesty lives in the footer only (said once), not repeated in the page.
  await expect(page.getByRole('contentinfo')).toContainText(MOCK_TEXT)
  expect(await countVisible(page, MOCK_TEXT)).toBe(1)
  await expect(page.getByRole('main')).not.toContainText('Mock data')
  const table = page.getByRole('table', { name: 'Collateral by token' })
  await expect(table.getByRole('columnheader')).toHaveText(['Token', 'Owed', 'Held', 'Difference'])
  const cells = table.getByRole('row', { name: /^USDx / }).getByRole('cell')
  const [owed, held, diff] = [await cells.nth(1).innerText(), await cells.nth(2).innerText(), await cells.nth(3).innerText()]
  expect(Number(owed.replace(/,/g, ''))).toBeGreaterThan(0)
  expect(held).toBe(owed)
  expect(Number(diff.replace(/,/g, ''))).toBe(0)
  await expect(table).not.toContainText('Short')
  await expect(page.getByRole('alert')).toHaveCount(0) // no clawback shortfall in the seed
})

test('issuer console asks to connect the issuer account', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Issuer')
  await expect(page.getByText(/Connect the asset issuer's account/)).toBeVisible()
  // In mock mode the console says plainly that issuer actions need a real Testnet contract.
  await expect(page.getByRole('main')).toContainText('Issuer actions need a Testnet contract.')
  await expect(page.getByRole('contentinfo')).toContainText(DEMO_TEXT)
})
