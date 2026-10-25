import { expect, test } from '@playwright/test'
import { connect, goTo, openApp, totalHeld } from './helpers.ts'

test('invalid input is rejected, a valid put locks collateral and can be cancelled', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await goTo(page, 'Write')

  const submit = page.getByRole('button', { name: 'Lock collateral & publish offer' })
  const before = await totalHeld(page, 'USDx')

  // 0.0000001 FUND at 0.5 USDx is not an exact settlement amount.
  await page.getByLabel(/^Quantity/).fill('0.0000001')
  await page.getByLabel(/^Strike per/).fill('0.5')
  await expect(page.getByText(/not an exact amount/)).toBeVisible()
  await expect(submit).toBeDisabled()

  // Valid cash-secured put: 5 FUND at 10 USDx locks 50 USDx.
  await page.getByLabel(/^Quantity/).fill('5')
  await page.getByLabel(/^Strike per/).fill('10')
  await expect(page.getByText(/not an exact amount/)).toBeHidden()
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.locator('.banner.ok')).toContainText('Offer published')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before + 50)

  await expect(page.getByRole('button', { name: /^Market \(5\)/ })).toBeVisible()
  await goTo(page, 'Market')
  await expect(page.getByRole('button', { name: /^Buy put on 5 FUND from GBE6…3ZEG/ })).toBeDisabled() // own offer

  await goTo(page, 'My positions')
  const row = page.locator('tbody tr')
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.banner.ok')).toContainText('Cancel confirmed')
  await expect(row.locator('.state')).toHaveText('cancelled')

  await goTo(page, 'Write')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before)
})
