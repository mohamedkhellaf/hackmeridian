import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, switchTo, toast } from './helpers.ts'

test('writer claims delivery after a second account buys and exercises', async ({ page }) => {
  await openApp(page)
  await connect(page) // account A (default)

  // A writes a put.
  await goTo(page, 'Write')
  await page.getByRole('button', { name: /^Lock .+ and publish$/ }).click()
  await expect(toast(page)).toContainText('Offer published')

  // B buys it and exercises (same page session: mock state is in memory).
  await switchTo(page, ADDR_B)
  await goTo(page, 'Markets')
  await page.getByRole('button', { name: /^Buy put on 5.00 FUND from GBE6…3ZEG/ }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: /I understand/ }).check()
  await page.getByRole('dialog').getByRole('button', { name: /Confirm in wallet/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Back to markets' }).click()
  await expect(toast(page)).toContainText('Purchase confirmed')
  await goTo(page, 'Portfolio')
  await page.getByRole('button', { name: 'Exercise' }).click()
  await expect(toast(page)).toContainText('Exercise confirmed')

  // A claims delivery.
  await switchTo(page, null)
  await goTo(page, 'Portfolio')
  const row = page.locator('tbody tr')
  await expect(row).toContainText('Awaiting your claim')
  await row.getByRole('button', { name: 'Claim 5.00 FUND' }).click()
  await expect(toast(page)).toContainText('Claim delivery confirmed')
  await expect(row).toHaveCount(0) // settled is closed
  await page.getByLabel('Show closed').check()
  await expect(row).toContainText('Settled')
})
