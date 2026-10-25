import { expect, test } from '@playwright/test'
import { expectOpenOffers, goTo, openApp } from './helpers.ts'

test('market lists the seeded series', async ({ page }) => {
  await openApp(page)
  await expectOpenOffers(page, 4)
  await expect(page.getByRole('heading', { name: /FUND PUT Strike 10.00 USDx/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /FUND CALL Strike 12.00 USDx/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /BOND PUT Strike 98.00 USDx/ })).toBeVisible()
})

test('best-price badge only on the series with several offers', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Best price')).toHaveCount(1)
  // The cheaper 5 FUND put (maker B, 0.36/unit) carries it.
  await expect(page.getByRole('row').filter({ hasText: 'GMAK…BBBB' }).filter({ hasText: '5.00 FUND' })).toContainText('Best price')
})

test('series cards show makers competing and the countdown', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('2 makers competing')).toBeVisible()
  await expect(page.getByText(/in \d+d \d+h/).first()).toBeVisible()
})

test('filters really filter the series', async ({ page }) => {
  await openApp(page)
  const filters = page.getByRole('group', { name: 'Filters' })
  const headings = page.getByRole('heading', { name: /Strike/ })
  await expect(headings).toHaveCount(3)
  await filters.getByRole('button', { name: 'BOND' }).click()
  await expect(headings).toHaveCount(1)
  await expect(page.getByRole('heading', { name: /BOND PUT/ })).toBeVisible()
  await filters.getByRole('button', { name: 'All assets' }).click()
  await filters.getByRole('button', { name: 'Calls', exact: true }).click()
  await expect(headings).toHaveCount(1)
  await expect(page.getByRole('heading', { name: /FUND CALL/ })).toBeVisible()
  await filters.getByRole('button', { name: 'BOND' }).click()
  await expect(page.getByText('No open offers match.')).toBeVisible()
  await filters.getByRole('button', { name: 'Puts & calls' }).click()
  await filters.getByRole('button', { name: 'All assets' }).click()
  await expect(headings).toHaveCount(3)
})

test('buy is disabled until a wallet is connected', async ({ page }) => {
  await openApp(page)
  const buys = page.getByRole('button', { name: /^Buy / })
  await expect(buys).toHaveCount(4)
  for (const b of await buys.all()) await expect(b).toBeDisabled()
})

test('hash routes drive the sidebar and every view renders', async ({ page }) => {
  await page.goto('/#/reserves')
  await expect(page.getByRole('heading', { level: 1, name: 'Reserves' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Reserves' })).toHaveAttribute('aria-current', 'page')
  for (const [link, title] of [
    ['Portfolio', 'Portfolio'],
    ['Write', 'Write an option'],
    ['Issuer', 'Issuer console'],
    ['Markets', 'Markets'],
  ] as const) {
    await goTo(page, link)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  }
  // Unknown routes fall back to Markets.
  await page.goto('/#/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Markets' })).toBeVisible()
})
