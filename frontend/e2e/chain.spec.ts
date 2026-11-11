/**
 * Chain mode of the asset page: the option chain on the standard grid, its keyboard model, the book of the
 * selected series, the orders that are off the grid, and the phone layout. Runs on the mock market, whose dates
 * move with the clock: the listed expiries are computed here the way the app computes them.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { DEMO_MAKERS } from '../src/core/options/demoAccounts'
import { expiryDayKey, standardExpiries } from '../src/core/series'
import { formatUtcDay } from '../src/core/format'
import { connect, currentPath, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, failNextRead, openApp, routeTo } from './helpers'

const EXPIRIES = standardExpiries(Math.floor(Date.now() / 1000))
const DAYS = EXPIRIES.map(expiryDayKey)
const LABELS = EXPIRIES.map(formatUtcDay)

const chain = (page: Page, code = 'BOND'): Locator => page.getByRole('table', { name: new RegExp(`^${code} option chain`) })
const cell = (page: Page, name: RegExp): Locator => page.getByTestId('chain-mode').getByRole('button', { name })
/** Matches a short date as the app prints it, with the no-break space core keeps inside it. */
const date = (label: string): string => label.replace(/\s/g, '\\s')
/** The words a half's name starts with: its figure, the wallet's own figure, or nothing on it. */
const LEAD = {
  offer: '(?:Offer \\d+\\.\\d\\d|Your offer \\d+\\.\\d\\d|No offer)',
  request: '(?:Request \\d+\\.\\d\\d|Your request \\d+\\.\\d\\d|No request)',
} as const
/** One half of a chain cell (ruling F3): the offer half next to the strike, or the request half further out. */
const half = (page: Page, side: 'offer' | 'request', kind: 'call' | 'put', strike: string): Locator =>
  cell(page, new RegExp(`^${LEAD[side]} at ${strike.replace('.', '\\.')}, ${kind},`))
/** The table cell around a half: both halves of a side, and "yours" over its edge. */
const around = (_page: Page, button: Locator): Locator => button.locator('xpath=ancestor::td[1]')
/** The words an empty half shows when pointed at or focused, and nothing at rest. */
const hintOf = (button: Locator): Locator => button.locator('span').first()
const panel = (page: Page): Locator => page.getByTestId('series-panel')
const book = (page: Page): Locator => panel(page).getByRole('table', { name: /^Book of/ })
/** The rows of one side of the book: `offers` above the gap line, `requests` below it. */
const sideRows = (page: Page, side: 'offers' | 'requests'): Locator => book(page).locator(`tbody[data-section="${side}"] tr[data-order]`)
const other = (page: Page): Locator => page.getByTestId('other-offers')
const ticket = (page: Page): Locator => page.getByRole('complementary', { name: 'Order ticket' })
const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams
/** The ticket's number of an order, unpadded as the contract has it (ruling F1). */
const numbered = (id: string): RegExp => new RegExp(`No\\. ${id}(?!\\d)`)

/** The figures of a column of some rows, as numbers. */
async function column(rows: Locator, nth: number): Promise<number[]> {
  const texts = await rows.evaluateAll((trs, i) => trs.map((r) => (r.children[i] as HTMLElement).innerText), nth)
  return texts.map((t) => Number(/\d[\d,]*\.\d+/.exec(t)?.[0].replace(/,/g, '')))
}

/** Columns of the book: No., From, Quantity, Premium per unit, Total premium, action. */
const COL = { no: 0, from: 1, qty: 2, perUnit: 3, total: 4 } as const

test.describe('option chain', () => {
  test('renders both sides of each series on the standard grid: the best offer and the best request, each with its size', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    const table = chain(page)
    await expect(table).toBeVisible()

    // Nine strikes around the demo price 99.40, ascending, each a row header in the centre.
    await expect(table.getByRole('rowheader')).toHaveText(['95.00', '96.00', '97.00', '98.00', '99.00', '100.00', '101.00', '102.00', '103.00'])
    // The reference price sits between 99 and 100 with its label; nothing calls it a market price.
    const rows = table.locator('tbody tr')
    await expect(rows.nth(5)).toHaveText('Demo price 99.40')
    await expect(page.getByTestId('chain-mode')).toContainText('Shaded cells are in the money at the demo price.')
    await expect(page.getByTestId('chain-mode')).not.toContainText('Chosen by the team')
    // Nothing is selected: one line says what a premium does.
    await expect(page.getByTestId('chain-mode')).toContainText('Select a premium to see its offers and requests.')
    await expect(page.getByTestId('chain-mode')).toContainText(/sizes in BOND\. Deadline /)

    // The listed deadlines are one radio group with the time left; the first is chosen; the count of orders is a
    // plain numeral beside the date on a wide screen.
    const expiry = page.getByRole('radiogroup', { name: 'Deadline' })
    await expect(expiry.getByRole('radio')).toHaveCount(EXPIRIES.length)
    await expect(expiry.getByRole('radio').first()).toContainText(LABELS[0])
    await expect(expiry.getByRole('radio').first()).toBeChecked()

    // Each side of a strike is two buttons, the offer next to the strike and the request further out: four per row.
    await expect(table.getByRole('button')).toHaveCount(36)
    // Priced halves carry the full sentence, the maker count only there; moneyness is said in words.
    const priced = cell(page, /^Offer \d+\.\d\d at \d+\.\d\d, (call|put), \d+\s\w{3}, for [\d.,]+ BOND, \d+ offers?/)
    expect(await priced.count()).toBeGreaterThanOrEqual(8)
    await expect(cell(page, new RegExp(`^Offer \\d+\\.\\d\\d at 99\\.00, call, ${date(LABELS[0])}, for [\\d.]+ BOND, \\d offers?, \\d makers?, in the money at the demo price\\. Buy\\.$`))).toBeVisible()
    await expect(cell(page, new RegExp(`^Offer \\d+\\.\\d\\d at 99\\.00, put, ${date(LABELS[0])}, for [\\d.]+ BOND, \\d offers?, \\d makers?\\. Buy\\.$`))).toBeVisible()
    await expect(chain(page)).not.toContainText(/makers?|No offer|Ask for a price/)

    // An empty half shows no text at rest and names what a press does (ruling F2).
    const empty = cell(page, new RegExp(`^No offer at 95\\.00, call, ${date(LABELS[0])}, in the money at the demo price\\. Post a request\\.$`))
    await expect(empty).toBeVisible()
    await expect(hintOf(empty)).toHaveCSS('opacity', '0')
    await expect(cell(page, new RegExp(`^No request at 95\\.00, put, ${date(LABELS[0])}\\. Post a request\\.$`))).toBeVisible()

    // A cell agrees with the book of its series: same best premium, same size, same number of distinct makers.
    const put99 = half(page, 'offer', 'put', '99.00')
    const name = (await put99.getAttribute('aria-label'))!
    const [, best, size, makers] = /^Offer (\d+\.\d\d) at .*, for ([\d.]+) BOND, \d+ offers?, (\d+) makers?/.exec(name)!
    // The button's text is its figure, a word of its name; its size is drawn beside it.
    await expect(put99).toHaveText(best)
    await expect(put99).toHaveAttribute('data-size', `×${size}`)
    await put99.click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99.00 put, ${LABELS[0]}`)
    await expect(page.getByTestId('chain-mode')).not.toContainText('Select a premium')
    const offers = sideRows(page, 'offers')
    const perUnit = await column(offers, COL.perUnit)
    expect(perUnit[0].toFixed(2)).toBe(best)
    expect((await column(offers, COL.qty))[0].toFixed(2)).toBe(size)
    const from = await offers.evaluateAll((trs, i) => trs.map((r) => (r.children[i] as HTMLElement).innerText), COL.from)
    expect(new Set(from.filter((t) => t.startsWith('Maker'))).size).toBe(Number(makers))
    // From 1200 px the press on the offer opens the ticket in the rail on that best offer.
    const first = (await offers.first().getAttribute('data-order'))!
    expect(search(page).get('offer')).toBe(first.slice(1))
    await expect(ticket(page)).toContainText(numbered(first.slice(1)))
    await expect(offers.first()).toHaveAttribute('data-selected', 'true')
  })

  test('is one tab stop: arrow keys move across the halves, Enter presses, the URL updates and restores', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    const table = chain(page)
    await expect(table).toBeVisible()
    await expect(table.locator('button[tabindex="0"]')).toHaveCount(1)
    await expect(table.locator('button[tabindex="-1"]')).toHaveCount(35)

    // The tab stop starts on the call offer next to the strike, on the row at the reference price.
    const home = half(page, 'offer', 'call', '100.00')
    await expect(home).toHaveAttribute('tabindex', '0')
    await home.focus()
    await page.keyboard.press('ArrowUp')
    await expect(half(page, 'offer', 'call', '99.00')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(half(page, 'offer', 'put', '99.00')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(half(page, 'request', 'put', '99.00')).toBeFocused()
    // Focus shows what a press on an empty half does.
    await expect(hintOf(half(page, 'request', 'put', '99.00'))).toHaveCSS('opacity', '1')
    await page.keyboard.press('ArrowRight') // stops at the edge
    await expect(half(page, 'request', 'put', '99.00')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(half(page, 'request', 'call', '99.00')).toBeFocused()
    await page.keyboard.press('End')
    await expect(half(page, 'request', 'put', '99.00')).toBeFocused()
    await page.keyboard.press('PageDown')
    await expect(half(page, 'request', 'put', '103.00')).toBeFocused()
    await page.keyboard.press('ArrowDown') // stops at the edge
    await expect(half(page, 'request', 'put', '103.00')).toBeFocused()
    await page.keyboard.press('Control+Home')
    await expect(half(page, 'request', 'call', '95.00')).toBeFocused()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await expect(half(page, 'offer', 'call', '98.00')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const put98 = half(page, 'offer', 'put', '98.00')
    await expect(put98).toBeFocused()
    // The half that has focus is now the chain's tab stop.
    await expect(table.locator('button[tabindex="0"]')).toHaveCount(1)
    await expect(put98).toHaveAttribute('tabindex', '0')

    await page.keyboard.press('Enter')
    // Both halves of the series show it selected.
    await expect(put98).toHaveAttribute('aria-pressed', 'true')
    await expect(half(page, 'request', 'put', '98.00')).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98.00 put, ${LABELS[0]}`)
    // The ticket that opens says what it is and takes focus, as a form does; the chain does not talk over it.
    await expectAnnounced(page, /^Order ticket/)
    await expect(ticket(page).getByRole('heading', { name: 'Buy a put on BOND' })).toBeFocused()
    // From 1200 px the ticket opens beside the chain on the best offer of the series.
    expect(search(page).get('side')).toBe('buy')
    expect(search(page).get('offer')).toMatch(/^\d+$/)
    expect(search(page).get('kind')).toBe('put')
    expect(search(page).get('strike')).toBe('98.00')
    expect(search(page).get('expiry')).toBe(DAYS[0])
    await expect(table.locator('button[aria-pressed="true"]')).toHaveCount(2)

    // Another date keeps the strike and the kind, and drops the ticket of the old offer.
    await page.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio').nth(1).click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98.00 put, ${LABELS[1]}`)
    expect(search(page).get('expiry')).toBe(DAYS[1])
    expect(search(page).get('offer')).toBeNull()

    // Back restores the previous selection; a fresh load of the link restores it too.
    await page.goBack()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98.00 put, ${LABELS[0]}`)
    await page.goBack()
    await expect(panel(page)).toHaveCount(0)
    await expect(table.locator('button[aria-pressed="true"]')).toHaveCount(0)
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[1]}&kind=call&strike=100`)
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 100.00 call, ${LABELS[1]}`)
    await expect(half(page, 'offer', 'call', '100.00')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio').nth(1)).toBeChecked()

    // The offer of the selected series opens its ticket; pressed again, it closes the series.
    await half(page, 'offer', 'call', '100.00').click()
    await expect(page).toHaveURL(/[?&]offer=\d+/)
    await half(page, 'offer', 'call', '100.00').click()
    await expect(panel(page)).toHaveCount(0)
    expect(search(page).get('strike')).toBeNull()
    expect(search(page).get('offer')).toBeNull()
    expect(search(page).get('expiry')).toBe(DAYS[1])
  })

  test('each half is its own target: the offer opens Buy on the best offer, the request opens Fill on the best request', async ({ page }) => {
    // Seeded: BOND put 98 on the third date has a maker's offer and a funded request (wallet A's), seen by a guest.
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[2]}`)
    const offer = half(page, 'offer', 'put', '98.00')
    const request = half(page, 'request', 'put', '98.00')
    const [, offerFigure] = /^Offer (\d+\.\d\d) at /.exec((await offer.getAttribute('aria-label'))!)!
    const requestName = (await request.getAttribute('aria-label'))!
    // A request shows its size like an offer, and its name ends with what a press does.
    const [, requestFigure, requestSize] = /^Request (\d+\.\d\d) at 98\.00, put, .*, for ([\d.]+) BOND, \d+ requests?\. Fill request\.$/.exec(requestName)!
    await expect(request).toHaveText(requestFigure)
    await expect(request).toHaveAttribute('data-size', `×${requestSize}`)
    expect(offerFigure).not.toBe(requestFigure)

    await request.click()
    await expect(page).toHaveURL(/[?&]bid=\d+/)
    expect(search(page).get('offer')).toBeNull()
    expect(search(page).get('side')).toBeNull()
    const requestRow = sideRows(page, 'requests').first()
    await expect(requestRow).toHaveAttribute('data-selected', 'true')
    const bidId = (await requestRow.getAttribute('data-order'))!.slice(1)
    expect(search(page).get('bid')).toBe(bidId)
    await expect(ticket(page).getByRole('heading', { name: 'Fill a request for a put on BOND' })).toBeVisible()
    await expect(ticket(page)).toContainText(numbered(bidId))

    // The other half of the same series opens the other side of the book, at its own price.
    await offer.click()
    await expect(page).toHaveURL(/[?&]offer=\d+/)
    expect(search(page).get('side')).toBe('buy')
    expect(search(page).get('bid')).toBeNull()
    await expect(sideRows(page, 'offers').first()).toHaveAttribute('data-selected', 'true')
    await expect(ticket(page).getByRole('heading', { name: 'Buy a put on BOND' })).toBeVisible()
  })

  test('the book is one table, best first on each side of the gap line, and opens the buy ticket for the chosen offer', async ({ page }) => {
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
    const offers = sideRows(page, 'offers')
    await expect(offers).toHaveCount(2)
    await expect(panel(page)).toContainText('The right to sell 1 BOND for 99.00 USDx. Out of the money at the demo price, 99.40.')
    await expect(panel(page)).toContainText('Quantities in BOND, premiums in USDx.')
    await expect(panel(page)).not.toContainText('Offers are funded')
    // Date first, then the time left.
    await expect(panel(page)).toContainText(/Deadline \d{1,2}\s\w{3}\s\d{4},\s08:00\sUTC, in \d/)
    // No request on this series: one muted row says so, under the offers.
    await expect(book(page)).toContainText('No requests on this series.')
    await expect(book(page).getByRole('row', { name: /^Requests/ })).toHaveCount(0)

    // Cheapest premium per unit first, each row with its number and labelled with its source; the first is marked Best.
    const perUnit = await column(offers, COL.perUnit)
    expect(perUnit).toEqual([...perUnit].sort((a, b) => a - b))
    // Best marks every row at the lowest premium per unit. The mock prices from the time left, so two makers can
    // meet on one tick: the pin follows the figures read above, not a fixed row.
    const lowest = Math.min(...perUnit)
    for (const [i, p] of perUnit.entries()) {
      if (p === lowest) await expect(offers.nth(i)).toContainText('Best')
      else await expect(offers.nth(i)).not.toContainText('Best')
    }
    for (const row of await offers.all()) {
      await expect(row.getByRole('cell').nth(COL.from)).toContainText(/^Maker/)
      // The contract's own number, unpadded (ruling F1).
      await expect(row.getByRole('cell').nth(COL.no)).toHaveText(/^(0|[1-9]\d*)$/)
      // Every row action is a small secondary button (ruling F14).
      await expect(row.getByRole('button', { name: /^Buy/ })).toHaveAttribute('data-variant', 'secondary')
      await expect(row.getByRole('button', { name: /^Buy/ })).toHaveAttribute('data-size', 'sm')
    }

    // Buy on the second row opens the ticket for exactly that offer.
    const second = offers.nth(1)
    const key = (await second.getAttribute('data-order'))!
    expect(key).toMatch(/^o\d+$/)
    await expect(second.getByRole('cell').nth(COL.no)).toHaveText(key.slice(1))
    const total = /\d+\.\d\d/.exec(await second.getByRole('cell').nth(COL.total).innerText())![0]
    await second.getByRole('button', { name: /^Buy put on \d+\.\d\d BOND from GMAK…[A-D]{4} for \d+\.\d\d USDx$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]offer=${key.slice(1)}(&|$)`))
    expect(search(page).get('side')).toBe('buy')
    // The selection stays, the row of the open ticket is marked, and the ticket shows that offer.
    expect(search(page).get('strike')).toBe('99.00')
    await expect(second).toHaveAttribute('data-selected', 'true')
    await expect(ticket(page)).toContainText(numbered(key.slice(1)))
    await expect(ticket(page)).toContainText(total)
    await expect(ticket(page).getByRole('button', { name: 'Connect wallet' })).toBeVisible()

    // A new selection drops the ticket of the old offer and opens one on the new series' best offer.
    await half(page, 'offer', 'call', '99.00').click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99.00 call, ${LABELS[0]}`)
    expect(search(page).get('kind')).toBe('call')
    expect(search(page).get('offer')).not.toBe(key.slice(1))
    await expect(book(page).locator('tbody[data-section="offers"] tr[data-order][data-selected]')).toHaveCount(1)
  })

  test('requests are the other side of the book and open the fill ticket', async ({ page }) => {
    // Seeded: a request on a series nobody quotes (FUND put 10.40, second date).
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[1]}`)
    const requestOnly = cell(page, new RegExp(`^Request \\d+\\.\\d\\d at 10\\.40, put, ${date(LABELS[1])}, for [\\d.]+ FUND, 1 request, in the money at the demo price\\. Fill request\\.$`))
    const [, figure, size] = /^Request (\d+\.\d\d) at .*, for ([\d.]+) FUND/.exec((await requestOnly.getAttribute('aria-label'))!)!
    // The figure and its size, in the request half: no word in front of it.
    await expect(requestOnly).toHaveText(figure)
    await expect(requestOnly).toHaveAttribute('data-size', `×${size}`)
    // The offer half beside it is empty, and posts a request.
    await expect(half(page, 'offer', 'put', '10.40')).toHaveAttribute('aria-label', /^No offer at 10\.40, put, .*\. Post a request\.$/)
    await requestOnly.click()
    // From 1200 px the request opens the fill ticket on itself, and its series is selected.
    expect(search(page).get('side')).toBeNull()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`FUND 10.40 put, ${LABELS[1]}`)
    await expect(book(page)).toContainText('No offers on this series.')
    const row = sideRows(page, 'requests')
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('cell').nth(COL.from)).toContainText(/^Buyer/)
    const key = (await row.getAttribute('data-order'))!
    await expect(page).toHaveURL(new RegExp(`[?&]bid=${key.slice(1)}(&|$)`))
    await expect(row).toHaveAttribute('data-selected', 'true')
    await row.getByRole('button', { name: /^Fill request: put on 10\.00 FUND from GHED…AAAA, \d+\.\d\d USDx escrowed$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]bid=${key.slice(1)}(&|$)`))
  })

  test('the book states the gap between the best offer and the best request', async ({ page }) => {
    // Seeded: FUND put 10.00, third date, has offers and a funded request.
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=10.00`)
    await expect(sideRows(page, 'offers').first()).toBeVisible()
    await expect(sideRows(page, 'requests').first()).toBeVisible()
    const offer = (await column(sideRows(page, 'offers'), COL.perUnit))[0]
    const request = (await column(sideRows(page, 'requests'), COL.perUnit))[0]
    await expect(book(page)).toContainText(`${(offer - request).toFixed(2)} between the best offer and the best request.`)
    // The chain cell shows both sides of the same series, each on its own half.
    await expect(half(page, 'offer', 'put', '10.00')).toHaveAttribute('aria-label', new RegExp(`^Offer ${offer.toFixed(2)} at 10\\.00, put, .*, for [\\d.]+ FUND,`))
    await expect(half(page, 'request', 'put', '10.00')).toHaveAttribute('aria-label', new RegExp(`^Request ${request.toFixed(2)} at 10\\.00, put, .*, for [\\d.]+ FUND, 1 request`))
  })

  test('an empty half shows nothing until pointed at, posts a request, and the series actions open empty forms', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    // The director's name for it, word for word (ruling F2).
    const empty = cell(page, new RegExp(`^No offer at 102\\.00, call, ${date(LABELS[0])}\\. Post a request\\.$`))
    await expect(hintOf(empty)).toHaveCSS('opacity', '0')
    await empty.hover()
    await expect(hintOf(empty)).toHaveText('Post a request')
    await expect(hintOf(empty)).toHaveCSS('opacity', '1')
    await empty.click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
    expect(search(page).get('kind')).toBe('call')
    expect(search(page).get('strike')).toBe('102.00')
    expect(search(page).get('expiry')).toBe(DAYS[0])
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 102.00 call, ${LABELS[0]}`)
    await expect(panel(page)).toContainText('Nothing is posted on this series.')
    await expect(half(page, 'offer', 'call', '102.00')).toHaveAttribute('aria-pressed', 'true')
    // The ticket is the request form on those terms.
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a call on BOND')

    // With the form open, every half retargets it instead of opening another ticket, and says so.
    const put99 = half(page, 'offer', 'put', '99.00')
    await expect(put99).toHaveAttribute('aria-label', /\. Post a request\.$/)
    await put99.click()
    expect(search(page).get('side')).toBe('bid')
    expect(search(page).get('kind')).toBe('put')
    expect(search(page).get('strike')).toBe('99.00')
    expect(search(page).get('offer')).toBeNull()
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a put on BOND')

    // "Write an offer" switches to the write form on the same series. No figure the user did not type is put in it.
    await panel(page).getByRole('button', { name: 'Write an offer' }).click()
    await expect(page).toHaveURL(/[?&]side=write(&|$)/)
    expect(search(page).get('strike')).toBe('99.00')
    expect(search(page).get('qty')).toBeNull()
    expect(search(page).get('premium')).toBeNull()
    // With the write form open, an empty half says it moves that form.
    await expect(half(page, 'offer', 'call', '102.00')).toHaveAttribute('aria-label', /\. Write an offer\.$/)
    await panel(page).getByRole('button', { name: 'Post a request' }).click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
    expect(search(page).get('premium')).toBeNull()
  })

  test('a deadline with no orders says so under the chain', async ({ page }) => {
    // The last listed EQTY deadline carries no order in the mock market.
    await openApp(page, `/markets/eqty?mode=chain&expiry=${DAYS[DAYS.length - 1]}`)
    const mode = page.getByTestId('chain-mode')
    await expect(chain(page, 'EQTY')).toBeVisible()
    await expect(mode).toContainText('No orders on this deadline yet. Press a strike to post a request or write the first offer.')
    await expect(mode).not.toContainText('Select a premium')
    // Every half is empty and blank at rest.
    await expect(chain(page, 'EQTY').getByRole('button', { name: /^(Offer|Request|Your) / })).toHaveCount(0)
    // A deadline with orders keeps the instruction.
    await page.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio').first().click()
    await expect(mode).toContainText('Select a premium to see its offers and requests.')
    await expect(mode).not.toContainText('No orders on this deadline')
  })

  test("the highlighter marks only the wallet's own order; own offers show Yours and can be cancelled", async ({ page }) => {
    // Seeded: the default wallet's request on BOND put 98, third date, beside a maker's offer.
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[2]}`, { connect: true })
    const ownRequest = cell(page, /^Your request (\d+\.\d\d) at 98\.00, put, .*, for [\d.]+ BOND, \d+ requests?/)
    const ownCell = around(page, ownRequest)
    await expect(ownCell.locator('mark')).toHaveCount(1)
    await expect(ownCell).toContainText('yours')
    // The maker's offer in the same cell is not marked, and stays a Buy.
    const [, requestFigure] = /^Your request (\d+\.\d\d)/.exec((await ownRequest.getAttribute('aria-label'))!)!
    await expect(ownRequest.locator('mark')).toHaveText(requestFigure)
    const makerOffer = half(page, 'offer', 'put', '98.00')
    await expect(makerOffer.locator('mark')).toHaveCount(0)
    await expect(makerOffer).toHaveAttribute('aria-label', /^Offer \d+\.\d\d at 98\.00, put, .*\. Buy\.$/)
    // The wallet's own request is not taken from the chain: a press shows its series and book, where it can be cancelled.
    await expect(ownRequest).not.toHaveAttribute('aria-label', /Fill request\.$/)
    // A cell the wallet only holds an option in carries no mark: the name says it.
    for (const held of await cell(page, /you hold an option/).all()) {
      if ((await around(page, held).innerText()).includes('yours')) continue
      await expect(around(page, held).locator('mark')).toHaveCount(0)
    }
    await expect(page.getByTestId('chain-mode')).not.toContainText('The highlighter marks')

    // Seeded: the default wallet's open offer, a put on 5 FUND at 9.80 on the third date, tied with a maker's.
    await page.goto(`/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`)
    await connect(page)
    const own = cell(page, /^(Your offer|Offer) \d+\.\d\d at 9\.80, put, .*, 2 offers, 2 makers/)
    await expect(own).toBeVisible()

    const offers = sideRows(page, 'offers')
    const mine = offers.filter({ hasText: 'Yours' })
    await expect(mine).toHaveCount(1)
    await expect(mine.locator('mark')).toHaveCount(1)
    await expect(mine.getByRole('button', { name: /^Buy/ })).toHaveCount(0)
    await expect(offers).toHaveCount(2)
    // Two offers at the same price: both are marked Best.
    const prices = await column(offers, COL.perUnit)
    if (prices[0] === prices[1]) for (const row of await offers.all()) await expect(row).toContainText('Best')

    // Cancel is a small secondary button, as every row action (ruling F14).
    const cancel = mine.getByRole('button', { name: 'Cancel your offer of put on 5.00 FUND' })
    await expect(cancel).toHaveAttribute('data-variant', 'secondary')
    await expect(cancel).toHaveAttribute('data-size', 'sm')
    await cancel.click()
    const dialog = page.getByRole('dialog', { name: 'Cancel offer' })
    await expect(dialog).toContainText('The offer leaves the book and its collateral returns to your wallet.')
    await expect(dialog).toContainText('FUND 9.80 put')
    await expect(dialog).toContainText('49.00 USDx') // 5 x 9.80, the collateral of a put
    await dialog.getByRole('button', { name: 'Cancel offer' }).click()
    await expect(dialog.getByRole('list', { name: 'Transaction progress' })).toContainText('Confirmed')
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(dialog).toHaveCount(0)

    // No optimistic update: the row leaves once the chain was read again, and the cell is no longer the wallet's.
    await expect(offers).toHaveCount(1)
    await expect(book(page)).not.toContainText('Yours')
    await expect(cell(page, /^Offer \d+\.\d\d at 9\.80, put, .*, for [\d.]+ FUND, 1 offer, 1 maker\. Buy\.$/)).toBeVisible()
  })

  test("the wallet's own orders on the asset are listed under the chain, once, and a held option is said in its series", async ({ page }) => {
    // A guest has none: no section.
    await openApp(page, '/markets/fund?mode=chain')
    await expect(chain(page, 'FUND')).toBeVisible()
    await expect(page.getByTestId('your-orders')).toHaveCount(0)

    // Seeded: the default wallet's offer on FUND put 9.80, third date, is listed from any date tab.
    await connect(page)
    const mine = page.getByTestId('your-orders')
    await expect(mine.getByRole('heading', { level: 2 })).toHaveText('Your orders on FUND')
    const row = mine.locator('tbody tr[data-order]').filter({ hasText: 'Put 9.80' })
    await expect(row).toHaveCount(1)
    // The role alone: the title already says the rows are the wallet's. The number is the contract's, unpadded.
    await expect(row.getByRole('cell').nth(2)).toHaveText('Maker')
    await expect(row.getByRole('cell').nth(1)).toHaveText(/^(0|[1-9]\d*)$/)
    await expect(row.getByRole('button', { name: 'Cancel your offer of put on 5.00 FUND' })).toHaveAttribute('data-variant', 'secondary')
    await row.getByRole('button', { name: 'Show put 9.80 in the chain' }).click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`FUND 9.80 put, ${LABELS[2]}`)
    expect(search(page).get('expiry')).toBe(DAYS[2])
    expect(search(page).get('strike')).toBe('9.80')
    // The series' book now lists that order with its Cancel; "Your orders" does not list it a second time.
    await expect(sideRows(page, 'offers').filter({ hasText: 'Yours' })).toHaveCount(1)
    await expect(page.getByTestId('your-orders').locator('tbody tr[data-order]').filter({ hasText: 'Put 9.80' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cancel your offer of put on 5.00 FUND' })).toHaveCount(1)

    // Seeded: the default wallet holds a BOND put 97 on the second date.
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[1]}&kind=put&strike=97.00`)
    await connect(page)
    await expect(panel(page)).toContainText(/You hold [\d.]+\sBOND of this put\./)
    await expect(panel(page).getByRole('link', { name: 'View position' })).toHaveAttribute('href', /^\/portfolio(\/\d+)?$/)
  })

  test('keeping the offer sends nothing', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    await book(page).getByRole('button', { name: /^Cancel your offer/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel offer' })
    await dialog.getByRole('button', { name: 'Keep offer' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(sideRows(page, 'offers')).toHaveCount(2)
  })

  test('other offers are listed with the reason they are off the grid, and stay buyable', async ({ page }) => {
    // Seeded: one EQTY call at a strike between two listed strikes.
    await openApp(page, '/markets/eqty?mode=chain')
    const section = other(page)
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Other offers')
    await expect(section).toContainText('1 order is on terms the chain does not list. It can still be traded.')
    const table = section.getByRole('table', { name: 'Other offers on EQTY' })
    const row = table.locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Call 24.75')
    await expect(row).toContainText('Off-grid strike')
    await expect(row).toContainText('Maker')
    await expect(section).toContainText('The strike is not one of the listed strikes around the reference price.')
    // The chain itself has no 24.75 row: the offer prices no cell.
    await expect(chain(page, 'EQTY').getByRole('rowheader', { name: '24.75' })).toHaveCount(0)

    const key = (await row.getAttribute('data-order'))!
    await row.getByRole('button', { name: /^Buy call on 3\.00 EQTY from GMAK…DDDD for \d+\.\d\d USDx$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]offer=${key.slice(1)}(&|$)`))
    await expect(ticket(page)).toContainText(numbered(key.slice(1)))

    // Seeded: one FUND put two days after a listed Friday. The expiry bar links to it.
    await page.goto('/markets/fund?mode=chain')
    const link = page.getByRole('link', { name: 'Other dates, 1 order' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/#other-offers$/)
    await expect(other(page)).toBeInViewport()
    const fundRow = other(page).getByRole('table', { name: 'Other offers on FUND' }).locator('tbody tr')
    await expect(fundRow).toContainText('Put 10.20')
    await expect(fundRow).toContainText('Non-standard deadline')
    await expect(fundRow).toContainText(/08:00\sUTC/)
    await expect(other(page)).toContainText('The deadline is not one of the listed Fridays at 08:00 UTC.')
    // BOND has none: no section, no link.
    await page.goto('/markets/bond?mode=chain')
    await expect(chain(page)).toBeVisible()
    await expect(other(page)).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^Other dates/ })).toHaveCount(0)
  })

  test('a link to a series that is off the grid still opens its book, and says so', async ({ page }) => {
    await openApp(page, '/markets/eqty?mode=chain&kind=call&strike=24.75')
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`EQTY 24.75 call, ${LABELS[0]}`)
    // Said once, in the terms line; not drawn as a warning on the row.
    await expect(panel(page)).toContainText('Not on the listed grid.')
    const row = sideRows(page, 'offers')
    await expect(row).toHaveCount(1)
    await expect(row).not.toContainText('Off-grid strike')
    await expect(row.getByRole('button', { name: /^Buy call on 3\.00 EQTY/ })).toBeVisible()
    // No cell of the chain is that series.
    await expect(chain(page, 'EQTY').locator('button[aria-pressed="true"]')).toHaveCount(0)
  })

  test('a link to a deadline the chain does not show says so and selects nothing', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain&expiry=2020-01-03&kind=put&strike=99.00')
    await expect(page.getByTestId('chain-mode')).toContainText(`The 3 Jan 2020 deadline has passed. Showing ${LABELS[0]}.`)
    await expect(panel(page)).toHaveCount(0)
    await expect(chain(page).locator('button[aria-pressed="true"]')).toHaveCount(0)
    // The URL now names what is shown, so a reload shows the same thing.
    await expect.poll(() => search(page).get('expiry')).toBe(DAYS[0])
    expect(search(page).get('strike')).toBeNull()
    // The next choice clears the line.
    await page.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio').nth(1).click()
    await expect(page.getByTestId('chain-mode')).not.toContainText('deadline has passed')
  })

  test('has no accessibility violations in either theme', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    await expect(book(page)).toBeVisible()
    await expect(other(page)).toBeVisible()
    await expectNoAxeViolations(page)
    // With an empty half pointed at, its words shown.
    const empty = chain(page, 'FUND').getByRole('button', { name: /^No request at / }).last()
    await empty.hover()
    await expect(hintOf(empty)).toHaveCSS('opacity', '1')
    await expectNoAxeViolations(page, { themes: ['light'] })
    // With the cancel dialog open.
    await book(page).getByRole('button', { name: /^Cancel your offer/ }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel offer' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('a guest sees every term and no dead button', async ({ page }) => {
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
    await expect(sideRows(page, 'offers').getByRole('button', { name: /^Buy/ })).toHaveCount(2)
    for (const button of await page.getByTestId('chain-mode').getByRole('button').all()) await expect(button).toBeEnabled()
    await expect(page.getByTestId('chain-mode')).not.toContainText(/market price|oracle price|live price|guaranteed|insured/i)
    // The maker addresses of the mock market are placeholders: no explorer link is offered for them.
    await expect(book(page)).toContainText(DEMO_MAKERS.b.slice(0, 4))
    await expect(book(page).getByRole('link')).toHaveCount(0)
    expect(await currentPath(page)).toBe(`/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
  })
})

test.describe('option chain on a phone @phone', () => {
  test('shows the four halves around the strike in one table, and never overflows', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    // One table, both sides: no switch between calls and puts.
    await expect(page.getByRole('radiogroup', { name: 'Side' })).toHaveCount(0)
    const table = chain(page)
    await expect(table.getByRole('button')).toHaveCount(36)
    await expect(table.getByRole('rowheader')).toHaveCount(9)
    await expect(table).toContainText('Demo price 99.40')
    await expectNoHorizontalOverflow(page)
    // The five deadlines fit the screen. The count of orders leaves the tabs (after a time left it read as hours)
    // and is said in words on the line under them (ruling F3).
    const deadlines = page.getByRole('radiogroup', { name: 'Deadline' })
    expect(await deadlines.evaluate((g) => g.scrollWidth - g.clientWidth)).toBeLessThanOrEqual(1)
    const shown = await deadlines.getByRole('radio').first().evaluate((r) => {
      const copy = r.cloneNode(true) as HTMLElement
      copy.querySelectorAll('.ui-vh').forEach((n) => n.remove())
      return copy.textContent ?? ''
    })
    expect(shown.replace(/\s/g, ' ')).toMatch(/^\d+ \w{3}(\d+ (d|h|min)|<1 min)$/)
    await expect(page.getByTestId('chain-mode')).toContainText(/Deadline \d+\s\w{3}\s\d{4},\s08:00\sUTC, \d+ orders?\./)

    // Every half is a target at least 44 px tall, and the strike sits in the centre of the row.
    const row = table.getByRole('row', { name: /at 99\.00, call,/ })
    const box = (await row.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    const strike = (await row.getByRole('rowheader').boundingBox())!
    expect(Math.abs(strike.x + strike.width / 2 - (box.x + box.width / 2))).toBeLessThan(2)
    for (const target of [half(page, 'request', 'call', '99.00'), half(page, 'offer', 'call', '99.00'), half(page, 'offer', 'put', '99.00'), half(page, 'request', 'put', '99.00')]) {
      const b = (await target.boundingBox())!
      expect(b.height).toBeGreaterThanOrEqual(43)
      expect(b.width).toBeGreaterThanOrEqual(44)
    }
    // Each half prints its size under its figure: one track, two lines.
    const put99 = half(page, 'offer', 'put', '99.00')
    await expect(put99).toHaveAttribute('data-size', /^×\d/)
    expect((await put99.evaluate((b) => getComputedStyle(b).gridTemplateColumns)).trim().split(/\s+/)).toHaveLength(1)

    // Arrow keys move across the strike as on a desktop.
    await half(page, 'offer', 'call', '99.00').focus()
    await page.keyboard.press('ArrowRight')
    await expect(put99).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(half(page, 'offer', 'put', '100.00')).toBeFocused()
    // Enter selects; focus goes with the view to the series heading, never left on a half scrolled away.
    await page.keyboard.press('Enter')
    await expect(panel(page).getByRole('heading', { level: 2, name: `BOND 100.00 put, ${LABELS[0]}` })).toBeFocused()

    // A tap on a price selects the series and brings its book into view, with the orders as a list, not a table.
    await put99.tap()
    await expect(put99).toHaveAttribute('aria-pressed', 'true')
    const heading = panel(page).getByRole('heading', { level: 2 })
    await expect(heading).toHaveText(`BOND 99.00 put, ${LABELS[0]}`)
    await expect(heading).toBeInViewport()
    const offers = panel(page).getByRole('list', { name: /^Offers on BOND 99\.00 put/ })
    await expect(offers.getByRole('listitem')).toHaveCount(2)
    await expect(offers).toBeInViewport()
    await expect(panel(page).getByRole('table')).toHaveCount(0)
    await expect(offers.getByRole('listitem').first()).toContainText('Quantity')
    await expect(offers.getByRole('listitem').first()).toContainText('Total premium')
    await expect(offers.getByRole('listitem').first()).toContainText(/No\.\s(0|[1-9]\d*)/)
    // The row action is the small secondary button of every row; its touch target still reaches 44 px.
    const buy = offers.getByRole('button', { name: /^Buy put on/ }).first()
    await expect(buy).toHaveAttribute('data-size', 'sm')
    const reach = await buy.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const hits = (y: number) => document.elementFromPoint(x, y)?.closest('button') === el
      return hits(r.top - 7) && hits(r.bottom + 7)
    })
    expect(reach).toBe(true)
    await expectNoHorizontalOverflow(page)

    // A link that names a series opens with its book in view.
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=call&strike=98.00`)
    await expect(half(page, 'offer', 'call', '98.00')).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('other offers fit the screen and the page has no accessibility violations', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    const list = other(page).getByRole('list', { name: 'Other offers on FUND' })
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await expect(list).toContainText('Put 10.20')
    await expect(list).toContainText('Non-standard deadline')
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)
  })
})

test.describe('when the chain cannot be read', () => {
  test('a first read that fails says so and reads again on request', async ({ page }) => {
    // The mock chain runs in the page: its option list fails more often than the data layer retries.
    await openApp(page, '/learn')
    await failNextRead(page, 'listOptions', 50)
    await routeTo(page, '/markets/bond?mode=chain')
    const mode = page.getByTestId('chain-mode')
    await expect(mode.getByText('The chain could not be read')).toBeVisible({ timeout: 30_000 })
    await expect(chain(page)).toHaveCount(0)
    await expectNoAxeViolations(page, { include: '[data-testid="chain-mode"]' })

    await failNextRead(page, 'listOptions', 0)
    await mode.getByRole('button', { name: /^(Try again|Read again|Retry)/ }).click()
    await expect(chain(page)).toBeVisible()
    await expect(mode.getByText('The chain could not be read')).toHaveCount(0)
  })

  test('a refresh that fails keeps the figures and says they are from the last read', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    await expect(chain(page)).toBeVisible()
    await failNextRead(page, 'listOptions', 50)
    // The book is polled every 10 s; with its retries the failed refresh shows within about half a minute.
    await expect(page.getByTestId('chain-mode').getByText('The last refresh failed. Figures are from the last successful read.')).toBeVisible({ timeout: 40_000 })
    await expect(chain(page)).toBeVisible()
    await failNextRead(page, 'listOptions', 0)
  })
})

