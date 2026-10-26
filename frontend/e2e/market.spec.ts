import { expect, test } from '@playwright/test'
import { expectOpenOffers, goTo, offerRows, openApp } from './helpers.ts'

test('market lists the seeded offers in one table', async ({ page }) => {
  await openApp(page)
  await expectOpenOffers(page, 4)
  const rows = offerRows(page)
  await expect(rows).toHaveCount(4)
  await expect(rows.filter({ hasText: 'FUND' }).filter({ hasText: 'Put' }).filter({ hasText: '10.00' })).toHaveCount(2)
  await expect(rows.filter({ hasText: 'FUND' }).filter({ hasText: 'Call' }).filter({ hasText: '12.00' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'BOND' }).filter({ hasText: 'Put' }).filter({ hasText: '98.00' })).toHaveCount(1)
})

test('two makers compete on the FUND put; the cheaper one is listed first', async ({ page }) => {
  await openApp(page)
  const fundPuts = offerRows(page).filter({ hasText: 'FUND' }).filter({ hasText: 'Put' })
  await expect(fundPuts).toHaveCount(2)
  // Same expiry and strike, so the sort falls through to premium per unit: maker B (0.36) before maker A (0.40).
  await expect(fundPuts.nth(0)).toContainText('GMAK…BBBB')
  await expect(fundPuts.nth(0)).toContainText('0.36')
  await expect(fundPuts.nth(0)).toContainText('1.80')
  await expect(fundPuts.nth(1)).toContainText('GMAK…AAAA')
  await expect(fundPuts.nth(1)).toContainText('0.40')
  await expect(fundPuts.nth(1)).toContainText('2.00')
  // Rows are sorted by expiry: both 3-day FUND puts, then the 7-day FUND call, then the 14-day BOND put.
  await expect(offerRows(page).nth(2)).toContainText('Call')
  await expect(offerRows(page).nth(3)).toContainText('BOND')
})

test('filters really filter the offers', async ({ page }) => {
  await openApp(page)
  const asset = page.getByRole('combobox', { name: 'Asset' })
  const kind = page.getByRole('radiogroup', { name: 'Kind' })
  const rows = offerRows(page)
  await expect(rows).toHaveCount(4)
  await asset.selectOption('BOND')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('BOND')
  await expect(rows).toContainText('Put')
  await asset.selectOption({ label: 'All assets' })
  await kind.getByRole('radio', { name: 'Call', exact: true }).click()
  await expect(kind.getByRole('radio', { name: 'Call', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('FUND')
  await expect(rows).toContainText('Call')
  await kind.getByRole('radio', { name: 'Put', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await kind.getByRole('radio', { name: 'Call', exact: true }).click()
  await asset.selectOption('BOND')
  await expect(page.getByText('No open offers match.')).toBeVisible()
  await expect(rows).toHaveCount(0)
  await kind.getByRole('radio', { name: 'All', exact: true }).click()
  await asset.selectOption({ label: 'All assets' })
  await expect(rows).toHaveCount(4)
  // Filters never change the count of open offers.
  await expectOpenOffers(page, 4)
})

test('buy is disabled until a wallet is connected', async ({ page }) => {
  await openApp(page)
  const buys = page.getByRole('button', { name: /^Buy / })
  await expect(buys).toHaveCount(4)
  for (const b of await buys.all()) await expect(b).toBeDisabled()
})

test('collateral card on Markets shows owed and held per token', async ({ page }) => {
  await openApp(page)
  const usdx = page.getByRole('table', { name: 'Collateral', exact: true }).getByRole('row', { name: /^USDx / })
  const cells = usdx.getByRole('cell')
  await expect(cells).toHaveCount(3)
  const [owed, held] = [await cells.nth(1).innerText(), await cells.nth(2).innerText()]
  expect(Number(owed.replace(/,/g, ''))).toBeGreaterThan(0)
  expect(held).toBe(owed)
})

test('hash routes drive the sidebar and every view renders', async ({ page }) => {
  await page.goto('/#/reserves')
  await expect(page.getByRole('heading', { level: 1, name: 'Collateral' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Collateral', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const [link, title] of [
    ['Positions', 'Positions'],
    ['Write', 'Write'],
    ['Protect', 'Protect'],
    ['Issuer', 'Issuer'],
    ['Markets', 'Markets'],
  ] as const) {
    await goTo(page, link)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${link}`) })).toHaveAttribute('aria-current', 'page')
  }
  // Unknown routes fall back to Markets.
  await page.goto('/#/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Markets' })).toBeVisible()
})
