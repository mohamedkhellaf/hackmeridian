import { expect, test } from '@playwright/test'
import { CHART_TEXT, ISSUER_TEXT, PREMIUM_TEXT, connect, expectOpenOffers, openApp, openBuyDialogForSeed, toast } from './helpers.ts'

test('buy review gates on the checkbox, then confirmed step, then exercise', async ({ page }) => {
  await openApp(page)
  await connect(page)

  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog', { name: 'Buy FUND put' })
  // Terms of the seeded PUT: 5 FUND, total strike 50 USDx (10 per FUND), premium 1.80 USDx.
  await expect(dialog).toContainText('5.00 FUND')
  await expect(dialog).toContainText(/10\.00 USDx per FUND, 50\.00 USDx total/)
  await expect(dialog).toContainText(/0\.36 USDx per FUND, 1\.80 USDx total/)
  await expect(dialog).toContainText('GMAK…BBBB')
  // Expiry row: date and time, then the countdown ("29 Oct 06:52 2d 23h").
  await expect(dialog.locator('dl div').filter({ hasText: /^Expiry/ })).toContainText(/\d{1,2} \w{3} \d{2}:\d{2} \d+d \d+h$/)
  await expect(dialog).toContainText(PREMIUM_TEXT)
  await expect(dialog).toContainText(ISSUER_TEXT)
  // Pre-trade checks resolve against the client.
  await expect(dialog.locator('dl div').filter({ hasText: /^Offer/ })).toHaveText(/^Offer\s*Open$/)
  await expect(dialog).toContainText('Authorized by the FUND issuer')

  // Payoff chart and risk lines (hypothetical, assumed price; K = 10, premium 1.80).
  const chart = dialog.locator('figure').filter({ has: page.getByTestId('payoff-chart') })
  await expect(chart.getByTestId('payoff-chart')).toBeVisible()
  await expect(chart).toContainText(CHART_TEXT)
  const assumed = dialog.getByLabel(/^Assumed price \(/)
  await expect(assumed).toHaveValue('10')
  await expect(dialog).toContainText('9.64 USDx per FUND') // break-even
  await expect(dialog.locator('dl div').filter({ hasText: /^Max loss/ })).toContainText('1.80 USDx')
  await expect(dialog.getByTestId('pnl-at-assumed')).toContainText('-1.80 USDx')
  await assumed.fill('4')
  await expect(dialog.getByTestId('pnl-at-assumed')).toContainText('+28.20 USDx')
  await expect(dialog).toContainText('P&L at 4')

  // Escape cancels without buying.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expectOpenOffers(page, 4)

  await openBuyDialogForSeed(page)
  const confirm = dialog.getByRole('button', { name: 'Buy for 1.80 USDx' })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('checkbox', { name: 'I understand the terms above.' }).check()
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // Confirmed step inside the same dialog.
  await expect(dialog).toContainText('Bought. Position 1')
  await expect(dialog).toContainText('Transaction')
  await expect(dialog).toContainText('(mock)')
  // The confirmed step replaces the success toast after a purchase (suppressed by design).
  await expect(dialog.getByRole('button', { name: 'View in positions' })).toBeVisible()
  await expect(toast(page).filter({ hasText: 'Bought' })).toHaveCount(0)
  await expectOpenOffers(page, 3)

  await dialog.getByRole('button', { name: 'View in positions' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/#\/portfolio$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Positions' })).toBeVisible()

  // The new position shows as a waiting action on the Positions link.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Positions 1' })).toBeVisible()
  const row = page.getByRole('table', { name: 'Held' }).locator('tbody tr')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('FUND')
  await expect(row).toContainText('Put')
  await expect(row).toContainText('Active')
  await row.getByRole('button', { name: 'Exercise' }).click()
  // Exercise confirmation states the physical delivery before anything is signed.
  const confirmDialog = page.getByRole('dialog', { name: 'Exercise FUND put' })
  await expect(confirmDialog).toContainText('GMAK…BBBB')
  await expect(confirmDialog).toContainText('You deliver 5.00 FUND and receive 50.00 USDx.')
  await expect(confirmDialog).toContainText('10.00 USDx per FUND')
  await expect(confirmDialog).toContainText(/Total strike\s*50\.00 USDx/)
  await expect(confirmDialog).toContainText(/Original premium \(paid to the writer\)\s*1\.80 USDx/)
  await confirmDialog.getByRole('button', { name: 'Exercise', exact: true }).click()
  await expect(confirmDialog).toBeHidden()
  await expect(toast(page)).toContainText('Exercised')
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Positions', exact: true })).toBeVisible()
  await page.getByLabel('Show closed').check()
  await expect(row).toContainText('Exercised')
  await expect(row.getByRole('button')).toHaveCount(0)
})

test('back to markets closes the confirmed step', async ({ page }) => {
  await openApp(page)
  await connect(page)
  await openBuyDialogForSeed(page)
  const dialog = page.getByRole('dialog', { name: 'Buy FUND put' })
  await dialog.getByRole('checkbox', { name: 'I understand the terms above.' }).check()
  await dialog.getByRole('button', { name: 'Buy for 1.80 USDx' }).click()
  await expect(dialog).toContainText('Bought. Position 1')
  await dialog.getByRole('button', { name: 'Back to markets' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/(#\/markets)?$/)
  await expectOpenOffers(page, 3)
  await expect(page.getByRole('button', { name: /^Buy put on 5.00 FUND from GMAK…BBBB/ })).toHaveCount(0)
})
