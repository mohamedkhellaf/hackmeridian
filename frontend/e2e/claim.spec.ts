import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, switchTo, toast } from './helpers.ts'

test('writer claims delivery after a second account buys and exercises', async ({ page }) => {
  await openApp(page)
  await connect(page) // account A (default)

  // A writes a put.
  await goTo(page, 'Write')
  await page.getByRole('button', { name: 'Lock collateral & publish offer' }).click()
  await expect(toast(page)).toContainText('Offer published')

  // B buys it and exercises (same page session: mock state is in memory).
  await switchTo(page, ADDR_B)
  await goTo(page, 'Markets')
  await page.getByRole('button', { name: /^Buy put on 5 FUND from GBE6…3ZEG/ }).click()
  await page.getByRole('button', { name: 'Confirm purchase and sign transaction' }).click()
  await expect(toast(page)).toContainText('Purchase confirmed')
  await goTo(page, 'Portfolio')
  await page.getByRole('button', { name: 'Exercise' }).click()
  await expect(toast(page)).toContainText('Exercise confirmed')

  // A claims delivery.
  await switchTo(page, null)
  await goTo(page, 'Portfolio')
  const row = page.locator('tbody tr')
  await row.getByRole('button', { name: 'Claim delivery' }).click()
  await expect(toast(page)).toContainText('Claim delivery confirmed')
  await expect(row.locator('.state')).toHaveText('settled')
})
