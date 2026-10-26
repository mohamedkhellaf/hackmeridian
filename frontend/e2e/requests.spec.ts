import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, openTrade, switchTo, toast } from './helpers.ts'

test('buyer posts a funded bid, a maker fills it, both sides see the position', async ({ page }) => {
  await openApp(page)
  const book = page.getByRole('region', { name: 'Book' })
  await page.getByRole('button', { name: /^Put at 10\.00/ }).first().click()
  await expect(book).toContainText('No bids yet')
  await connect(page)

  // Wallet A posts a bid on the FUND 10.00 put series: 5 FUND at 10 USDx, offering 2 USDx premium.
  await openTrade(page, /^Put at 10\.00/, 'Buy', 'Post a bid at my price')
  const form = page.getByRole('dialog', { name: 'Buy FUND 10.00 put' })
  await form.getByLabel('Quantity (FUND)').fill('5')
  await form.getByLabel('Strike per FUND (USDx)').fill('10')
  await form.getByLabel('Premium you offer, total (USDx)').fill('2')
  await expect(form.getByTestId('escrow-line')).toHaveText('You escrow 2.00 USDx now; refunded if you cancel or it expires.')
  await form.getByRole('button', { name: 'Post bid, escrow 2.00 USDx' }).click()
  await expect(form).toBeHidden()
  await expect(toast(page)).toContainText('Request posted')

  const rows = page.getByRole('table', { name: 'Bids' }).locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('10.00')
  await expect(rows).toContainText('0.40')
  await expect(rows).toContainText('2.00 USDx')
  await expect(rows).toContainText('(you)')
  await expect(rows.getByRole('button', { name: 'Cancel request 0' })).toBeVisible()
  await expect(rows.getByRole('button', { name: 'Sell to bid 0' })).toHaveCount(0)

  // A sees it under My requests on Positions.
  await goTo(page, 'Positions')
  await expect(page.getByRole('table', { name: 'My requests' }).locator('tbody tr')).toHaveCount(1)

  // Wallet B fills it from the bid row.
  await goTo(page, 'Markets')
  await switchTo(page, ADDR_B)
  await page.getByRole('button', { name: /^Put at 10\.00/ }).first().click()
  await rows.getByRole('button', { name: 'Sell to bid 0' }).click()
  const fill = page.getByRole('dialog', { name: 'Fill FUND put request' })
  await expect(fill.getByTestId('fill-line')).toHaveText('You lock 50.00 USDx and receive 2.00 USDx now.')
  await expect(fill).toContainText('You become the writer. The collateral stays locked until exercise or expiry.')
  await expect(fill.locator('dl div').filter({ hasText: /^Collateral you lock/ })).toContainText('50.00 USDx')
  await expect(fill.locator('dl div').filter({ hasText: /^Premium you receive/ })).toContainText('2.00 USDx')
  await expect(fill.locator('dl div').filter({ hasText: /^Request/ })).toHaveText(/^Request\s*Open$/)
  await expect(fill).toContainText('Authorized by the FUND issuer')
  await fill.getByRole('button', { name: 'Lock 50.00 USDx and fill' }).click()
  await expect(fill).toContainText('Filled. You wrote this option; the buyer holds it.')
  await expect(fill).toContainText('(mock)')
  await expect(book).toContainText('No bids yet')
  await fill.getByRole('button', { name: 'View in positions' }).click()
  await expect(fill).toBeHidden()

  // B wrote it.
  const written = page.getByRole('table', { name: 'Written' }).locator('tbody tr')
  await expect(written).toHaveCount(1)
  await expect(written).toContainText('FUND')
  await expect(written).toContainText('Active')

  // A holds it as an Active position; the request is no longer listed under My requests.
  await switchTo(page, null)
  await goTo(page, 'Positions')
  const held = page.getByRole('table', { name: 'Held' }).locator('tbody tr')
  await expect(held).toHaveCount(1)
  await expect(held).toContainText('FUND')
  await expect(held).toContainText('Active')
  await expect(page.getByRole('table', { name: 'My requests' })).toHaveCount(0)
})
