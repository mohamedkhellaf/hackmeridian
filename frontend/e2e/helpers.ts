import { expect, type Page } from '@playwright/test'

// Addresses of the test wallet (src/wallet/useFreighter.ts, VITE_E2E=1). A is the default.
export const ADDR_B = 'GBPHYE7XMH6GWDVWVTB3V2N55I6GRFAEK6BPWVOH2RGKX3PMNA2VIEEM'

// Required disclosures (frontend/STYLE.md section 5). Each must appear exactly once, where the table says.
export const DEMO_TEXT = 'Stellar Testnet. Fictional assets and makers. No real funds.'
export const MOCK_TEXT = 'Mock data, not read from a chain.'
export const ISSUER_TEXT = 'The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.'
export const PREMIUM_TEXT = 'Paid to the maker now. Not refundable.'
export const CHART_TEXT = 'Hypothetical payoff at expiry. Not a quote.'

export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('table', { name: 'Offers' })).toBeVisible()
}

export async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Wallet menu' })).toBeVisible()
}

// Disconnect lives in the wallet menu (the wallet pill in the top bar opens it).
export async function disconnect(page: Page) {
  await page.getByRole('button', { name: 'Wallet menu' }).click()
  await page.getByRole('dialog', { name: 'Wallet' }).getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
}

// The mock state lives in memory, so switching identity must not reload the page: the test wallet
// reads `?as=` at connect time, so we rewrite the URL (keeping the hash route) and reconnect.
export async function switchTo(page: Page, address: string | null) {
  await disconnect(page)
  await page.evaluate((a) => history.replaceState(null, '', (a ? `/?as=${a}` : '/') + window.location.hash), address)
  await connect(page)
}

export type NavName = 'Markets' | 'Positions' | 'Locked reserves' | 'Issuer'

// Nav label -> hash route. Labels changed in the fix round; routes did not.
export const ROUTE_OF: Record<NavName, string> = {
  Markets: 'markets',
  Positions: 'portfolio',
  'Locked reserves': 'reserves',
  Issuer: 'issuer',
}

// Markets: pick a series in the chain, then open its Buy or Sell dialog on a tab.
export async function openTrade(page: Page, series: RegExp, side: 'Buy' | 'Sell', tab?: string) {
  await page.getByRole('button', { name: series }).first().click()
  await page.getByRole('region', { name: 'Book' }).getByRole('button', { name: side, exact: true }).click()
  if (tab) await page.getByRole('radio', { name: tab }).click()
}

// Top bar navigation (hash routes: #/markets, #/write, #/portfolio, #/reserves, #/issuer).
// The Positions link may carry a count ("Positions 1"), so the name is matched as a prefix.
export async function goTo(page: Page, name: NavName) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${name}`) }).click()
  await expect(page).toHaveURL(new RegExp(`#/${ROUTE_OF[name]}$`))
}

// The open-offer count in the Markets header ("4 open offers").
export async function expectOpenOffers(page: Page, n: number) {
  await expect(page.getByRole('group', { name: 'Open offers' })).toHaveText(new RegExp(`^${n} open offers?$`))
}

// Transaction toast (role=status on success).
export const toast = (page: Page) => page.getByRole('status')

// Body rows of the Markets offers table.
export const offerRows = (page: Page) => page.getByRole('table', { name: 'Offers' }).locator('tbody tr')

// "Owed" figure of a token on the Collateral page (= total collateral locked), as a number.
export async function totalHeld(page: Page, code: string): Promise<number> {
  const row = page.getByRole('table', { name: 'Locked reserves by token' }).getByRole('row', { name: new RegExp(`^${code} `) })
  const text = (await row.getByTestId('owed').innerText()).replace(/,/g, '')
  return Number(text)
}

// How many times `s` occurs in the visible text of the whole document (dialogs are portalled into body).
export async function countVisible(page: Page, s: string): Promise<number> {
  const text = await page.locator('body').innerText()
  return text.split(s).length - 1
}

export async function openBuyDialogForSeed(page: Page) {
  // Seeded cheapest FUND put (maker B, 1.80 USDx for 5.00 FUND).
  await page.getByRole('button', { name: /^Buy put on 5.00 FUND from GMAK…BBBB/ }).click()
  await expect(page.getByRole('dialog', { name: 'Buy FUND put' })).toBeVisible()
}
