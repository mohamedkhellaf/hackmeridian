import { expect, test } from '@playwright/test'
import { connect, goTo, openApp, openBuyDialogForSeed } from './helpers.ts'

test('buy, then exercise', async ({ page }) => {
  await openApp(page)
  await connect(page)

  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('You pay')
  await expect(dialog).toContainText('1.8 USDx')
  await expect(dialog).toContainText('50 USDx locked in the contract')
  await expect(dialog).toContainText(/Issuer controls on regulated assets \(freeze, clawback\) can block settlement/)

  // Escape cancels without buying.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: /^Market \(4\)/ })).toBeVisible()

  await openBuyDialogForSeed(page)
  await page.getByRole('button', { name: 'Confirm purchase and sign transaction' }).click()
  await expect(page.locator('.banner.ok')).toContainText('Purchase confirmed')
  await expect(page.getByRole('button', { name: /^Market \(3\)/ })).toBeVisible()

  await goTo(page, 'My positions')
  const row = page.getByRole('row').filter({ hasText: 'GMAK…BBBB' })
  await expect(row.locator('.state')).toHaveText('active')
  await row.getByRole('button', { name: 'Exercise' }).click()
  await expect(page.locator('.banner.ok')).toContainText('Exercise confirmed')
  await expect(row.locator('.state')).toHaveText('exercised')
})
