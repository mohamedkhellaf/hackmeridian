/**
 * Portfolio (`/portfolio`) and one position (`/portfolio/$id`), on the mock chain with the test wallet.
 *
 * The default test wallet starts with seeded positions (src/core/options/mockSeed.ts). Their terms follow from
 * the demo prices (FUND 10.20, BOND 99.40, EQTY 24.60) and do not move with the clock:
 *   0  put it holds, 10 FUND at 10.60: in the money, deadline inside 48 hours
 *   1  put it holds, 2 BOND at 97.00: out of the money
 *   2  call it wrote and sold, 4 EQTY at 25.50
 *   3  call it wrote, exercised: 98.00 USDx waits for its claim
 *   4  put it wrote, expired: 48.00 USDx waits for its reclaim
 *   5  call it held, expired unexercised
 *   6  open offer it wrote, put on 5 FUND at 9.80 (49.00 USDx locked)
 * and one request (bid 0). Premiums depend on the time to the deadline, so no test asserts one.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { connect, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, failNextRead, failNextTx, goTo, openApp } from './helpers'

const PAYOFF_CAPTION = 'Hypothetical payoff at expiry. Not a quote.'

const dialogOf = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name })

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
  test('the to-do strip tells an in-the-money exercise from a reminder', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })

    const urgent = page.getByTestId('todo-exercise-0')
    await expect(urgent).toContainText('Action needed')
    await expect(urgent.getByRole('heading', { name: 'Exercise your put on 10.00 FUND' })).toBeVisible()
    await expect(urgent).toContainText('In the money at the reference price 10.20 (demo price). You deliver 10.00 FUND and receive 106.00 USDx.')
    await expect(urgent).toContainText('Exercise value at the demo price')
    await expect(urgent).toContainText('+4.00')
    await expect(urgent.getByRole('timer')).toHaveAccessibleName(/^Time left to exercise:/)
    await expect(urgent.locator('time')).toContainText('UTC')
    await expect(urgent.getByRole('button', { name: 'Exercise' })).toBeVisible()

    const neutral = page.getByTestId('todo-exercise-1')
    await expect(neutral).toContainText(/Reminder|Expires soon/)
    await expect(neutral).not.toContainText('Action needed')
    await expect(neutral.getByRole('heading', { name: 'Your put on 2.00 BOND' })).toBeVisible()
    await expect(neutral).toContainText('Out of the money at the reference price 99.40 (demo price). Nothing to do unless the price falls below 97.00.')
    await expect(neutral.getByRole('button')).toHaveCount(0)
    await expect(neutral.getByRole('link', { name: /^View position/ })).toBeVisible()

    // Both kinds of writer are told what waits in the contract; an expired option is information only.
    await expect(page.getByTestId('todo-claim-3')).toContainText('Claim 98.00 USDx from your exercised call')
    await expect(page.getByTestId('todo-reclaim-4')).toContainText('Reclaim 48.00 USDx from your expired put')
    const info = page.getByTestId('todo-expired-unexercised-5')
    await expect(info).toContainText('For information')
    await expect(info.getByRole('button')).toHaveCount(0)

    // One ink button on the page: the most pressing action.
    await expect(page.locator('main button[data-variant="primary"]')).toHaveCount(1)

    // The four summary figures, with units, and the three tabs with their counts.
    const summary = page.getByRole('region', { name: 'Summary' })
    for (const label of ['Premium paid', 'Premium earned', 'Collateral locked', 'Positions open']) await expect(summary).toContainText(label)
    await expect(summary).toContainText('4.00')
    await expect(summary).toContainText('EQTY')
    await expect(page.getByRole('tab', { name: /^Holding/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /^Written/ })).toContainText('3')
    await expect(page.getByRole('tab', { name: /^Orders/ })).toContainText('2')

    // The holding table says where each option stands, in words, with the source of the price.
    const table = page.getByRole('table', { name: /^Options you hold/ })
    await expect(table.getByTestId('row-0')).toContainText('In the money')
    await expect(table.getByTestId('row-0')).toContainText('at the demo price 10.20')
    await expect(table.getByTestId('row-1')).toContainText('Out of the money')
    await expect(table.getByTestId('row-0').getByText('Active', { exact: true })).toBeVisible()
  })

  test('exercise from the to-do strip, with the confirmation and the receipt', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' }).click()

    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog).toContainText('You deliver 10.00 FUND and receive 106.00 USDx.')
    await expect(dialog).toContainText('In the money')
    await expect(dialog).toContainText('Reference price 10.20 USDx (demo price)')
    // Feasibility with exact figures: the option is still active and the wallet holds what it must deliver.
    const checks = dialog.getByRole('region', { name: 'Checked before you sign' })
    await expect(checks).toContainText('Active')
    await expect(checks).toContainText('120.00 FUND, enough')

    const receipt = await confirmAndReadReceipt(dialog, 'Exercise')
    await expect(receipt).toContainText('Exercised: put on 10.00 FUND')
    await expect(receipt).toContainText('You delivered')
    await expect(receipt).toContainText('10.00 FUND')
    await expect(receipt).toContainText('You received')
    await expect(receipt).toContainText('106.00 USDx')
    await expect(receipt.getByRole('link', { name: 'View position' })).toBeVisible()
    await done(dialog)

    // The chain is the record: the to-do card is gone and the row reads Exercised with nothing left to do.
    await expect(page.getByTestId('todo-exercise-0')).toHaveCount(0)
    const row = page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-0')
    await expect(row).toContainText('Exercised')
    await expect(row.getByRole('button')).toHaveCount(0)
  })

  test('a declined signature sends nothing and the review can be opened again', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' }).click()
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('120.00 FUND, enough')

    await failNext(page, 'declined')
    await dialog.getByRole('button', { name: 'Exercise', exact: true }).click()
    const progress = dialog.getByRole('group', { name: 'Transaction progress' })
    await expect(progress).toContainText('Declined')
    await expect(progress).toContainText('Nothing was sent')
    await expect(dialog.getByTestId('receipt')).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Review again' }).click()
    await expect(dialog).toContainText('You deliver 10.00 FUND and receive 106.00 USDx.')
    await dialog.getByRole('button', { name: 'Not now' }).click()
    await expect(dialog).toBeHidden()
    // Nothing changed on the chain.
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
  })

  test('an outcome that is unknown is checked again, never sent again', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-reclaim-4').getByRole('button', { name: 'Reclaim' }).click()
    const dialog = dialogOf(page, 'Reclaim collateral')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('Expired. 48.00 USDx in the contract')

    await failNext(page, 'unknown')
    await dialog.getByRole('button', { name: 'Reclaim', exact: true }).click()
    const progress = dialog.getByRole('group', { name: 'Transaction progress' })
    await expect(progress).toContainText('Outcome unknown')
    await expect(progress).toContainText('Do not send it again')
    await expect(dialog.getByRole('button', { name: 'Review again' })).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Check again' }).click()
    const receipt = dialog.getByTestId('receipt')
    await expect(receipt).toBeVisible()
    await expect(receipt).toContainText('Reclaimed: put on 2.00 EQTY')
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
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog).toContainText('Less than 15 minutes to the deadline. The ledger decides the time, so a signature may not land before it.')
    await dialog.getByRole('button', { name: 'Not now' }).click()
    await expect(dialog).toBeHidden()

    // Past the deadline nothing can be exercised: the card goes, and the option is reported as expired.
    await page.clock.setFixedTime(deadline + 30_000)
    await expect(page.getByTestId('todo-exercise-0')).toHaveCount(0, { timeout: 20_000 })
    const expired = page.getByTestId('todo-expired-unexercised-0')
    await expect(expired).toContainText('Put on 10.00 FUND expired', { timeout: 20_000 })
    await expect(expired.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-0')).toHaveCount(0)
  })

  test('claim delivery as the writer', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-claim-3').getByRole('button', { name: 'Claim delivery' }).click()

    const dialog = dialogOf(page, 'Claim delivery')
    await expect(dialog).toContainText('The holder exercised this call and paid 98.00 USDx. Claiming moves it from the contract to your wallet.')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('Exercised. 98.00 USDx in the contract')

    const receipt = await confirmAndReadReceipt(dialog, 'Claim delivery')
    await expect(receipt).toContainText('Delivery claimed: call on 1.00 BOND')
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
    await expect(table.getByTestId('row-3')).toContainText('Settled')
  })

  test('reclaim the collateral of an expired option', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await page.getByTestId('todo-reclaim-4').getByRole('button', { name: 'Reclaim' }).click()

    const dialog = dialogOf(page, 'Reclaim collateral')
    await expect(dialog).toContainText('This put expired without being exercised. Reclaiming moves your 48.00 USDx from the contract to your wallet.')
    const receipt = await confirmAndReadReceipt(dialog, 'Reclaim')
    await expect(receipt).toContainText('Reclaimed: put on 2.00 EQTY')
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
    const cancelOffer = dialogOf(page, 'Cancel offer')
    await expect(cancelOffer).toContainText('The offer leaves Markets and your 49.00 USDx goes back to your wallet.')
    await expect(cancelOffer.getByRole('region', { name: 'Checked before you sign' })).toContainText('Open, no buyer')
    const offerReceipt = await confirmAndReadReceipt(cancelOffer, 'Cancel offer')
    await expect(offerReceipt).toContainText('Offer cancelled: put on 5.00 FUND')
    await expect(offerReceipt).toContainText('49.00 USDx')
    await done(cancelOffer)
    await expect(page.getByText('No offers of yours are waiting for a buyer.')).toBeVisible()

    const requests = page.getByRole('table', { name: /^Your requests/ })
    await expect(requests.getByTestId('request-0')).toContainText('Waiting for a maker')
    await requests.getByTestId('request-0').getByRole('button', { name: /^Cancel request/ }).click()
    const cancelRequest = dialogOf(page, 'Cancel request')
    await expect(cancelRequest).toContainText('goes back to your wallet')
    const requestReceipt = await confirmAndReadReceipt(cancelRequest, 'Cancel request')
    await expect(requestReceipt).toContainText('Request cancelled: put on 2.00 BOND')
    await done(cancelRequest)
    await expect(page.getByText('No requests of yours are waiting for a maker.')).toBeVisible()
  })

  test('list a position for sale through the ticket, then cancel the listing', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    // The row's word is the link to the position page, where selling lives.
    await page.getByRole('table', { name: /^Options you hold/ }).getByTestId('row-1').getByRole('link', { name: /^Put on 2\.00 BOND/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 2.00 BOND at 97.00' })).toBeVisible()

    await page.locator('main').getByRole('button', { name: 'Sell', exact: true }).click()
    await expect(page).toHaveURL(/do=sell/)
    const ticket = page.getByRole('dialog')
    await expect(ticket).toContainText('Sell your put on BOND')
    await ticket.getByRole('textbox').first().fill('1.25')
    await ticket.getByRole('button', { name: 'Review', exact: true }).click()
    await ticket.getByRole('checkbox').check()
    await ticket.getByRole('button', { name: 'List for 1.25 USDx' }).click()
    await expect(ticket).toContainText('Listed. Your option is for sale.')
    await ticket.getByRole('button', { name: 'Done' }).click()
    await expect(ticket).toBeHidden()
    expect(await currentPath(page)).toBe('/portfolio/1')

    // The position now carries its listing: the price on the note, re-pricing and withdrawing as actions.
    await expect(page.locator('main')).toContainText('It is listed for resale at 1.25 USDx.')
    await expect(page.locator('main').getByRole('button', { name: 'Change price' })).toBeVisible()
    await page.locator('main').getByRole('button', { name: 'Cancel listing' }).click()

    const dialog = dialogOf(page, 'Cancel listing')
    await expect(dialog).toContainText('Your put on 2.00 BOND is no longer for sale at 1.25 USDx. You keep the option and can still exercise it before the deadline.')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('For sale at 1.25 USDx')
    const receipt = await confirmAndReadReceipt(dialog, 'Cancel listing')
    await expect(receipt).toContainText('Listing cancelled: put on 2.00 BOND')
    await done(dialog)

    await expect(page.locator('main').getByRole('button', { name: 'Sell', exact: true })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Cancel listing' })).toHaveCount(0)
  })

  test('a listing shows under Orders with its price and can be withdrawn there', async ({ page }) => {
    await openApp(page, '/portfolio/1?do=sell', { connect: true })
    const ticket = page.getByRole('dialog')
    await ticket.getByRole('textbox').first().fill('1.25')
    await ticket.getByRole('button', { name: 'Review', exact: true }).click()
    await ticket.getByRole('checkbox').check()
    await ticket.getByRole('button', { name: 'List for 1.25 USDx' }).click()
    await ticket.getByRole('button', { name: 'Done' }).click()
    await expect(ticket).toBeHidden()

    await page.locator('main').getByRole('link', { name: 'Portfolio' }).click()
    await page.getByRole('tab', { name: /^Orders/ }).click()
    const listing = page.getByRole('table', { name: /^Your resale listings/ }).getByTestId('listing-1')
    await expect(listing).toContainText('1.25')
    await expect(listing.getByRole('button', { name: /^Change price/ })).toBeVisible()

    // Withdrawn from the list itself: the receipt links to the position, and the row is gone afterwards.
    await listing.getByRole('button', { name: /^Cancel listing/ }).click()
    const dialog = dialogOf(page, 'Cancel listing')
    const receipt = await confirmAndReadReceipt(dialog, 'Cancel listing')
    await expect(receipt.getByRole('link', { name: 'View position' })).toBeVisible()
    await done(dialog)
    await expect(page.getByText('None of your options is listed for resale.')).toBeVisible()
  })

  test('show closed positions, kept in the URL', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const table = page.getByRole('table', { name: /^Options you hold/ })
    await expect(table.getByTestId('row-0')).toBeVisible()
    await expect(table.getByTestId('row-5')).toHaveCount(0)
    await expect(page.getByText('1 closed position or order is hidden. Turn on Show closed to see it.')).toBeVisible()

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
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog).toBeVisible()
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
    await expect(lifecycle).toContainText('The holder delivered 10.00 FUND and received 106.00 USDx.')
    await expect(lifecycle.getByText('Transaction')).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise', exact: true })).toHaveCount(0)
    await expect(page.locator('main')).toContainText('You exercised: you delivered 10.00 FUND and received 106.00 USDx.')
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
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 FUND at 10.60' })).toBeVisible()
    await expect(page.locator('main')).toContainText('You can sell 10.00 FUND for 106.00 USDx until the deadline.')

    const note = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Long put, FUND' }) })
    await expect(note).toContainText('No. 000000')
    await expect(note.getByText('Active', { exact: true })).toBeVisible()
    for (const term of ['Quantity', 'Strike', 'Original premium', 'Breakeven', 'Deadline', 'At the reference', 'Exercise value', 'Collateral', 'Writer']) {
      await expect(note.locator('dt', { hasText: term }).first()).toBeVisible()
    }
    await expect(note).toContainText('106.00 USDx in the contract')
    await expect(note).toContainText('Reference price 10.20 USDx (demo price). Chosen by the team for this demo. Not a market.')
    await expect(note.locator('time')).toContainText('UTC')
    await expect(note.getByRole('timer')).toBeVisible()

    // The payoff figure: required caption, and an assumed price that the keyboard moves.
    const figure = page.locator('figure').filter({ has: page.getByTestId('payoff-chart') })
    await expect(figure.locator('figcaption')).toContainText(PAYOFF_CAPTION)
    const slider = figure.getByRole('slider')
    const before = await slider.getAttribute('aria-valuetext')
    await slider.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(slider).not.toHaveAttribute('aria-valuetext', before ?? '')

    // The lifecycle: five steps, the exercise window is where the option is now.
    const lifecycle = page.getByRole('list', { name: 'Lifecycle of this option' })
    await expect(lifecycle.getByRole('listitem')).toHaveCount(5)
    await expect(lifecycle.locator('[aria-current="step"]')).toContainText('Until the deadline')
    await expect(lifecycle).toContainText('Nothing settles by itself.')

    // The deadline as a calendar file, built in the page; Google Calendar is an outbound link the user chooses.
    await page.getByRole('button', { name: 'Add the deadline to your calendar' }).click()
    await expect(page.getByRole('menuitem', { name: /Open in Google Calendar/ })).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\//)
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download calendar file' }).click()
    expect((await download).suggestedFilename()).toMatch(/^stellsec-deadline-\d{8}\.ics$/)
  })

  test('a written position shows the short side and why there is no button', async ({ page }) => {
    await openApp(page, '/portfolio/2', { connect: true })
    await expect(page.getByRole('heading', { name: 'Short call, EQTY' })).toBeVisible()
    await expect(page.locator('main')).toContainText('If the holder exercises, you sell 4.00 EQTY for 102.00 USDx. Your 4.00 EQTY is locked until then or until the deadline.')
    await expect(page.locator('main')).toContainText('Nothing for you to do now. You claim after an exercise, or reclaim after the deadline.')
    await expect(page.locator('main')).toContainText('The option alone, premium included.')
    await expect(page.locator('main').getByRole('button', { name: /Exercise|Sell|Claim|Reclaim/ })).toHaveCount(0)
  })

  test('a guest sees what the page holds, the terms of an option, and a way to connect', async ({ page }) => {
    await openApp(page, '/portfolio')
    await expect(page.getByRole('heading', { name: 'Connect a wallet to see what you hold and what you wrote.' })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await expect(page.locator('main').getByRole('table')).toHaveCount(0)

    await openApp(page, '/portfolio/0')
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 FUND at 10.60' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Put, FUND' })).toBeVisible()
    await expect(page.locator('main')).toContainText('Connect the wallet that holds or wrote this option to act on it.')
    await expect(page.getByTestId('payoff-chart')).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise' })).toHaveCount(0)

    // Connecting in place turns the same page into the holder's view.
    await page.locator('main').getByRole('button', { name: 'Connect wallet' }).click()
    await expect(page.getByRole('heading', { name: 'Long put, FUND' })).toBeVisible()
    await expect(page.locator('main').getByRole('button', { name: 'Exercise', exact: true })).toBeVisible()
  })

  test('a wallet with nothing gets one sentence and one way forward per tab', async ({ page }) => {
    // Any other account: it has no seeded positions, orders or closed history.
    await openApp(page, '/portfolio', { connect: `G${'A'.repeat(55)}` })
    await expect(page.getByRole('heading', { name: 'To do' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Summary' })).toContainText('0.00')
    await expect(page.getByRole('heading', { name: 'You hold no options.' })).toBeVisible()
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Go to Markets' })).toBeVisible()

    await page.getByRole('tab', { name: /^Written/ }).click()
    await expect(page.getByRole('heading', { name: 'You have written no options that found a buyer.' })).toBeVisible()

    await page.getByRole('tab', { name: /^Orders/ }).click()
    for (const line of ['No offers of yours are waiting for a buyer.', 'No requests of yours are waiting for a maker.', 'None of your options is listed for resale.']) {
      await expect(page.getByText(line)).toBeVisible()
    }
    await expect(page.getByText(/closed position/)).toHaveCount(0)
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
    await expect(main).toContainText('The mock chain did not answer (demo switch). Nothing was changed. Your positions are on the chain, not in this page.')
    await expect(main.getByRole('table')).toHaveCount(0)

    await failNextRead(page, 'listOptions', 0)
    await main.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
    await expect(main.getByText('Could not read your positions')).toHaveCount(0)
  })

  test('an unknown option number has its own page', async ({ page }) => {
    await openApp(page, '/portfolio/999999')
    await expect(page.getByRole('heading', { name: 'No option has this number.' })).toBeVisible()
    await page.locator('main').getByRole('link', { name: 'Back to your portfolio' }).click()
    expect(await currentPath(page)).toBe('/portfolio')
  })

  test('the keyboard alone exercises an option', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    const button = page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' })
    await button.focus()
    await page.keyboard.press('Enter')
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog).toBeVisible()
    // Focus starts on the dialog's title; the primary action is reached by Tab and never by a pointer.
    const confirm = dialog.getByRole('button', { name: 'Exercise', exact: true })
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('120.00 FUND, enough')
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
    const dialog = dialogOf(page, 'Claim delivery')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('phone: lists instead of tables, 44 px rows that open the position, no sideways scroll @phone', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await expect(page.getByTestId('todo-exercise-0')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const list = page.getByRole('list', { name: 'Options you hold' })
    await expect(list).toBeVisible()
    await expect(page.getByRole('table', { name: /^Options you hold/ })).toBeHidden()
    const row = list.getByRole('link', { name: /Put on 10\.00 FUND at 10\.60/ })
    await expect(row).toContainText('Active')
    await expect(row).toContainText('In the money at the demo price 10.20')
    await expect(row).toContainText('left')
    expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    const exercise = page.getByTestId('todo-exercise-0').getByRole('button', { name: 'Exercise' })
    expect((await exercise.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)

    // Orders keep their one action on the phone: a request has no page of its own.
    await page.getByRole('tab', { name: /^Orders/ }).click()
    await expect(page.getByRole('list', { name: 'Your requests' }).getByRole('button', { name: /^Cancel request/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('tab', { name: /^Holding/ }).click()
    await row.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Put on 10.00 FUND at 10.60' })).toBeVisible()
    await expect(page.getByTestId('payoff-chart')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.locator('main').getByRole('button', { name: 'Exercise', exact: true }).click()
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog).toContainText('You deliver 10.00 FUND and receive 106.00 USDx.')
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
    const dialog = dialogOf(page, 'Exercise put on 10.00 FUND')
    await expect(dialog.getByRole('region', { name: 'Checked before you sign' })).toContainText('120.00 FUND, enough')
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
