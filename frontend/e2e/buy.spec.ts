import { expect, test } from '@playwright/test'
import { connect, expectOpenOffers, goTo, openApp, openBuyDialogForSeed, toast } from './helpers.ts'

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
  await expectOpenOffers(page, 4)

  await openBuyDialogForSeed(page)
  await page.getByRole('button', { name: 'Confirm purchase and sign transaction' }).click()
  await expect(toast(page)).toContainText('Purchase confirmed')
  await expect(toast(page)).toContainText('(mock)')
  await expectOpenOffers(page, 3)

  // The new position shows as a waiting action on the Portfolio link.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Portfolio 1' })).toBeVisible()
  await goTo(page, 'Portfolio')
  const row = page.getByRole('row').filter({ hasText: 'GMAK…BBBB' })
  await expect(row.locator('.state')).toHaveText('active')
  await row.getByRole('button', { name: 'Exercise' }).click()
  await expect(toast(page)).toContainText('Exercise confirmed')
  await expect(row.locator('.state')).toHaveText('exercised')
})
