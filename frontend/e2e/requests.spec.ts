import { expect, test } from '@playwright/test'
import { ADDR_B, connect, goTo, openApp, switchTo, toast } from './helpers.ts'

test('buyer posts a funded request, a maker fills it, both sides see the position', async ({ page }) => {
  await openApp(page)
  const requests = page.getByRole('region', { name: 'Requests' })
  await expect(requests).toContainText('No requests.')
  await connect(page)

  // Wallet A requests a FUND put: 5 FUND at 10 USDx, offering 2 USDx premium (the form defaults).
  await requests.getByRole('button', { name: 'Request an option' }).click()
  const form = page.getByRole('dialog', { name: 'Request an option' })
  await form.getByLabel('Quantity (FUND)').fill('5')
  await form.getByLabel('Strike per FUND (USDx)').fill('10')
  await form.getByLabel('Premium you offer, total (USDx)').fill('2')
  await expect(form.getByTestId('escrow-line')).toHaveText('You escrow 2.00 USDx now; refunded if you cancel or the request expires.')
  await form.getByRole('button', { name: 'Post request, escrow 2.00 USDx' }).click()
  await expect(form).toBeHidden()
  await expect(toast(page)).toContainText('Request posted')

  const rows = page.getByRole('table', { name: 'Requests' }).locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Put')
  await expect(rows).toContainText('FUND')
  await expect(rows).toContainText('10.00 / 50.00 USDx')
  await expect(rows).toContainText('0.40 / 2.00 USDx')
  await expect(rows).toContainText('(you)')
  await expect(rows.getByTestId('request-status')).toHaveText('Open')
  await expect(rows.getByRole('button', { name: 'Cancel request 0' })).toBeVisible()
  await expect(rows.getByRole('button', { name: 'Fill request 0' })).toHaveCount(0)

  // A sees it under My requests on Positions.
  await goTo(page, 'Positions')
  await expect(page.getByRole('table', { name: 'My requests' }).locator('tbody tr')).toHaveCount(1)

  // Wallet B fills it.
  await goTo(page, 'Markets')
  await switchTo(page, ADDR_B)
  await rows.getByRole('button', { name: 'Fill request 0' }).click()
  const fill = page.getByRole('dialog', { name: 'Fill FUND put request' })
  await expect(fill).toContainText('You become the writer. The collateral stays locked until exercise or expiry.')
  await expect(fill.locator('dl div').filter({ hasText: /^Collateral you lock/ })).toContainText('50.00 USDx')
  await expect(fill.locator('dl div').filter({ hasText: /^Premium you receive/ })).toContainText('2.00 USDx')
  await expect(fill.locator('dl div').filter({ hasText: /^Request/ })).toHaveText(/^Request\s*Open$/)
  await expect(fill).toContainText('Authorized by the FUND issuer')
  await fill.getByRole('button', { name: 'Lock 50.00 USDx and fill' }).click()
  await expect(fill).toContainText('Filled. You wrote this option; the buyer holds it.')
  await expect(fill).toContainText('(mock)')
  await expect(rows.getByTestId('request-status')).toHaveText('Filled')
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
