import { expect, test } from '@playwright/test'
import { openApp } from './helpers.ts'

test('market lists the seeded series', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('button', { name: /^Market \(4\)/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /PUT FUND · strike 10 USDx/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /CALL FUND · strike 12 USDx/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /PUT BOND · strike 98 USDx/ })).toBeVisible()
})

test('best-price badge only on the series with several offers', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Best price')).toHaveCount(1)
  // The cheaper 5 FUND put (maker B, 0.36/unit) carries it.
  await expect(page.getByRole('row').filter({ hasText: 'GMAK…BBBB' }).filter({ hasText: '5 FUND' })).toContainText('Best price')
})

test('buy is disabled until a wallet is connected', async ({ page }) => {
  await openApp(page)
  const buys = page.getByRole('button', { name: /^Buy / })
  await expect(buys).toHaveCount(4)
  for (const b of await buys.all()) await expect(b).toBeDisabled()
})
