import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, openBuyDialogForSeed, switchTo, toast } from './helpers.ts'

test('holder lists an option for sale, another account buys it, the holder changes', async ({ page }) => {
  await openApp(page)
  await connect(page)

  // Wallet A buys the seeded FUND put (position 1) so it has something to resell.
  await openBuyDialogForSeed(page)
  const buy = page.getByRole('dialog', { name: 'Buy FUND put' })
  await buy.getByRole('checkbox', { name: 'I understand the terms above.' }).check()
  await buy.getByRole('button', { name: 'Buy for 1.80 USDx' }).click()
  await expect(buy).toContainText('Bought. Position 1')
  await buy.getByRole('button', { name: 'Done' }).click()

  // Markets shows an empty Resale section.
  const resale = page.getByRole('region', { name: 'Resale' })
  await expect(resale).toContainText('No options for sale.')

  // Positions: list it for 2.50 USDx.
  await goTo(page, 'Positions')
  const resell = page.getByRole('table', { name: 'Resell' })
  await expect(resell.locator('tbody tr')).toHaveCount(1)
  await expect(resell).toContainText('Not listed')
  await resell.getByRole('button', { name: 'Sell' }).click()
  const sell = page.getByRole('dialog', { name: 'Sell FUND put' })
  await sell.getByLabel('Your price (USDx, total)').fill('2.5')
  await expect(sell.getByTestId('ask-per-unit')).toHaveText('0.50 USDx per FUND.')
  await sell.getByRole('button', { name: 'List for 2.50 USDx' }).click()
  await expect(sell).toBeHidden()
  await expect(toast(page)).toContainText('Listed for sale')
  await expect(resell).toContainText('For sale at 2.50 USDx')

  // The seller sees its own listing in Markets without a Buy button.
  await goTo(page, 'Markets')
  const rows = page.getByRole('table', { name: 'Resale' }).locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('GBE6…3ZEG')
  await expect(rows).toContainText('2.50')
  await expect(rows).toContainText('0.50')
  await expect(rows).toContainText('Yours')

  // Wallet B buys it.
  await switchTo(page, ADDR_B)
  await rows.getByRole('button', { name: 'Buy resale of option 1' }).click()
  const dialog = page.getByRole('dialog', { name: 'Buy FUND put from holder' })
  await expect(dialog).toContainText("You pay the seller, not the writer. The option's collateral stays locked in the contract.")
  await expect(dialog).toContainText('Set by the seller.')
  await expect(dialog.locator('dl div').filter({ hasText: /^Listing/ })).toHaveText(/^Listing\s*For sale$/)
  await expect(dialog).toContainText('Authorized by the FUND issuer')
  await dialog.getByRole('button', { name: 'Pay 2.50 USDx' }).click()
  await expect(dialog).toContainText('Bought from holder. You now hold position 1.')
  await expect(dialog).toContainText('(mock)')
  await dialog.getByRole('button', { name: 'View in positions' }).click()
  await expect(dialog).toBeHidden()

  // B is now the holder; A no longer is.
  const held = page.getByRole('table', { name: 'Held' }).locator('tbody tr')
  await expect(held).toHaveCount(1)
  await expect(held).toContainText('FUND')
  await expect(held).toContainText('Active')
  await expect(page.getByRole('table', { name: 'Resell' })).toContainText('Not listed')

  await switchTo(page, null)
  await goTo(page, 'Positions')
  await expect(page.getByRole('table', { name: 'Held' })).toHaveCount(0)
  await goTo(page, 'Markets')
  await expect(resale).toContainText('No options for sale.')
})
