/**
 * /reserves: per token, what the Covered contract has locked against the balance it holds; the split of what is
 * locked; the clawback-shortfall notice; the read line with Refresh; and "Contracts and roles".
 *
 * The suite runs on the mock chain, where the contract holds exactly what it owes. The shortfall state is
 * therefore staged: `stageShortfall` reaches the page's own mock client and lowers the contract's balance, the
 * way an issuer clawback would (a demo switch for this is requested from the mock client; see the report).
 *
 * Every cell of the statement carries `data-units`, the exact integer units, so figures are compared as
 * integers and never parsed from formatted text.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BANNED_TAGLINES, MARGIN_BANNED_WORDS, clawbackShortfallDisclosure, findBannedWords } from '../src/core/disclosures'
import { PAGE_DESCRIPTION } from '../src/features/reserves/copy'
import { explorerAccount, explorerContract, explorerTx } from '../src/core/explorer'
import { COVERED_CONTRACT, MARGIN_CONTRACT, TOKEN_RECORDS } from '../src/core/deployments'
import { clawBack, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, goTo, openApp, pageHeading } from './helpers'
import type { OpenOptions } from './helpers'

const HEADERS = ['Token', 'Locked', 'Held', 'Difference']
/** One whole unit of a mock token (7 decimals). */
const UNIT = 10_000_000n

const statement = (page: Page): Locator => page.getByRole('table', { name: 'Reserves by token' })
const tokenRow = (page: Page, code: string): Locator => statement(page).getByRole('row', { name: new RegExp(`^${code} `) })
const toggle = (page: Page, code: string): Locator => statement(page).getByRole('button', { name: new RegExp(`^${code}\\b`) })
const roles = (page: Page): Locator => page.getByRole('region', { name: 'Contracts and roles' })
/** Alerts that belong to the page: the shell's permanent assertive live region is not one of them. */
const pageAlerts = (page: Page): Locator => page.locator('[role="alert"]:not([data-live-region])')

async function units(cell: Locator): Promise<bigint> {
  const raw = await cell.getAttribute('data-units')
  if (raw === null) throw new Error('The cell carries no data-units')
  return BigInt(raw)
}
const locked = (page: Page, code: string): Promise<bigint> => units(tokenRow(page, code).getByTestId('locked'))
const held = (page: Page, code: string): Promise<bigint> => units(tokenRow(page, code).getByTestId('held'))
const difference = (page: Page, code: string): Promise<bigint> => units(tokenRow(page, code).getByTestId('difference'))

/**
 * Opens the page so that staging can find the modules the app loaded. The dev server serves an edited module
 * under a `?t=` URL; the resource timing entries give the exact URL, and importing it returns the app's instance.
 */
async function openReserves(page: Page, options: OpenOptions = {}): Promise<void> {
  await openApp(page, '/reserves', options)
  await expect(statement(page)).toBeVisible()
}

/** Lowers the mock contract's own balance of a token by `amount` units: what an issuer clawback does. */
const stageShortfall = clawBack

async function refresh(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Refresh' }).click()
}

test.describe('Reserves', () => {
  test('says what it shows, where the figures come from and when, and raises no alert while held covers locked', async ({ page }) => {
    await openReserves(page)
    await expect(pageHeading(page)).toHaveText('Reserves')
    await expect(page.getByRole('main')).toContainText(PAGE_DESCRIPTION)
    // A mock build says the figures are mock data, and names no contract call they were read from.
    await expect(page.getByTestId('read-at')).toHaveText(/^Mock data, \d{2}:\d{2}:\d{2} UTC$/)
    await expect(page.getByRole('main')).not.toContainText('Read from')
    await expect(page.getByTestId('reserves-summary')).toHaveText('Held is at or above locked for all 4 tokens.')
    // No shortfall in the seed: nothing on the page is an alert.
    await expect(pageAlerts(page)).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
  })

  test('the statement has the four headers and a row where held equals locked, difference 0', async ({ page }) => {
    await openReserves(page)
    await expect(statement(page).getByRole('columnheader')).toHaveText(HEADERS)
    await expect(statement(page).getByRole('rowheader')).toHaveText([/^USDx/, /^FUND/, /^BOND/, /^EQTY/])
    await expect(tokenRow(page, 'USDx').getByRole('rowheader')).toContainText('Quote token')

    for (const code of ['USDx', 'FUND', 'BOND', 'EQTY']) {
      expect(await locked(page, code), code).toBeGreaterThan(0n)
      expect(await held(page, code), code).toBe(await locked(page, code))
      expect(await difference(page, code), code).toBe(0n)
    }
    const row = tokenRow(page, 'USDx')
    await expect(row.getByTestId('difference')).toContainText('0.00')
    await expect(row.getByTestId('held').locator('[aria-hidden="true"]').first()).toHaveText(await row.getByTestId('locked').locator('[aria-hidden="true"]').first().innerText())
    await expect(statement(page)).not.toContainText('short')
  })

  test('no bar while held equals locked; a bar in the row of a token where they differ, out of the accessibility tree', async ({ page }) => {
    await openReserves(page)
    await expect(page.getByTestId('reserve-figure')).toHaveCount(0)
    await expect(statement(page).getByTestId('reserve-bar')).toHaveCount(0)
    await stageShortfall(page, 'C_MOCK_BOND', 65_000_000n)
    await refresh(page)
    await expect(tokenRow(page, 'BOND').getByTestId('reserve-bar')).toHaveCount(1)
    await expect(statement(page).getByTestId('reserve-bar')).toHaveCount(1)
    await expect(tokenRow(page, 'BOND').getByTestId('reserve-bar').locator('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('a click anywhere on a row opens it; the button stays the one tab stop', async ({ page }) => {
    await openReserves(page)
    const button = toggle(page, 'FUND')
    await tokenRow(page, 'FUND').getByTestId('held').click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await tokenRow(page, 'FUND').getByTestId('difference').click()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  test('a row opens to the split of what is locked, and the items add up to locked', async ({ page }) => {
    await openReserves(page)
    const button = toggle(page, 'USDx')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')

    const labels = ['Offered', 'Active', 'Pending reclaim', 'Unclaimed', 'Escrowed']
    for (const label of labels) await expect(statement(page).getByRole('rowheader', { name: new RegExp(`^${label}`) })).toBeVisible()
    let sum = 0n
    for (const key of ['offered', 'active', 'pendingReclaim', 'unclaimed', 'escrowed']) sum += await units(statement(page).getByTestId(`item-${key}`))
    expect(sum).toBe(await locked(page, 'USDx'))
    await expect(statement(page).getByTestId('item-sum')).toContainText('Sum of items')
    // The headers did not change: the split is rows of the same four columns.
    await expect(statement(page).getByRole('columnheader')).toHaveText(HEADERS)

    // An underlying has no request escrow: four lines.
    await toggle(page, 'BOND').click()
    await expect(statement(page).getByRole('rowheader', { name: /^Escrowed/ })).toHaveCount(1)

    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(statement(page).getByRole('rowheader', { name: /^Escrowed/ })).toHaveCount(0)
  })

  test('the keyboard opens and closes a row, with focus in sight', async ({ page }) => {
    await openReserves(page)
    const button = toggle(page, 'FUND')
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(statement(page).getByRole('rowheader', { name: /^Offered/ })).toBeVisible()
    await expect(button).toBeFocused()
    await page.keyboard.press('Space')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    // The next stop is the next token: one control per row.
    await page.keyboard.press('Tab')
    await expect(toggle(page, 'BOND')).toBeFocused()
  })

  test('writing an offer raises what is locked by its collateral', async ({ page }) => {
    await openReserves(page, { connect: true })
    const before = await locked(page, 'USDx')
    await toggle(page, 'USDx').click()
    const offeredBefore = await units(statement(page).getByTestId('item-offered'))

    // To the write ticket without a page load (a load would start a fresh mock chain): a put on 1.00 BOND at
    // 95.00 locks 95.00 USDx.
    await page.evaluate((href) => (window as unknown as { __stellsec: { router: { navigate(to: { href: string }): Promise<void> } } }).__stellsec.router.navigate({ href }), '/markets/bond?mode=chain&side=write&kind=put&strike=95&qty=1&premium=1.5')
    const ticket = page.getByTestId('ticket')
    await expect(ticket).toContainText('95.00 USDx')
    await ticket.getByRole('button', { name: 'Review' }).click()
    const write = ticket.getByRole('button', { name: /^Write put/ })
    await expect(write).toBeVisible()
    await write.click()
    await expect(ticket.getByText(/Offer No\. \d+/).first()).toBeVisible()
    await ticket.getByRole('button', { name: 'Done' }).click()

    await goTo(page, 'Reserves')
    await expect.poll(() => locked(page, 'USDx')).toBe(before + 95n * UNIT)
    expect(await held(page, 'USDx')).toBe(before + 95n * UNIT)
    expect(await difference(page, 'USDx')).toBe(0n)
    await toggle(page, 'USDx').click()
    expect(await units(statement(page).getByTestId('item-offered'))).toBe(offeredBefore + 95n * UNIT)
    await expect(pageAlerts(page)).toHaveCount(0)
  })

  test('a clawback shortfall is an alert with the required sentence and the exact figures', async ({ page }) => {
    await openReserves(page)
    const before = await locked(page, 'BOND')
    await stageShortfall(page, 'C_MOCK_BOND', 65_000_000n) // 6.50 BOND taken from the contract
    await refresh(page)

    const alert = pageAlerts(page)
    await expect(alert).toHaveCount(1)
    await expect(alert.getByTestId('shortfall-disclosure')).toHaveText(clawbackShortfallDisclosure('BOND'))
    // Said once: the notice carries the sentence, the row right below carries the figures, no summary repeats it.
    await expect(alert).not.toContainText('6.50')
    await expect(page.getByTestId('reserves-summary')).toHaveCount(0)

    expect(await locked(page, 'BOND')).toBe(before)
    expect(await held(page, 'BOND')).toBe(before - 65_000_000n)
    expect(await difference(page, 'BOND')).toBe(-65_000_000n)
    // A sign and a word, never colour alone.
    await expect(tokenRow(page, 'BOND').getByTestId('difference')).toContainText('−6.50')
    await expect(tokenRow(page, 'BOND').getByTestId('difference')).toContainText('short')
    await expect(tokenRow(page, 'BOND').getByTestId('reserve-bar')).toBeVisible()
    // The other tokens are untouched.
    expect(await difference(page, 'USDx')).toBe(0n)

    // Two short tokens share one notice.
    await stageShortfall(page, 'C_MOCK_EQTY', 10_000_000n)
    await refresh(page)
    await expect(pageAlerts(page)).toHaveCount(1)
    await expect(pageAlerts(page).getByTestId('shortfall-disclosure')).toHaveText(clawbackShortfallDisclosure('BOND and EQTY'))
  })

  test('a difference under a cent is said in words, with the exact value one press away', async ({ page }) => {
    await openReserves(page)
    await stageShortfall(page, 'C_MOCK_EQTY', 1n)
    await refresh(page)
    const cell = tokenRow(page, 'EQTY').getByTestId('difference')
    expect(await difference(page, 'EQTY')).toBe(-1n)
    await expect(cell).toContainText('under 0.01')
    await expect(cell).toContainText('short')
    await expect(cell).not.toContainText('<0.01')
  })

  test('Refresh reads again and says so', async ({ page }) => {
    await openReserves(page)
    await refresh(page)
    await expectAnnounced(page, /^Reserves read again at \d{2}:\d{2}:\d{2} UTC\.$/)
    await expect(page.getByTestId('read-at')).toHaveText(/^Mock data, \d{2}:\d{2}:\d{2} UTC$/)
  })

  test('a failed read says so in plain words, keeps the raw message behind a disclosure, and still shows contracts and roles', async ({ page }) => {
    // The mock market is a chunk of its own: without it the contract cannot be read.
    await page.route(/mockClient/, (route) => route.abort())
    await page.goto('/reserves')
    await expect(pageHeading(page)).toHaveText('Reserves')
    await expect(page.getByRole('main').getByText('Reserves could not be read', { exact: true })).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('main').getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('The read of the contract failed, so no figure is shown.')
    // The raw message is there, closed.
    await expect(page.getByRole('main').getByText('Technical detail')).toBeVisible()
    await expect(page.getByRole('main').getByText(/Failed to fetch/)).toBeHidden()
    await expect(statement(page)).toHaveCount(0)
    // Not a live region of its own: the failure went through the shell's assertive region once.
    await expect(pageAlerts(page)).toHaveCount(0)
    await expect(roles(page)).toContainText(COVERED_CONTRACT.contractId)
  })

  test('Refresh in the error notice reads again and leaves focus on the statement, not on the page body', async ({ page }) => {
    await page.route(/mockClient/, (route) => route.abort())
    await page.goto('/reserves')
    await expect(page.getByRole('main').getByText('Reserves could not be read', { exact: true })).toBeVisible({ timeout: 25_000 })
    await page.unroute(/mockClient/)
    await page.getByRole('main').getByRole('button', { name: 'Refresh' }).focus()
    await page.keyboard.press('Enter')
    await expect(statement(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Held against locked' })).toBeFocused()
  })

  test('headings come in order, and the page uses no promise word and no disclaimer tagline', async ({ page }) => {
    await openReserves(page)
    const levels = await page.getByRole('main').locator('h1, h2, h3, h4, h5, h6').evaluateAll((list) => list.map((h) => Number(h.tagName[1])))
    expect(levels[0]).toBe(1)
    expect(levels.filter((level) => level === 1)).toHaveLength(1)
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1)
    const text = await page.getByRole('main').innerText()
    expect(findBannedWords(text, MARGIN_BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
    expect(text).not.toMatch(/experimental|fictional/i)
    // No em dash, no arrow, no exclamation mark.
    expect(text).not.toMatch(/[\u{2014}\u{2192}!]/u)
  })

  test('axe finds nothing in either theme: closed, opened, and with a shortfall', async ({ page }) => {
    await openReserves(page)
    await expectNoAxeViolations(page)
    for (const code of ['USDx', 'FUND']) await toggle(page, code).click()
    await expectNoAxeViolations(page)
    await stageShortfall(page, 'C_MOCK_BOND', 65_000_000n)
    await refresh(page)
    await expect(pageAlerts(page)).toHaveCount(1)
    await expectNoAxeViolations(page)
  })
})

test.describe('Contracts and roles', () => {
  test('gives the Covered contract id in full, its wasm hash and the facts, in one list', async ({ page }) => {
    await openReserves(page)
    const covered = roles(page).getByRole('region', { name: 'Covered contract' })
    await expect(covered).not.toContainText('No admin. No upgrades. No oracle.')
    await expect(covered.getByRole('term')).toHaveText(['Contract id', 'Version', 'Wasm hash', 'Deploy transaction', 'Deployed by', 'Admin', 'Upgrades', 'Oracle', 'Asset listing', 'Audit'])
    await expect(covered).toContainText('The contract has no admin function and no owner.')
    await expect(covered).toContainText(COVERED_CONTRACT.contractId)
    await expect(covered).toContainText(COVERED_CONTRACT.wasmHash)
    await expect(covered).toContainText(COVERED_CONTRACT.version)
    await expect(covered.getByRole('link', { name: /View the Covered contract on the explorer/ })).toHaveAttribute('href', explorerContract(COVERED_CONTRACT.contractId))
    await expect(covered.getByRole('link', { name: /^View transaction/ })).toHaveAttribute('href', explorerTx(COVERED_CONTRACT.deployTx))
    for (const term of ['Admin', 'Upgrades', 'Oracle', 'Asset listing', 'Audit']) await expect(covered.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) })).toBeVisible()
    await expect(covered).toContainText('No outside party has reviewed the code.')
    // A mock build says which deployment this is, and which token it shows under another code.
    await expect(roles(page)).toContainText('The Testnet deployment is listed here as recorded on 26 Oct 2026. Its fund token is RWA, shown above as FUND.')
    // Copy belongs to an id printed in full and to the wasm hash; a shortened id carries its explorer link only.
    await expect(covered.getByRole('button', { name: /^Copy/ })).toHaveCount(2)
  })

  test('lists the token contracts with their issuers and what each issuer can do', async ({ page }) => {
    await openReserves(page)
    const table = roles(page).getByRole('table', { name: 'Token contracts, issuers and issuer flags' })
    await expect(table.getByRole('columnheader')).toHaveText(['Token', 'Token contract', 'Issuer', 'Approval required', 'Can freeze', 'Can claw back'])
    await expect(table.getByRole('rowheader')).toHaveText(TOKEN_RECORDS.map((t) => new RegExp(`^${t.code}`)))
    for (const token of TOKEN_RECORDS) {
      const row = table.getByRole('row', { name: new RegExp(`^${token.code} `) })
      await expect(row.getByRole('link', { name: new RegExp(`View the ${token.code} token contract on the explorer`) })).toHaveAttribute('href', explorerContract(token.contractId))
      await expect(row.getByRole('link', { name: new RegExp(`View the ${token.code} issuer on the explorer`) })).toHaveAttribute('href', explorerAccount(token.issuer))
      const word = (on: boolean) => (on ? 'Yes' : 'No')
      await expect(row.getByRole('cell')).toHaveText([/.+/, /.+/, word(token.flags.authRequired), word(token.flags.authRevocable), word(token.flags.clawback)])
    }
    await expect(roles(page)).toContainText('The USDx issuer has none of these powers today, and can change these later.')
  })

  test('sets Margin apart and says what its admin and its publisher can and cannot do', async ({ page }) => {
    await openReserves(page)
    const margin = roles(page).getByRole('region', { name: 'Margin contract' })
    await expect(margin).toContainText(MARGIN_CONTRACT.contractId)
    await expect(margin).toContainText(MARGIN_CONTRACT.wasmHash)
    await expect(margin).toContainText('It shares no storage, balance or call with the Covered contract.')
    await expect(margin.getByRole('link', { name: /View the Margin admin on the explorer/ })).toHaveAttribute('href', explorerAccount(MARGIN_CONTRACT.admin))
    await expect(margin.getByRole('link', { name: /View the Margin publisher on the explorer/ })).toHaveAttribute('href', explorerAccount(MARGIN_CONTRACT.publisher))
    await expect(margin.getByRole('heading', { level: 4 })).toHaveText(['Admin', 'Publisher'])
    await expect(margin).toContainText('Lists the series that can be traded')
    // What neither role can do is said once, for both.
    await expect(margin.getByRole('list', { name: 'Neither can', exact: true })).toContainText('Trade, take over a position or deposit into the vault.')
    await expect(margin.getByRole('term')).toHaveText(['Contract id', 'Version', 'Wasm hash', 'Deploy transaction', 'Deployed by', 'Upgrades', 'Prices', 'Audit'])
    await expect(margin).toContainText('These prices decide every liquidation, early exercise and payout.')
    await expect(margin).toContainText('The admin and the publisher must be different accounts.')
    // The two contracts stay apart: the Covered block names no admin address.
    await expect(roles(page).getByRole('region', { name: 'Covered contract' })).not.toContainText(MARGIN_CONTRACT.admin.slice(0, 6))
  })
})

test.describe('Reserves on a phone', () => {
  test('fits 390 px: no sideways scroll, the four columns, 44 px targets @phone', async ({ page }) => {
    await openReserves(page)
    await expectNoHorizontalOverflow(page)
    await expect(statement(page).getByRole('columnheader')).toHaveText(HEADERS)
    for (const header of await statement(page).getByRole('columnheader').all()) await expect(header).toBeInViewport({ ratio: 0 })
    // The statement fits: its wrapper has nothing to scroll.
    expect(await statement(page).evaluate((table) => table.parentElement!.scrollWidth <= table.parentElement!.clientWidth + 1)).toBe(true)
    for (const code of ['USDx', 'FUND', 'BOND', 'EQTY']) expect((await toggle(page, code).boundingBox())!.height, code).toBeGreaterThanOrEqual(44)
    expect((await page.getByRole('button', { name: 'Refresh' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test('a row opens to a list of items that add up, and the tokens are blocks, not a wide table @phone', async ({ page }) => {
    await openReserves(page)
    await toggle(page, 'USDx').click()
    let sum = 0n
    for (const key of ['offered', 'active', 'pendingReclaim', 'unclaimed', 'escrowed']) sum += await units(statement(page).getByTestId(`item-${key}`))
    expect(sum).toBe(await locked(page, 'USDx'))
    await expect(statement(page).getByText('Collateral of open offers, not sold yet')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const tokens = roles(page).getByRole('list', { name: 'Token contracts, issuers and issuer flags' })
    await expect(tokens.getByRole('listitem')).toHaveCount(TOKEN_RECORDS.length)
    await expect(tokens.getByRole('listitem').last()).toContainText('Can claw back')
    await expect(roles(page).getByRole('table')).toHaveCount(0)
    await expect(roles(page)).toContainText(COVERED_CONTRACT.contractId)
  })

  test('a shortfall on a phone: the notice, the hatched row, no sideways scroll @phone', async ({ page }) => {
    await openReserves(page)
    await stageShortfall(page, 'C_MOCK_BOND', 65_000_000n)
    await refresh(page)
    await expect(pageAlerts(page).getByTestId('shortfall-disclosure')).toHaveText(clawbackShortfallDisclosure('BOND'))
    expect(await difference(page, 'BOND')).toBe(-65_000_000n)
    await expectNoHorizontalOverflow(page)
  })

  test('axe finds nothing in either theme @phone', async ({ page }) => {
    await openReserves(page)
    await toggle(page, 'USDx').click()
    await expectNoAxeViolations(page)
  })
})

test.describe('Reserves at 320 px', () => {
  test.use({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true })

  test('the four columns fit, the widest difference and an open split included', async ({ page }) => {
    await openReserves(page)
    // The widest cell the statement can hold: a difference under a cent, in the short weight, with its word.
    await stageShortfall(page, 'C_MOCK_EQTY', 1n)
    await stageShortfall(page, 'C_MOCK_BOND', 65_000_000n)
    await refresh(page)
    await expect(tokenRow(page, 'EQTY').getByTestId('difference')).toContainText('under 0.01')
    await toggle(page, 'USDx').click()
    await expect(statement(page).getByTestId('item-sum')).toBeVisible()

    await expectNoHorizontalOverflow(page)
    expect(await statement(page).evaluate((table) => table.parentElement!.scrollWidth <= table.parentElement!.clientWidth + 1)).toBe(true)
    for (const header of await statement(page).getByRole('columnheader').all()) await expect(header).toBeInViewport({ ratio: 1 })
    for (const code of ['USDx', 'EQTY']) {
      const cell = (await tokenRow(page, code).getByTestId('difference').boundingBox())!
      expect(cell.x + cell.width, code).toBeLessThanOrEqual(320)
    }
    // The token code and the first figure do not touch.
    const code = await toggle(page, 'USDx').locator('span').nth(1).boundingBox()
    const figure = await tokenRow(page, 'USDx').getByTestId('locked').locator('[aria-hidden="true"]').first().boundingBox()
    expect(figure!.x - (code!.x + code!.width)).toBeGreaterThanOrEqual(8)
  })
})
