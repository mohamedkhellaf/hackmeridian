import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, switchTo, toast } from './helpers.ts'

test('writer claims delivery after a second account buys and exercises', async ({ page }) => {
  await openApp(page)
  await connect(page) // account A (default)

  // A writes a put (default form: 5 FUND at 10 USDx).
  await goTo(page, 'Write')
  await page.getByRole('button', { name: 'Write put' }).click()
  await expect(toast(page)).toContainText('Offer written')

  // B buys it and exercises (same page session: mock state is in memory).
  await switchTo(page, ADDR_B)
  await goTo(page, 'Markets')
  await page.getByRole('button', { name: /^Buy put on 5.00 FUND from GBE6…3ZEG/ }).click()
  const buy = page.getByRole('dialog', { name: 'Buy FUND put' })
  await buy.getByRole('checkbox', { name: 'I understand the terms above.' }).check()
  await buy.getByRole('button', { name: /^Buy for / }).click()
  // Purchase confirmation is the dialog's confirmed step (no "Bought" toast by design).
  await expect(buy).toContainText(/Bought\. Position \d+/)
  await buy.getByRole('button', { name: 'Done' }).click()
  await expect(buy).toBeHidden()
  await goTo(page, 'Positions')
  await page.getByRole('button', { name: 'Exercise' }).click()
  const ex = page.getByRole('dialog', { name: 'Exercise FUND put' })
  await ex.getByRole('button', { name: 'Exercise', exact: true }).click()
  await expect(toast(page)).toContainText('Exercised')

  // A claims delivery.
  await switchTo(page, null)
  await goTo(page, 'Positions')
  const row = page.getByRole('table', { name: 'Written' }).locator('tbody tr')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Exercised')
  await row.getByRole('button', { name: 'Claim delivery' }).click()
  await expect(toast(page)).toContainText('Delivery claimed')
  await expect(row).toHaveCount(0) // settled is closed
  await page.getByLabel('Show closed').check()
  await expect(row).toContainText('Settled')
  await expect(row.getByRole('button')).toHaveCount(0)
})
