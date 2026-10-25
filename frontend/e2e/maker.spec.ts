import { expect, test } from '@playwright/test'
import { connect, expectOpenOffers, goTo, openApp, toast, totalHeld } from './helpers.ts'

test('invalid input is rejected, a valid put locks collateral and can be cancelled', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await goTo(page, 'Reserves')
  const before = await totalHeld(page, 'USDx')

  await goTo(page, 'Write')
  const submit = page.getByRole('button', { name: 'Lock collateral & publish offer' })

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
  await expect(toast(page)).toContainText('Offer published')

  await goTo(page, 'Reserves')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before + 50)

  await goTo(page, 'Markets')
  await expectOpenOffers(page, 5)
  await expect(page.getByRole('button', { name: /^Buy put on 5 FUND from GBE6…3ZEG/ })).toBeDisabled() // own offer

  await goTo(page, 'Portfolio')
  const row = page.locator('tbody tr')
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(toast(page)).toContainText('Cancel confirmed')
  await expect(row.locator('.state')).toHaveText('cancelled')

  await goTo(page, 'Reserves')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before)
})
