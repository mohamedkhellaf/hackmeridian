import { expect, test } from '@playwright/test'
import { connect, expectOpenOffers, goTo, offerRows, openApp, toast, totalHeld } from './helpers.ts'

test('invalid input is rejected, a valid put locks collateral and can be cancelled', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await goTo(page, 'Collateral')
  const before = await totalHeld(page, 'USDx')

  await goTo(page, 'Write')
  await expect(page.getByRole('heading', { level: 1, name: 'Write' })).toBeVisible()
  const submit = page.getByRole('button', { name: 'Write put' })

  // 0.0000001 FUND at 0.5 USDx is not an exact settlement amount.
  await page.getByLabel(/^Quantity/).fill('0.0000001')
  await page.getByLabel(/^Strike per/).fill('0.5')
  await expect(page.getByText(/not an exact amount/)).toBeVisible()
  await expect(submit).toBeDisabled()

  // Valid cash-secured put: 5 FUND at 10 USDx locks 50 USDx.
  await page.getByLabel(/^Quantity/).fill('5')
  await page.getByLabel(/^Strike per/).fill('10')
  await expect(page.getByText(/not an exact amount/)).toBeHidden()
  await expect(page.getByRole('group', { name: 'Order summary' })).toContainText(/Collateral to lock\s*50\.00 USDx/)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(toast(page)).toContainText('Offer written')

  await goTo(page, 'Collateral')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before + 50)

  await goTo(page, 'Markets')
  await expectOpenOffers(page, 5)
  await expect(offerRows(page)).toHaveCount(5)
  await expect(page.getByRole('button', { name: /^Buy put on 5.00 FUND from GBE6…3ZEG/ })).toBeDisabled() // own offer

  await goTo(page, 'Positions')
  const row = page.getByRole('table', { name: 'Written' }).locator('tbody tr')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Offered')
  await row.getByRole('button', { name: 'Cancel offer' }).click()
  await expect(toast(page)).toContainText('Cancelled')
  // Cancelled positions are closed: hidden until "Show closed" is on.
  await expect(row).toHaveCount(0)
  await page.getByLabel('Show closed').check()
  await expect(row).toContainText('Cancelled')
  await expect(row.getByRole('button')).toHaveCount(0)

  await goTo(page, 'Collateral')
  await expect.poll(() => totalHeld(page, 'USDx')).toBe(before)
  await goTo(page, 'Markets')
  await expectOpenOffers(page, 4)
})
