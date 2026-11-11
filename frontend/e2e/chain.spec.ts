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
/** The table cell around a chain button: the button shows its main figure, the cell also the size, the request and "yours". */
const around = (_page: Page, button: Locator): Locator => button.locator('xpath=ancestor::td[1]')
const panel = (page: Page): Locator => page.getByTestId('series-panel')
const book = (page: Page): Locator => panel(page).getByRole('table', { name: /^Book of/ })
/** The rows of one side of the book: `offers` above the gap line, `requests` below it. */
const sideRows = (page: Page, side: 'offers' | 'requests'): Locator => book(page).locator(`tbody[data-section="${side}"] tr[data-order]`)
const other = (page: Page): Locator => page.getByTestId('other-offers')
const ticket = (page: Page): Locator => page.getByRole('complementary', { name: 'Order ticket' })
const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams

/** The figures of a column of some rows, as numbers. */
async function column(rows: Locator, nth: number): Promise<number[]> {
  const texts = await rows.evaluateAll((trs, i) => trs.map((r) => (r.children[i] as HTMLElement).innerText), nth)
  return texts.map((t) => Number(/\d[\d,]*\.\d+/.exec(t)?.[0].replace(/,/g, '')))
}

/** Columns of the book: No., From, Quantity, Premium per unit, Total premium, action. */
const COL = { no: 0, from: 1, qty: 2, perUnit: 3, total: 4 } as const

test.describe('option chain', () => {
  test('renders both sides of each series on the standard grid: the best offer with its size, and the best request', async ({ page }) => {
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

    // The listed deadlines are one radio group with the time left; the first is chosen.
    const expiry = page.getByRole('radiogroup', { name: 'Deadline' })
    await expect(expiry.getByRole('radio')).toHaveCount(EXPIRIES.length)
    await expect(expiry.getByRole('radio').first()).toContainText(LABELS[0])
    await expect(expiry.getByRole('radio').first()).toBeChecked()

    // Priced cells carry the full sentence, the maker count only there; empty cells ask for a price; moneyness
    // is said in words.
    const priced = cell(page, /^(Call|Put) at \d+\.\d\d, best offer \d+\.\d\d for [\d.,]+ BOND, \d+ offers?/)
    expect(await priced.count()).toBeGreaterThanOrEqual(8)
    await expect(cell(page, /^Call at 95\.00, no offer or request, ask for a price, in the money at the demo price$/)).toBeVisible()
    await expect(cell(page, /^Put at 95\.00, no offer or request, ask for a price$/)).toHaveText('Ask for a price')
    await expect(cell(page, /^Call at 99\.00, best offer \d+\.\d\d for [\d.]+ BOND, \d offers?, \d makers?, in the money at the demo price$/)).toBeVisible()
    await expect(cell(page, /^Put at 99\.00, best offer \d+\.\d\d for [\d.]+ BOND, \d offers?, \d makers?$/)).toBeVisible()
    await expect(chain(page)).not.toContainText(/makers?|No offer/)

    // A cell agrees with the book of its series: same best premium, same size, same number of distinct makers.
    const put99 = cell(page, /^Put at 99\.00,/)
    const name = (await put99.getAttribute('aria-label'))!
    const [, best, size, makers] = /best offer (\d+\.\d\d) for ([\d.]+) BOND, \d+ offers?, (\d+) makers?/.exec(name)!
    // The button's own text is the premium, a word of its name; the size is drawn beside it in the cell.
    await expect(put99).toHaveText(best)
    await expect(around(page, put99)).toHaveText(`${best}× ${size}`)
    await put99.click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99.00 put, ${LABELS[0]}`)
    await expect(page.getByTestId('chain-mode')).not.toContainText('Select a premium')
    const offers = sideRows(page, 'offers')
    const perUnit = await column(offers, COL.perUnit)
    expect(perUnit[0].toFixed(2)).toBe(best)
    expect((await column(offers, COL.qty))[0].toFixed(2)).toBe(size)
    const from = await offers.evaluateAll((trs, i) => trs.map((r) => (r.children[i] as HTMLElement).innerText), COL.from)
    expect(new Set(from.filter((t) => t.startsWith('Maker'))).size).toBe(Number(makers))
    // From 1200 px the press opens the ticket in the rail on that best offer.
    const first = (await offers.first().getAttribute('data-order'))!
    expect(search(page).get('offer')).toBe(first.slice(1))
    await expect(ticket(page)).toContainText(`No. ${first.slice(1).padStart(6, '0')}`)
    await expect(offers.first()).toHaveAttribute('data-selected', 'true')
  })

  test('is one tab stop: arrow keys move, Enter selects, the URL updates and restores', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    const table = chain(page)
    await expect(table).toBeVisible()
    await expect(table.locator('button[tabindex="0"]')).toHaveCount(1)
    await expect(table.locator('button[tabindex="-1"]')).toHaveCount(17)

    // The tab stop starts on the row at the reference price.
    const home = cell(page, /^Call at 100\.00,/)
    await expect(home).toHaveAttribute('tabindex', '0')
    await home.focus()
    await page.keyboard.press('ArrowUp')
    await expect(cell(page, /^Call at 99\.00,/)).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(cell(page, /^Put at 99\.00,/)).toBeFocused()
    await page.keyboard.press('ArrowRight') // stops at the edge
    await expect(cell(page, /^Put at 99\.00,/)).toBeFocused()
    await page.keyboard.press('End')
    await expect(cell(page, /^Put at 99\.00,/)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(cell(page, /^Call at 99\.00,/)).toBeFocused()
    await page.keyboard.press('PageDown')
    await expect(cell(page, /^Call at 103\.00,/)).toBeFocused()
    await page.keyboard.press('ArrowDown') // stops at the edge
    await expect(cell(page, /^Call at 103\.00,/)).toBeFocused()
    await page.keyboard.press('Control+Home')
    await expect(cell(page, /^Call at 95\.00,/)).toBeFocused()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    const put98 = cell(page, /^Put at 98\.00,/)
    await expect(put98).toBeFocused()
    // The cell that has focus is now the chain's tab stop.
    await expect(table.locator('button[tabindex="0"]')).toHaveCount(1)
    await expect(put98).toHaveAttribute('tabindex', '0')

    await page.keyboard.press('Enter')
    await expect(put98).toHaveAttribute('aria-pressed', 'true')
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
    await expect(table.locator('button[aria-pressed="true"]')).toHaveCount(1)

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
    await expect(cell(page, /^Call at 100\.00,/)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio').nth(1)).toBeChecked()

    // Pressing the selected cell again closes its panel.
    await cell(page, /^Call at 100\.00,/).click()
    await expect(panel(page)).toHaveCount(0)
    expect(search(page).get('strike')).toBeNull()
    expect(search(page).get('expiry')).toBe(DAYS[1])
  })

  test('the book is one table, best first on each side of the gap line, and opens the buy ticket for the chosen offer', async ({ page }) => {
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
    const offers = sideRows(page, 'offers')
    await expect(offers).toHaveCount(2)
    await expect(panel(page)).toContainText('The right to sell 1 BOND for 99.00 USDx. Out of the money at the demo price, 99.40.')
    await expect(panel(page)).toContainText('Quantities in BOND, premiums in USDx.')
    await expect(panel(page)).not.toContainText('Offers are funded')
    // Date first, then the time left.
    await expect(panel(page)).toContainText(/Deadline \d{1,2} \w{3} \d{4}, 08:00 UTC, in \d/)
    // No request on this series: one muted row says so, under the offers.
    await expect(book(page)).toContainText('No requests on this series.')
    await expect(book(page).getByRole('row', { name: /^Requests/ })).toHaveCount(0)

    // Cheapest premium per unit first, each row with its number and labelled with its source; the first is marked Best.
    const perUnit = await column(offers, COL.perUnit)
    expect(perUnit).toEqual([...perUnit].sort((a, b) => a - b))
    await expect(offers.first()).toContainText('Best')
    await expect(offers.nth(1)).not.toContainText('Best')
    for (const row of await offers.all()) {
      await expect(row.getByRole('cell').nth(COL.from)).toContainText(/^Maker/)
      await expect(row.getByRole('cell').nth(COL.no)).toHaveText(/^\d{6}$/)
    }

    // Buy on the second row opens the ticket for exactly that offer.
    const second = offers.nth(1)
    const key = (await second.getAttribute('data-order'))!
    expect(key).toMatch(/^o\d+$/)
    await expect(second.getByRole('cell').nth(COL.no)).toHaveText(key.slice(1).padStart(6, '0'))
    const total = /\d+\.\d\d/.exec(await second.getByRole('cell').nth(COL.total).innerText())![0]
    await second.getByRole('button', { name: /^Buy put on \d+\.\d\d BOND from GMAK…[A-D]{4} for \d+\.\d\d USDx$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]offer=${key.slice(1)}(&|$)`))
    expect(search(page).get('side')).toBe('buy')
    // The selection stays, the row of the open ticket is marked, and the ticket shows that offer.
    expect(search(page).get('strike')).toBe('99.00')
    await expect(second).toHaveAttribute('data-selected', 'true')
    await expect(ticket(page)).toContainText(`No. ${key.slice(1).padStart(6, '0')}`)
    await expect(ticket(page)).toContainText(`${total} USDx`)
    await expect(ticket(page).getByRole('button', { name: 'Connect wallet' })).toBeVisible()

    // A new selection drops the ticket of the old offer and opens one on the new series' best offer.
    await cell(page, /^Call at 99\.00,/).click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99.00 call, ${LABELS[0]}`)
    expect(search(page).get('kind')).toBe('call')
    expect(search(page).get('offer')).not.toBe(key.slice(1))
    await expect(book(page).locator('tbody[data-section="offers"] tr[data-order][data-selected]')).toHaveCount(1)
  })

  test('requests are the other side of the book and open the fill ticket', async ({ page }) => {
    // Seeded: a request on a series nobody quotes (FUND put 10.40, second date).
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[1]}`)
    const requestOnly = cell(page, /^Put at 10\.40, no offer, best request \d+\.\d\d, 1 request, in the money at the demo price$/)
    const figure = /best request (\d+\.\d\d)/.exec((await requestOnly.getAttribute('aria-label'))!)![1]
    // The figure alone, in the request column: no word in front of it.
    await expect(requestOnly).toHaveText(figure)
    await requestOnly.click()
    // A cell with only a request selects its series; from 1200 px the fill ticket opens on that request.
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
    // The chain cell shows both sides of the same series.
    const put10 = cell(page, /^Put at 10\.00,/)
    await expect(put10).toHaveAttribute('aria-label', new RegExp(`best offer ${offer.toFixed(2)} for [\\d.]+ FUND, .*best request ${request.toFixed(2)}, 1 request`))
  })

  test('an empty cell asks for a price, and the series actions open empty forms', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    await cell(page, /^Call at 102\.00, no offer or request, ask for a price$/).click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
    expect(search(page).get('kind')).toBe('call')
    expect(search(page).get('strike')).toBe('102.00')
    expect(search(page).get('expiry')).toBe(DAYS[0])
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 102.00 call, ${LABELS[0]}`)
    await expect(panel(page)).toContainText('Nothing is posted on this series.')
    await expect(cell(page, /^Call at 102\.00,/)).toHaveAttribute('aria-pressed', 'true')
    // The ticket is the request form on those terms.
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a call on BOND')

    // With the form open, the chain retargets it instead of closing it.
    await cell(page, /^Put at 99\.00,/).click()
    expect(search(page).get('side')).toBe('bid')
    expect(search(page).get('kind')).toBe('put')
    expect(search(page).get('strike')).toBe('99.00')
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a put on BOND')

    // "Write an offer" switches to the write form on the same series. No figure the user did not type is put in it.
    await panel(page).getByRole('button', { name: 'Write an offer' }).click()
    await expect(page).toHaveURL(/[?&]side=write(&|$)/)
    expect(search(page).get('strike')).toBe('99.00')
    expect(search(page).get('qty')).toBeNull()
    expect(search(page).get('premium')).toBeNull()
    await panel(page).getByRole('button', { name: 'Post a request' }).click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
    expect(search(page).get('premium')).toBeNull()
  })

  test("the highlighter marks only the wallet's own order; own offers show Yours and can be cancelled", async ({ page }) => {
    // Seeded: the default wallet's request on BOND put 98, third date, below a maker's offer.
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[2]}`, { connect: true })
    const ownRequest = cell(page, /^Put at 98\.00, best offer \d+\.\d\d for [\d.]+ BOND, .*best request \d+\.\d\d, \d+ requests?, yours: the best request/)
    const ownCell = around(page, ownRequest)
    await expect(ownCell.locator('mark')).toHaveCount(1)
    await expect(ownCell).toContainText('yours')
    // The maker's offer in the same cell is not marked.
    const [, offerFigure, requestFigure] = /best offer (\d+\.\d\d).*best request (\d+\.\d\d)/.exec((await ownRequest.getAttribute('aria-label'))!)!
    await expect(ownCell.locator('mark')).toHaveText(requestFigure)
    await expect(ownRequest.locator('mark')).toHaveCount(0)
    expect(offerFigure).not.toBe(requestFigure)
    // A cell the wallet only holds an option in carries no mark: the name says it.
    for (const held of await cell(page, /you hold an option/).all()) {
      if (/yours:/.test((await held.getAttribute('aria-label'))!)) continue
      await expect(around(page, held).locator('mark')).toHaveCount(0)
    }
    await expect(page.getByTestId('chain-mode')).not.toContainText('The highlighter marks')

    // Seeded: the default wallet's open offer, a put on 5 FUND at 9.80 on the third date, tied with a maker's.
    await page.goto(`/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`)
    await connect(page)
    const own = cell(page, /^Put at 9\.80, best offer \d+\.\d\d for [\d.]+ FUND, 2 offers, 2 makers, (yours: the best offer|you have an order in this series)/)
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

    await mine.getByRole('button', { name: 'Cancel your offer of put on 5.00 FUND' }).click()
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
    await expect(cell(page, /^Put at 9\.80, best offer \d+\.\d\d for [\d.]+ FUND, 1 offer, 1 maker$/)).toBeVisible()
  })

  test("the wallet's own orders on the asset are listed under the chain, and a held option is said in its series", async ({ page }) => {
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
    await expect(row.getByRole('button', { name: 'Cancel your offer of put on 5.00 FUND' })).toBeVisible()
    await row.getByRole('button', { name: 'Show put 9.80 in the chain' }).click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`FUND 9.80 put, ${LABELS[2]}`)
    expect(search(page).get('expiry')).toBe(DAYS[2])
    expect(search(page).get('strike')).toBe('9.80')

    // Seeded: the default wallet holds a BOND put 97 on the second date.
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[1]}&kind=put&strike=97.00`)
    await connect(page)
    await expect(panel(page)).toContainText(/You hold [\d.]+ BOND of this put\./)
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
    await expect(ticket(page)).toContainText(`No. ${key.slice(1).padStart(6, '0')}`)

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
    await expect(fundRow).toContainText('08:00 UTC')
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
  test('shows both halves around the strike in one table, and never overflows', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    // One table, both halves: no switch between calls and puts.
    await expect(page.getByRole('radiogroup', { name: 'Side' })).toHaveCount(0)
    const table = chain(page)
    await expect(table.getByRole('button')).toHaveCount(18)
    await expect(table.getByRole('rowheader')).toHaveCount(9)
    await expect(table).toContainText('Demo price 99.40')
    await expectNoHorizontalOverflow(page)
    // The five deadlines fit the screen: the count of orders sits on the second line.
    const deadlines = page.getByRole('radiogroup', { name: 'Deadline' })
    expect(await deadlines.evaluate((g) => g.scrollWidth - g.clientWidth)).toBeLessThanOrEqual(1)

    // Every cell is a target at least 44 px tall, and the strike sits in the centre of the row.
    const row = table.getByRole('row', { name: /Call at 99\.00,/ })
    const box = (await row.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    const strike = (await row.getByRole('rowheader').boundingBox())!
    expect(Math.abs(strike.x + strike.width / 2 - (box.x + box.width / 2))).toBeLessThan(2)
    for (const name of [/^Call at 99\.00,/, /^Put at 99\.00,/]) {
      const target = (await table.getByRole('button', { name }).boundingBox())!
      expect(target.height).toBeGreaterThanOrEqual(43)
      expect(target.width).toBeGreaterThanOrEqual(44)
    }

    // Arrow keys move across the strike as on a desktop.
    const put99 = cell(page, /^Put at 99\.00,/)
    await cell(page, /^Call at 99\.00,/).focus()
    await page.keyboard.press('ArrowRight')
    await expect(put99).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(cell(page, /^Put at 100\.00,/)).toBeFocused()
    // Enter selects; focus goes with the view to the series heading, never left on a cell scrolled away.
    await page.keyboard.press('Enter')
    await expect(panel(page).getByRole('heading', { level: 2, name: `BOND 100.00 put, ${LABELS[0]}` })).toBeFocused()

    // A tap selects the series and brings its book into view, with the orders as a list, not a table.
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
    const buy = offers.getByRole('button', { name: /^Buy put on/ }).first()
    expect((await buy.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expectNoHorizontalOverflow(page)

    // A link that names a series opens with its book in view.
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=call&strike=98.00`)
    await expect(cell(page, /^Call at 98\.00,/)).toHaveAttribute('aria-pressed', 'true')
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

