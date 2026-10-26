import { expect, test } from '@playwright/test'
import { connect, goTo, openApp } from './helpers.ts'

test('protect: pick asset, name a floor, buy a matching put in the buy dialog', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await goTo(page, 'Protect')
  await expect(page.getByRole('heading', { name: 'Protect', level: 1 })).toBeVisible()

  await page.getByRole('combobox', { name: 'Asset' }).selectOption({ label: 'FUND' })
  // Every funded FUND put is listed before a floor is typed (two in the seed); the floor only filters.
  const rows = page.getByRole('table', { name: 'Matching puts' }).getByTestId('protect-match')
  await expect(rows).toHaveCount(2)
  await page.getByLabel('Quantity of FUND').fill('50')
  await page.getByLabel(/^Floor price in/).fill('10')

  // Two seeded FUND puts at strike 10; the 1.80 USDx one (0.36 per unit) is listed first.
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('0.36')
  await expect(rows.first()).toContainText('1.80')
  await expect(rows.first()).toContainText('GMAK…BBBB')

  // Too high a floor: honest empty state, no fake offers.
  await page.getByLabel(/^Floor price in/).fill('12')
  await expect(page.getByText('No funded put matches.')).toBeVisible()
  await expect(rows).toHaveCount(0)
  await page.getByLabel(/^Floor price in/).fill('10')
  await expect(rows).toHaveCount(2)

  // Expiry window: both puts expire in 3 days, so a 2-day window has none.
  await page.getByLabel('Expires within days').fill('2')
  await expect(page.getByText('No funded put matches.')).toBeVisible()
  await page.getByLabel('Expires within days').fill('')
  await expect(rows).toHaveCount(2)

  // The row action reuses the existing BuyDialog.
  await rows.first().getByRole('button', { name: 'Buy put on 5.00 FUND from GMAK…BBBB' }).click()
  const dialog = page.getByRole('dialog', { name: 'Buy FUND put' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Buy for 1.80 USDx' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
