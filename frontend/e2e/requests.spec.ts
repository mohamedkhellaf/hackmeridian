/**
 * /requests: the board of funded bids, its filters and order in the URL, the wallet's own requests, cancelling
 * as a staged transaction, and the two tickets the page opens (post a request, sell to a bid).
 *
 * The mock market seeds four open requests: No. 000000 by wallet A (put on BOND), No. 000001 by wallet B (put on
 * FUND), No. 000002 (put on FUND) and No. 000003 (call on EQTY) by two fictional hedgers.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { bidEscrowDisclosure } from '../src/core/disclosures'
import { ADDR_A, connect, connectButton, expectNoAxeViolations, expectNoHorizontalOverflow, goTo, isPhone, openApp, pageHeading, switchAccount, walletButton } from './helpers'

const LEAD = "A request is a buyer's premium already escrowed in the contract, waiting for a seller."

const rows = (page: Page): Locator => page.getByTestId('request-row')
const row = (page: Page, serial: string): Locator => rows(page).filter({ hasText: `No. ${serial}` })
const boardTab = (page: Page): Locator => page.getByRole('tab', { name: /^Open requests/ })
const mineTab = (page: Page): Locator => page.getByRole('tab', { name: /^My requests/ })
const postButton = (page: Page): Locator => page.getByRole('button', { name: 'Post a request' }).first()
const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams

/** The per-unit premium of every row on screen, in row order, as numbers (display figures: ordering only). */
async function perUnitFigures(page: Page): Promise<number[]> {
  const texts = await rows(page).allInnerTexts()
  return texts.map((text) => Number(/([\d,.]+) per [A-Z]+/.exec(text)?.[1].replace(/,/g, '')))
}

/** The deadline of every row on screen, in row order, as epoch milliseconds. */
async function deadlines(page: Page): Promise<number[]> {
  return rows(page).evaluateAll((list) => list.map((el) => Date.parse(el.querySelector('time')?.getAttribute('datetime') ?? '')))
}

async function chooseOption(page: Page, label: string, option: string | RegExp): Promise<void> {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('Requests board', () => {
  test('lists the seeded requests with every term a seller prices', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(pageHeading(page)).toHaveText('Requests')
    await expect(page.getByText(LEAD)).toBeVisible()

    await expect(rows(page)).toHaveCount(4)
    await expect(page.getByRole('table', { name: /^Open requests/ })).toBeVisible()
    await expect(boardTab(page)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('board-summary')).toContainText(/^4 open requests\. [\d,.]+ USDx of premium is escrowed in the contract\./)

    // One row in full: asset, kind as glyph and word, quantity, strike, deadline with countdown, premium total and
    // per unit, buyer, and the collateral a seller would lock.
    const fund = row(page, '000002')
    await expect(fund.getByRole('rowheader')).toContainText('FUND')
    await expect(fund.getByRole('rowheader')).toContainText('Fund share')
    await expect(fund).toContainText('Put')
    await expect(fund).toContainText('10.00 FUND')
    await expect(fund).toContainText(/\d+\.\d{2} per FUND/)
    await expect(fund.locator('time')).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, 08:00 UTC$/)
    await expect(fund.getByRole('timer')).toHaveAttribute('aria-label', /^Time left: /)
    await expect(fund).toContainText('GHED…AAAA')
    const sell = fund.getByRole('button', { name: /^Sell to this bid/ })
    await expect(sell).toHaveAccessibleName(/^Sell to this bid: put on 10\.00 FUND at [\d.]+ USDx, until .+ UTC, premium [\d.]+ USDx, you lock [\d,.]+ USDx$/)

    // A call locks the asset itself.
    await expect(row(page, '000003').getByRole('button', { name: /^Sell to this bid/ })).toHaveAccessibleName(/you lock 4\.00 EQTY$/)

    // The default order is the soonest deadline.
    const when = await deadlines(page)
    expect(when).toEqual([...when].sort((a, b) => a - b))
  })

  test('filters and order are real controls that live in the URL', async ({ page }) => {
    await openApp(page, '/requests')
    await expect(rows(page)).toHaveCount(4)

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

    await chooseOption(page, 'Sort by', 'Highest premium per unit')
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
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toContainText('Highest premium per unit')
    const filtered = await perUnitFigures(page)
    expect(filtered).toEqual([...filtered].sort((a, b) => b - a))

    // Back to the default order: the param leaves the URL.
    await chooseOption(page, 'Sort by', 'Soonest deadline')
    expect(search(page).has('sort')).toBe(false)
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
    await expect(page.getByRole('button', { name: /^Sell to this bid/ })).toHaveCount(4)
    for (const button of await page.getByRole('button', { name: /^Sell to this bid/ }).all()) await expect(button).toBeEnabled()
    await expect(page.getByText('Yours')).toHaveCount(0)

    await mineTab(page).click()
    expect(search(page).get('mine')).toBe('1')
    await expect(page.getByRole('heading', { name: 'Connect a wallet to see your requests.' })).toBeVisible()
    await page.getByRole('tabpanel').getByRole('button', { name: 'Connect wallet' }).click()
    await expect(walletButton(page)).toBeVisible()
    await expect(row(page, '000000')).toContainText('BOND')
    await expect(row(page, '000000')).toContainText('Open')
    await expect(row(page, '000000')).toContainText('Premium in the contract')
  })

  test('the wallet own request reads Yours and is cancelled as a staged transaction', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    const mine = row(page, '000000')
    await expect(mine).toContainText('Yours')
    await expect(mine.getByRole('button', { name: /^Sell to this bid/ })).toHaveCount(0)
    await expect(mineTab(page)).toContainText('1')
    // The wallet's own figure sits under the highlighter.
    const premium = /[\d.]+ USDx/.exec((await mine.locator('mark').innerText()).replace(/\s+/g, ' '))?.[0] ?? ''
    expect(premium).toMatch(/^[\d.]+ USDx$/)

    await mine.getByRole('button', { name: /^Cancel request No\. 000000/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 000000' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Put on 2.00 BOND')
    await expect(dialog).toContainText(/Strike\s*[\d.]+ USDx per BOND/)
    await expect(dialog).toContainText('Returned to your wallet')
    await expect(dialog).toContainText(premium)
    await expect(dialog.getByRole('button', { name: 'Keep request' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel request', exact: true }).click()
    // The stages are named while the transaction runs, then the outcome stays on screen with its hash.
    await expect(dialog.getByRole('list', { name: 'Transaction progress' })).toBeVisible()
    await expect(dialog.getByTestId('cancel-outcome')).toContainText(`Request cancelled. ${premium} returned to your wallet.`)
    await expect(dialog.getByTestId('cancel-outcome')).toContainText('Transaction')
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).toBeHidden()

    // Not optimistic: the row left because the contract was read again.
    await expect(rows(page)).toHaveCount(3)
    await expect(row(page, '000000')).toHaveCount(0)
    await mineTab(page).click()
    await expect(row(page, '000000')).toContainText('Cancelled')
    await expect(row(page, '000000')).toContainText('Premium returned')
    await expect(row(page, '000000').getByRole('button')).toHaveCount(0)

    // And it is on record in Activity (in the wallet menu at this width).
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: /^Activity/ }).click()
    await expect(page).toHaveURL(/\/activity/)
    await expect(page.getByText(/Cancel request for put on 2\.00 BOND/).first()).toBeVisible()
  })

  test('keeping the request closes the dialog and sends nothing', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    await row(page, '000000').getByRole('button', { name: /^Cancel request/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 000000' })
    await dialog.getByRole('button', { name: 'Keep request' }).click()
    await expect(dialog).toBeHidden()
    await expect(rows(page)).toHaveCount(4)
    await expect(row(page, '000000')).toContainText('Yours')
  })

  test('a failed read says so and offers a retry', async ({ page }) => {
    // The mock market is a chunk of its own: without it the contract cannot be read.
    await page.route(/mockClient/, (route) => route.abort())
    await page.goto('/requests')
    await expect(pageHeading(page)).toHaveText('Requests')
    await expect(page.getByText('Requests could not be read.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
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
    await expect(chooser.getByRole('button', { name: /^EQTY/ })).toContainText('Demo price')
    await chooser.getByRole('button', { name: /^EQTY/ }).click()
    await expect(chooser).toBeHidden()

    // The bid ticket (owned by the ticket feature) opens on that asset.
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Request a put on EQTY')
    await ticket.getByRole('radio', { name: /UTC, in \d+ d/ }).nth(1).click()
    await ticket.getByRole('radio', { name: /^24\.00/ }).click()
    await ticket.getByRole('textbox', { name: /^Quantity/ }).fill('3')
    await ticket.getByRole('textbox', { name: /^Premium you offer/ }).fill('1.5')
    await expect(ticket.getByText(bidEscrowDisclosure('1.50 USDx')).first()).toBeVisible()
    await ticket.getByRole('button', { name: 'Review' }).click()
    await ticket.getByRole('checkbox').check()
    await ticket.getByRole('button', { name: 'Post request, escrow 1.50 USDx' }).click()

    // The receipt: the request as a note with its number, and the transaction.
    await expect(ticket).toContainText('Posted. Your premium is in escrow.')
    await expect(ticket).toContainText('Request No. 000004')
    await expect(ticket).toContainText('Premium escrowed')
    await expect(ticket).toContainText('Transaction')
    await ticket.getByRole('button', { name: 'Done' }).click()
    await expect(ticket).toBeHidden()
    expect(search(page).has('new')).toBe(false)

    await expect(rows(page)).toHaveCount(5)
    const posted = row(page, '000004')
    await expect(posted.getByRole('rowheader')).toContainText('EQTY')
    await expect(posted).toContainText('Put')
    await expect(posted).toContainText('3.00 EQTY')
    await expect(posted).toContainText('24.00 USDx')
    await expect(posted).toContainText('1.50 USDx')
    await expect(posted).toContainText('0.50 per EQTY')
    await expect(posted).toContainText('Yours')
    await expect(posted.locator('mark')).toContainText('1.50')
    await expect(posted.getByRole('button', { name: /^Cancel request No\. 000004/ })).toBeVisible()
    await expect(mineTab(page)).toContainText('2')
    await expect(page.getByTestId('board-summary')).toContainText('5 open requests.')
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

  test('sell to a bid from the second wallet and land on the position', async ({ page }) => {
    await openApp(page, '/requests', { connect: 'b' })
    // Wallet B posted No. 000001; it sells to wallet A's No. 000000 (a put on 2.00 BOND, 196.00 USDx to lock).
    await expect(row(page, '000001')).toContainText('Yours')
    const target = row(page, '000000')
    await expect(target).toContainText('196.00 USDx')
    await target.getByRole('button', { name: /^Sell to this bid/ }).click()
    expect(search(page).get('bid')).toBe('0')
    await expect(target).toHaveAttribute('data-selected', 'true')

    // The fill ticket (owned by the ticket feature): terms, review with consent, sign, receipt.
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Fill a request for a put on BOND')
    await expect(ticket).toContainText('196.00 USDx')
    await ticket.getByRole('button', { name: 'Review' }).click()
    await ticket.getByRole('checkbox').check()
    await ticket.getByRole('button', { name: 'Lock 196.00 USDx and fill' }).click()
    await expect(ticket).toContainText('Filled. You wrote this put; the buyer holds it.')
    await ticket.getByRole('link', { name: 'View position' }).click()
    await expect(page).toHaveURL(/\/portfolio\/\d+/)
    const optionId = /\/portfolio\/(\d+)/.exec(page.url())?.[1]
    // The ticket belonged to the Requests page and leaves with it.
    await expect(ticket).toBeHidden()
    await expect(pageHeading(page)).toContainText('Put on 2.00 BOND')

    // The request left the board, and its buyer finds the same position from My requests.
    await goTo(page, 'Requests')
    await expect(rows(page)).toHaveCount(3)
    await expect(row(page, '000000')).toHaveCount(0)
    // By address: `switchAccount(page, 'a')` clears `?as=`, and the root route's retained search puts it back.
    await switchAccount(page, ADDR_A)
    await mineTab(page).click()
    await expect(row(page, '000000')).toContainText('Filled')
    await expect(row(page, '000000')).toContainText('Premium paid to the seller')
    await row(page, '000000').getByRole('link', { name: /^View position/ }).click()
    await expect(page).toHaveURL(new RegExp(`/portfolio/${optionId}(\\?|$)`))
  })

  test('a guest opens the fill ticket and is asked to connect, never shown a dead button', async ({ page }) => {
    await openApp(page, '/requests')
    await row(page, '000002').getByRole('button', { name: /^Sell to this bid/ }).click()
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Fill a request for a put on FUND')
    await expect(ticket.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await ticket.getByRole('button', { name: 'Close' }).click()
    await expect(ticket).toBeHidden()
    expect(search(page).has('bid')).toBe(false)
  })
})

test.describe('Requests on a phone @phone', () => {
  test('two lines of terms per request, 44 px targets, no sideways scroll', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    expect(isPhone(page)).toBe(true)
    await expect(page.getByRole('table')).toHaveCount(0)
    const list = page.getByRole('list', { name: /^Open requests/ })
    await expect(list.getByRole('listitem')).toHaveCount(4)
    await expectNoHorizontalOverflow(page)

    const first = rows(page).first()
    await expect(first).toContainText(/(Put|Call) on [\d.]+ [A-Z]+/)
    await expect(first).toContainText(/Strike [\d.]+ USDx/)
    await expect(first).toContainText(/You lock [\d,.]+ [A-Za-z]+/)
    await expect(first).toContainText('Buyer')

    for (const control of [
      postButton(page),
      boardTab(page),
      mineTab(page),
      page.getByRole('combobox', { name: 'Asset' }),
      page.getByRole('combobox', { name: 'Sort by' }),
      // The kind switch is one 44 px strip; its segments sit inside its 1 px border.
      page.getByRole('radiogroup', { name: 'Kind' }),
      ...(await page.getByRole('button', { name: /^Sell to this bid/ }).all()),
      page.getByRole('button', { name: /^Cancel request/ }),
    ]) {
      const box = await control.boundingBox()
      expect(box?.height ?? 0, (await control.innerText()).slice(0, 40)).toBeGreaterThanOrEqual(44)
    }

    // Cancelling is a short confirmation: a sheet, with the same staged transaction.
    await row(page, '000000').getByRole('button', { name: /^Cancel request/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Cancel request No. 000000' })
    await expect(sheet).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await sheet.getByRole('button', { name: 'Cancel request', exact: true }).click()
    await expect(sheet.getByTestId('cancel-outcome')).toContainText('Request cancelled.')
    await sheet.getByRole('button', { name: 'Done' }).click()
    await expect(rows(page)).toHaveCount(3)

    await mineTab(page).click()
    await expect(page.getByRole('list', { name: /^My requests/ }).getByRole('listitem')).toHaveCount(1)
    await expect(row(page, '000000')).toContainText('Cancelled')
    await expectNoHorizontalOverflow(page)
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
    await row(page, '000000').getByRole('button', { name: /^Cancel request/ }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel request No. 000000' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Keep request' }).click()

    await postButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Post a request' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('keyboard: filters, a row action and the confirmation work without a pointer', async ({ page }) => {
    test.skip(isPhone(page), 'A keyboard path is a desktop concern; the phone project covers touch targets.')
    await openApp(page, '/requests', { connect: true })
    await expect(rows(page)).toHaveCount(4)

    const kind = page.getByRole('radiogroup', { name: 'Kind' })
    await kind.getByRole('radio', { name: 'All', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(kind.getByRole('radio', { name: 'Put' })).toBeChecked()
    await expect(rows(page)).toHaveCount(3)

    const cancel = row(page, '000000').getByRole('button', { name: /^Cancel request/ })
    await cancel.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 000000' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(cancel).toBeFocused()
  })
})
