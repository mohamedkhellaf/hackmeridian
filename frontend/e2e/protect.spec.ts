import { expect, test } from '@playwright/test'
import { connect, goTo, openApp } from './helpers.ts'

test('protect: pick asset, name a floor, review the best matching put in the buy dialog', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await goTo(page, 'Protect')
  await expect(page.getByRole('heading', { name: 'Protect', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: /FUND/ }).click()
  await page.getByLabel('Quantity of FUND').fill('50')
  await page.getByLabel(/^Floor price in/).fill('10')
  await expect(page.getByText(/Protect 50.00 FUND below 10.00 USDx/)).toBeVisible()

  // Two seeded FUND puts at strike 10; the 1.80 USDx one is cheapest per unit and highlighted.
  const rows = page.getByTestId('protect-match')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('best premium')
  await expect(rows.first()).toContainText('0.36')
  await expect(rows.first()).toContainText('Covers 5.00 of your 50.00 FUND')

  // Too high a floor: honest empty state, no fake offers.
  await page.getByLabel(/^Floor price in/).fill('12')
  await expect(page.getByText('No funded put matches these filters.')).toBeVisible()
  await expect(rows).toHaveCount(0)
  await page.getByLabel(/^Floor price in/).fill('10')

  // Step 03 reuses the existing BuyDialog.
  await page.getByRole('button', { name: 'Review and buy' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('You pay now')
  await expect(dialog).toContainText('1.80 USDx')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
