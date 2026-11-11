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
import { currentPath, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, failNextRead, openApp, routeTo } from './helpers'

const EXPIRIES = standardExpiries(Math.floor(Date.now() / 1000))
const DAYS = EXPIRIES.map(expiryDayKey)
const LABELS = EXPIRIES.map(formatUtcDay)

const chain = (page: Page, code = 'BOND'): Locator => page.getByRole('table', { name: new RegExp(`^${code} option chain`) })
const cell = (page: Page, name: RegExp): Locator => page.getByTestId('chain-mode').getByRole('button', { name })
const panel = (page: Page): Locator => page.getByTestId('series-panel')
const offersTable = (page: Page): Locator => panel(page).getByRole('table', { name: /^Offers on/ })
const bidsTable = (page: Page): Locator => panel(page).getByRole('table', { name: /^Bids on/ })
const other = (page: Page): Locator => page.getByTestId('other-offers')
const ticket = (page: Page): Locator => page.getByRole('complementary', { name: 'Order ticket' })
const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams

/** The figures of a column of a table body, as numbers. */
async function column(table: Locator, nth: number): Promise<number[]> {
  const texts = await table.locator('tbody tr').evaluateAll((rows, i) => rows.map((r) => (r.children[i] as HTMLElement).innerText), nth)
  return texts.map((t) => Number(/\d[\d,]*\.\d+/.exec(t)?.[0].replace(/,/g, '')))
}

test.describe('option chain', () => {
  test('renders the seeded series with best premiums and maker counts on the standard grid', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    const table = chain(page)
    await expect(table).toBeVisible()

    // Nine strikes around the demo price 99.40, ascending, each a row header in the centre.
    await expect(table.getByRole('rowheader')).toHaveText(['95.00', '96.00', '97.00', '98.00', '99.00', '100.00', '101.00', '102.00', '103.00'])
    // The reference price sits between 99 and 100 with its label; nothing calls it a market price.
    const rows = table.locator('tbody tr')
    await expect(rows.nth(5)).toHaveText('Demo price 99.40')
    await expect(page.getByTestId('chain-mode')).toContainText('Shaded cells are in the money at the demo price, 99.40. Chosen by the team for this demo. Not a market.')

    // The listed expiries are one radio group with the time left; the first is chosen.
    const expiry = page.getByRole('radiogroup', { name: 'Expiry' })
    await expect(expiry.getByRole('radio')).toHaveCount(EXPIRIES.length)
    await expect(expiry.getByRole('radio').first()).toContainText(LABELS[0])
    await expect(expiry.getByRole('radio').first()).toBeChecked()

    // Priced cells carry the full sentence; empty cells offer a request; moneyness is said in words.
    const priced = cell(page, /^(Call|Put) at \d+\.\d\d, best premium \d+\.\d\d, \d+ makers?/)
    expect(await priced.count()).toBeGreaterThanOrEqual(8)
    await expect(cell(page, /^Call at 95\.00, no offer, request a price, in the money at the demo price$/)).toBeVisible()
    await expect(cell(page, /^Put at 95\.00, no offer, request a price$/)).toBeVisible()
    await expect(cell(page, /^Call at 99\.00, best premium \d+\.\d\d, \d makers?, in the money at the demo price$/)).toBeVisible()
    await expect(cell(page, /^Put at 99\.00, best premium \d+\.\d\d, \d makers?$/)).toBeVisible()

    // A cell agrees with the book of its series: same best premium, same number of distinct makers.
    const put99 = cell(page, /^Put at 99\.00,/)
    const name = (await put99.getAttribute('aria-label'))!
    const [, best, makers] = /best premium (\d+\.\d\d), (\d+) makers?/.exec(name)!
    await expect(put99).toContainText(best)
    await expect(put99).toContainText(`${makers} maker`)
    await put99.click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99 put, ${LABELS[0]}`)
    const perUnit = await column(offersTable(page), 2)
    expect(perUnit[0].toFixed(2)).toBe(best)
    const from = await offersTable(page).locator('tbody tr').evaluateAll((trs) => trs.map((r) => (r.children[0] as HTMLElement).innerText))
    expect(new Set(from.filter((t) => t.startsWith('Maker'))).size).toBe(Number(makers))
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
    await expect(put98).toBeFocused()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98 put, ${LABELS[0]}`)
    await expectAnnounced(page, `BOND 98 put, ${LABELS[0]} selected`)
    expect(search(page).get('kind')).toBe('put')
    expect(search(page).get('strike')).toBe('98.00')
    expect(search(page).get('expiry')).toBe(DAYS[0])
    await expect(table.locator('button[aria-pressed="true"]')).toHaveCount(1)

    // Another date keeps the strike and the kind.
    await page.getByRole('radiogroup', { name: 'Expiry' }).getByRole('radio').nth(1).click()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98 put, ${LABELS[1]}`)
    expect(search(page).get('expiry')).toBe(DAYS[1])

    // Back restores the previous selection; a fresh load of the link restores it too.
    await page.goBack()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 98 put, ${LABELS[0]}`)
    await page.goBack()
    await expect(panel(page)).toHaveCount(0)
    await expect(table.locator('button[aria-pressed="true"]')).toHaveCount(0)
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[1]}&kind=call&strike=100`)
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 100 call, ${LABELS[1]}`)
    await expect(cell(page, /^Call at 100\.00,/)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radiogroup', { name: 'Expiry' }).getByRole('radio').nth(1)).toBeChecked()

    // Pressing the selected cell again closes its panel.
    await cell(page, /^Call at 100\.00,/).click()
    await expect(panel(page)).toHaveCount(0)
    expect(search(page).get('strike')).toBeNull()
    expect(search(page).get('expiry')).toBe(DAYS[1])
  })

  test('the book lists the best first and opens the buy ticket for the chosen offer', async ({ page }) => {
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
    const offers = offersTable(page)
    await expect(offers.locator('tbody tr')).toHaveCount(2)
    await expect(panel(page)).toContainText('The right to sell 1 BOND for 99.00 USDx. Out of the money at the demo price, 99.40.')
    await expect(panel(page)).toContainText('Quantities in BOND, premiums in USDx.')

    // Cheapest premium per unit first, each row labelled with its source; the first is marked Best.
    const perUnit = await column(offers, 2)
    expect(perUnit).toEqual([...perUnit].sort((a, b) => a - b))
    await expect(offers.locator('tbody tr').first()).toContainText('Best')
    await expect(offers.locator('tbody tr').nth(1)).not.toContainText('Best')
    for (const row of await offers.locator('tbody tr').all()) await expect(row.getByRole('cell').first()).toContainText(/^Maker/)

    // Buy on the second row opens the ticket for exactly that offer.
    const second = offers.locator('tbody tr').nth(1)
    const key = (await second.getAttribute('data-order'))!
    expect(key).toMatch(/^o\d+$/)
    const total = /\d+\.\d\d/.exec(await second.getByRole('cell').nth(3).innerText())![0]
    await second.getByRole('button', { name: /^Buy put on \d+\.\d\d BOND from GMAK…[A-D]{4} for \d+\.\d\d USDx$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]offer=${key.slice(1)}(&|$)`))
    expect(search(page).get('side')).toBe('buy')
    // The selection stays, the row of the open ticket is marked, and the ticket shows that offer.
    expect(search(page).get('strike')).toBe('99.00')
    await expect(second).toHaveAttribute('data-selected', 'true')
    await expect(ticket(page)).toContainText(`No. ${key.slice(1).padStart(6, '0')}`)
    await expect(ticket(page)).toContainText(`${total} USDx`)
    await expect(ticket(page).getByRole('button', { name: 'Connect wallet' })).toBeVisible()

    // A new selection drops the ticket of the old offer.
    await cell(page, /^Call at 99\.00,/).click()
    expect(search(page).get('offer')).toBeNull()
    expect(search(page).get('kind')).toBe('call')
  })

  test('bids are the other side of the book and open the fill ticket', async ({ page }) => {
    // Seeded: a request on a series nobody quotes (FUND put 10.40, second date).
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[1]}`)
    const bidOnly = cell(page, /^Put at 10\.40, no offer, highest bid \d+\.\d\d, 1 bid, in the money at the demo price$/)
    await expect(bidOnly).toContainText('Bid')
    await bidOnly.click()
    // A cell with a bid selects its series; it does not open a request of its own.
    expect(search(page).get('side')).toBeNull()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`FUND 10.4 put, ${LABELS[1]}`)
    await expect(panel(page)).toContainText('No offers on this series.')
    const row = bidsTable(page).locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('cell').first()).toContainText(/^Bid/)
    const key = (await row.getAttribute('data-order'))!
    await row.getByRole('button', { name: /^Sell to this bid: put on 10\.00 FUND from GHED…AAAA, \d+\.\d\d USDx escrowed$/ }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]bid=${key.slice(1)}(&|$)`))
    await expect(row).toHaveAttribute('data-selected', 'true')
  })

  test('an empty cell opens the bid ticket prefilled, and the series actions open the forms', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    await cell(page, /^Call at 102\.00, no offer, request a price$/).click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
    expect(search(page).get('kind')).toBe('call')
    expect(search(page).get('strike')).toBe('102.00')
    expect(search(page).get('expiry')).toBe(DAYS[0])
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 102 call, ${LABELS[0]}`)
    await expect(panel(page)).toContainText('Nothing is posted on this series.')
    await expect(cell(page, /^Call at 102\.00,/)).toHaveAttribute('aria-pressed', 'true')
    // The ticket is the request form on those terms.
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a call on BOND')
    await expect(ticket(page).getByRole('radio', { name: 'Call', exact: true })).toBeChecked()
    await expect(ticket(page).getByRole('radio', { name: /^102\.00/ })).toBeChecked()

    // With the form open, the chain retargets it instead of closing it.
    await cell(page, /^Put at 99\.00,/).click()
    expect(search(page).get('side')).toBe('bid')
    expect(search(page).get('kind')).toBe('put')
    expect(search(page).get('strike')).toBe('99.00')
    await expect(ticket(page).getByRole('heading').first()).toHaveText('Request a put on BOND')

    // "Write an offer here" switches to the write form on the same series, next to the best order.
    await panel(page).getByRole('button', { name: 'Write an offer here' }).click()
    await expect(page).toHaveURL(/[?&]side=write(&|$)/)
    expect(search(page).get('strike')).toBe('99.00')
    expect(search(page).get('qty')).toMatch(/^\d+(\.\d+)?$/)
    expect(search(page).get('premium')).toMatch(/^\d+(\.\d+)?$/)
    await panel(page).getByRole('button', { name: 'Post a bid here' }).click()
    await expect(page).toHaveURL(/[?&]side=bid(&|$)/)
  })

  test('own offers show Yours and can be cancelled', async ({ page }) => {
    // Seeded: the default wallet's open offer, a put on 5 FUND at 9.80 on the third date.
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    const own = cell(page, /^Put at 9\.80, best premium \d+\.\d\d, 2 makers, yours, you have an order in this series$/)
    await expect(own).toBeVisible()
    await expect(own.locator('mark')).toHaveCount(1) // the highlighter, on the figure
    await expect(own).toContainText('2 makers, yours')
    await expect(page.getByTestId('chain-mode')).toContainText('The highlighter marks series where you hold an option, wrote one or have an order.')

    const mine = offersTable(page).locator('tbody tr').filter({ hasText: 'Yours' })
    await expect(mine).toHaveCount(1)
    await expect(mine.locator('mark')).toHaveCount(1)
    await expect(mine.getByRole('button', { name: /^Buy/ })).toHaveCount(0)
    await expect(offersTable(page).locator('tbody tr')).toHaveCount(2)

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
    await expect(offersTable(page).locator('tbody tr')).toHaveCount(1)
    await expect(offersTable(page)).not.toContainText('Yours')
    await expect(cell(page, /^Put at 9\.80, best premium \d+\.\d\d, 1 maker$/)).toBeVisible()
  })

  test('keeping the offer sends nothing', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    await offersTable(page).getByRole('button', { name: /^Cancel your offer/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel offer' })
    await dialog.getByRole('button', { name: 'Keep offer' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(offersTable(page).locator('tbody tr')).toHaveCount(2)
  })

  test('other offers are listed with the reason they are off the grid, and stay buyable', async ({ page }) => {
    // Seeded: one EQTY call at a strike between two listed strikes.
    await openApp(page, '/markets/eqty?mode=chain')
    const section = other(page)
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Other offers')
    await expect(section).toContainText('1 order on this asset is outside the standard grid, so it does not price a chain cell. It can still be traded.')
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
    await expect(fundRow).toContainText('Non-standard expiry')
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
    await expect(panel(page)).toContainText('This series is not on the standard grid. Its orders are also listed under Other offers.')
    const row = offersTable(page).locator('tbody tr')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Off-grid strike.')
    await expect(row.getByRole('button', { name: /^Buy call on 3\.00 EQTY/ })).toBeVisible()
    // No cell of the chain is that series.
    await expect(chain(page, 'EQTY').locator('button[aria-pressed="true"]')).toHaveCount(0)
  })

  test('has no accessibility violations in either theme', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    await expect(offersTable(page)).toBeVisible()
    await expect(other(page)).toBeVisible()
    await expectNoAxeViolations(page)
    // With the cancel dialog open.
    await offersTable(page).getByRole('button', { name: /^Cancel your offer/ }).click()
    await expect(page.getByRole('dialog', { name: 'Cancel offer' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('a guest sees every term and no dead button', async ({ page }) => {
    await openApp(page, `/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
    await expect(offersTable(page).getByRole('button', { name: /^Buy/ })).toHaveCount(2)
    for (const button of await page.getByTestId('chain-mode').getByRole('button').all()) await expect(button).toBeEnabled()
    await expect(page.getByTestId('chain-mode')).not.toContainText(/market price|oracle price|live price|guaranteed|insured/i)
    // The maker addresses of the mock market are placeholders: no explorer link is offered for them.
    await expect(offersTable(page)).toContainText(DEMO_MAKERS.b.slice(0, 4))
    await expect(offersTable(page).getByRole('link')).toHaveCount(0)
    expect(await currentPath(page)).toBe(`/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=put&strike=99.00`)
  })
})

test.describe('option chain on a phone @phone', () => {
  test('shows one half at a time with the strike in the centre, and never overflows', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain')
    const half = page.getByRole('radiogroup', { name: 'Side' })
    await expect(half.getByRole('radio', { name: 'Calls' })).toBeChecked()
    const calls = page.getByRole('table', { name: /^BOND calls by strike/ })
    await expect(calls.getByRole('button')).toHaveCount(9)
    await expect(calls.getByRole('button', { name: /^Put at/ })).toHaveCount(0)
    await expect(calls.getByRole('rowheader')).toHaveCount(9)
    await expect(page.getByRole('table', { name: /option chain/ })).toHaveCount(0)
    await expect(calls).toContainText('Demo price 99.40')
    await expectNoHorizontalOverflow(page)

    // Every row is a target at least 44 px tall that spans the screen, with the strike in the centre.
    const row = calls.getByRole('row', { name: /Call at 99\.00,/ })
    const box = (await row.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThan(340)
    const strike = (await row.getByRole('rowheader').boundingBox())!
    expect(Math.abs(strike.x + strike.width / 2 - (box.x + box.width / 2))).toBeLessThan(2)
    const target = (await calls.getByRole('button', { name: /^Call at 99\.00,/ }).boundingBox())!
    expect(target.height).toBeGreaterThanOrEqual(43)
    expect(target.width).toBeGreaterThanOrEqual(44)

    // The other half.
    await half.getByRole('radio', { name: 'Puts' }).click()
    const puts = page.getByRole('table', { name: /^BOND puts by strike/ })
    await expect(puts.getByRole('button')).toHaveCount(9)
    await expect(puts.getByRole('button', { name: /^Call at/ })).toHaveCount(0)

    // Arrow keys move within the half shown.
    const put99 = puts.getByRole('button', { name: /^Put at 99\.00,/ })
    await put99.focus()
    await page.keyboard.press('ArrowDown')
    await expect(puts.getByRole('button', { name: /^Put at 100\.00,/ })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(puts.getByRole('button', { name: /^Put at 100\.00,/ })).toBeFocused()

    // A tap anywhere on the row selects it (here: on the makers cell).
    await puts.getByRole('row', { name: /Put at 98\.00,/ }).getByRole('cell').last().click()
    await expect(puts.getByRole('button', { name: /^Put at 98\.00,/ })).toHaveAttribute('aria-pressed', 'true')

    // Selecting opens the series under the chain, with the orders as a list, not a table.
    await put99.click()
    await expect(put99).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(`BOND 99 put, ${LABELS[0]}`)
    const offers = panel(page).getByRole('list', { name: /^Offers on BOND 99 put/ })
    await expect(offers.getByRole('listitem')).toHaveCount(2)
    await expect(panel(page).getByRole('table')).toHaveCount(0)
    await expect(puts.getByRole('button', { name: /^Put at 98\.00,/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(offers.getByRole('listitem').first()).toContainText('Quantity')
    await expect(offers.getByRole('listitem').first()).toContainText('Total premium')
    const buy = offers.getByRole('button', { name: /^Buy put on/ }).first()
    expect((await buy.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expectNoHorizontalOverflow(page)

    // A link that selects a call shows the calls half.
    await page.goto(`/markets/bond?mode=chain&expiry=${DAYS[0]}&kind=call&strike=98.00`)
    await expect(page.getByRole('radiogroup', { name: 'Side' }).getByRole('radio', { name: 'Calls' })).toBeChecked()
    await expect(page.getByRole('button', { name: /^Call at 98\.00,/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('other offers fit the screen and the page has no accessibility violations', async ({ page }) => {
    await openApp(page, `/markets/fund?mode=chain&expiry=${DAYS[2]}&kind=put&strike=9.80`, { connect: true })
    const list = other(page).getByRole('list', { name: 'Other offers on FUND' })
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await expect(list).toContainText('Put 10.20')
    await expect(list).toContainText('Non-standard expiry.')
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

