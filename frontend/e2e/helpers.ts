import { expect, type Page } from '@playwright/test'

// Addresses of the test wallet (src/wallet/useFreighter.ts, VITE_E2E=1). A is the default.
export const ADDR_B = 'GBPHYE7XMH6GWDVWVTB3V2N55I6GRFAEK6BPWVOH2RGKX3PMNA2VIEEM'

export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /FUND/ }).first()).toBeVisible()
}

export async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible()
}

// The mock state lives in memory, so switching identity must not reload the page: the test wallet
// reads `?as=` at connect time, so we rewrite the URL (keeping the hash route) and reconnect.
export async function switchTo(page: Page, address: string | null) {
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await page.evaluate((a) => history.replaceState(null, '', (a ? `/?as=${a}` : '/') + window.location.hash), address)
  await connect(page)
}

// Sidebar navigation (hash routes: #/markets, #/write, #/portfolio, #/reserves, #/issuer).
export async function goTo(page: Page, name: 'Markets' | 'Write' | 'Portfolio' | 'Reserves' | 'Issuer') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: new RegExp(`^${name}`) }).click()
  await expect(page).toHaveURL(new RegExp(`#/${name.toLowerCase()}$`))
}

// The "Open offers" KPI on the Markets page.
export async function expectOpenOffers(page: Page, n: number) {
  await expect(page.getByRole('group', { name: 'Open offers' })).toHaveText(new RegExp(`${n}$`))
}

// Transaction toast (role=status on success).
export const toast = (page: Page) => page.getByRole('status')

// "Owed" figure of a token card on the Reserves page (= total collateral locked), as a number.
export async function totalHeld(page: Page, code: string): Promise<number> {
  const text = (await page.getByRole('region', { name: `${code} reserves` }).getByTestId('owed').innerText()).replace(/,/g, '')
  return Number(text)
}

export async function openBuyDialogForSeed(page: Page) {
  // Seeded best-priced FUND put (maker B, 1.80 USDx for 5.00 FUND).
  await page.getByRole('button', { name: /^Buy put on 5.00 FUND from GMAK…BBBB/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
