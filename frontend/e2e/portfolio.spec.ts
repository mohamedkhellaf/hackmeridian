/**
 * Portfolio (`/portfolio`) and one position (`/portfolio/$id`), on the mock chain with the test wallet.
 *
 * The default test wallet starts with seeded positions (src/core/options/mockSeed.ts). Their terms follow from
 * the demo prices (RWA 10.20, BOND 99.40, EQTY 24.60) and do not move with the clock:
 *   0  put it holds, 10 RWA at 10.60: in the money, deadline inside 48 hours
 *   1  put it holds, 2 BOND at 97.00: out of the money
 *   2  call it wrote and sold, 4 EQTY at 25.50
 *   3  call it wrote, exercised: 98.00 USDx waits for its claim
 *   4  put it wrote, expired: 48.00 USDx waits for its reclaim
 *   5  call it held, expired unexercised
 *   6  open offer it wrote, put on 5 RWA at 9.80 (49.00 USDx locked)
 * and one request (bid 0). An end-to-end build prices the seed at fixed leads before each deadline (mockSeed
 * fixedPricing), so its premiums are the same on every run: position 0 cost 0.43 per RWA, request 0 escrows 1.18 USDx.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { PAYOFF_CAPTION, clawbackShortfallDisclosure } from '../src/core/disclosures'
import { ADDR_A, clawBack, connect, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, failNextRead, failNextTx, goTo, openApp } from './helpers'

/**
 * The action dialog that opened with this title. Its title turns into the done wording on the receipt, so the
 * returned locator is the open dialog itself, not the title.
 */
async function openedDialog(page: Page, name: string | RegExp): Promise<Locator> {
  await expect(page.getByRole('dialog', { name })).toBeVisible()
  return page.getByRole('dialog')
}

/**
 * Lists the open position through the order ticket, typing `price` in its price field. The ticket's own words belong
 * to the ticket, so only its shape is relied on: a price field, Review, the button that names the price (the wallet
 * signature is the consent). Returns the price the button names (`2.50` for 2.00 BOND at 1.25 per unit), which is
 * what the position then carries.
 */
async function listThroughTicket(page: Page, price: string): Promise<string> {
  const ticket = page.getByRole('dialog')
  await expect(ticket).toContainText(/your put on BOND/i)
  await ticket.getByRole('textbox').first().fill(price)
  await ticket.getByRole('button', { name: 'Review', exact: true }).click()
  const list = ticket.getByRole('button', { name: /^List for [\d.,]+\sUSDx/ })
  const total = /^List for ([\d.,]+)/.exec((await list.textContent()) ?? '')?.[1] ?? ''
  expect(total).not.toBe('')
  await list.click()
  await expect(ticket).toContainText(/Listed/)
  await ticket.getByRole('button', { name: 'Done' }).click()
  await expect(ticket).toBeHidden()
  return total
}

/** Signs the action of an open dialog and waits for its receipt, which takes focus. */
async function confirmAndReadReceipt(dialog: Locator, confirm: string): Promise<Locator> {
  await dialog.getByRole('button', { name: confirm, exact: true }).click()
  const receipt = dialog.getByTestId('receipt')
  await expect(receipt).toBeVisible()
  await expect(receipt).toBeFocused()
  await expect(receipt).toContainText('Transaction')
  return receipt
}

async function done(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
}

/** Makes the next mock transaction end the way `kind` says (the app's own mock client, through the E2E hook). */
const failNext = failNextTx

test.describe('Portfolio', () => {
  test('the to-do strip holds what the wallet can do now, and the tables say where each option stands', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })

    const urgent = page.getByTestId('todo-exercise-0')
    await expect(urgent.getByRole('heading', { name: 'Exercise your put on 10.00 RWA' })).toBeVisible()
    await expect(urgent).toContainText('In the money at the demo price 10.20. You deliver 10.00 RWA and receive 106.00 USDx.')
    // The exercise value is a value, not a gain: no plus sign, and the premium is said to be left out.
    await expect(urgent).toContainText('Exercise value')
    await expect(urgent).toContainText('4.00 USDx')
    await expect(urgent).not.toContainText('+4.00')
    await expect(urgent).toContainText('At the reference price. The premium is not counted.')
    await expect(urgent.getByRole('timer')).toHaveAccessibleName(/^Time left to exercise:/)
    await expect(urgent.locator('time')).toContainText('UTC')
    await expect(urgent.getByRole('button', { name: 'Exercise' })).toBeVisible()
    // No eyebrow labels on the cards: the title says what to do.
    const strip = page.getByRole('region', { name: 'To do' })
    for (const label of ['Action needed', 'Ready to claim', 'Ready to reclaim', 'Reminder', 'For information', 'No deadline']) await expect(strip).not.toContainText(label)

    // An option that is out of the money and more than 48 hours from its deadline is not a to-do.
    await expect(page.getByTestId('todo-exercise-1')).toHaveCount(0)

    // Both kinds of maker are told what waits in the contract, once: the title and the button, no sentence.
    await expect(page.getByTestId('todo-claim-3')).toContainText('Claim 98.00 USDx from your exercised call')
    await expect(page.getByTestId('todo-claim-3')).not.toContainText('It waits in the contract')
    await expect(page.getByTestId('todo-reclaim-4')).toContainText('Reclaim 48.00 USDx from your expired put')
    await expect(page.getByTestId('todo-reclaim-4')).not.toContainText('It stays in the contract')
    // Each card hugs its content: a claim is not stretched to the height of the exercise beside it.
    const exerciseHeight = (await urgent.boundingBox())?.height ?? 0
    const claimHeight = (await page.getByTestId('todo-claim-3').boundingBox())?.height ?? 0
    expect(claimHeight).toBeLessThan(exerciseHeight - 40)
    // An option that lapsed this week is one plain line, not a card.
    await expect(page.getByTestId('todo-expired-unexercised-5')).toHaveCount(0)
    await expect(page.getByTestId('lapsed-5')).toContainText(/^Your call on 5\.00\sRWA expired on .+ without being exercised\./)

    // One ink button on the page: the most pressing action.
    await expect(page.locator('main button[data-variant="primary"]')).toHaveCount(1)

    // The totals, with units: what is locked and what can be taken back now are separate figures.
    const summary = page.getByRole('region', { name: 'Summary' })
    for (const label of ['Original premiums', 'Premium earned', 'Locked', 'Ready to take back']) await expect(summary).toContainText(label)
    await expect(summary).not.toContainText('Positions open')
    await expect(summary).toContainText('4.00')
    await expect(summary).toContainText('EQTY')
    await expect(summary).toContainText('146.00')
    await expect(page.getByRole('tab', { name: /^Holding/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /^Written/ })).toContainText('3')
    await expect(page.getByRole('tab', { name: /^Orders/ })).toContainText('2')
    await expect(page.getByText(/closed position or order is hidden/)).toHaveCount(0)

    // The holding table says where each option stands, in words, and what it is worth against the labelled demo
    // price; no state column. The strike column is serif, as on every table.
    const table = page.getByRole('table', { name: /^Options you hold/ })
    await expect(table.getByRole('columnheader', { name: 'State' })).toHaveCount(0)
    await expect(table.getByTestId('row-0')).toContainText('In the money')
    await expect(table.getByTestId('row-0')).toContainText('Exercise value 4.00 at the demo price 10.20')
    await expect(table.getByTestId('row-0')).toContainText('0.43 per RWA')
    await expect(table.getByTestId('row-1')).toContainText('Out of the money')
    await expect(table.getByTestId('row-1')).toContainText('Demo price 99.40, above the strike 97.00')
    await expect(table.getByTestId('row-0').getByText('Active', { exact: true })).toHaveCount(0)
    await expect(table.getByTestId('row-0').locator('td[data-strike]')).toHaveCSS('font-family', /Serif/)
    // In the money: exercise, and list for sale beside it. Out of the money: the row leads with the listing. Every
    // row action has the same look.
    await expect(table.getByTestId('row-0').getByRole('button', { name: /^Exercise/ })).toBeVisible()
    await expect(table.getByTestId('row-0').getByRole('button', { name: /^List for sale/ })).toBeVisible()
    await expect(table.getByTestId('row-1').getByRole('button', { name: /^Exercise/ })).toHaveCount(0)
    await expect(table.getByTestId('row-1').getByRole('button', { name: /^List for sale/ })).toBeVisible()
    for (const button of await table.getByRole('button').all()) {
      await expect(button).toHaveAttribute('data-variant', 'secondary')
      await expect(button).toHaveAttribute('data-size', 'sm')
    }

    // A written option that is live says what it locks.
    await page.getByRole('tab', { name: /^Written/ }).click()
    await expect(page.getByRole('table', { name: /^Options you wrote/ }).getByTestId('row-2')).toContainText('Locks 4.00 EQTY')
    await page.getByRole('tab', { name: /^Holding/ }).click()

    // A click anywhere on a row opens the position.
    await table.getByTestId('row-1').getByRole('cell', { name: 'BOND', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 2.00 BOND at 97.00' })).toBeVisible()
  })

  test('a request past its deadline is a to-do, and Orders still offers to cancel it', async ({ page }) => {
    await openApp(page, '/portfolio?tab=orders', { connect: true })
    const request = page.getByRole('table', { name: /^Your requests/ }).getByTestId('request-0')
    const deadline = Date.parse((await request.locator('time').first().getAttribute('datetime')) ?? '')
    expect(Number.isFinite(deadline)).toBe(true)
    await page.clock.setFixedTime(deadline + 60_000)

    const card = page.getByTestId('todo-request-0')
    // The seeded request escrows 0.59 USDx per unit for 2.00 BOND (end-to-end builds price at fixed leads).
    await expect(card).toContainText(/^Take back 1\.18\sUSDx from your expired request/, { timeout: 20_000 })
    await expect(request).toContainText('1.18')
    await expect(card).toContainText('No maker filled your request for a put on 2.00 BOND.')
    await expect(card).not.toContainText('stays in the contract')
    // The open request past its deadline can be cancelled from its row too.
    await expect(request).toContainText('Expired. Cancel it to get the premium back')
    await expect(request.getByRole('button', { name: /^Cancel request/ })).toBeEnabled()
    await card.getByRole('button', { name: 'Cancel request' }).click()
    const dialog = await openedDialog(page, 'Cancel request')
    await expect(dialog).toContainText('This request expired without a maker.')
  })

  test('a clawback shortfall is said where the money waits: the page, the rows, and the claim review', async ({ page }) => {
    // The issuer claws USDx back from the contract before the portfolio first reads the reserves.
    await openApp(page, '/learn', { connect: true })
    await clawBack(page, 'C_MOCK_USDX', 400n * 10_000_000n)
    await goTo(page, 'Portfolio')

    const main = page.locator('main')
    await expect(main).toContainText(clawbackShortfallDisclosure('USDx'))
    await expect(page.getByTestId('todo-claim-3')).toContainText('Clawback shortfall on USDx')

    await page.getByTestId('todo-claim-3').getByRole('button', { name: 'Claim delivery' }).click()
    const dialog = await openedDialog(page, 'Claim delivery')
    const checks = dialog.getByRole('region', { name: 'Checked before you sign' })
    await expect(checks).toContainText('Holds less USDx than it owes')
    await expect(checks).not.toContainText('in the contract')
    await expect(dialog).toContainText(clawbackShortfallDisclosure('USDx'))
    // A warning, not a block: payouts are first come, first served.
    await expect(dialog.getByRole('button', { name: 'Claim delivery', exact: true })).toBeEnabled()
  })

  test('a holder who cannot cover the exercise is told before the dialog, with where the asset is', async ({ page }) => {
    // The wallet holds 1.00 RWA of the 10.00 RWA that exercising option 0 delivers.
    await openApp(page, '/learn', { connect: true })
    await page.evaluate(async (address) => {
      type Hook = { mock(): Promise<{ setBalance(who: string, token: { contractId: string }, units: bigint): void }>; queryClient: { invalidateQueries(): Promise<void> } }
      const hook = (window as unknown as { __stellsec: Hook }).__stellsec
      ;(await hook.mock()).setBalance(address, { contractId: 'C_MOCK_RWA' }, 10_000_000n)
      // Balances read earlier (the wallet menu) are read again.
      await hook.queryClient.invalidateQueries()
    }, ADDR_A)
    await goTo(page, 'Portfolio')
    await expect(page.getByTestId('todo-exercise-0')).toContainText('You hold 1.00 of the 10.00 RWA this exercise delivers.')

    await page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-0').getByRole('link', { name: /^Put on 10\.00\sRWA/ }).click()
    const main = page.locator('main')
    await expect(main).toContainText('You hold 1.00 of the 10.00 RWA this exercise delivers.')
    await main.getByRole('button', { name: 'Exercise', exact: true }).click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog.getByRole('link', { name: 'RWA in Markets' })).toBeVisible()
  })

  test('exercise from the to-do strip, with the confirmation and the receipt', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' }).click()

    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog).toContainText('You deliver 10.00 RWA and receive 106.00 USDx.')
    await expect(dialog).toContainText('In the money')
    await expect(dialog).toContainText('Demo price 10.20 USDx')
    // Feasibility with exact figures: the option is still active and the wallet holds what it must deliver.
    const checks = dialog.getByRole('region', { name: 'Checked before you sign' })
    // Mock data is not read from a contract, and the line says so.
    await expect(checks).toContainText(/^Mock data: the option is active/)
    await expect(checks).toContainText('you hold 120.00 RWA')

    const receipt = await confirmAndReadReceipt(dialog, 'Exercise')
    await expect(page.getByRole('dialog', { name: 'Exercised: put on 10.00 RWA' })).toBeVisible()
    await expect(receipt).toContainText('Long put, RWA')
    await expect(receipt).toContainText('You delivered')
    await expect(receipt).toContainText('10.00 RWA')
    await expect(receipt).toContainText('You received')
    await expect(receipt).toContainText('106.00 USDx')
    await expect(receipt.getByRole('link', { name: 'View position' })).toBeVisible()
    await done(dialog)

    // The chain is the record: the to-do card is gone and the row says it was exercised, with nothing left to do.
    await expect(page.getByTestId('todo-exercise-0')).toHaveCount(0)
    const row = page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-0')
    await expect(row).toContainText('You exercised it')
    await expect(row.getByRole('button')).toHaveCount(0)
  })

  test('a declined signature sends nothing and the review can be opened again', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' }).click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('you hold 120.00 RWA')

    await failNext(page, 'declined')
    await dialog.getByRole('button', { name: 'Exercise', exact: true }).click()
    const progress = dialog.getByRole('group', { name: 'Transaction progress' })
    await expect(progress).toContainText('Declined')
    await expect(progress).toContainText('Nothing was sent')
    await expect(dialog.getByTestId('receipt')).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Review again' }).click()
    await expect(dialog).toContainText('You deliver 10.00 RWA and receive 106.00 USDx.')
    await dialog.getByRole('button', { name: 'Not now' }).click()
    await expect(dialog).toBeHidden()
    // Nothing changed on the chain.
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
  })

  test('an outcome that is unknown is checked again, never sent again', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-reclaim-4').getByRole('button', { name: 'Reclaim' }).click()
    const dialog = await openedDialog(page, 'Reclaim collateral')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('the option has expired and 48.00 USDx waits in the contract')

    await failNext(page, 'unknown')
    await dialog.getByRole('button', { name: 'Reclaim', exact: true }).click()
    const progress = dialog.getByRole('group', { name: 'Transaction progress' })
    await expect(progress).toContainText('Outcome unknown')
    await expect(progress).toContainText(/Do not send/)
    await expect(dialog.getByRole('button', { name: 'Review again' })).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Check again' }).click()
    const receipt = dialog.getByTestId('receipt')
    await expect(receipt).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Reclaimed: put on 2.00 EQTY' })).toBeVisible()
  })

  test('the last 15 minutes warn that a signature may not land; after the deadline the exercise is gone', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const card = page.getByTestId('todo-exercise-0')
    const deadline = Date.parse((await card.locator('time').getAttribute('datetime')) ?? '')
    expect(Number.isFinite(deadline)).toBe(true)

    // Ten minutes before the deadline. Timers keep running; only the wall clock of the page moves.
    await page.clock.setFixedTime(deadline - 10 * 60_000)
    await expect(card).toContainText('Less than 15 minutes left. The ledger decides the time, so a signature may not land before the deadline.', { timeout: 20_000 })
    await card.getByRole('button', { name: 'Exercise' }).click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog).toContainText('Less than 15 minutes to the deadline. The ledger decides the time, so a signature may not land before it.')
    await dialog.getByRole('button', { name: 'Not now' }).click()
    await expect(dialog).toBeHidden()

    // Past the deadline nothing can be exercised: the card goes, and one line says the option lapsed.
    await page.clock.setFixedTime(deadline + 30_000)
    await expect(page.getByTestId('todo-exercise-0')).toHaveCount(0, { timeout: 20_000 })
    const expired = page.getByTestId('lapsed-0')
    await expect(expired).toContainText(/Your put on 10\.00\sRWA expired on .+ without being exercised\./, { timeout: 20_000 })
    await expect(expired.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-0')).toHaveCount(0)
  })

  test('claim delivery as the maker', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-claim-3').getByRole('button', { name: 'Claim delivery' }).click()

    const dialog = await openedDialog(page, 'Claim delivery')
    await expect(dialog).toContainText('The holder exercised this call and paid 98.00 USDx. Claiming moves it from the contract to your wallet.')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText(/^Mock data, \d\d:\d\d:\d\d\sUTC: the option is exercised and 98\.00\sUSDx waits in the contract\.$/)

    const receipt = await confirmAndReadReceipt(dialog, 'Claim delivery')
    await expect(page.getByRole('dialog', { name: 'Delivery claimed: call on 1.00 BOND' })).toBeVisible()
    await expect(receipt).toContainText('You received')
    await expect(receipt).toContainText('98.00 USDx')
    await done(dialog)

    await expect(page.getByTestId('todo-claim-3')).toHaveCount(0)
    // Settled is closed: the row leaves the Written tab until "Show closed" is on.
    await page.getByRole('tab', { name: /^Written/ }).click()
    const table = page.getByRole('table', { name: /^Options you wrote/ })
    await expect(table.getByTestId('row-2')).toBeVisible()
    await expect(table.getByTestId('row-3')).toHaveCount(0)
    await page.getByRole('switch', { name: 'Show closed' }).click()
    await expect(table.getByTestId('row-3')).toContainText('Exercised and claimed')
  })

  test('reclaim the collateral of an expired option', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-reclaim-4').getByRole('button', { name: 'Reclaim' }).click()

    const dialog = await openedDialog(page, 'Reclaim collateral')
    await expect(dialog).toContainText('This put expired without being exercised. Reclaiming moves your 48.00 USDx from the contract to your wallet.')
    const receipt = await confirmAndReadReceipt(dialog, 'Reclaim')
    await expect(page.getByRole('dialog', { name: 'Reclaimed: put on 2.00 EQTY' })).toBeVisible()
    await expect(receipt).toContainText('Returned to you')
    await expect(receipt).toContainText('48.00 USDx')
    await done(dialog)

    await expect(page.getByTestId('todo-reclaim-4')).toHaveCount(0)
  })

  test('cancel an own offer and an own request from the Orders tab', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByRole('tab', { name: /^Orders/ }).click()
    await expect(page).toHaveURL(/tab=orders/)

    const offers = page.getByRole('table', { name: /^Your offers without a buyer/ })
    await expect(offers.getByTestId('row-6')).toContainText('For sale in Markets')
    await offers.getByTestId('row-6').getByRole('button', { name: /^Cancel offer/ }).click()
    const cancelOffer = await openedDialog(page, 'Cancel offer')
    await expect(cancelOffer).toContainText('The offer leaves Markets and your 49.00 USDx goes back to your wallet.')
    await expect(cancelOffer.getByRole('region', { name: 'Checked before you sign' })).toContainText('the offer is open with no buyer')
    const offerReceipt = await confirmAndReadReceipt(cancelOffer, 'Cancel offer')
    await expect(page.getByRole('dialog', { name: 'Offer cancelled: put on 5.00 RWA' })).toBeVisible()
    await expect(offerReceipt).toContainText('49.00 USDx')
    await done(cancelOffer)
    await expect(page.getByText('No offers of yours are waiting for a buyer.')).toBeVisible()

    const requests = page.getByRole('table', { name: /^Your requests/ })
    await expect(requests.getByTestId('request-0')).toContainText('Waiting for a maker')
    await requests.getByTestId('request-0').getByRole('button', { name: /^Cancel request/ }).click()
    const cancelRequest = await openedDialog(page, 'Cancel request')
    await expect(cancelRequest).toContainText('goes back to your wallet')
    await confirmAndReadReceipt(cancelRequest, 'Cancel request')
    await expect(page.getByRole('dialog', { name: 'Request cancelled: put on 2.00 BOND' })).toBeVisible()
    await done(cancelRequest)
    await expect(page.getByText('No requests of yours are waiting for a maker.')).toBeVisible()
  })

  test('list a position for sale through the ticket, then cancel the listing', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    // The row's word is the link to the position page.
    await page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-1').getByRole('link', { name: /^Put on 2\.00\sBOND/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 2.00 BOND at 97.00' })).toBeVisible()
    // The header says what exercising does; listing has its own name.
    await expect(page.locator('main')).toContainText('Exercise to sell 2.00 BOND for 194.00 USDx, at any time before the deadline.')

    await page.locator('main').getByRole('button', { name: 'List for sale', exact: true }).click()
    await expect(page).toHaveURL(/do=sell/)
    const ask = await listThroughTicket(page, '1.25')
    expect(await currentPath(page)).toBe('/portfolio/1')

    // The position now carries its listing: the price on the note, re-pricing and withdrawing as actions.
    await expect(page.locator('main')).toContainText(`It is listed for resale at ${ask} USDx.`)
    await expect(page.locator('main').getByRole('button', { name: 'Change price' })).toBeVisible()
    await page.locator('main').getByRole('button', { name: 'Cancel listing' }).click()

    const dialog = await openedDialog(page, 'Cancel listing')
    await expect(dialog).toContainText(`Your put on 2.00 BOND is no longer for sale at ${ask} USDx. You keep the option and can still exercise it before the deadline.`)
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText(`it is for sale at ${ask} USDx`)
    await confirmAndReadReceipt(dialog, 'Cancel listing')
    await expect(page.getByRole('dialog', { name: 'Listing cancelled: put on 2.00 BOND' })).toBeVisible()
    await done(dialog)

    await expect(page.locator('main').getByRole('button', { name: 'List for sale', exact: true })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Cancel listing' })).toHaveCount(0)

    // Back from a position opened from the list goes back in history: the list keeps its place.
    await page.locator('main').getByRole('link', { name: 'Portfolio' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible()
  })

  test('a holding row lists the option for sale in place, and its listing can be changed or withdrawn there', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-1').getByRole('button', { name: /^List for sale/ }).click()
    const ask = await listThroughTicket(page, '1.10')
    expect(await currentPath(page)).toBe('/portfolio')
    const row = page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-1')
    await expect(row).toContainText(`Listed for resale at ${ask} USDx`)
    // The row offers every action of the position page: change the price, or cancel the listing beside it.
    await expect(row.getByRole('button', { name: /^Change price/ })).toBeVisible()
    await row.getByRole('button', { name: /^Cancel listing/ }).click()
    const dialog = await openedDialog(page, 'Cancel listing')
    await confirmAndReadReceipt(dialog, 'Cancel listing')
    await done(dialog)
    await expect(row.getByRole('button', { name: /^List for sale/ })).toBeVisible()
    await expect(row.getByRole('button', { name: /^Cancel listing/ })).toHaveCount(0)
  })

  test('after an outcome-unknown transaction the position says so in place of its action, and the rest wait', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-reclaim-4').getByRole('button', { name: 'Reclaim' }).click()
    const dialog = await openedDialog(page, 'Reclaim collateral')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('48.00 USDx waits in the contract')
    await failNext(page, 'unknown')
    await dialog.getByRole('button', { name: 'Reclaim', exact: true }).click()
    await expect(dialog.getByRole('group', { name: 'Transaction progress' })).toContainText('Outcome unknown')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // The card of that option: the state and "Check again" in place of Reclaim.
    const card = page.getByTestId('todo-reclaim-4')
    await expect(card.getByTestId('tx-state')).toHaveText('Outcome unknown')
    await expect(card.getByRole('button', { name: 'Reclaim', exact: true })).toHaveCount(0)
    // Every other action waits for it, and says why.
    const exercise = page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' })
    await expect(exercise).toHaveAttribute('aria-disabled', 'true')
    await expect(exercise).toHaveAccessibleDescription(/Check it in Activity/)
    // The row of that option says the same.
    await page.getByRole('tab', { name: /^Written/ }).click()
    await expect(page.getByRole('table', { name: /^Options you wrote/ }).getByTestId('row-4').getByTestId('tx-state')).toHaveText('Outcome unknown')

    // Checking again finds the reclaim confirmed: the card goes and the other actions are back.
    await card.getByRole('button', { name: /^Check again/ }).click()
    await expect(card).toHaveCount(0)
    await expect(exercise).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('a listing shows under Orders with its price and can be withdrawn there', async ({ page }) => {
    await openApp(page, '/portfolio/1?do=sell', { connect: true })
    const ask = await listThroughTicket(page, '1.25')

    await page.locator('main').getByRole('link', { name: 'Portfolio' }).click()
    await page.getByRole('tab', { name: /^Orders/ }).click()
    const listing = page.getByRole('table', { name: /^Your resale listings/ }).getByTestId('listing-1')
    await expect(listing).toContainText(ask)
    await expect(listing.getByRole('button', { name: /^Change price/ })).toBeVisible()

    // Withdrawn from the list itself: the receipt links to the position, and the row is gone afterwards.
    await listing.getByRole('button', { name: /^Cancel listing/ }).click()
    const dialog = await openedDialog(page, 'Cancel listing')
    const receipt = await confirmAndReadReceipt(dialog, 'Cancel listing')
    await expect(receipt.getByRole('link', { name: 'View position' })).toBeVisible()
    await done(dialog)
    await expect(page.getByText('None of your options is listed for resale.')).toBeVisible()
    // The empty list says where a listing starts.
    await page.getByRole('link', { name: 'List an option you hold' }).click()
    await expect(page.getByRole('tab', { name: /^Holding/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('an offer that found a buyer since the last visit is marked and listed first under Written', async ({ page }) => {
    // The last visit in this browser saw option 2 as an open offer; it has been sold since.
    await page.addInitScript((address) => localStorage.setItem(`stellsec.portfolio.offers.v1.${address}`, JSON.stringify(['2'])), ADDR_A)
    await openApp(page, '/portfolio?tab=written', { connect: true })
    const table = page.getByRole('table', { name: /^Options you wrote/ })
    await expect(table.getByTestId('row-2')).toContainText('Sold since your last visit')
    await expect(table.locator('tbody tr').first()).toHaveAttribute('data-testid', 'row-2')
    await expect(table.getByTestId('row-3')).not.toContainText('Sold since your last visit')
    await expect(page.getByRole('tab', { name: /^Written/ })).toHaveAccessibleName(/1 sold since your last visit/)
  })

  test('show closed positions, kept in the URL', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const table = page.getByRole('table', { name: /^Options you hold/ })
    await expect(table.getByTestId('row-0')).toBeVisible()
    await expect(table.getByTestId('row-5')).toHaveCount(0)

    await page.getByRole('switch', { name: 'Show closed' }).click()
    await expect(page).toHaveURL(/closed=1/)
    await expect(table.getByTestId('row-5')).toContainText('Expired')
    await expect(table.getByTestId('row-5')).toContainText('Expired without exercise')
    await expect(page.getByRole('tab', { name: /^Holding/ })).toContainText('3')

    await page.getByRole('switch', { name: 'Show closed' }).click()
    await expect(table.getByTestId('row-5')).toHaveCount(0)
    expect(await currentPath(page)).toBe('/portfolio')
  })

  test('a link with do=exercise lands on the exercise, and the back button closes it', async ({ page }) => {
    // A reminder link reaches a browser whose wallet is not connected yet: the terms are there, then connecting
    // opens the exercise at once. (The dialog covers the page, so the shared `connect` helper is not used.)
    await openApp(page, '/portfolio/0?do=exercise')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('main').getByRole('button', { name: 'Connect wallet' }).click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(await currentPath(page)).toBe('/portfolio/0')

    // Opening it from the page is a history step: Back closes the dialog and stays on the position.
    await page.locator('main').getByRole('button', { name: 'Exercise', exact: true }).click()
    await expect(page).toHaveURL(/do=exercise/)
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(dialog).toBeHidden()
    expect(await currentPath(page)).toBe('/portfolio/0')

    // Exercise here: the receipt stays although the position no longer allows the action, and the lifecycle
    // then links the transaction this wallet made.
    await page.locator('main').getByRole('button', { name: 'Exercise', exact: true }).click()
    await confirmAndReadReceipt(dialog, 'Exercise')
    await done(dialog)
    expect(await currentPath(page)).toBe('/portfolio/0')
    const lifecycle = page.getByRole('list', { name: 'Lifecycle of this option' })
    await expect(lifecycle).toContainText('Exercised')
    await expect(lifecycle).toContainText('You delivered 10.00 RWA and received 106.00 USDx.')
    await expect(lifecycle.getByText('Transaction')).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise', exact: true })).toHaveCount(0)
    await expect(page.locator('main')).toContainText('You exercised: you delivered 10.00 RWA and received 106.00 USDx.')
    // An ended option has no payoff figure: the header and the lifecycle say what happened.
    await expect(page.getByTestId('payoff-chart')).toHaveCount(0)
  })

  test('an action link that no longer applies explains itself', async ({ page }) => {
    await openApp(page, '/portfolio/0?do=claim', { connect: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('This link opens the claim, and nothing is waiting to be claimed by this wallet.')).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    expect(await currentPath(page)).toBe('/portfolio/0')
    await expect(page.getByText('This link opens the claim')).toHaveCount(0)
  })

  test('the position page: contract note, payoff figure, lifecycle and calendar file', async ({ page }) => {
    await openApp(page, '/portfolio/0', { connect: true })
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 RWA at 10.60' })).toBeVisible()
    const main = page.locator('main')
    await expect(main).toContainText('Exercise to sell 10.00 RWA for 106.00 USDx, at any time before the deadline.')
    // The deadline is in the header, with the time left, and the series is one link away.
    await expect(main.locator('header time').first()).toContainText('UTC')
    await expect(main.getByRole('link', { name: 'This series in Markets' })).toHaveAttribute('href', /\/markets\/rwa\?.*kind=put/)
    await expect(main).not.toContainText('RWA-2026')

    const note = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Long put, RWA' }) })
    // The serial line prints the option number as the contract does, unpadded.
    await expect(note).toContainText(/No\.\s0(?!\d)/)
    await expect(note.getByText('Active', { exact: true })).toBeVisible()
    for (const term of ['Quantity', 'Strike', 'Original premium', 'Breakeven', 'Deadline', 'At the reference', 'Exercise value', 'Collateral in the contract', 'Maker']) {
      await expect(note.locator('dt', { hasText: term }).first()).toBeVisible()
    }
    await expect(note.locator('dt', { hasText: 'Writer' })).toHaveCount(0)
    await expect(note).toContainText('Demo price 10.20, below the strike 10.60')
    await expect(note.locator('time')).toContainText('UTC')
    // The countdown is in the header, once: the note does not repeat it.
    await expect(note.getByRole('timer')).toHaveCount(0)
    await expect(main.locator('header').getByRole('timer')).toBeVisible()
    // This browser did not buy the option: its breakeven comes from the original premium and says so.
    await expect(note.locator('dt', { hasText: 'Breakeven at the original premium' })).toBeVisible()
    // The exercise value is a value, not a gain.
    await expect(note).not.toContainText('+4.00')
    // One figure under the highlighter: the holder's breakeven.
    await expect(note.locator('mark')).toHaveCount(1)

    // The payoff figure: required caption, a readout that leads with what exercising pays, an assumed price that
    // the keyboard moves. The figures drawn from the original premium say so.
    const figure = page.locator('figure').filter({ has: page.getByTestId('payoff-chart') })
    await expect(figure.locator('figcaption')).toContainText(PAYOFF_CAPTION)
    await expect(figure.locator('figcaption')).toContainText('Original premium included.')
    await expect(figure).toContainText('Most you can lose at the original premium')
    await expect(page.getByTestId('payoff-readout')).toContainText('If RWA is at 10.20 at the deadline, exercising pays')
    await expect(page.getByTestId('payoff-readout')).not.toContainText('+4.00')
    await expect(page.getByTestId('payoff-readout')).toContainText('After the 4.30 USDx original premium:')
    const slider = figure.getByRole('slider')
    const before = await slider.getAttribute('aria-valuetext')
    await slider.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(slider).not.toHaveAttribute('aria-valuetext', before ?? '')

    // The lifecycle: five steps in the second person, the exercise window is where the option is now, and the
    // deadline is dated on its own step.
    const lifecycle = page.getByRole('list', { name: 'Lifecycle of this option' })
    await expect(lifecycle.getByRole('listitem')).toHaveCount(5)
    await expect(lifecycle.locator('[aria-current="step"]')).toContainText('Until the deadline')
    await expect(lifecycle).toContainText('You can exercise at any time')
    await expect(lifecycle).toContainText('The deadline passes')
    // Holding the option does not prove this wallet paid the premium: the first sale is told in the third person.
    await expect(lifecycle).toContainText('A buyer paid the premium of 4.30 USDx to the maker and became the holder.')
    await expect(lifecycle).not.toContainText('You paid')
    await expect(lifecycle).not.toContainText('Nothing settles by itself')
    await expect(lifecycle).not.toContainText('acts')

    // The deadline as a calendar file, built in the page; Google Calendar is an outbound link the user chooses.
    await page.getByRole('button', { name: 'Add the deadline to your calendar' }).click()
    await expect(page.getByRole('menuitem', { name: /Open in Google Calendar/ })).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\//)
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download calendar file' }).click()
    expect((await download).suggestedFilename()).toMatch(/^stellsec-deadline-\d{8}\.ics$/)
    await expect(main).not.toContainText('A reminder can arrive late')
  })

  test('a written position shows what the maker holds with the agreement and without it', async ({ page }) => {
    await openApp(page, '/portfolio/2', { connect: true })
    await expect(page.getByRole('heading', { name: 'Short call, EQTY' })).toBeVisible()
    const main = page.locator('main')
    await expect(main).toContainText(
      'If the holder exercises, you sell 4.00 EQTY for 102.00 USDx. Your 4.00 EQTY stays in the contract until you claim after an exercise or reclaim after the deadline.',
    )
    const figure = page.locator('figure').filter({ hasText: 'With the agreement' })
    await expect(figure).toContainText('Just holding')
    await expect(figure).toContainText('Sell at 25.50')
    await expect(figure.locator('figcaption')).toContainText(PAYOFF_CAPTION)
    await expect(main).not.toContainText('The option alone')
    await expect(main.getByRole('button', { name: /Exercise|List for sale|Claim|Reclaim/ })).toHaveCount(0)
    // The maker's own premium is the one figure under the highlighter.
    await expect(page.getByRole('article').locator('mark')).toHaveCount(1)
  })

  test('an open offer of the wallet: withdrawing it is a choice, not the page ink button', async ({ page }) => {
    await openApp(page, '/portfolio/6', { connect: true })
    await expect(page.locator('main').getByRole('button', { name: 'Cancel offer' })).toHaveAttribute('data-variant', 'secondary')
    await expect(page.locator('main').getByRole('link', { name: 'This series in Markets' })).toHaveAttribute('href', /offer=6/)
  })

  test('a guest sees a way to connect, the terms of an option, and no action', async ({ page }) => {
    await openApp(page, '/portfolio')
    await expect(page.getByRole('heading', { name: 'Connect a wallet to see your positions.' })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await expect(page.locator('main').getByRole('table')).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText('Options to exercise before their deadline')

    await openApp(page, '/portfolio/0')
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 RWA at 10.60' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Put, RWA' })).toBeVisible()
    await expect(page.locator('main')).toContainText('Connect the wallet that holds or wrote this option to act on it.')
    await expect(page.getByTestId('payoff-chart')).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise' })).toHaveCount(0)
    // The top bar keeps the one ink button.
    await expect(page.locator('main').getByRole('button', { name: 'Connect wallet' })).not.toHaveAttribute('data-variant', 'primary')

    // Connecting in place turns the same page into the holder's view.
    await page.locator('main').getByRole('button', { name: 'Connect wallet' }).click()
    await expect(page.getByRole('heading', { name: 'Long put, RWA' })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise', exact: true })).toBeVisible()
  })

  test('a wallet with nothing gets the title and one blank slip with one way forward', async ({ page }) => {
    // Any other account: it has no seeded positions, orders or closed history.
    await openApp(page, '/portfolio', { connect: `G${'A'.repeat(55)}` })
    await expect(page.getByRole('heading', { name: 'To do' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Summary' })).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.getByRole('switch', { name: 'Show closed' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'You hold no options.' })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: 'Go to Markets' })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('a read that fails shows the error with a retry, and the retry reads again', async ({ page }) => {
    // Start on a page that reads no options, then make the mock chain refuse to list them.
    await openApp(page, '/learn')
    // More failures than the data layer retries, so the error state is reached; cleared before "Try again".
    await failNextRead(page, 'listOptions', 50)
    await connect(page)
    await goTo(page, 'Portfolio')

    const main = page.locator('main')
    await expect(main.getByText('Could not read your positions')).toBeVisible({ timeout: 30_000 })
    await expect(main).toContainText('The mock chain did not answer')
    await expect(main).not.toContainText('Nothing was changed')
    await expect(main.getByRole('table')).toHaveCount(0)

    await failNextRead(page, 'listOptions', 0)
    await main.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
    await expect(main.getByText('Could not read your positions')).toHaveCount(0)
  })

  test('an unknown option number has its own page', async ({ page }) => {
    await openApp(page, '/portfolio/999999')
    await expect(page.getByRole('heading', { name: 'No option has this number.' })).toBeVisible()
    // One way back: the header's link.
    await expect(page.locator('main').getByRole('link')).toHaveCount(1)
    await page.locator('main').getByRole('link', { name: 'Portfolio' }).click()
    expect(await currentPath(page)).toBe('/portfolio')
  })

  test('the keyboard alone exercises an option', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const button = page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' })
    await button.focus()
    await page.keyboard.press('Enter')
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog).toBeVisible()
    // Focus starts on the dialog's title; the primary action is reached by Tab and never by a pointer.
    const confirm = dialog.getByRole('button', { name: 'Exercise', exact: true })
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('you hold 120.00 RWA')
    for (let i = 0; i < 12 && !(await confirm.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog.getByTestId('receipt')).toBeFocused()
    const doneButton = dialog.getByRole('button', { name: 'Done' })
    for (let i = 0; i < 12 && !(await doneButton.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(doneButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    // The card that opened the dialog is gone with the exercise: focus goes to the page heading, not to nowhere.
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeFocused()
  })

  test('closing a dialog without acting returns focus to what opened it', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const opener = page.getByTestId('todo-claim-3').getByRole('button', { name: 'Claim delivery' })
    await opener.click()
    const dialog = await openedDialog(page, 'Claim delivery')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('phone: lists instead of tables, rows that open the position with every figure, no sideways scroll @phone', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const list = page.getByRole('list', { name: 'Options you hold' })
    await expect(list).toBeVisible()
    await expect(page.getByRole('table', { name: /^Options you hold/ })).toBeHidden()
    const row = list.getByRole('link', { name: /Put on 10\.00\sRWA at\s10\.60/ })
    await expect(row).toContainText('In the money')
    await expect(row).toContainText('Exercise value 4.00 at the demo price 10.20')
    await expect(row).toContainText('left')
    // The premium and the date are on the row too: no column of the table is left out.
    await expect(row).toContainText('Original premium 4.30 USDx')
    await expect(row).toContainText('UTC')
    // The line under the totals keeps its line box on a touch screen: its link does not double the line height.
    const lapsed = page.getByTestId('lapsed-5')
    const lines = await lapsed.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))
    expect(lines).toBeLessThanOrEqual(3.1)
    await expect(row).not.toContainText('Active')
    expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    const exercise = page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' })
    expect((await exercise.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

    // A maker's row puts what waits for it in the emphasised corner.
    await page.getByRole('tab', { name: /^Written/ }).click()
    await expect(page.getByRole('list', { name: 'Options you wrote' }).getByRole('link', { name: /Call on 1\.00\sBOND/ })).toContainText('Claim 98.00 USDx')

    // Orders keep their one action on the phone: a request has no page of its own.
    await page.getByRole('tab', { name: /^Orders/ }).click()
    await expect(page.getByRole('list', { name: 'Your requests' }).getByRole('button', { name: /^Cancel request/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // Below about 360 px the premium and the date each take a line, so neither breaks inside.
    await page.getByRole('tab', { name: /^Holding/ }).click()
    await page.setViewportSize({ width: 320, height: 740 })
    const premiumBox = await row.getByText(/^Original premium/).boundingBox()
    const dateBox = await row.getByText(/UTC$/).boundingBox()
    expect((dateBox?.y ?? 0) - (premiumBox?.y ?? 0)).toBeGreaterThan(8)
    await expectNoHorizontalOverflow(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await row.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 RWA at 10.60' })).toBeVisible()
    await expect(page.getByTestId('payoff-chart')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    // The back link is a 44 px target that returns to the list.
    const back = page.locator('main').getByRole('link', { name: 'Portfolio' })
    expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

    // The actions of a live position stay on the bottom edge while the page scrolls.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const bar = page.locator('main').getByRole('button', { name: 'Exercise', exact: true })
    await expect(bar).toBeInViewport()
    await bar.click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog).toContainText('You deliver 10.00 RWA and receive 106.00 USDx.')
    const confirm = dialog.getByRole('button', { name: 'Exercise', exact: true })
    expect((await confirm.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expectNoHorizontalOverflow(page)
    await confirmAndReadReceipt(dialog, 'Exercise')
    await expectNoHorizontalOverflow(page)
  })

  test('no accessibility violations, in both themes @both', async ({ page }) => {
    test.slow()
    await openApp(page, '/portfolio')
    await expectNoAxeViolations(page)

    await connect(page)
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
    await expectNoAxeViolations(page)

    await page.getByRole('tab', { name: /^Orders/ }).click()
    await expect(page.getByText('For sale in Markets').filter({ visible: true }).first()).toBeVisible()
    await expectNoAxeViolations(page)

    await page.getByRole('switch', { name: 'Show closed' }).click()
    await page.getByRole('tab', { name: /^Written/ }).click()
    await expectNoAxeViolations(page)

    // An exercise dialog, in review and on its receipt.
    await page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' }).click()
    const dialog = await openedDialog(page, 'Exercise put on 10.00 RWA')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('you hold 120.00 RWA')
    await expectNoAxeViolations(page)
    await confirmAndReadReceipt(dialog, 'Exercise')
    await expectNoAxeViolations(page)
    await done(dialog)

    // A position that is still open, with its payoff figure and calendar menu.
    await page.goto('/portfolio/1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await connect(page)
    await expect(page.getByRole('heading', { name: 'Long put, BOND' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('button', { name: 'Add the deadline to your calendar' }).click()
    await expect(page.getByRole('menuitem', { name: 'Download calendar file' })).toBeVisible()
    // `region` is off for this scan only: an open menu is portalled to the end of <body>, outside the landmarks,
    // while the page behind it is unchanged. Every other rule runs on the menu.
    await expectNoAxeViolations(page, { disableRules: ['region'] })
  })
})
