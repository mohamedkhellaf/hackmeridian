/**
 * The order ticket (src/features/ticket), on the mock chain with the test wallet.
 *
 * Most tests drive the ticket through its own harness page (src/features/ticket/harness), which lists what can
 * be opened, switches the wallet and stages how the next transaction ends. The last blocks open the same ticket
 * through the asset route. Every test loads the page once: the mock chain lives in the page.
 *
 * Buy, fill and resale buy open on their review (there is nothing to set); write, request and list have a Terms
 * step first. There is no consent tick box: the wallet signature is the consent.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BANNED_TAGLINES, ISSUER_DISCLOSURE, PAYOFF_CAPTION, PREMIUM_DISCLOSURE, RESALE_PRICE_DISCLOSURE, bidEscrowDisclosure, findBannedWords } from '../src/core/disclosures'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'
import { COMMITMENT, RESALE_NOTE } from '../src/features/ticket/copy'
import { currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, quietDevOverlay, routeTo } from './helpers'

const HARNESS = '/src/features/ticket/harness/index.html'
const DESKTOP = { width: 1440, height: 900 }
const TABLET = { width: 1024, height: 900 }
const PHONE = { width: 390, height: 844 }

const ticket = (page: Page): Locator => page.getByTestId('ticket')
const flow = (page: Page): Locator => page.getByTestId('ticket-flow')
const button = (page: Page, name: string | RegExp): Locator => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true })
const offersList = (page: Page): Locator => page.getByTestId('harness-offers')
const heading = (page: Page, name: string | RegExp): Locator => page.getByRole('heading', { name, level: 2 })
/** A row of a ruled list, by its label. */
const row = (scope: Locator, label: string | RegExp): Locator => scope.locator('dl > div').filter({ has: scope.page().locator('dt', { hasText: typeof label === 'string' ? new RegExp(`^${label}$`) : label }) })
const pay = (page: Page): Locator => button(page, /^Pay [\d.,]+ USDx$/)

async function openHarness(page: Page, query = ''): Promise<void> {
  await quietDevOverlay(page)
  await page.goto(`${HARNESS}${query ? `?${query}` : ''}`)
  // Attached, not visible: a link that opens the ticket on a phone covers the harness with the ticket's page.
  await expect(page.locator('h1', { hasText: 'Ticket harness' })).toBeAttached()
  await expect(offersList(page).locator('button').first()).toBeAttached()
}

async function connectAs(page: Page, which: 'A' | 'B'): Promise<void> {
  await button(page, `Use wallet ${which}`).click()
  await expect(page.getByTestId('harness-wallet')).toHaveText(`Connected as wallet ${which}`)
}

/**
 * Opens the buy ticket of the first open offer of `kind` that neither test wallet wrote (a guest who connects
 * becomes wallet A, so its own offers are left out for guests too). Returns the offer id.
 */
async function openOffer(page: Page, kind: 'put' | 'call' = 'put'): Promise<string> {
  const offer = offersList(page).locator(`button[data-kind="${kind}"][data-maker]`).first()
  const id = /Buy offer (\d+):/.exec((await offer.textContent()) ?? '')?.[1]
  expect(id, 'an open offer to buy').toBeTruthy()
  await offer.click()
  await expect(heading(page, `Buy a ${kind} on RWA`)).toBeVisible()
  return id!
}

/** The closing figure of a form's terms ("You receive when bought 1.80 USDx"): the amount with its unit, as read. */
async function totalOf(page: Page): Promise<string> {
  const text = ((await page.getByTestId('ticket-total').locator('mark').first().innerText()) ?? '').split('\n')[0].replace(/\s+/g, ' ').trim()
  expect(text).toMatch(/^[\d,.]+ [A-Za-z]+$/)
  return text
}

/** The "Change terms" disclosure of a form, which holds the kind, deadline and strike pickers. */
const changeTerms = (scope: Locator): Locator => scope.locator('details', { has: scope.page().locator('summary', { hasText: 'Change terms' }) })

/** The figure of a review row, as read: "1.80 USDx". */
async function figureOf(scope: Locator, label: string): Promise<string> {
  const text = (await row(scope, label).locator('dd').first().innerText()).split('\n')[0]
  return text.replace(/\s+/g, ' ').trim()
}

/** Opens the closed payoff figure of a review. */
async function openFigure(page: Page): Promise<Locator> {
  const details = flow(page).locator('details', { has: page.locator('summary', { hasText: 'Payoff at the deadline' }) })
  await details.locator('summary').click()
  await expect(details).toHaveAttribute('open', '')
  return details
}

test.describe('buy an offer', () => {
  test.use({ viewport: DESKTOP })

  test('opens on its review and goes to the receipt: no Terms step, no tick box', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)

    // The review, in the rail beside the page, ordered by what informs the decision.
    const review = flow(page)
    await expect(ticket(page)).toHaveAttribute('data-container', 'rail')
    await expect(review).toHaveAttribute('data-step', 'review')
    // The contract's own number, unpadded.
    await expect(review.getByText(`Offer No. ${id}`, { exact: true })).toBeVisible()
    for (const label of ['You pay', 'Collateral locked', 'Strike', 'Quantity', 'Deadline', 'Breakeven', 'Most you can lose', 'Maker']) {
      await expect(row(review, label)).toBeVisible()
    }
    // The breakeven is decided on beside the money: it follows the money rows, before the issuer sentence; the
    // terms follow the outcome sentences.
    const top = async (l: Locator) => (await l.boundingBox())!.y
    expect(await top(row(review, 'Breakeven'))).toBeLessThan(await top(review.getByText(ISSUER_DISCLOSURE)))
    expect(await top(row(review, 'Strike'))).toBeGreaterThan(await top(review.getByTestId('outcome')))
    // No absence rows, no step trail, no consent.
    for (const gone of ['You lock', 'Counterparty', 'Offer', 'Your account', 'USDx balance']) await expect(row(review, gone)).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Steps of the ticket' })).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(button(page, 'Review')).toHaveCount(0)
    await expect(button(page, 'Back')).toHaveCount(0)

    // The checks that passed are one sentence with the read time; on mock data it says mock data, not a contract.
    await expect(review.getByTestId('checks')).toHaveText(/^Mock data, \d\d:\d\d:\d\d\sUTC: the offer is open, the RWA issuer has authorized your account, and you hold [\d,.]+\sUSDx\.$/)
    // The required sentences at their home, as plain paragraphs.
    await expect(row(review, 'You pay')).toContainText(PREMIUM_DISCLOSURE)
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await expect(review.getByText('Issuer control', { exact: true })).toHaveCount(0)
    await expect(review.getByTestId('outcome')).toContainText(COMMITMENT.buy)
    await expect(review.getByTestId('outcome')).toContainText(/If RWA is below [\d.]+\sUSDx, exercising pays: you deliver/)

    // The payoff figure is closed until asked for; its caption is inside with it.
    await expect(review.getByTestId('payoff-chart')).toBeHidden()
    const figure = await openFigure(page)
    await expect(figure.locator('figure figcaption')).toHaveText(PAYOFF_CAPTION)
    await expect(figure.getByRole('slider', { name: 'Assumed price at the deadline' })).toBeVisible()

    await pay(page).click()

    // Receipt: the contract note, the transaction, the right in words, the calendar entry and the way on.
    await expect(heading(page, 'Put bought')).toBeVisible()
    await expect(heading(page, 'Put bought')).toBeFocused()
    await expect(ticket(page)).toHaveAttribute('data-step', 'receipt')
    const receipt = flow(page)
    await expect(receipt.getByRole('heading', { name: 'Long put, RWA' })).toBeVisible()
    await expect(receipt.getByText('Active', { exact: true })).toBeVisible()
    await expect(receipt.getByTestId('receipt-tx')).toContainText('confirmed')
    await expect(receipt.getByText(/^Until .+\sUTC you can sell [\d.]+\sRWA for [\d,.]+\sUSDx\. Use it only if RWA is worth less than [\d.]+\sUSDx then: exercise from Portfolio before the deadline\.$/)).toBeVisible()
    await expect(receipt.getByRole('link', { name: /Open in Google Calendar instead/ })).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\//)

    const download = page.waitForEvent('download')
    await button(page, 'Add the deadline to your calendar').click()
    expect((await download).suggestedFilename()).toMatch(/^stellsec-deadline-\d{8}\.ics$/)

    // The chain moved: the offer is gone from the market and the wallet holds the option.
    await expect(offersList(page).getByRole('button', { name: new RegExp(`^Buy offer ${id}:`) })).toHaveCount(0)
    await expect(page.getByTestId('harness-held').getByRole('button', { name: new RegExp(`^Sell option ${id}:`) })).toBeVisible()

    const view = page.getByRole('link', { name: 'View position' })
    await expect(view).toHaveAttribute('href', new RegExp(`/portfolio/${id}$`))
    await view.click()
    await expect(page.getByTestId('harness-path')).toHaveText(`/portfolio/${id}`)
  })

  test('Done closes the ticket and the rail goes back to its idle note', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await pay(page).click()
    await expect(heading(page, 'Put bought')).toBeVisible()
    await button(page, 'Done').click()
    await expect(ticket(page)).toHaveCount(0)
    await expect(page.getByText('Pick an offer to see its terms.')).toBeVisible()
    await expect(page).not.toHaveURL(/offer=/)
    // The row that opened the ticket is gone (the offer was bought): focus lands on a heading, never on the body.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  })

  test('refuses the wallet its own offer, with the reason printed above the action', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await offersList(page).locator('button[data-mine]').first().click()
    await expect(flow(page).getByText('This is your own offer. You cannot buy it.')).toBeVisible()
    await expect(pay(page)).toBeDisabled()
    await expect(page.getByTestId('action-reason')).toHaveText('This is your own offer. You cannot buy it.')
  })

  test('an offer that is no longer open says so instead of asking for a payment', async ({ page }) => {
    // Option 0 of the mock market was bought before the page opened.
    await openHarness(page, 'offer=0')
    await expect(ticket(page).getByText('This offer was bought.')).toBeVisible()
    await expect(flow(page)).toHaveCount(0)
    await expect(pay(page)).toHaveCount(0)
    await expect(ticket(page).getByRole('button', { name: 'Connect wallet' })).toHaveCount(0)
  })

  test('switches between Buy, Write and Request on the same series', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)
    const strike = /put ([\d.]+)\sUSDx/.exec((await offersList(page).getByRole('button', { name: new RegExp(`^Buy offer ${id}:`) }).textContent()) ?? '')?.[1]
    await page.getByRole('radio', { name: 'Write' }).click()
    await expect(heading(page, 'Write a put on RWA')).toBeVisible()
    await expect(page).toHaveURL(/side=write/)
    // Opened on a series: the series is three rows, and the pickers wait behind "Change terms".
    await expect(row(flow(page), 'Strike')).toContainText(`${strike} USDx`)
    await expect(changeTerms(flow(page))).not.toHaveAttribute('open', '')
    await page.getByRole('radio', { name: 'Request' }).click()
    await expect(heading(page, 'Request a put on RWA')).toBeVisible()
    await page.getByRole('radio', { name: 'Buy', exact: true }).click()
    await expect(heading(page, 'Buy a put on RWA')).toBeVisible()
    await expect(page).toHaveURL(/offer=\d+/)
  })
})

test.describe('the transaction states', () => {
  test.use({ viewport: DESKTOP })

  async function toSigning(page: Page, outcome: string): Promise<void> {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, `Next ends ${outcome}`).click()
    await openOffer(page)
    await pay(page).click()
  }

  test('an unknown outcome shows the hash, never offers to send again, and resolves with "Check again"', async ({ page }) => {
    await toSigning(page, 'unknown')
    await expect(heading(page, 'Not confirmed yet')).toBeVisible()
    const sign = flow(page)
    await expect(sign.getByText('Outcome unknown')).toBeVisible()
    await expect(sign.getByText(/It can still go through until \d\d:\d\d:\d\d\sUTC\. Do not send another one before that: check again first\./)).toBeVisible()
    await expect(sign.getByRole('button', { name: 'Copy transaction hash' })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign again|try again|send again/i })).toHaveCount(0)
    await button(page, 'Check again').click()
    await expect(heading(page, 'Put bought')).toBeVisible()
  })

  test('while an outcome is unknown, another review waits for it', async ({ page }) => {
    await toSigning(page, 'unknown')
    await expect(heading(page, 'Not confirmed yet')).toBeVisible()
    await button(page, 'Close').click()
    await expect(ticket(page)).toHaveCount(0)
    // Another offer than the one sent.
    await offersList(page).locator('button[data-kind="put"][data-maker]').nth(1).click()
    await expect(heading(page, 'Buy a put on RWA')).toBeVisible()
    await expect(pay(page)).toBeDisabled()
    await expect(page.getByTestId('action-reason')).toHaveText(/^A transaction sent at \d\d:\d\d:\d\d\sUTC is not confirmed yet and can still go through until \d\d:\d\d:\d\d\sUTC\./)
    // Looking it up releases the review once the ledger has it.
    await flow(page).getByRole('button', { name: 'Check again' }).click()
    await expect(pay(page)).toBeEnabled()
  })

  test('a declined signature says nothing was sent and lets the user sign again', async ({ page }) => {
    await toSigning(page, 'declined')
    await expect(heading(page, 'Declined in the wallet')).toBeVisible()
    await expect(flow(page).getByText(/Nothing was sent and no fee was charged/)).toBeVisible()
    await button(page, 'Sign again').click()
    await expect(heading(page, 'Put bought')).toBeVisible()
  })

  test('a refusal before sending and a failure on the ledger read differently', async ({ page }) => {
    await toSigning(page, 'refused')
    await expect(heading(page, 'Refused before sending')).toBeVisible()
    await expect(flow(page).getByText(/No fee was charged\. Go back to the review to see what changed\.$/)).toBeVisible()
    await button(page, 'Back to review').click()
    await expect(flow(page)).toHaveAttribute('data-step', 'review')

    await button(page, 'Next ends failed').click()
    await pay(page).click()
    await expect(heading(page, 'Refused on the ledger')).toBeVisible()
    await expect(flow(page).getByText(/A ledger included the transaction\. The network fee was charged\./)).toBeVisible()
  })

  test('an expired transaction says nothing was charged and can be signed again', async ({ page }) => {
    await toSigning(page, 'expired')
    await expect(heading(page, 'The transaction expired')).toBeVisible()
    await expect(flow(page).getByText(/Nothing was charged\. You can sign again\./)).toBeVisible()
    await button(page, 'Sign again').click()
    await expect(heading(page, 'Put bought')).toBeVisible()
  })

  test('closing the ticket before the wallet is asked cancels the attempt', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)
    // Pay, then close at once, while the last re-check is still reading.
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="ticket"] button')]
      buttons.find((b) => /^Pay /.test(b.textContent ?? ''))?.click()
      buttons.find((b) => b.getAttribute('aria-label') === 'Close ticket')?.click()
    })
    await expect(ticket(page)).toHaveCount(0)
    await page.waitForTimeout(1500)
    await expect(offersList(page).getByRole('button', { name: new RegExp(`^Buy offer ${id}:`) })).toHaveCount(1)
    await expect(page.getByTestId('harness-held').getByRole('button', { name: new RegExp(`^Sell option ${id}:`) })).toHaveCount(0)
  })
})

test.describe('write an offer', () => {
  test.use({ viewport: DESKTOP })

  test('from the standard grid to an open offer, then another', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a put').click()
    await expect(heading(page, 'Write a put on RWA')).toBeVisible()

    // Opened without a series: a listed deadline and the strike nearest the reference, shown as rows; the pickers
    // wait behind "Change terms", so the quantity and the premium come first.
    const form = flow(page)
    await expect(changeTerms(form)).not.toHaveAttribute('open', '')
    await expect(row(form, 'Deadline')).toBeVisible()
    await changeTerms(form).locator('summary').first().click()
    await expect(form.getByRole('radiogroup', { name: 'Deadline' }).getByRole('radio', { checked: true })).toHaveCount(1)
    const strike = await form.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio', { checked: true }).getAttribute('value')
    expect(Number(strike)).toBeGreaterThan(0)
    await expect(button(page, 'Review')).toBeDisabled()
    await expect(page.getByTestId('action-reason')).toHaveText('Enter a quantity of RWA. Enter the premium per RWA, in USDx.')
    await expect(form.getByRole('radiogroup', { name: 'Collateral' })).toHaveCount(0)
    await expect(form.getByRole('link', { name: 'Write with partial margin instead' })).toHaveAttribute('href', /\/margin\/trade$/)

    // The premium is typed per unit; the total is computed exactly.
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('5')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).fill('0.36')
    const locks = `${(Number(strike) * 5).toFixed(2)} USDx`
    await expect(row(form, 'You lock')).toContainText(locks)
    await expect(row(form, 'Lowest open offer in this series')).toBeVisible()
    await expect(row(form, 'USDx balance after')).toBeVisible()
    expect(await totalOf(page)).toBe('1.80 USDx')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).blur()
    await expect(page).toHaveURL(/premium=1\.8(&|$)/)

    // Enter in a field goes to the review.
    await form.getByRole('textbox', { name: 'Premium per RWA' }).press('Enter')
    await expect(heading(page, 'Review your offer')).toBeVisible()
    const review = flow(page)
    await expect(row(review, 'You lock')).toContainText(locks)
    await expect(row(review, 'Your open offers')).toHaveCount(0)
    await expect(review.getByTestId('outcome')).toContainText('waits in the contract until you claim it')
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    const figure = await openFigure(page)
    await expect(figure.locator('figure figcaption')).toHaveText(PAYOFF_CAPTION)

    await button(page, `Write put, lock ${locks}`).click()
    await expect(heading(page, 'Offer written')).toBeVisible()
    await expect(flow(page).getByText('Offered', { exact: true })).toBeVisible()
    const view = page.getByRole('link', { name: 'View offer' })
    const id = /\/portfolio\/(\d+)$/.exec((await view.getAttribute('href')) ?? '')?.[1]
    expect(id).toBeTruthy()
    await expect(offersList(page).locator('button[data-mine]', { hasText: `Buy offer ${id}:` })).toBeVisible()

    // "Write another" starts the next offer from the same terms.
    await button(page, 'Write another').click()
    await expect(heading(page, 'Write a put on RWA')).toBeVisible()
    await expect(flow(page)).toHaveAttribute('data-step', 'terms')
    await expect(flow(page).getByRole('textbox', { name: /^Quantity/ })).toHaveValue('5')
    await expect(flow(page).getByRole('textbox', { name: 'Premium per RWA' })).toHaveValue('0.36')
  })

  test('validates with exact reasons and warns on implausible terms', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    const form = flow(page)
    const qty = form.getByRole('textbox', { name: /^Quantity/ })
    const premium = form.getByRole('textbox', { name: 'Premium per RWA' })

    // More than the wallet holds: the field says so, and the reason under the action names both figures, once,
    // with the way to test funds beside it (no notice repeats it).
    await qty.fill('500')
    await premium.fill('1')
    await premium.blur()
    await expect(form.getByText(/^This locks more than the 120\.00\sRWA you have\.$/)).toBeVisible()
    await expect(page.getByTestId('action-reason')).toHaveText(/^You have 120\.00\sRWA; this locks 500\.00\sRWA\./)
    await expect(form.getByText(/You have 120\.00\sRWA; this locks/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'How to get test funds' })).toHaveAttribute('href', /^\/markets\?funds=1&from=/)
    await expect(button(page, 'Review')).toBeDisabled()

    // Max takes the whole balance of the asset a covered call locks.
    await button(page, /^Max/).click()
    await expect(qty).toHaveValue('120')

    // A premium at or above the total strike is allowed, with a warning that carries no category word.
    await qty.fill('1')
    await premium.fill('5000')
    await premium.blur()
    await expect(form.getByText(/The premium is at least the total strike\./)).toBeVisible()
    await expect(form.getByText('Check terms', { exact: true })).toHaveCount(0)
    await expect(button(page, 'Review')).toBeEnabled()

    // Custom terms: a strike off the ladder and a date beyond the two-year tenor.
    await changeTerms(form).locator('summary').first().click()
    await form.locator('summary', { hasText: 'Custom terms' }).click()
    await form.getByRole('textbox', { name: /^Strike, USDx per RWA/ }).fill('10.33')
    await expect(form.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio', { checked: true })).toHaveCount(0)
    const far = `${new Date().getUTCFullYear() + 3}-01-15`
    await form.getByRole('textbox', { name: 'Deadline date, UTC' }).fill(far)
    await expect(form.getByText(/must be within 2 years\./)).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()
    await form.getByRole('textbox', { name: 'Deadline date, UTC' }).fill('not a date')
    await expect(form.getByText('Use the form 2026-12-18.')).toBeVisible()
  })

  test('a written call shows what it gives up, never an unlimited loss', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    const form = flow(page)
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('3')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).fill('0.4')
    await button(page, 'Review').click()
    const review = flow(page)
    await expect(row(review, 'You give up')).toContainText(/Every rise above [\d.]+\sUSDx per RWA/)
    await expect(row(review, 'You give up')).toContainText('You cannot owe more than the 3.00 RWA you lock; it can still fall in price.')
    await expect(row(review, 'Most you can lose')).toHaveCount(0)
    await openFigure(page)
    const text = await review.innerText()
    expect(text).not.toMatch(/unlimited|no cap/i)
    await expect(review.getByText(/Gives up the rise above/).first()).toBeVisible()
  })
})

test.describe('requests', () => {
  test.use({ viewport: DESKTOP })

  test('post a request: the escrow sentence, then the premium in escrow', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Request a put').click()
    await expect(heading(page, 'Request a put on RWA')).toBeVisible()
    const form = flow(page)
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('5')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).fill('0.4')
    await expect(page.getByTestId('escrow-line')).toHaveText(bidEscrowDisclosure('2.00 USDx'))
    expect(await totalOf(page)).toBe('2.00 USDx')

    await button(page, 'Review').click()
    await expect(heading(page, 'Review your request')).toBeVisible()
    const review = flow(page)
    expect(await figureOf(review, 'You escrow')).toBe('2.00 USDx')
    await expect(review.getByText(bidEscrowDisclosure('2.00 USDx'))).toBeVisible()
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await expect(review.getByTestId('outcome')).toContainText(COMMITMENT.bid)
    const before = await page.getByTestId('harness-bids').getByRole('button').count()
    await button(page, 'Post request, escrow 2.00 USDx').click()
    await expect(heading(page, 'Request posted')).toBeVisible()
    await expect(flow(page).getByText(/^Request No\. \d+/).first()).toBeVisible()
    await expect(page.getByTestId('harness-bids').getByRole('button')).toHaveCount(before + 1)

    const view = page.getByRole('link', { name: 'View my requests' })
    await expect(view).toHaveAttribute('href', /\/requests\?mine=1$/)
    await expect(button(page, 'Post another')).toBeVisible()
  })

  test('fill a request from the second wallet', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'B')
    const open = page.getByTestId('harness-bids').locator('button:not([data-mine])', { hasText: 'RWA' }).first()
    const text = (await open.textContent()) ?? ''
    const kind = /: (put|call) on/.exec(text)![1]
    const premium = /premium ([\d.,]+\sUSDx)/.exec(text)![1].replace(/\s/g, ' ')
    await open.click()
    await expect(heading(page, `Fill a request for a ${kind} on RWA`)).toBeVisible()

    const review = flow(page)
    await expect(review).toHaveAttribute('data-step', 'review')
    expect(await figureOf(review, 'You receive')).toBe(premium)
    await expect(row(review, 'You lock')).toBeVisible()
    await expect(row(review, 'Buyer')).toBeVisible()
    await expect(review.getByTestId('checks')).toContainText('the request is open')
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await button(page, /^Lock [\d.,]+ [A-Za-z]+ and fill$/).click()
    await expect(heading(page, 'Request filled')).toBeVisible()
    await expect(flow(page).getByRole('heading', { name: `Short ${kind}, RWA` })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View position' })).toHaveAttribute('href', /\/portfolio\/\d+$/)
  })

  test('refuses the buyer its own request', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'B')
    await page.getByTestId('harness-bids').locator('button[data-mine]').first().click()
    await expect(flow(page).getByText('This is your own request. You cannot fill it.')).toBeVisible()
    await expect(button(page, /^Lock .* and fill$/)).toBeDisabled()
  })
})

test.describe('resale', () => {
  test.use({ viewport: DESKTOP })

  test('buy a resale listing: the seller is paid, at the price reviewed', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const listing = page.getByTestId('harness-asks').getByRole('button').first()
    const text = (await listing.textContent()) ?? ''
    const kind = /: (put|call) on/.exec(text)![1]
    const price = / for ([\d.,]+\sUSDx)$/.exec(text)![1].replace(/\s/g, ' ')
    await listing.click()
    await expect(heading(page, new RegExp(`^Buy a ${kind} on [A-Z]+ from its holder$`))).toBeVisible()

    const review = flow(page)
    expect(await figureOf(review, 'You pay')).toBe(price)
    await expect(review.getByText(RESALE_NOTE)).toBeVisible()
    await expect(review.getByText(RESALE_PRICE_DISCLOSURE)).toBeVisible()
    await expect(review.getByText(PREMIUM_DISCLOSURE)).toHaveCount(0)
    await expect(review.getByTestId('checks')).toContainText('the listing is for sale')
    await expect(row(review, 'Seller')).toBeVisible()
    await expect(row(review, 'Maker')).toBeVisible()
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await button(page, `Pay ${price}`).click()
    await expect(heading(page, `${kind === 'put' ? 'Put' : 'Call'} bought from its holder`)).toBeVisible()
    await expect(page.getByTestId('harness-asks').getByRole('button')).toHaveCount(0)
  })

  test('list a position for sale, then change its price', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const held = page.getByTestId('harness-held').getByRole('button').first()
    const id = /Sell option (\d+):/.exec((await held.textContent()) ?? '')![1]
    await held.click()
    await expect(heading(page, /^Sell your (put|call) on [A-Z]+$/)).toBeVisible()
    // The chain records the first buyer's premium, not this holder's: it is named for what it is.
    await expect(row(flow(page), 'Original premium')).toBeVisible()
    await expect(flow(page).getByText(/Premium you paid/)).toHaveCount(0)
    await expect(button(page, 'Review')).toBeDisabled()
    // The price is typed per unit, like the reference printed above it; the exact total is a row of its own.
    const lowest = row(flow(page), 'Lowest open offer in this series')
    if ((await lowest.count()) > 0) await expect(lowest.locator('dd')).toContainText(/USDx per [A-Z]+/)
    const price = flow(page).getByRole('textbox', { name: /^Your price per [A-Z]+/ })
    await price.fill('0')
    await price.blur()
    await expect(flow(page).getByText('The price must be above zero.')).toBeVisible()
    await price.fill('0.7')
    const total = await totalOf(page)
    const qty = Number((await figureOf(flow(page), 'Quantity')).split(' ')[0].replace(/,/g, ''))
    expect(total).toBe(`${(qty * 0.7).toFixed(2)} USDx`)

    await button(page, 'Review').click()
    await expect(heading(page, 'Review your listing')).toBeVisible()
    const review = flow(page)
    expect(await figureOf(review, 'You receive')).toBe(total)
    await expect(review.getByTestId('checks')).toContainText('the option is active')
    // Selling is not keeping: no payoff figure, no breakeven, no loss drawn from someone else's premium.
    await expect(review.locator('summary', { hasText: 'Payoff at the deadline' })).toHaveCount(0)
    await expect(row(review, 'Breakeven')).toHaveCount(0)
    await expect(review.getByText(ISSUER_DISCLOSURE)).toHaveCount(0)
    await button(page, `List for ${total}`).click()
    await expect(heading(page, 'Listed for sale')).toBeVisible()
    await expect(page.getByTestId('harness-asks').getByRole('button', { name: new RegExp(`^Buy listing ${id}:.* for ${total.replace('.', '\\.')}$`) })).toBeVisible()
    await button(page, 'Done').click()

    // Opening it again is a change of price, starting from the current one per unit; the same price cannot be signed.
    await page.getByTestId('harness-held').getByRole('button', { name: new RegExp(`^Sell option ${id}:`) }).click()
    await expect(heading(page, /^Change the price of your (put|call) on [A-Z]+$/)).toBeVisible()
    await expect(flow(page).getByRole('textbox', { name: /^Your price per/ })).toHaveValue('0.7')
    await expect(row(flow(page), 'Listed now')).toContainText(total)
    await expect(button(page, 'Review')).toBeDisabled()
    await expect(page.getByTestId('action-reason')).toHaveText('This is the current price.')

    // The same ticket takes the listing off sale: its own review, a way back to the price, then the receipt.
    await button(page, 'Cancel listing').click()
    await expect(heading(page, /^Cancel the listing of your (put|call) on [A-Z]+$/)).toBeVisible()
    const cancel = flow(page)
    expect(await figureOf(cancel, 'Listed now')).toBe(total)
    await expect(cancel.getByTestId('outcome')).toContainText('You keep the option and can still exercise it before the deadline.')
    await button(page, 'Back').click()
    await expect(heading(page, /^Change the price of your (put|call) on [A-Z]+$/)).toBeVisible()
    await button(page, 'Cancel listing').click()
    await button(page, 'Cancel listing').click()
    await expect(heading(page, 'Listing cancelled')).toBeVisible()
    await expect(flow(page).getByText('Active', { exact: true })).toBeVisible()
    await expect(page.getByTestId('harness-asks').getByRole('button', { name: new RegExp(`^Buy listing ${id}:`) })).toHaveCount(0)
  })
})

test.describe('guest', () => {
  test.use({ viewport: DESKTOP })

  test('sees the review and a Connect wallet action, never a dead button', async ({ page }) => {
    await openHarness(page)
    await expect(page.getByTestId('harness-wallet')).toHaveText('Guest')
    await openOffer(page)
    await expect(row(flow(page), 'Strike')).toBeVisible()
    await expect(pay(page)).toHaveCount(0)
    const connect = ticket(page).getByRole('button', { name: 'Connect wallet' })
    await expect(connect).toBeEnabled()
    await connect.click()
    await expect(pay(page)).toBeEnabled()
    // No tagline under the action.
    expect(findBannedWords(await ticket(page).innerText(), BANNED_TAGLINES)).toEqual([])
  })

  test('sees the form of a request with its terms kept after connecting', async ({ page }) => {
    await openHarness(page, 'side=bid&kind=call&qty=3&premium=1.5')
    await expect(heading(page, 'Request a call on RWA')).toBeVisible()
    await expect(page.getByTestId('escrow-line')).toHaveText(bidEscrowDisclosure('1.50 USDx'))
    await expect(flow(page).getByRole('textbox', { name: 'Premium per RWA' })).toHaveValue('0.5')
    await ticket(page).getByRole('button', { name: 'Connect wallet' }).click()
    await expect(flow(page).getByRole('textbox', { name: /^Quantity/ })).toHaveValue('3')
    await expect(button(page, 'Review')).toBeEnabled()
  })
})

test.describe('keyboard', () => {
  test.use({ viewport: DESKTOP })

  /** Presses Tab until the focused element matches, and fails with what had focus if it never does. */
  async function tabTo(page: Page, target: Locator, max = 50): Promise<void> {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab')
      if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return
    }
    throw new Error(`Tab never reached the target. Focus is on: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160))}`)
  }

  test('buys an offer with the keyboard alone, with focus on the heading of every step', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const offer = offersList(page).locator('button[data-kind="put"][data-maker]').first()
    await offer.focus()
    await page.keyboard.press('Enter')

    // Opening the ticket moves focus to its heading and says so.
    await expect(heading(page, 'Buy a put on RWA')).toBeFocused()

    // The figure opens from its summary; the assumed price moves with the arrow keys and reads its outcome.
    const summary = flow(page).locator('summary', { hasText: 'Payoff at the deadline' })
    await tabTo(page, summary)
    await page.keyboard.press('Enter')
    const slider = page.getByRole('slider', { name: 'Assumed price at the deadline' })
    await tabTo(page, slider)
    const before = await slider.getAttribute('aria-valuenow')
    await page.keyboard.press('ArrowLeft')
    expect(await slider.getAttribute('aria-valuenow')).not.toBe(before)
    await expect(slider).toHaveAttribute('aria-valuetext', /^At [\d.]+ you would /)

    await tabTo(page, pay(page))
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Put bought')).toBeFocused()

    await tabTo(page, page.getByRole('link', { name: 'View position' }))
    await tabTo(page, button(page, 'Done'), 3)
    await page.keyboard.press('Enter')
    await expect(ticket(page)).toHaveCount(0)
  })

  test('Escape closes the ticket in the rail, and the strike chips are one tab stop with arrow keys', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a put').click()
    await changeTerms(ticket(page)).locator('summary').first().click()
    const strikes = ticket(page).getByRole('radiogroup', { name: /^Strike/ })
    const checked = strikes.getByRole('radio', { checked: true })
    const first = await checked.getAttribute('value')
    await checked.focus()
    await page.keyboard.press('ArrowRight')
    await expect(strikes.getByRole('radio', { checked: true })).not.toHaveAttribute('value', first!)
    await expect(strikes.getByRole('radio', { checked: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(strikes.locator(':focus')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(ticket(page)).toHaveCount(0)
    // Focus goes back to what opened the ticket.
    await expect(button(page, 'Write a put')).toBeFocused()
  })
})

test.describe('drawer, 768 to 1199 px', () => {
  test.use({ viewport: TABLET })

  test('the ticket is a modal drawer with its actions in the footer', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    const dialog = page.getByRole('dialog', { name: 'Buy a put on RWA' })
    await expect(dialog).toBeVisible()
    await expect(ticket(page)).toHaveAttribute('data-container', 'drawer')
    await expect(dialog.getByRole('button', { name: /^Pay / })).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.width).toBe(420)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page).not.toHaveURL(/offer=/)
  })

  test('Escape leaves a transaction in flight on screen, as in the rail, and closes the receipt', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await pay(page).click()
    await expect(page.getByRole('dialog').getByText(/^(Sign in your wallet|Sending|Waiting for the ledger)$/).first()).toBeVisible()
    await page.keyboard.press('Escape')
    const dialog = page.getByRole('dialog', { name: 'Put bought' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

// Tagged @phone: these run in the suite's phone project (390 x 844, touch, mobile viewport).
test.describe('phone, 390 px @phone', () => {
  test('the ticket is a full page with a 64 px action bar, and the issuer sentence is on the first screen', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    const dialog = page.getByRole('dialog', { name: 'Buy a put on RWA' })
    await expect(ticket(page)).toHaveAttribute('data-container', 'page')

    // A full page: the whole viewport, nothing sideways.
    const box = await dialog.boundingBox()
    expect(Math.round(box!.width)).toBe(PHONE.width)
    expect(Math.round(box!.height)).toBe(PHONE.height)
    await expectNoHorizontalOverflow(page)

    // The action bar: 64 px, one full-width action of at least 48 px.
    const bar = dialog.locator('footer')
    expect(Math.round((await bar.boundingBox())!.height)).toBe(64)
    const action = dialog.getByRole('button', { name: /^Pay / })
    const actionBox = (await action.boundingBox())!
    expect(actionBox.height).toBeGreaterThanOrEqual(48)
    expect(actionBox.width).toBeGreaterThanOrEqual(PHONE.width - 32 - 1)

    // Nothing to tick: the issuer sentence sits above the bar on the first screen.
    const issuer = dialog.getByText(ISSUER_DISCLOSURE)
    const ib = (await issuer.boundingBox())!
    expect(ib.y + ib.height).toBeLessThanOrEqual((await bar.boundingBox())!.y)

    await action.tap()
    await expect(page.getByRole('dialog', { name: 'Put bought' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View position' })).toBeVisible()
    expect(Math.round((await page.getByRole('dialog').locator('footer').boundingBox())!.height)).toBe(64)
    await expectNoHorizontalOverflow(page)
  })

  for (const size of [
    { width: 375, height: 667 },
    { width: 360, height: 640 },
  ]) {
    test(`at ${size.width} x ${size.height} the issuer sentence is on the first screen of buy, fill and resale buy`, async ({ page }) => {
      await page.setViewportSize(size)
      await openHarness(page)
      await connectAs(page, 'B')
      const cases: [string, Locator][] = [
        ['buy', offersList(page).locator('button[data-kind="put"][data-maker]').first()],
        ['fill', page.getByTestId('harness-bids').locator('button:not([data-mine])', { hasText: 'RWA' }).first()],
        ['resale buy', page.getByTestId('harness-asks').getByRole('button').first()],
      ]
      for (const [name, opener] of cases) {
        await opener.click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByTestId('ticket-flow')).toHaveAttribute('data-step', 'review')
        const issuer = dialog.getByText(ISSUER_DISCLOSURE)
        await expect(issuer, name).toBeVisible()
        const ib = (await issuer.boundingBox())!
        const barTop = (await dialog.locator('footer').boundingBox())!.y
        expect(ib.y + ib.height, `${name}: the issuer sentence ends above the action bar`).toBeLessThanOrEqual(barTop)
        await button(page, 'Close ticket').click()
        await expect(dialog).toHaveCount(0)
      }
    })
  }

  test('the page has no axe violation in either theme, on the review and on the form', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await expect(ticket(page)).toHaveAttribute('data-container', 'page')
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
    await button(page, 'Close ticket').click()
    await button(page, 'Request a put').click()
    await expect(page.getByRole('dialog', { name: 'Request a put on RWA' })).toBeVisible()
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
  })

  test('the write form fits the phone: inputs at 16 px, chips at 44 px', async ({ page }) => {
    await openHarness(page, 'side=write&kind=put')
    const dialog = page.getByRole('dialog', { name: 'Write a put on RWA' })
    await expect(dialog).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const qty = dialog.getByRole('textbox', { name: /^Quantity/ })
    expect(await qty.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
    await changeTerms(dialog).locator('summary').first().click()
    const chip = dialog.getByRole('radiogroup', { name: /^Strike/ }).locator('label').first()
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const dialogBox = (await dialog.boundingBox())!
    for (const el of await dialog.getByRole('radiogroup', { name: /^Strike/ }).locator('label').all()) {
      const b = (await el.boundingBox())!
      expect(b.x + b.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width)
    }
  })
})

test.describe('accessibility', () => {
  test('the rail ticket has no axe violation in either theme, on the review, the figure and the receipt', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
    await openFigure(page)
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
    await pay(page).click()
    await expect(heading(page, 'Put bought')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
  })

  test('the forms and the sign step have no axe violation in either theme', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    await flow(page).getByRole('textbox', { name: /^Quantity/ }).fill('500')
    await flow(page).getByRole('textbox', { name: 'Premium per RWA' }).fill('1')
    await changeTerms(flow(page)).locator('summary').first().click()
    await flow(page).locator('summary', { hasText: 'Custom terms' }).click()
    await expect(flow(page).getByText(/^This locks more than the 120\.00\sRWA you have\.$/)).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })

    await button(page, 'Close ticket').click()
    await button(page, 'Next ends unknown').click()
    await openOffer(page)
    await pay(page).click()
    await expect(heading(page, 'Not confirmed yet')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
  })

  test('the drawer has no axe violation in either theme', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await expect(pay(page)).toBeVisible()
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
  })
})

test.describe('through the asset route', () => {
  test.use({ viewport: DESKTOP })

  test('a link opens the write ticket in the rail of the asset page, for a guest too', async ({ page }) => {
    await openApp(page, '/markets/rwa?side=write&kind=put')
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'Write a put on RWA', level: 2 })).toBeVisible()
    await expect(rail.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    // The quantity and the premium are on the rail's first screen, above its action bar; the pickers wait behind
    // "Change terms".
    const bar = rail.getByRole('button', { name: 'Connect wallet' })
    const premium = rail.getByRole('textbox', { name: 'Premium per RWA' })
    await expect(premium).toBeInViewport({ ratio: 1 })
    expect((await premium.boundingBox())!.y + (await premium.boundingBox())!.height).toBeLessThanOrEqual((await bar.boundingBox())!.y)
    await changeTerms(rail).locator('summary').first().click()
    await rail.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio').first().check({ force: true })
    await expect(page).toHaveURL(/strike=[\d.]+/)
    await rail.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page).not.toHaveURL(/side=write/)
    await expect(rail.getByTestId('ticket')).toHaveCount(0)
  })

  test('an offer another account takes during the review: one notice with the reason, and the next offer', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain&offer=47', { connect: true })
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'Buy a put on BOND', level: 2 })).toBeVisible()
    await page.evaluate(async () => {
      const hook = (window as unknown as { __stellsec: { mock(): Promise<{ buy(id: bigint, buyer: string): Promise<unknown> }> } }).__stellsec
      await (await hook.mock()).buy(47n, 'GHEDGEROTHERACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
    })
    await rail.getByRole('button', { name: /^Pay / }).click()
    // The re-check stops it; the reason is said once, and the dead terms lose their figure.
    const changed = rail.getByText(/^Something changed since you opened the review\. Nothing was sent\. Another account bought this offer\.$/)
    await expect(changed).toBeVisible()
    await expect(rail.getByText(/This offer is no longer open/).filter({ visible: true })).toHaveCount(0)
    await expect(page.getByTestId('action-reason')).toHaveText('Another account bought this offer.')
    await expect(rail.locator('summary', { hasText: 'Payoff at the deadline' })).toHaveCount(0)
    const next = rail.getByRole('button', { name: /^Next offer: [\d.]+ USDx per BOND, [\d.]+ BOND$/ })
    await next.click()
    await expect(page).not.toHaveURL(/offer=47(&|$)/)
    await expect(rail.getByTestId('ticket-flow')).toHaveAttribute('data-step', 'review')
    await expect(rail.getByRole('button', { name: /^Pay / })).toBeEnabled()
  })

  test('a wallet that cannot pay reads the shortfall at its balance row and under the action, with the way to test funds and back', async ({ page }) => {
    await openApp(page, '/markets/bond?mode=chain&offer=47', { connect: DEMO_WALLETS.c })
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'Buy a put on BOND', level: 2 })).toBeVisible()
    const review = rail.getByTestId('ticket-flow')
    await expect(row(review, 'USDx balance')).toContainText(/short$/)
    // Stated once in the review, never as a notice headed by a category word.
    await expect(page.getByTestId('action-reason')).toHaveText(/^You have 0\.00\sUSDx; this needs [\d.,]+\sUSDx\. Get test funds or pick a smaller offer\.$/)
    await expect(review.getByText(/^You have 0\.00\sUSDx/)).toHaveCount(0)
    for (const word of ['Blocked', 'Warning', 'Exercise', 'Check terms']) await expect(rail.getByText(word, { exact: true })).toHaveCount(0)
    // The way to test funds sits beside the reason and carries the order, so the funds strip can lead back to it.
    const funds = rail.getByRole('link', { name: 'How to get test funds' })
    const href = (await funds.getAttribute('href')) ?? ''
    const url = new URL(href, 'http://app.invalid')
    expect(url.pathname).toBe('/markets')
    expect(url.searchParams.get('funds')).toBe('1')
    expect(url.searchParams.get('from')).toMatch(/^\/markets\/bond\?.*offer=47/)
    await expect(pay(page)).toBeDisabled()
  })

  test('new terms from the page after a written offer start a new form, and the receipt keeps what was signed', async ({ page }) => {
    await openApp(page, '/markets/rwa?side=write&kind=put', { connect: true })
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    const form = rail.getByTestId('ticket-flow')
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('1')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).fill('0.5')
    await form.getByRole('textbox', { name: 'Premium per RWA' }).blur()
    await expect(page).toHaveURL(/premium=0\.5/)
    await rail.getByRole('button', { name: 'Review', exact: true }).click()
    const strike = await figureOf(form, 'Strike')
    await rail.getByRole('button', { name: /^Write put, lock / }).click()
    await expect(rail.getByRole('heading', { name: 'Offer written', level: 2 })).toBeVisible()
    await expect(form).toContainText(strike)

    // Another strike chosen on the page: the ticket starts again at Terms with it.
    const path = await currentPath(page)
    const other = (Number(/strike=([\d.]+)/.exec(path)![1]) + 0.2).toFixed(1)
    await routeTo(page, path.replace(/strike=[\d.]+/, `strike=${other}`))
    await expect(rail.getByRole('heading', { name: 'Write a put on RWA', level: 2 })).toBeVisible()
    await expect(form).toHaveAttribute('data-step', 'terms')
    await expect(row(form, 'Strike')).toContainText(`${Number(other).toFixed(2)} USDx`)
  })
})
