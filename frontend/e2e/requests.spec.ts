/**
 * /requests: the board of open requests, its filters and order in the URL, the wallet's own requests, cancelling
 * (or taking back the premium of an expired request) as a staged transaction, and the two tickets the page opens
 * (post a request, fill a request).
 *
 * The mock market seeds four open requests: No. 0 by wallet A (put on BOND), No. 1 by wallet B (put on FUND), No. 2
 * (put on FUND) and No. 3 (call on EQTY) by two fictional hedgers. Ids are printed unpadded (ruling F1).
 *
 * Figures and their units, dates and times are joined by no-break spaces (ruling F7): patterns match them with `\s`.
 *
 * The ticket's own steps are tested in ticket.spec.ts; here they are driven only as far as this page needs, with
 * matchers that follow the ticket's purpose rather than its exact words.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { bidEscrowDisclosure } from '../src/core/disclosures'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'
import { ADDR_A, connect, connectButton, expectNoAxeViolations, expectNoHorizontalOverflow, goTo, isPhone, openApp, pageHeading, switchAccount, walletButton } from './helpers'

const LEAD = "A request is a buyer's premium already escrowed in the contract, waiting for a maker."

const rows = (page: Page): Locator => page.getByTestId('request-row')
const row = (page: Page, serial: string): Locator => rows(page).filter({ hasText: new RegExp(`No\\.\\s${serial}(?!\\d)`) })
const boardTab = (page: Page): Locator => page.getByRole('tab', { name: /^Open requests/ })
const mineTab = (page: Page): Locator => page.getByRole('tab', { name: /^My requests/ })
const postButton = (page: Page): Locator => page.getByRole('button', { name: 'Post a request' }).first()
const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams

/**
 * The premium per unit of every row on screen, in row order, as numbers (display figures: ordering only). Read from
 * the accessible name of the row's action, which carries the quantity and the total premium.
 */
async function perUnitFigures(page: Page): Promise<number[]> {
  const names = await rows(page).evaluateAll((list) => list.map((el) => el.querySelector('button[aria-label]')?.getAttribute('aria-label') ?? ''))
  return names.map((name) => {
    const qty = Number(/ on ([\d,.]+)\s[A-Z]+ at /.exec(name)?.[1].replace(/,/g, ''))
    const premium = Number(/premium ([\d,.]+)\sUSDx/.exec(name)?.[1].replace(/,/g, ''))
    return premium / qty
  })
}

/** Moves the deadline of a seeded request to `offsetSec` from now, as the mock chain will read it. */
async function setDeadline(page: Page, id: number, offsetSec: number): Promise<void> {
  await page.evaluate(
    async ({ id, offsetSec }) => {
      const hook = (window as unknown as { __stellsec?: { mock(): Promise<unknown>; queryClient: { invalidateQueries(): Promise<void> } } }).__stellsec
      if (!hook) throw new Error('The E2E hook is missing: the app was not built with VITE_E2E=1.')
      const mock = (await hook.mock()) as { bids: { id: bigint; expiry: number }[] }
      const bid = mock.bids.find((b) => b.id === BigInt(id))
      if (!bid) throw new Error(`Request ${id} is not seeded.`)
      bid.expiry = Math.floor(Date.now() / 1000) + offsetSec
      await hook.queryClient.invalidateQueries()
    },
    { id, offsetSec },
  )
}

/** Wallet A's request No. 0, an hour past its deadline with the premium still in the contract. */
const expireOwnRequest = (page: Page): Promise<void> => setDeadline(page, 0, -3_600)

/** The deadline of every row on screen, in row order, as epoch milliseconds. */
async function deadlines(page: Page): Promise<number[]> {
  return rows(page).evaluateAll((list) => list.map((el) => Date.parse(el.querySelector('time')?.getAttribute('datetime') ?? '')))
}

/** The premium of a request, read from the accessible name of its action, which ends with it ("premium 0.92 USDx"). */
async function premiumOf(action: Locator): Promise<string> {
  const name = (await action.getAttribute('aria-label')) ?? ''
  return /premium ([\d,.]+)\sUSDx/.exec(name)?.[1] ?? ''
}

async function chooseOption(page: Page, label: string, option: string | RegExp): Promise<void> {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('Requests board', () => {
  test('lists the seeded requests with every term a maker prices', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(pageHeading(page)).toHaveText('Requests')
    await expect(page.getByText(LEAD)).toBeVisible()

    await expect(rows(page)).toHaveCount(4)
    await expect(page.getByRole('table', { name: /^Open requests/ })).toBeVisible()
    await expect(boardTab(page)).toHaveAttribute('aria-selected', 'true')
    // The tabs carry no count: the summary line says it once, in words.
    await expect(boardTab(page)).toHaveText('Open requests')
    await expect(mineTab(page)).toHaveText('My requests')
    await expect(page.getByTestId('board-summary')).toContainText(/^4 open requests\. [\d,.]+\sUSDx of premium is escrowed in the contract\./)
    // No explainer under the board.
    await expect(page.getByRole('heading', { name: 'How a request works' })).toHaveCount(0)

    // The columns of ruling F15, in its order, after the asset (the board spans assets). The asset Requests tab has
    // the same ones without the asset (see "the same drawing on both pages" below).
    await expect(page.getByRole('table', { name: /^Open requests/ }).getByRole('columnheader')).toHaveText([
      'Asset',
      'Kind',
      'Strike',
      'Quantity',
      'Deadline',
      'Premium per unit',
      'Buyer',
      'Action',
    ])

    // One row in full: asset with the request's number, kind as glyph and word, the strike (serif, as on every
    // page) with the labelled reference price, quantity, deadline with countdown, premium per unit with the total
    // beneath, buyer. What a maker locks is in the accessible name of the action and in the ticket.
    const fund = row(page, '2')
    await expect(fund.getByRole('rowheader')).toContainText('FUND')
    await expect(fund.getByRole('rowheader')).toContainText('Fund share')
    await expect(fund).toContainText('Put')
    await expect(fund).toContainText('No. 2')
    await expect(fund).toContainText('10.00 FUND')
    const strike = fund.locator('td[data-strike]')
    await expect(strike).toContainText(/Demo price\s\d+\.\d{2}/)
    expect(await strike.evaluate((td) => getComputedStyle(td).fontFamily)).toMatch(/Serif/)
    await expect(fund).toContainText(/USDx\s*in total/)
    await expect(fund.locator('time')).toHaveText(/^\d{1,2}\s[A-Z][a-z]{2}\s\d{4},\s08:00\sUTC$/)
    await expect(fund.getByRole('timer')).toHaveAttribute('aria-label', /^Time left: /)
    await expect(fund).toContainText('GHED…AAAA')
    await expect(fund).not.toContainText('You lock')
    // The buyer's address carries no copy button on the board.
    await expect(fund.getByRole('button', { name: /copy/i })).toHaveCount(0)
    const fill = fund.getByRole('button', { name: /^Fill request/ })
    await expect(fill).toHaveAccessibleName(/^Fill request: put on 10\.00\sFUND at [\d.]+\sUSDx, until .+\sUTC, premium [\d.]+\sUSDx, you lock [\d,.]+\sUSDx$/)

    // A call locks the asset itself.
    await expect(row(page, '3').getByRole('button', { name: /^Fill request/ })).toHaveAccessibleName(/you lock 4\.00\sEQTY$/)

    // One label per destination (ruling F19).
    await expect(page.getByTestId('board-summary').getByRole('link', { name: 'Open Reserves' })).toHaveAttribute('href', /\/reserves$/)

    // The default order is the soonest deadline, and the Deadline header says so.
    const when = await deadlines(page)
    expect(when).toEqual([...when].sort((a, b) => a - b))
    await expect(page.getByRole('columnheader', { name: /^Deadline/ })).toHaveAttribute('aria-sort', 'ascending')
    await expect(page.getByRole('columnheader', { name: /^Premium per unit/ })).toHaveAttribute('aria-sort', 'none')
  })

  test('the columns do not move when the wallet connects', async ({ page }) => {
    await openApp(page, '/requests')
    const edges = () => page.getByRole('columnheader').evaluateAll((list) => list.map((th) => Math.round(th.getBoundingClientRect().left)))
    const guest = await edges()
    await connect(page)
    await expect(rows(page).filter({ hasText: 'Yours' })).toHaveCount(1)
    expect(await edges()).toEqual(guest)
  })

  test('filters and order are real controls that live in the URL', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(rows(page)).toHaveCount(4)
    // From 1200 px the table headers set the order; the toolbar has no order control.
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0)

    await chooseOption(page, 'Asset', /^FUND/)
    await expect(rows(page)).toHaveCount(2)
    expect(search(page).get('asset')).toBe('fund')
    await expect(page.getByTestId('board-summary')).toContainText('2 of 4 open requests shown')

    await page.getByRole('radiogroup', { name: 'Kind' }).getByRole('radio', { name: 'Call' }).click()
    expect(search(page).get('kind')).toBe('call')
    await expect(rows(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'No open requests match these filters.' })).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows(page)).toHaveCount(4)
    expect(search(page).has('asset')).toBe(false)
    expect(search(page).has('kind')).toBe(false)

    const premiumHeader = page.getByRole('columnheader', { name: /^Premium per unit/ })
    await premiumHeader.getByRole('button').click()
    await expect(premiumHeader).toHaveAttribute('aria-sort', 'descending')
    expect(search(page).get('sort')).toBe('premium')
    const perUnit = await perUnitFigures(page)
    expect(perUnit).toHaveLength(4)
    expect(perUnit).toEqual([...perUnit].sort((a, b) => b - a))

    // The whole state is in the link: a fresh load of it shows the same board.
    await page.getByRole('radiogroup', { name: 'Kind' }).getByRole('radio', { name: 'Put' }).click()
    await chooseOption(page, 'Asset', /^FUND/)
    const url = new URL(page.url())
    expect(Object.fromEntries(url.searchParams)).toEqual({ asset: 'fund', kind: 'put', sort: 'premium' })
    await page.goto(url.pathname + url.search)
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('combobox', { name: 'Asset' })).toContainText('FUND')
    await expect(page.getByRole('radiogroup', { name: 'Kind' }).getByRole('radio', { name: 'Put' })).toBeChecked()
    await expect(page.getByRole('columnheader', { name: /^Premium per unit/ })).toHaveAttribute('aria-sort', 'descending')
    const filtered = await perUnitFigures(page)
    expect(filtered).toEqual([...filtered].sort((a, b) => b - a))

    // Back to the default order: the param leaves the URL.
    await page.getByRole('columnheader', { name: /^Deadline/ }).getByRole('button').click()
    expect(search(page).has('sort')).toBe(false)
  })

  test('switching tabs replaces the history entry', async ({ page }) => {
    await openApp(page, '/markets')
    await goTo(page, 'Requests')
    await expect(rows(page)).toHaveCount(4)
    await mineTab(page).click()
    await boardTab(page).click()
    await mineTab(page).click()
    expect(search(page).get('mine')).toBe('1')
    await page.goBack()
    await expect(page).toHaveURL(/\/markets/)
  })

  test('an asset the contract does not list is ignored and said so', async ({ page }) => {
    await openApp(page, '/requests?asset=nope')
    await expect(rows(page)).toHaveCount(4)
    await expect(page.getByText('The asset in this link is not listed in the contract. Every asset is shown.')).toBeVisible()
  })

  test('a guest sees every term, and My requests asks for a wallet', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(rows(page)).toHaveCount(4)
    // No dead buttons: every row can be opened, and nothing is disabled.
    await expect(page.getByRole('button', { name: /^Fill request/ })).toHaveCount(4)
    for (const button of await page.getByRole('button', { name: /^Fill request/ }).all()) await expect(button).toBeEnabled()
    await expect(page.getByText('Yours')).toHaveCount(0)

    await mineTab(page).click()
    expect(search(page).get('mine')).toBe('1')
    await expect(page.getByRole('heading', { name: 'Connect a wallet to see your requests.' })).toBeVisible()
    await page.getByRole('tabpanel').getByRole('button', { name: 'Connect wallet' }).click()
    await expect(walletButton(page)).toBeVisible()
    await expect(row(page, '0')).toContainText('BOND')
    await expect(row(page, '0')).toContainText('Open')
    // The tag says it: no caption restates where the premium of an open request is.
    await expect(row(page, '0')).not.toContainText('Premium in the contract')
  })

  test('the wallet own request reads Yours and is cancelled as a staged transaction', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    const mine = row(page, '0')
    await expect(mine).toContainText('Yours')
    await expect(mine.getByRole('button', { name: /^Fill request/ })).toHaveCount(0)
    // The wallet's own figure (the premium per unit) sits under the highlighter; the total is beneath it.
    await expect(mine.locator('mark')).toContainText(/[\d.]+\s*USDx/)
    const action = mine.getByRole('button', { name: /^Cancel request No\. 0\b/ })
    // Row actions are one secondary button per action, the same on every row (ruling F14).
    await expect(action).toHaveAttribute('data-variant', 'secondary')
    const premium = await premiumOf(action)
    expect(premium).toMatch(/^[\d.]+$/)

    await action.click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 0' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Put on 2.00 BOND')
    await expect(dialog).toContainText(/Strike\s*[\d.]+\sUSDx/)
    await expect(dialog).toContainText('Returned to your wallet')
    await expect(dialog).toContainText(premium)
    const keep = dialog.getByRole('button', { name: 'Keep request' })
    await expect(keep).toBeVisible()
    // At rest the dialog takes the room its content needs: no empty stage between the note and the actions.
    const note = dialog.getByText(/^The contract returns the premium in the same transaction\./)
    const gap = ((await keep.boundingBox())?.y ?? 0) - (((await note.boundingBox())?.y ?? 0) + ((await note.boundingBox())?.height ?? 0))
    expect(gap).toBeLessThan(64)

    await dialog.getByRole('button', { name: 'Cancel request', exact: true }).click()
    // The stages are named while the transaction runs, then the outcome stays on screen with its hash, under a
    // title that says what happened.
    await expect(page.getByRole('dialog').getByRole('list', { name: 'Transaction progress' })).toBeVisible()
    const done = page.getByRole('dialog', { name: 'Request cancelled' })
    await expect(done.getByTestId('cancel-outcome')).toContainText('Transaction')
    await expect(done).toContainText('Returned to your wallet')
    await expect(done).toContainText(premium)
    // After the outcome too: the hash line and then the actions.
    const outcome = done.getByTestId('cancel-outcome')
    const doneButton = done.getByRole('button', { name: 'Done' })
    const after = ((await doneButton.boundingBox())?.y ?? 0) - (((await outcome.boundingBox())?.y ?? 0) + ((await outcome.boundingBox())?.height ?? 0))
    expect(after).toBeLessThan(64)
    await doneButton.click()
    await expect(done).toBeHidden()

    // Not optimistic: the row left because the contract was read again.
    await expect(rows(page)).toHaveCount(3)
    await expect(row(page, '0')).toHaveCount(0)
    await mineTab(page).click()
    // A cancelled request is closed: it waits behind "Show closed".
    await expect(page.getByRole('heading', { name: 'You have no open requests.' })).toBeVisible()
    await page.getByRole('switch', { name: 'Show closed' }).click()
    await expect(row(page, '0')).toContainText('Cancelled')
    await expect(row(page, '0').getByRole('button')).toHaveCount(0)

    // And it is on record in Activity (in the wallet menu at this width).
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: /^Activity/ }).click()
    await expect(page).toHaveURL(/\/activity/)
    await expect(page.getByText(/Cancel request for put on 2\.00\sBOND/).first()).toBeVisible()
  })

  test('an open request past its deadline comes first and can still be cancelled for its premium (ruling F9)', async ({ page }) => {
    await openApp(page, '/requests?mine=1', { connect: true })
    await expect(row(page, '0')).toContainText('Open')
    await expireOwnRequest(page)

    const expired = row(page, '0')
    await expect(expired).toContainText('Expired')
    await expect(expired).toContainText('Premium still in the contract')
    await expect(rows(page).first()).toContainText('No. 0')
    // The action keeps its one name after the deadline.
    const action = expired.getByRole('button', { name: /^Cancel request No\. 0\b/ })
    await expect(action).toBeVisible()
    const premium = await premiumOf(action)
    // It left the board of open requests.
    await boardTab(page).click()
    await expect(row(page, '0')).toHaveCount(0)
    await mineTab(page).click()

    await action.click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 0' })
    await expect(dialog).toContainText('Nobody filled it before the deadline. The contract returns the premium in the same transaction.')
    await expect(dialog).toContainText('Returned to your wallet')
    await expect(dialog).toContainText(premium)
    await expect(dialog.getByRole('button', { name: 'Keep request' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Close' }).last()).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel request', exact: true }).click()
    const done = page.getByRole('dialog', { name: 'Request cancelled' })
    await expect(done.getByTestId('cancel-outcome')).toContainText('Transaction')
    await done.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('heading', { name: 'You have no open requests.' })).toBeVisible()
  })

  test('the warning tone is for the wallet own request; a request about to lapse says so in words', async ({ page }) => {
    await openApp(page, '/requests', { connect: 'b' })
    await expect(rows(page)).toHaveCount(4)
    // Wallet A's No. 0 has 9 minutes left; wallet B's own No. 1 has 5 hours.
    await setDeadline(page, 0, 9 * 60)
    await setDeadline(page, 1, 5 * 3_600)
    const lapsing = row(page, '0')
    await expect(lapsing).toContainText('A fill may land too late')
    // Another wallet's countdown stays neutral, even with minutes left; the wallet's own takes the warning tone.
    await expect(lapsing.getByRole('timer')).toHaveAttribute('data-state', 'running')
    await expect(row(page, '1').getByRole('timer')).toHaveAttribute('data-state', 'warn')
    await expect(row(page, '1')).not.toContainText('A fill may land too late')
    await expect(row(page, '2')).not.toContainText('A fill may land too late')
  })

  test('a wallet that holds none of a collateral token is told once, with the way to test funds', async ({ page }) => {
    await openApp(page, '/requests', { connect: DEMO_WALLETS.c })
    await expect(rows(page)).toHaveCount(4)
    const line = page.getByText(/^Your wallet holds no (EQTY or USDx|USDx or EQTY)\.$/)
    await expect(line).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get test funds' })).toHaveAttribute('href', /\/markets/)
    // The rows stay quiet: no "You hold" hint under each collateral figure.
    await expect(page.getByText(/^You hold /)).toHaveCount(0)
  })

  test('a long board shows 25 requests at a time and keeps its header in view', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(rows(page)).toHaveCount(4)
    // Thirty more open requests, copies of No. 2 with their own numbers.
    await page.evaluate(async () => {
      const hook = (window as unknown as { __stellsec?: { mock(): Promise<unknown>; queryClient: { invalidateQueries(): Promise<void> } } }).__stellsec
      if (!hook) throw new Error('The E2E hook is missing: the app was not built with VITE_E2E=1.')
      const mock = (await hook.mock()) as { bids: { id: bigint; expiry: number }[] }
      const template = mock.bids.find((b) => b.id === 2n)
      if (!template) throw new Error('Request No. 2 is not seeded.')
      for (let i = 0; i < 30; i++) mock.bids.push({ ...template, id: BigInt(100 + i), expiry: template.expiry + (i + 1) * 3_600 })
      await hook.queryClient.invalidateQueries()
    })
    await expect(rows(page)).toHaveCount(25)
    await expect(page.getByTestId('board-summary')).toContainText('25 of 34 open requests shown')
    // The table scrolls inside its frame, under a header that stays put.
    const frame = page.getByRole('region', { name: /^Open requests/ })
    await expect(frame).toBeVisible()
    const header = page.getByRole('columnheader', { name: /^Deadline/ })
    const before = (await header.boundingBox())?.y ?? 0
    await frame.evaluate((el) => el.scrollBy(0, 600))
    await expect.poll(async () => (await header.boundingBox())?.y ?? -1).toBe(before)

    await page.getByRole('button', { name: 'Show 9 more' }).click()
    await expect(rows(page)).toHaveCount(34)
    await expect(page.getByRole('button', { name: /^Show \d+ more$/ })).toHaveCount(0)
    await expect(page.getByTestId('board-summary')).toContainText(/^34 open requests\./)
  })

  test('keeping the request closes the dialog and sends nothing', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    await row(page, '0').getByRole('button', { name: /^Cancel request/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 0' })
    await dialog.getByRole('button', { name: 'Keep request' }).click()
    await expect(dialog).toBeHidden()
    await expect(rows(page)).toHaveCount(4)
    await expect(row(page, '0')).toContainText('Yours')
  })

  test('a failed read says so and offers a retry', async ({ page }) => {
    // The mock market is a chunk of its own: without it the contract cannot be read.
    await page.route(/mockClient/, (route) => route.abort())
    await page.goto('/requests')
    await expect(pageHeading(page)).toHaveText('Requests')
    await expect(page.getByText('Requests could not be read.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
    // Post a request still opens something: the chooser, which says the assets could not be read.
    await postButton(page).click()
    const chooser = page.getByRole('dialog', { name: 'Post a request' })
    await expect(chooser).toBeVisible()
    await expect(chooser.getByText('The assets could not be read.')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('Requests tickets', () => {
  test('post a request: asset first, the escrow sentence, a receipt, then it reads Yours', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    await expect(rows(page)).toHaveCount(4)

    await postButton(page).click()
    expect(search(page).get('new')).toBe('1')
    const chooser = page.getByRole('dialog', { name: 'Post a request' })
    await expect(chooser).toContainText('Choose the asset the option is on.')
    await expect(chooser.getByRole('listitem')).toHaveCount(3)
    await chooser.getByRole('button', { name: /^EQTY/ }).click()
    await expect(chooser).toBeHidden()
    // The choice is in the URL.
    expect(search(page).get('asset')).toBe('eqty')
    expect(search(page).get('new')).toBe('1')

    // The request ticket (owned by the ticket feature) opens on that asset, with no switch to other modes.
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Request a put on EQTY')
    await expect(ticket.getByRole('radio', { name: 'Buy', exact: true })).toHaveCount(0)
    // The ticket may show its seeded terms first, with the choices behind "Change terms".
    const changeTerms = ticket.getByText('Change terms', { exact: true })
    if ((await changeTerms.count()) > 0 && !(await ticket.getByRole('radio', { name: /UTC, in \d+\sd/ }).first().isVisible())) await changeTerms.click()
    await ticket.getByRole('radio', { name: /UTC, in \d+\sd/ }).nth(1).click()
    await ticket.getByRole('radio', { name: /^24\.00/ }).click()
    await ticket.getByRole('textbox', { name: /^Quantity/ }).fill('3')
    // The premium is typed per unit or as the total, depending on the ticket's form: 1.50 USDx in total either way.
    const perUnitField = ticket.getByRole('textbox', { name: /^Premium per/ })
    if ((await perUnitField.count()) > 0) await perUnitField.fill('0.5')
    else await ticket.getByRole('textbox', { name: /^Premium/ }).fill('1.5')
    await expect(ticket.getByText(bidEscrowDisclosure('1.50 USDx')).first()).toBeVisible()
    await ticket.getByRole('button', { name: 'Review' }).click()
    await ticket.getByRole('button', { name: /^Post request/ }).click()

    // The receipt names the request by its number, with the transaction.
    await expect(ticket).toContainText(/No\.\s4(?!\d)/)
    await expect(ticket).toContainText('Transaction')
    await ticket.getByRole('button', { name: 'Done' }).click()
    await expect(ticket).toBeHidden()
    // Closing gives the board back as it was before the asset was chosen.
    expect(search(page).has('new')).toBe(false)
    expect(search(page).has('asset')).toBe(false)

    await expect(rows(page)).toHaveCount(5)
    const posted = row(page, '4')
    await expect(posted.getByRole('rowheader')).toContainText('EQTY')
    await expect(posted).toContainText('Put')
    await expect(posted).toContainText('3.00 EQTY')
    await expect(posted).toContainText('24.00 USDx')
    await expect(posted).toContainText(/1\.50\sUSDx/)
    await expect(posted).toContainText('in total')
    await expect(posted).toContainText('Yours')
    await expect(posted.locator('mark')).toContainText('0.50')
    await expect(posted.getByRole('button', { name: /^Cancel request No\. 4\b/ })).toBeVisible()
    await expect(page.getByTestId('board-summary')).toContainText('5 open requests.')
  })

  test('the asset chosen for a request survives a reload and goes back with Back', async ({ page }) => {
    await openApp(page, '/requests')
    await postButton(page).click()
    await page.getByRole('dialog', { name: 'Post a request' }).getByRole('button', { name: /^FUND/ }).click()
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Request a put on FUND')

    await page.reload()
    await expect(page.getByRole('dialog')).toContainText('Request a put on FUND')

    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(search(page).has('new')).toBe(false)
  })

  test('with the board filtered to one asset, Post a request skips the chooser; closing clears the URL', async ({ page }) => {
    await openApp(page, '/requests?asset=bond', { connect: true })
    await expect(rows(page)).toHaveCount(1)
    await postButton(page).click()
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Request a put on BOND')
    await expect(page.getByText('Choose the asset the option is on.')).toHaveCount(0)
    expect(search(page).get('new')).toBe('1')
    await page.keyboard.press('Escape')
    await expect(ticket).toBeHidden()
    expect(search(page).has('new')).toBe(false)
    expect(search(page).get('asset')).toBe('bond')
  })

  test('closing the asset chooser leaves the board as it was', async ({ page }) => {
    await openApp(page, '/requests')
    await postButton(page).click()
    const chooser = page.getByRole('dialog', { name: 'Post a request' })
    await expect(chooser).toBeVisible()
    await chooser.getByRole('button', { name: 'Close' }).click()
    await expect(chooser).toBeHidden()
    expect(search(page).has('new')).toBe(false)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(4)
  })

  test('fill a request from the second wallet and land on the position', async ({ page }) => {
    await openApp(page, '/requests', { connect: 'b' })
    // Wallet B posted No. 1; it fills wallet A's No. 0 (a put on 2.00 BOND, 196.00 USDx to lock).
    await expect(row(page, '1')).toContainText('Yours')
    const target = row(page, '0')
    const fill = target.getByRole('button', { name: /^Fill request/ })
    await expect(fill).toHaveAccessibleName(/you lock 196\.00\sUSDx$/)
    await fill.click()
    expect(search(page).get('bid')).toBe('0')
    await expect(target).toHaveAttribute('data-selected', 'true')

    // The fill ticket (owned by the ticket feature) opens on its review: the row already showed the terms.
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Fill a request for a put on BOND')
    await expect(ticket).toContainText('196.00 USDx')
    await expect(ticket.getByRole('button', { name: 'Review' })).toHaveCount(0)
    await ticket.getByRole('button', { name: /^Lock 196\.00 USDx/ }).click()
    await ticket.getByRole('link', { name: 'View position' }).click()
    await expect(page).toHaveURL(/\/portfolio\/\d+/)
    const optionId = /\/portfolio\/(\d+)/.exec(page.url())?.[1]
    // The ticket belonged to the Requests page and leaves with it.
    await expect(ticket).toBeHidden()
    await expect(pageHeading(page)).toContainText('Put on 2.00 BOND')

    // The request left the board, and its buyer finds the same position from My requests.
    await goTo(page, 'Requests')
    await expect(rows(page)).toHaveCount(3)
    await expect(row(page, '0')).toHaveCount(0)
    // By address: `switchAccount(page, 'a')` clears `?as=`, and the root route's retained search puts it back.
    await switchAccount(page, ADDR_A)
    await mineTab(page).click()
    await expect(row(page, '0')).toContainText('Filled')
    await row(page, '0').getByRole('link', { name: /^View position/ }).click()
    await expect(page).toHaveURL(new RegExp(`/portfolio/${optionId}(\\?|$)`))
  })

  test('a guest opens the fill ticket and is asked to connect, never shown a dead button', async ({ page }) => {
    await openApp(page, '/requests')
    await row(page, '2').getByRole('button', { name: /^Fill request/ }).click()
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Fill a request for a put on FUND')
    await expect(ticket.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await ticket.getByRole('button', { name: 'Close' }).click()
    await expect(ticket).toBeHidden()
    expect(search(page).has('bid')).toBe(false)
  })
})

test.describe('Requests on a phone @phone', () => {
  test('the card of a request, the filters on two lines under 400 px, 44 px targets, no sideways scroll', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    expect(isPhone(page)).toBe(true)
    await expect(page.getByRole('table')).toHaveCount(0)
    const list = page.getByRole('list', { name: /^Open requests/ })
    await expect(list.getByRole('listitem')).toHaveCount(4)
    await expectNoHorizontalOverflow(page)

    // The card of ruling F15, the same as on the asset Requests tab: what is wanted and the premium per unit, the
    // strike and the total, the deadline and the time left, the buyer and the number.
    const first = rows(page).first()
    await expect(first).toContainText(/(Put|Call) on [\d.]+\s[A-Z]+/)
    await expect(first).toContainText(/per (EQTY|FUND|BOND)/)
    await expect(first).toContainText(/Strike\s*[\d.]+\sUSDx/)
    await expect(first).toContainText(/Demo price\s[\d.]+/)
    await expect(first).toContainText('in total')
    await expect(first).toContainText('Buyer')
    await expect(first).toContainText(/No\.\s\d/)
    await expect(first).not.toContainText('You lock')

    // Under 400 px the asset select takes the first line whole, so the chosen asset is never cut short; the kind
    // switch and the order share the second.
    const asset = page.getByRole('combobox', { name: 'Asset' })
    const kindSwitch = page.getByRole('radiogroup', { name: 'Kind' })
    const sortButton = page.getByRole('button', { name: /^Sort/ })
    const [assetBox, kindBox, sortBox] = [await asset.boundingBox(), await kindSwitch.boundingBox(), await sortButton.boundingBox()]
    expect(assetBox?.width ?? 0).toBeGreaterThan(300)
    expect(Math.abs((kindBox?.y ?? 0) - (sortBox?.y ?? 100))).toBeLessThanOrEqual(2)
    expect(kindBox?.y ?? 0).toBeGreaterThan((assetBox?.y ?? 0) + (assetBox?.height ?? 0) - 1)
    await expect(asset).toContainText('All assets')

    for (const control of [
      postButton(page),
      boardTab(page),
      mineTab(page),
      asset,
      sortButton,
      // The kind switch is one 44 px strip; its segments sit inside its 1 px border.
      page.getByRole('radiogroup', { name: 'Kind' }),
      ...(await page.getByRole('button', { name: /^Fill request/ }).all()),
      page.getByRole('button', { name: /^Cancel request/ }),
    ]) {
      const box = await control.boundingBox()
      expect(box?.height ?? 0, (await control.innerText()).slice(0, 40)).toBeGreaterThanOrEqual(44)
    }

    // The order menu writes the URL like the headers do on a desktop.
    await sortButton.click()
    await page.getByRole('menuitemradio', { name: 'Highest premium per unit' }).click()
    await page.keyboard.press('Escape')
    expect(search(page).get('sort')).toBe('premium')

    // Cancelling is a short confirmation: a sheet, with the same staged transaction.
    await row(page, '0').getByRole('button', { name: /^Cancel request/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Cancel request No. 0' })
    await expect(sheet).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await sheet.getByRole('button', { name: 'Cancel request', exact: true }).click()
    const done = page.getByRole('dialog', { name: 'Request cancelled' })
    await expect(done.getByTestId('cancel-outcome')).toContainText('Transaction')
    await done.getByRole('button', { name: 'Done' }).click()
    await expect(rows(page)).toHaveCount(3)

    await mineTab(page).click()
    await page.getByRole('switch', { name: 'Show closed' }).click()
    await expect(page.getByRole('list', { name: /^My requests/ }).getByRole('listitem')).toHaveCount(1)
    await expect(row(page, '0')).toContainText('Cancelled')
    await expectNoHorizontalOverflow(page)
  })
})

test.describe('the same drawing on both pages (ruling F15) @both', () => {
  test('/requests and the asset Requests tab draw an open request with the same columns, figures and card', async ({ page }) => {
    await openApp(page, '/requests?asset=fund')
    await expect(rows(page)).toHaveCount(2)
    const board = row(page, '2')
    const boardText = ((await board.textContent()) ?? '').replace(/\s+/g, ' ')
    const fillName = (await board.getByRole('button', { name: /^Fill request/ }).getAttribute('aria-label')) ?? ''
    expect(fillName).toMatch(/^Fill request: /)

    await page.goto('/markets/fund?tab=requests')
    const main = page.getByRole('main')
    if (isPhone(page)) {
      // One card on both pages: the same lines, the same action.
      const card = main.getByRole('list', { name: 'Open requests on FUND' }).getByRole('listitem').filter({ has: page.getByRole('link', { name: fillName, exact: true }) })
      await expect(card).toContainText('No. 2')
      await expect(card).toContainText(/Put on 10\.00\sFUND/)
      await expect(card).toContainText('per FUND')
      await expect(card).toContainText('in total')
      await expect(card).toContainText('Buyer')
      await expect(card.getByRole('link', { name: /^Fill request/ })).toHaveAccessibleName(fillName)
      for (const text of ['Put on 10.00', 'per FUND', 'in total', 'Buyer', 'No. 2']) expect(boardText).toContain(text)
      return
    }
    const table = main.getByRole('table', { name: 'Open requests on FUND' })
    await expect(table.getByRole('columnheader')).toHaveText(['Kind', 'Strike', 'Quantity', 'Deadline', 'Premium per unit', 'Buyer', 'Action'])
    const tabRow = table.locator('tbody tr').filter({ has: page.getByRole('link', { name: fillName, exact: true }) })
    await expect(tabRow).toContainText('No. 2')
    // The same figures and deadline format, the strike in the serif, and the same action with the same name.
    await expect(tabRow.locator('time')).toHaveText(/^\d{1,2}\s[A-Z][a-z]{2}\s\d{4},\s08:00\sUTC$/)
    await expect(tabRow).toContainText(/USDx\s*in total/)
    expect(await tabRow.locator('td[data-strike]').evaluate((td) => getComputedStyle(td).fontFamily)).toMatch(/Serif/)
    await expect(tabRow.getByRole('link', { name: /^Fill request/ })).toHaveAccessibleName(fillName)
    for (const text of ['Put', 'No. 2', '10.00 FUND', 'in total']) expect(boardText).toContain(text)
    await expect(tabRow.getByRole('link', { name: /^Fill request/ })).toHaveAttribute('data-variant', 'secondary')
  })
})

test.describe('Requests accessibility @both', () => {
  test('axe: the board as a guest and as a wallet, in both themes', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(rows(page)).toHaveCount(4)
    await expectNoAxeViolations(page)
    await connect(page)
    await expect(rows(page).filter({ hasText: 'Yours' })).toHaveCount(1)
    await expectNoAxeViolations(page)
  })

  test('axe: My requests, the guest note and the filtered-empty board', async ({ page }) => {
    await openApp(page, '/requests?mine=1')
    await expect(connectButton(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connect a wallet to see your requests.' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('tabpanel').getByRole('button', { name: 'Connect wallet' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expectNoAxeViolations(page)

    await boardTab(page).click()
    await page.getByRole('radiogroup', { name: 'Kind' }).getByRole('radio', { name: 'Call' }).click()
    await chooseOption(page, 'Asset', /^BOND/)
    await expect(page.getByRole('heading', { name: 'No open requests match these filters.' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('axe: the cancel confirmation and the asset chooser', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    await row(page, '0').getByRole('button', { name: /^Cancel request/ }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel request No. 0' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Keep request' }).click()

    await postButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Post a request' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('keyboard: filters, the order, a row action and the confirmation work without a pointer', async ({ page }) => {
    test.skip(isPhone(page), 'A keyboard path is a desktop concern; the phone project covers touch targets.')
    await openApp(page, '/requests', { connect: true })
    await expect(rows(page)).toHaveCount(4)

    const kind = page.getByRole('radiogroup', { name: 'Kind' })
    await kind.getByRole('radio', { name: 'All', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(kind.getByRole('radio', { name: 'Put' })).toBeChecked()
    await expect(rows(page)).toHaveCount(3)

    await page.getByRole('columnheader', { name: /^Premium per unit/ }).getByRole('button').focus()
    await page.keyboard.press('Enter')
    expect(search(page).get('sort')).toBe('premium')

    const cancel = row(page, '0').getByRole('button', { name: /^Cancel request/ })
    await cancel.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 0' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(cancel).toBeFocused()
  })
})
