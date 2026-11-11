/**
 * Guided mode of the asset page: four intents in plain words, three terms, what the contract holds for them,
 * what the user would hold at a lower and a higher price, the one action that opens the ticket (in the order
 * rail from 1200 px, under the outcome below that), the figure at any price, and who acts and by when.
 * The mock market is rebuilt on every page load, so each test starts from the same book.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { PAYOFF_CAPTION } from '../src/core/disclosures'
import { connect, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, failNextRead, openApp, routeTo } from './helpers'

const guided = (page: Page) => page.getByTestId('guided-mode')
const picker = (page: Page) => guided(page).getByRole('radiogroup', { name: 'What do you want to do?' })
const ticket = (page: Page) => page.getByTestId('ticket')
// The closing block: in the order rail from 1200 px, in the guided page below that. One on screen at a time.
const action = (page: Page) => page.getByRole('region', { name: 'Next step' })
const sentence = (page: Page) => guided(page).getByTestId('outcome-sentence')
const slider = (page: Page, code: string) => guided(page).getByRole('slider', { name: `Assumed ${code} price at the deadline` })
const chip = (group: Locator, name: RegExp) => group.getByRole('radio', { name })
/** Chooses a strike or deadline chip by pressing it, as a pointer user does. */
async function pick(radio: Locator): Promise<void> {
  await radio.check()
}
const query = (page: Page) => new URL(page.url()).searchParams

/** Waits for the flow to be on screen: the note with its three terms. */
async function ready(page: Page, heading: string | RegExp): Promise<void> {
  await expect(guided(page).getByRole('heading', { level: 2, name: heading })).toBeVisible()
}

/** The ticket is open on its review step, with this heading. */
async function expectReview(page: Page, title: string | RegExp): Promise<void> {
  await expect(ticket(page)).toBeVisible()
  const exact = typeof title === 'string'
  await expect(page.getByRole('heading', { name: title }).or(page.getByText(title, { exact })).first()).toBeVisible()
  await expect(page.getByTestId('ticket-flow')).toHaveAttribute('data-step', 'review')
  expect(query(page).get('step')).toBe('review')
}

test.describe('four intents reach the ticket review', () => {
  test('set a floor: buys the matched put offer', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await expect(picker(page).getByRole('radio', { name: /^Set a floor/ })).toBeChecked()

    // The default terms are a funded offer: its number is on the heading line of the block, its premium in the
    // block and in the summary, each said once.
    const note = guided(page).getByRole('article')
    const serial = (await guided(page).getByTestId('guided-number').innerText()).replace(/\D/g, '')
    expect(serial).toMatch(/^\d{6}$/)
    await expect(guided(page).getByTestId('guided-found')).toContainText(/You pay\s*\d+\.\d{2}\s*USDx/)
    await expect(note).toContainText('Locked in the contract.')
    await expect(note).not.toContainText('In contract words')
    await expect(page.getByTestId('guided-summary')).toContainText(/^You pay \d+\.\d{2} USDx now\. Until .* UTC you can sell 2\.00 BOND for 198\.00 USDx\.$/)

    await action(page).getByRole('button', { name: 'Review this offer' }).click()
    await expectReview(page, 'Buy a put on BOND')
    const q = query(page)
    expect(q.get('side')).toBe('buy')
    expect(Number(q.get('offer'))).toBe(Number(serial))
    expect(q.get('intent')).toBe('floor')
    expect(q.get('strike')).toBe('99')
    expect(q.get('qty')).toBe('2.00')
    expect(q.get('expiry')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // The ticket shows the same terms the guided flow chose.
    await expect(ticket(page)).toContainText('long put on 2.00 BOND')
    await expect(ticket(page)).toContainText('Strike 99.00')
    await expect(ticket(page)).toContainText('198.00 USDx')
  })

  test('earn on what you hold: fills the matched call request', async ({ page }) => {
    await openApp(page, '/markets/eqty?mode=guided&intent=earn-hold', { connect: true })
    await ready(page, 'Earn on the EQTY you hold')
    await expect(guided(page).getByTestId('guided-found')).toContainText(/You are paid\s*\d+\.\d{2}\s*USDx/)
    await expect(guided(page).getByTestId('guided-found')).toContainText('Buyer')
    await expect(page.getByTestId('guided-summary')).toContainText(/^You are paid \d+\.\d{2} USDx now and lock 4\.00 EQTY\./)

    await action(page).getByRole('button', { name: 'Review this request' }).click()
    await expectReview(page, 'Fill a request for a call on EQTY')
    const q = query(page)
    expect(q.get('bid')).toMatch(/^\d+$/)
    expect(q.get('side')).toBeNull()
    expect(q.get('intent')).toBe('earn-hold')
    expect(q.get('strike')).toBe('25')
    expect(q.get('qty')).toBe('4.00')
  })

  test('earn while waiting to buy: fills the matched put request', async ({ page }) => {
    await openApp(page, '/markets/fund?mode=guided&intent=earn-buy', { connect: true })
    await ready(page, 'Earn while waiting to buy FUND')
    await expect(guided(page).getByTestId('guided-found')).toContainText(/You are paid\s*\d+\.\d{2}\s*USDx/)
    // The quantity field says what it locks, in USDx, before anything is signed.
    await expect(guided(page).getByText(/Locks \d+\.\d{2} USDx in the contract\./)).toBeVisible()

    await action(page).getByRole('button', { name: 'Review this request' }).click()
    await expectReview(page, 'Fill a request for a put on FUND')
    expect(query(page).get('bid')).toMatch(/^\d+$/)
    expect(query(page).get('intent')).toBe('earn-buy')
  })

  test('lock a buy price: buys the matched call offer', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await picker(page).getByRole('radio', { name: /Lock a buy price/ }).check()
    await ready(page, 'Lock a buy price for BOND')
    expect(query(page).get('intent')).toBe('lock-buy')
    await expect(guided(page).getByTestId('guided-found')).toContainText(/You pay\s*\d+\.\d{2}\s*USDx/)

    await action(page).getByRole('button', { name: 'Review this offer' }).click()
    await expectReview(page, 'Buy a call on BOND')
    expect(query(page).get('side')).toBe('buy')
    expect(query(page).get('offer')).toMatch(/^\d+$/)
    expect(query(page).get('intent')).toBe('lock-buy')
  })
})

test.describe('other orders the flow can match', () => {
  test('a resale listing is named as one, with its seller and its maker, and opens the resale ticket', async ({ page }) => {
    // The demo market has one listing: a holder resells a call on 5 FUND at 10.40 for the second listed date.
    await openApp(page, '/markets/fund?mode=guided&intent=lock-buy', { connect: true })
    await ready(page, 'Lock a buy price for FUND')
    await pick(guided(page).getByRole('radiogroup', { name: 'Choose your highest buy price' }).getByRole('radio', { name: /^10\.40 USDx/ }))
    await pick(guided(page).getByRole('radiogroup', { name: 'Choose the deadline' }).getByRole('radio').nth(1))
    await guided(page).getByRole('textbox', { name: /^I want/ }).fill('5')

    await expect(guided(page).getByTestId('guided-found')).toContainText(/Price, per unit/)
    const note = guided(page).getByRole('article')
    await expect(guided(page).getByTestId('guided-number')).toHaveText(/^Listing No\. \d{6}$/)
    await expect(note.getByRole('term').filter({ hasText: /^Seller$/ })).toBeVisible()
    await expect(note.getByRole('term').filter({ hasText: /^Maker$/ })).toBeVisible()

    await action(page).getByRole('button', { name: 'Review this listing' }).click()
    await expectReview(page, 'Buy a call on FUND from its holder')
    expect(query(page).get('side')).toBe('buy')
    expect(query(page).get('ask')).toMatch(/^\d+$/)
    expect(query(page).get('offer')).toBeNull()
  })

  test('a deadline under 48 hours away is said to be close', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    const dates = guided(page).getByRole('radiogroup', { name: 'Choose the deadline' })
    // The default deadline leaves at least 48 hours; the first listed date may not.
    await expect(guided(page).getByText(/^This deadline is under/)).toHaveCount(0)
    const first = dates.getByRole('radio').first()
    const name = (await first.getAttribute('aria-label')) ?? ''
    await pick(first)
    // Its name carries the time left ("13 Nov, 1 d 19 h left, ..."): under two days is under 48 hours.
    const close = /, (1 d\b|\d+ h\b|\d+ min\b|<1 min)/.test(name)
    await expect(guided(page).getByText(/^This deadline is under (48 hours|2 hours|15 minutes) away$/)).toHaveCount(close ? 1 : 0)
  })
})

test.describe('state lives in the URL', () => {
  test('every choice is in the link, survives a reload, and Back undoes it', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    const floors = guided(page).getByRole('radiogroup', { name: 'Choose your floor' })
    const dates = guided(page).getByRole('radiogroup', { name: 'Choose the deadline' })
    await expect(chip(floors, /^99\.00 USDx/)).toBeChecked()

    await pick(chip(floors, /^98\.00 USDx/))
    await expect(page).toHaveURL(/strike=98/)
    await pick(dates.getByRole('radio').nth(2))
    const day = query(page).get('expiry')
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await guided(page).getByRole('textbox', { name: /^I hold/ }).fill('5')
    await expect(page).toHaveURL(/qty=5(&|$)/)
    const q = query(page)
    expect(q.get('intent')).toBe('floor')
    expect(q.get('strike')).toBe('98')

    const link = await currentPath(page)
    await page.reload()
    await ready(page, 'A floor on BOND')
    expect(await currentPath(page)).toBe(link)
    await expect(chip(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }), /^98\.00 USDx/)).toBeChecked()
    await expect(guided(page).getByRole('radiogroup', { name: 'Choose the deadline' }).getByRole('radio').nth(2)).toBeChecked()
    await expect(guided(page).getByRole('textbox', { name: /^I hold/ })).toHaveValue('5')
    await expect(guided(page).getByTestId('guided-strike')).toContainText('98.00')

    // A chip adds a history entry; typing does not.
    await pick(chip(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }), /^97\.00 USDx/))
    await expect(page).toHaveURL(/strike=97/)
    await page.goBack()
    await expect(page).toHaveURL(/strike=98/)
    await expect(chip(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }), /^98\.00 USDx/)).toBeChecked()
    await expect(guided(page).getByRole('textbox', { name: /^I hold/ })).toHaveValue('5')
  })

  test('another intent starts from its own terms, and Back returns to the first', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided&intent=floor&strike=97&qty=2')
    await ready(page, 'A floor on BOND')
    await picker(page).getByRole('radio', { name: /^Earn on what you hold/ }).check()
    await ready(page, 'Earn on the BOND you hold')
    const q = query(page)
    expect(q.get('intent')).toBe('earn-hold')
    expect(q.get('strike')).toBeNull()
    expect(q.get('qty')).toBeNull()
    // A sale price starts at or above the reference price, never at the floor that was chosen before.
    await expect(guided(page).getByTestId('guided-strike')).toContainText('100.00')

    await page.goBack()
    await ready(page, 'A floor on BOND')
    await expect(guided(page).getByTestId('guided-strike')).toContainText('97.00')
  })

  test('closing the ticket keeps the quantity that was set', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    // The third deadline has an offer for one BOND; the default terms are for two.
    const dates = guided(page).getByRole('radiogroup', { name: 'Choose the deadline' })
    await pick(dates.getByRole('radio').nth(2))
    const qty = guided(page).getByRole('textbox', { name: /^I hold/ })
    await qty.fill('1')
    await expect(guided(page).getByTestId('guided-found')).toBeVisible()
    await action(page).getByRole('button', { name: 'Review this offer' }).click()
    await expectReview(page, 'Buy a put on BOND')
    await expect(ticket(page)).toContainText('long put on 1.00 BOND')
    await page.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page.getByTestId('ticket-flow')).toHaveCount(0)
    expect(query(page).get('offer')).toBeNull()
    await expect(qty).toHaveValue('1')
    await expect(page).toHaveURL(/qty=1(&|$)/)
    await expect(dates.getByRole('radio').nth(2)).toBeChecked()
    await expect(guided(page).getByTestId('guided-found')).toBeVisible()
  })
})

test.describe('when nothing matches', () => {
  test('a seller with no buyer posts an offer at a price of their own, with the lowest offer as reference', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided&intent=earn-hold', { connect: true })
    await ready(page, 'Earn on the BOND you hold')
    // Writing an offer is the normal way to earn here: the block opens on it, with one line on the buyer side.
    await expect(guided(page).getByRole('heading', { name: 'Post an offer at your price' })).toBeVisible()
    await expect(guided(page).getByTestId('guided-not-found')).toHaveText('No buyer is waiting for these terms.')
    const fallback = guided(page).getByTestId('guided-fallback')
    await expect(fallback).toContainText(/Lowest open offer at this price and date: \d+\.\d{2} USDx per unit, for 2\.00 BOND\./)
    // The quantity starts from that offer's lot, and the figures use its price, labelled as assumed.
    await expect(guided(page).getByRole('textbox', { name: /^I lock/ })).toHaveValue('2.00')
    await expect(guided(page)).toContainText(/Assuming \d+\.\d{2} USDx per unit, the lowest open offer at this price and date\./)
    await expect(sentence(page)).toBeVisible()
    await expect(guided(page)).not.toContainText('0.00 USDx, the same as')
    await expect(action(page).getByRole('button', { name: 'Post an offer' })).toBeVisible()

    await fallback.getByRole('button', { name: /^Use \d+\.\d{2} per unit$/ }).click()
    const premium = fallback.getByRole('textbox', { name: /^Premium you ask, in total/ })
    await expect(premium).toHaveValue(/^\d+\.\d{2}$/)
    const typed = await premium.inputValue()
    await expect(guided(page)).toContainText(`With your premium of ${typed} USDx. Someone has to accept it first.`)
    await expect(page.getByTestId('guided-summary')).toContainText(`You lock 2.00 BOND and ask ${typed} USDx.`)

    await action(page).getByRole('button', { name: 'Review your offer' }).click()
    await expectReview(page, /^(Write a call on BOND|Review your offer)$/)
    const q = query(page)
    expect(q.get('side')).toBe('write')
    expect(q.get('kind')).toBe('call')
    expect(q.get('strike')).toBe('100')
    expect(q.get('qty')).toBe('2.00')
    expect(q.get('premium')).toBe(typed)
  })

  test('a buyer whose quantity matches no offer gets the nearest terms and a request', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await guided(page).getByRole('textbox', { name: /^I hold/ }).fill('7')
    await expect(guided(page).getByRole('heading', { name: 'No single offer for 7.00 BOND at these terms' })).toBeVisible()
    // The smaller lots of the same terms are summed, and the user can start with one of them.
    await expect(guided(page).getByTestId('guided-not-found')).toContainText(/smaller offers? at these terms covers? \d+\.\d{2} of your 7\.00 BOND/)
    await expect(guided(page).getByRole('button', { name: /^Start with 2\.00 BOND at \d+\.\d{2}$/ })).toBeVisible()

    // Nothing is swapped in: the nearest funded terms are offered, each led by what differs.
    const suggestions = guided(page).getByRole('list').filter({ hasText: 'instead of' })
    await expect(suggestions.getByRole('listitem').first()).toContainText('instead of')
    const fallback = guided(page).getByTestId('guided-fallback')
    await expect(fallback.getByRole('heading', { name: 'Post a request and escrow your premium' })).toBeVisible()

    await action(page).getByRole('button', { name: 'Post a request' }).click()
    await expect(ticket(page)).toBeVisible()
    await expect(page.getByTestId('ticket-flow')).toHaveAttribute('data-step', 'terms')
    const q = query(page)
    expect(q.get('side')).toBe('bid')
    expect(q.get('kind')).toBe('put')
    expect(q.get('qty')).toBe('7')
    expect(q.get('strike')).toBe('99')
    await page.getByRole('button', { name: 'Close ticket' }).click()

    // Taking a suggestion moves focus to the block's heading, which now names the match.
    await suggestions.getByRole('button', { name: /^Use these terms/ }).first().click()
    await expect(guided(page).getByTestId('guided-found')).toBeVisible()
    await expect(guided(page).getByRole('heading', { name: 'Available now for exactly these terms' })).toBeFocused()
    await expect(action(page).getByRole('button', { name: 'Review this offer' })).toBeVisible()
  })

  test('a premium typed for one set of terms does not follow the user to others', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await guided(page).getByRole('textbox', { name: /^I hold/ }).fill('7')
    const premium = guided(page).getByRole('textbox', { name: /^Premium you offer, in total/ })
    await premium.fill('6')
    await expect(page).toHaveURL(/premium=6/)
    await pick(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }).getByRole('radio', { name: /^95\.00 USDx/ }))
    await expect(page).not.toHaveURL(/premium=/)
    await expect(premium).toHaveValue('')
  })
})

test.describe('what the link says', () => {
  test('a call chosen in the chain opens as a buy price to lock, not as a floor', async ({ page }) => {
    // Switching from the chain keeps the selected cell's kind and strike and names no intent.
    await openApp(page, '/markets/bond?mode=guided&kind=call&strike=101.00')
    await ready(page, 'Lock a buy price for BOND')
    await expect(picker(page).getByRole('radio', { name: /^Lock a buy price/ })).toBeChecked()
    await expect(guided(page).getByTestId('guided-strike')).toContainText('101.00')
    // A put's terms under a call's intent are not carried over.
    await routeTo(page, '/markets/bond?mode=guided&intent=floor&kind=call&strike=101.00')
    await ready(page, 'A floor on BOND')
    await expect(guided(page).getByTestId('guided-strike')).not.toContainText('101.00')
  })

  test('a price or a date that is not on the list is replaced, and said once', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided&intent=floor&strike=97.5')
    await ready(page, 'A floor on BOND')
    await expect(guided(page).getByTestId('guided-off-grid')).toHaveText(/^97\.50 USDx is not a listed price\. Showing \d+\.\d{2} USDx\.$/)
    await expect(page).not.toHaveURL(/strike=97\.5/)
  })

  test('the terms of a request the wallet already has are said first, with a way to it', async ({ page }) => {
    // The default wallet's seeded request: a put on 2.00 BOND at 98.00, on the third listed date.
    await openApp(page, '/markets/bond?mode=guided&intent=floor', { connect: true })
    await ready(page, 'A floor on BOND')
    await pick(guided(page).getByRole('radiogroup', { name: 'Choose the deadline' }).getByRole('radio').nth(2))
    await pick(chip(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }), /^98\.00 USDx/))
    await guided(page).getByRole('textbox', { name: /^I hold/ }).fill('2')
    await expect(guided(page).getByTestId('guided-own')).toContainText(/^Your request No\. 000000 is open at these terms: 2\.00 BOND, \d+\.\d{2} USDx escrowed\./)
    // A second order is not the obvious next step.
    await expect(action(page).getByRole('link', { name: 'View your request' })).toBeVisible()
  })
})

test.describe('an empty quantity', () => {
  test('asks for one, shows what is funded in fixed quantities, and says why the action waits', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    const qty = guided(page).getByRole('textbox', { name: /^I hold/ })
    await qty.fill('')
    await expect(guided(page).getByText('Enter a quantity.', { exact: true })).toBeVisible()
    await expect(guided(page).getByRole('heading', { name: 'Offers come in fixed quantities' })).toBeVisible()
    await expect(guided(page).getByRole('heading', { name: 'Enter a quantity to see what you would hold.' })).toBeVisible()
    await expect(guided(page).getByText('Enter a quantity to see each step with its amounts.')).toBeVisible()
    await expect(page.getByTestId('guided-summary')).toHaveCount(0)
    // Nothing prints a sentence with a hole in it.
    await expect(guided(page)).not.toContainText(/deliver\s+BOND|locks\s+USDx|\s{2,}USDx/)

    const post = action(page).getByRole('button', { name: 'Post a request' })
    await expect(post).toBeDisabled()
    await expect(post).toHaveAccessibleDescription('Enter a quantity first.')

    // Offers are sold whole: Max fills in the largest lot the holding covers, which an offer matches.
    await guided(page).getByRole('button', { name: /^Max/ }).click()
    await expect(qty).toHaveValue('2.00')
    await expect(action(page).getByRole('button', { name: 'Review this offer' })).toBeEnabled()
  })

  test('the quantity and the premium can be emptied with Backspace and retyped', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    const qty = guided(page).getByRole('textbox', { name: /^I hold/ })
    await expect(qty).toHaveValue('2.00')
    await qty.click()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await expect(qty).toHaveValue('')
    await expect(page).not.toHaveURL(/qty=/)
    await page.keyboard.type('5')
    await expect(qty).toHaveValue('5')
    await expect(page).toHaveURL(/qty=5(&|$)/)
    // A trailing dot stays while typing.
    await page.keyboard.type('.')
    await expect(qty).toHaveValue('5.')

    const premium = guided(page).getByRole('textbox', { name: /^Premium you offer, in total/ })
    await premium.click()
    await page.keyboard.type('1.25')
    await expect(premium).toHaveValue('1.25')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await expect(premium).toHaveValue('')
    await page.keyboard.type('3')
    await expect(premium).toHaveValue('3')
    await expect(page).toHaveURL(/premium=3(&|$)/)
  })
})

test.describe('the quantity field', () => {
  test('more than the wallet holds is said with exact figures', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided&intent=earn-hold&qty=15', { connect: true })
    await ready(page, 'Earn on the BOND you hold')
    await expect(guided(page)).toContainText('You hold 12.00 BOND; locking 15.00 BOND needs 3.00 BOND more. Lower the quantity or get test funds.')
  })
})

test.describe('outcome', () => {
  test('the price handle works by keyboard and rewrites the outcome sentence', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    const figure = guided(page).locator('figure')
    await expect(figure.locator('figcaption')).toHaveText(PAYOFF_CAPTION)
    await expect(figure.getByTestId('with-without-chart')).toBeVisible()

    const handle = slider(page, 'BOND')
    // At the reference price the floor is not used.
    await expect(sentence(page)).toHaveText(/^You keep 2\.00 BOND, worth 198\.80 USDx at that price, less the \d+\.\d{2} you paid\.$/)
    await expect(handle).toHaveAttribute('aria-valuetext', /^If BOND is at 99\.40 at the deadline\. You keep 2\.00 BOND/)

    await handle.focus()
    await page.keyboard.press('Home')
    await expect(sentence(page)).toHaveText(/^You sell 2\.00 BOND at 99\.00 and hold 198\.00 USDx, less the \d+\.\d{2} you paid\.$/)
    await expect(handle).toHaveAttribute('aria-valuetext', /You sell 2\.00 BOND at 99\.00 .* more than without the floor\.$/)
    await expect(guided(page).getByTestId('outcome-difference')).toContainText('more than without the floor')

    const before = Number(await handle.getAttribute('aria-valuenow'))
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
    await page.keyboard.press('End')
    await expect(sentence(page)).toHaveText(/^You keep 2\.00 BOND, worth /)
    await expect(guided(page).getByTestId('outcome-difference')).toContainText('less than without the floor')

    // A card moves the handle to its price.
    await guided(page).getByRole('button', { name: 'If BOND falls to 95.00' }).click()
    await expect(handle).toHaveAttribute('aria-valuenow', '95')
    await expect(sentence(page)).toHaveText(/^You sell 2\.00 BOND at 99\.00/)
  })

  test('says who acts and by when, and what the deadline does', async ({ page }) => {
    await openApp(page, '/markets/eqty?mode=guided&intent=earn-hold')
    await ready(page, 'Earn on the EQTY you hold')
    const when = guided(page).getByRole('region', { name: 'What happens and when' })
    const steps = when.getByRole('list', { name: 'What happens and when' }).getByRole('listitem')
    await expect(steps).toHaveCount(4)
    await expect(steps.nth(0)).toContainText('Now')
    await expect(steps.nth(1)).toContainText('Until the deadline')
    await expect(steps.nth(1)).toContainText('The buyer can take your EQTY')
    await expect(steps.nth(2)).toContainText(/At the deadline, \d{1,2} \w{3}, 08:00 UTC/)
    await expect(steps.nth(2)).toContainText('The deadline passes')
    await expect(steps.nth(3)).toContainText('You reclaim your EQTY')
    await expect(when).not.toContainText('Nothing settles by itself')
    // For a written covered call: what is given up, never a loss figure without a cap.
    await expect(guided(page)).toContainText('You give up')
    await expect(guided(page)).toContainText('Every rise above 25.00 USDx per EQTY')
    await expect(guided(page)).not.toContainText(/No cap|unlimited/i)
  })

  test('a floor prints the same worst case as the ticket: the premium', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    const total = /\d+\.\d{2}/.exec(await guided(page).getByTestId('guided-total').innerText())?.[0] ?? 'missing'
    await expect(guided(page).locator('dt', { hasText: 'Most you can lose' }).locator('xpath=following-sibling::dd')).toContainText(`${total} USDx`)
    await expect(guided(page)).toContainText('The premium, if you never use the floor.')
  })
})

test.describe('guest', () => {
  test('sees the terms, the offer and the outcome, and connects instead of meeting a dead button', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    await expect(guided(page).getByTestId('guided-found')).toBeVisible()
    await expect(sentence(page)).toBeVisible()
    // No balance and no Max without a wallet.
    await expect(guided(page).getByText(/^You hold /)).toHaveCount(0)
    await expect(guided(page).getByRole('button', { name: /^Max/ })).toHaveCount(0)
    await expect(action(page).getByRole('button', { name: /Review/ })).toHaveCount(0)
    await expect(action(page)).not.toContainText('Testnet')

    await pick(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }).getByRole('radio', { name: /^98\.00 USDx/ }))
    await action(page).getByRole('button', { name: 'Connect wallet' }).click()
    await expect(action(page).getByRole('button', { name: 'Review this offer' })).toBeVisible()
    await expect(guided(page).getByText('You hold 12.00 BOND')).toBeVisible()
    await expect(guided(page).getByTestId('guided-strike')).toContainText('98.00')
  })

  test('the reference price always carries its source, and no price is called a market price', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    // The label goes with the figure; the sentence that explains it lives in the asset header.
    await expect(guided(page)).toContainText('Demo price 99.40 USDx')
    await expect(guided(page)).not.toContainText('Chosen by the team')
    await expect(guided(page)).not.toContainText(/market price|oracle price|live price|spot price/i)
    await expect(guided(page)).not.toContainText(/guarantee|insur|risk-free|protected|\bsafe\b/i)
  })
})

test.describe('when the market cannot be read', () => {
  test('says so, keeps the intents on screen, and reads again on request', async ({ page }) => {
    // The mock chain runs in the page: its option list is made to fail, more often than the data layer retries.
    await openApp(page, '/learn')
    await failNextRead(page, 'listOptions', 50)
    await routeTo(page, '/markets/bond?mode=guided')
    const problem = guided(page).getByText('Could not read this market')
    await expect(problem).toBeVisible({ timeout: 20_000 })
    await expect(guided(page)).toContainText('Nothing was read from the contract. Check your connection and try again.')
    await expect(picker(page).getByRole('radio')).toHaveCount(4)
    await expect(guided(page).getByRole('article')).toHaveCount(0)

    await failNextRead(page, 'listOptions', 0)
    await guided(page).getByRole('button', { name: 'Try again' }).click()
    await ready(page, 'A floor on BOND')
    await expect(problem).toHaveCount(0)
  })
})

test.describe('accessibility and layout', () => {
  test('axe is clean in both themes, with a funded match and with the fallback', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await expect(sentence(page)).toBeVisible()
    await expectNoAxeViolations(page)

    await picker(page).getByRole('radio', { name: /^Earn on what you hold/ }).check()
    await ready(page, 'Earn on the BOND you hold')
    await expect(guided(page).getByTestId('guided-fallback')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('the choices are radio groups with one tab stop each and arrow keys', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    const floors = guided(page).getByRole('radiogroup', { name: 'Choose your floor' })
    await chip(floors, /^99\.00 USDx/).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(chip(floors, /^98\.00 USDx/)).toBeChecked()
    await expect(chip(floors, /^98\.00 USDx/)).toBeFocused()
    await expect(page).toHaveURL(/strike=98/)
    // A chip says in words whether something is funded behind it.
    await expect(chip(floors, /^98\.00 USDx, 1\.4% below the demo price, funded offer available$/)).toHaveCount(1)
    await expect(floors.getByRole('radio', { name: /no offer yet$/ }).first()).toBeVisible()

    await page.keyboard.press('Tab')
    await expect(guided(page).getByRole('radiogroup', { name: 'Choose the deadline' }).getByRole('radio', { checked: true })).toBeFocused()
  })

  test('headings come in order', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    const levels = await guided(page).getByRole('heading').evaluateAll((nodes) => nodes.map((n) => Number(n.tagName.slice(1))))
    expect(levels[0]).toBe(2)
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading ${i} jumps from h${levels[i - 1]} to h${levels[i]}`).toBeLessThanOrEqual(1)
  })

  test('at 390 px nothing overflows and every choice is a 44 px target @phone', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided')
    await ready(page, 'A floor on BOND')
    await expect(sentence(page)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    // The deadline figure stays inside the note down to the narrowest phones.
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 740 })
      // The chart measures its box after a resize: wait for the page to settle at the new width.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      await expectNoHorizontalOverflow(page)
      const inside = await guided(page).evaluate((root) => {
        const note = root.querySelector('article')?.getBoundingClientRect()
        const until = root.querySelector('[data-testid="guided-expiry"]')?.getBoundingClientRect()
        return !!note && !!until && until.right <= note.right
      })
      expect(inside, `deadline inside the note at ${width} px`).toBe(true)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    for (const group of ['What do you want to do?', 'Choose your floor', 'Choose the deadline']) {
      const boxes = await guided(page).getByRole('radiogroup', { name: group }).locator('label').evaluateAll((labels) => labels.map((l) => l.getBoundingClientRect().height))
      expect(boxes.length).toBeGreaterThan(2)
      for (const height of boxes) expect(height, group).toBeGreaterThanOrEqual(44)
    }

    // The fallback path too, connected.
    await connect(page)
    await picker(page).getByRole('radio', { name: /^Earn on what you hold/ }).check()
    await ready(page, 'Earn on the BOND you hold')
    await expect(guided(page).getByTestId('guided-fallback')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('on a phone the action opens the ticket at its review step, and closing it returns to the same terms @phone', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=guided', { connect: true })
    await ready(page, 'A floor on BOND')
    await pick(guided(page).getByRole('radiogroup', { name: 'Choose your floor' }).getByRole('radio', { name: /^98\.00 USDx/ }))
    await action(page).getByRole('button', { name: 'Review this offer' }).click()
    await expectReview(page, 'Buy a put on BOND')
    expect(query(page).get('strike')).toBe('98')
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page.getByTestId('ticket-flow')).toHaveCount(0)
    await ready(page, 'A floor on BOND')
    await expect(guided(page).getByTestId('guided-strike')).toContainText('98.00')
    await expect(guided(page).getByRole('textbox', { name: /^I hold/ })).toHaveValue('2.00')
  })

  test('axe is clean on a phone in both themes @phone', async ({ page }) => {
    await openApp(page, '/markets/eqty?mode=guided&intent=earn-hold')
    await ready(page, 'Earn on the EQTY you hold')
    await expect(sentence(page)).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
