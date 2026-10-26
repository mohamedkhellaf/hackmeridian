import { expect, test, type Page } from '@playwright/test'
import { expectOpenOffers, goTo, offerRows, openApp } from './helpers.ts'

const chain = (page: Page) => page.getByRole('table', { name: 'Option chain' })
const chainRows = (page: Page) => chain(page).locator('tbody tr')

test('a loading skeleton precedes the data and no count or empty state shows meanwhile', async ({ page }) => {
  await page.goto('/')
  const loading = page.getByRole('status', { name: 'Loading Markets' })
  await expect(loading).toBeVisible()
  await expect(loading.getByText(/open offers?/)).toHaveCount(0)
  await expect(page.getByRole('table', { name: 'Offers' })).toBeVisible()
  await expect(loading).toHaveCount(0)
})

test('chain shows strikes with the best premium and maker count per side', async ({ page }) => {
  await openApp(page)
  await expectOpenOffers(page, 4)
  // Opens on FUND, first expiry: one strike, a put quoted by two makers (best 0.36), no call.
  await expect(chainRows(page)).toHaveCount(1)
  const row = chainRows(page).first()
  await expect(row.getByRole('cell').nth(1)).toHaveText('10.00')
  await expect(row.getByRole('cell').nth(0)).toHaveText('—')
  await expect(row.getByRole('button', { name: /^Put at 10\.00/ })).toContainText(/0\.36\s*\(2\)/)
  // The list under the chain is that series, best first.
  await expect(page.getByRole('heading', { name: 'FUND 10.00 put' })).toBeVisible()
  await expect(offerRows(page)).toHaveCount(2)
  await expect(offerRows(page).nth(0)).toContainText('GMAK…BBBB')
  await expect(offerRows(page).nth(0)).toContainText('0.36')
  await expect(offerRows(page).nth(0)).toContainText('1.80')
  await expect(offerRows(page).nth(1)).toContainText('GMAK…AAAA')
  await expect(offerRows(page).nth(1)).toContainText('0.40')
  await expect(offerRows(page).nth(1)).toContainText('2.00')
})

test('expiry and asset controls rebuild the chain from real offers', async ({ page }) => {
  await openApp(page)
  const expiry = page.getByRole('radiogroup', { name: 'Expiry' })
  await expect(expiry.getByRole('radio')).toHaveCount(2)
  await expiry.getByRole('radio').nth(1).click()
  await expect(expiry.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
  await expect(chainRows(page)).toHaveCount(1)
  await expect(chainRows(page).first().getByRole('cell').nth(1)).toHaveText('12.00')
  await expect(chainRows(page).first().getByRole('cell').nth(2)).toHaveText('—')
  await expect(page.getByRole('button', { name: /^Call at 12\.00/ })).toContainText(/0\.50\s*\(1\)/)
  await expect(offerRows(page)).toHaveCount(1)
  await expect(offerRows(page)).toContainText('GMAK…AAAA')

  await page.getByRole('combobox', { name: 'Asset' }).selectOption('BOND')
  await expect(expiry.getByRole('radio')).toHaveCount(1)
  await expect(chainRows(page).first().getByRole('cell').nth(1)).toHaveText('98.00')
  await expect(page.getByRole('heading', { name: 'BOND 98.00 put' })).toBeVisible()
  await expect(offerRows(page)).toHaveCount(1)
  // The count of open offers never depends on the view.
  await expectOpenOffers(page, 4)
})

test('picking a price shows every maker for that series', async ({ page }) => {
  await openApp(page)
  const expiry = page.getByRole('radiogroup', { name: 'Expiry' })
  await expiry.getByRole('radio').nth(1).click()
  await expect(page.getByRole('heading', { name: 'FUND 12.00 call' })).toBeVisible()
  await expiry.getByRole('radio').nth(0).click()
  await page.getByRole('button', { name: /^Put at 10\.00/ }).click()
  await expect(page.getByRole('button', { name: /^Put at 10\.00/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(offerRows(page)).toHaveCount(2)
})

test('the ticket starts empty; without a wallet it shows terms and Connect wallet', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Select a price in the chain.')).toBeVisible()
  await page.getByRole('button', { name: /^Buy put on 5.00 FUND from GMAK…BBBB/ }).click()
  const ticket = page.getByRole('dialog', { name: 'Buy FUND put' })
  await expect(ticket).toContainText('5.00 FUND')
  await expect(ticket).toContainText('At exercise you deliver 5.00 FUND and receive 50.00 USDx.')
  await expect(ticket.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
  await expect(ticket.getByRole('button', { name: /^Buy for/ })).toHaveCount(0)
  // Connecting from the ticket opens the live ticket for the same offer.
  await ticket.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Wallet menu' })).toBeVisible()
  await expect(ticket.getByRole('button', { name: 'Buy for 1.80 USDx' })).toBeDisabled()
})

test('hash routes drive the sidebar and every view renders', async ({ page }) => {
  await page.goto('/#/reserves')
  await expect(page.getByRole('heading', { level: 1, name: 'Collateral' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Collateral', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const [link, title] of [
    ['Positions', 'Positions'],
    ['Issuer', 'Issuer'],
    ['Markets', 'Markets'],
  ] as const) {
    await goTo(page, link)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${link}`) })).toHaveAttribute('aria-current', 'page')
  }
  // Unknown routes fall back to Markets.
  await page.goto('/#/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Markets' })).toBeVisible()
})
