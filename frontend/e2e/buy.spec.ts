import { expect, test } from '@playwright/test'
import { connect, expectOpenOffers, openApp, openBuyDialogForSeed, toast } from './helpers.ts'

test('buy review gates on the checkbox, then confirmed step, then exercise', async ({ page }) => {
  await openApp(page)
  await connect(page)

  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('You pay now')
  await expect(dialog).toContainText('1.8 USDx')
  await expect(dialog).toContainText('50 USDx locked')
  await expect(dialog).toContainText(/Issuer controls on regulated assets \(freeze, clawback\) can block settlement/)
  await expect(dialog).toContainText(/not refunded/)
  // Pre-trade checks resolve against the client.
  await expect(dialog).toContainText('Offer is still open')
  await expect(dialog).toContainText('authorized by the FUND issuer')
  await expect(dialog).toContainText('Collateral is fully locked in the contract')

  // Escape cancels without buying.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expectOpenOffers(page, 4)

  await openBuyDialogForSeed(page)
  const confirm = dialog.getByRole('button', { name: /Confirm in wallet/ })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('checkbox', { name: /I understand/ }).check()
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // Confirmed step inside the same dialog.
  await expect(dialog).toContainText('You hold a FUND put')
  await expect(dialog).toContainText('(mock)')
  await expect(dialog).toContainText('Premium paid')
  await expect(toast(page)).toContainText('Purchase confirmed')
  await expectOpenOffers(page, 3)

  await dialog.getByRole('button', { name: 'View in portfolio' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/#\/portfolio$/)

  // The new position shows as a waiting action on the Portfolio link.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Portfolio 1' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'GMAK…BBBB' })
  await expect(row.locator('.state')).toHaveText('active')
  await row.getByRole('button', { name: 'Exercise' }).click()
  await expect(toast(page)).toContainText('Exercise confirmed')
  await expect(row.locator('.state')).toHaveText('exercised')
})

test('back to markets closes the confirmed step', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: /I understand/ }).check()
  await dialog.getByRole('button', { name: /Confirm in wallet/ }).click()
  await expect(dialog).toContainText('You hold a FUND put')
  await dialog.getByRole('button', { name: 'Back to markets' }).click()
  await expect(dialog).toBeHidden()
  await expectOpenOffers(page, 3)
})
