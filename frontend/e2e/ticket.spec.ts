/**
 * The order ticket (src/features/ticket), on the mock chain with the test wallet.
 *
 * Most tests drive the ticket through its own harness page (src/features/ticket/harness), which lists what can
 * be opened, switches the wallet and stages how the next transaction ends. The last block opens the same
 * ticket through the asset route. Every test loads the page once: the mock chain lives in the page.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { COLLATERAL_CARDS, ISSUER_DISCLOSURE, PAYOFF_CAPTION, PREMIUM_DISCLOSURE, RESALE_PRICE_DISCLOSURE, bidEscrowDisclosure } from '../src/core/disclosures'
import { CONSENT, GUEST_NOTE, RESALE_NOTE } from '../src/features/ticket/copy'
import { expectNoAxeViolations, expectNoHorizontalOverflow, openApp, quietDevOverlay } from './helpers'

const HARNESS = '/src/features/ticket/harness/index.html'
const DESKTOP = { width: 1440, height: 900 }
const TABLET = { width: 1024, height: 900 }
const PHONE = { width: 390, height: 844 }

const ticket = (page: Page): Locator => page.getByTestId('ticket')
const flow = (page: Page): Locator => page.getByTestId('ticket-flow')
const button = (page: Page, name: string | RegExp): Locator => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true })
const offersList = (page: Page): Locator => page.getByTestId('harness-offers')
const heading = (page: Page, name: string | RegExp): Locator => page.getByRole('heading', { name, level: 2 })

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
  const row = offersList(page).locator(`button[data-kind="${kind}"][data-maker]`).first()
  const id = /Buy offer (\d+):/.exec((await row.textContent()) ?? '')?.[1]
  expect(id, 'an open offer to buy').toBeTruthy()
  await row.click()
  await expect(heading(page, `Buy a ${kind} on FUND`)).toBeVisible()
  return id!
}

/** "You pay 0.90 USDx" at the foot of the terms: the amount with its unit. */
async function totalOf(page: Page): Promise<string> {
  const text = (await page.getByTestId('ticket-total').locator('mark').first().textContent()) ?? ''
  expect(text).toMatch(/^[\d,.]+ [A-Za-z]+$/)
  return text
}

async function consent(page: Page): Promise<void> {
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('checkbox')).toBeChecked()
}

test.describe('buy an offer', () => {
  test.use({ viewport: DESKTOP })

  test('goes through terms, review, the consent gate and the receipt', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)
    const pays = await totalOf(page)

    // Terms: the offer as a term sheet, in the rail beside the page.
    await expect(ticket(page)).toHaveAttribute('data-container', 'rail')
    await expect(ticket(page).getByText('Put, American style')).toBeVisible()
    await expect(ticket(page).getByText(`No. ${id.padStart(6, '0')}`)).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Terms' })).toHaveAttribute('aria-current', 'step')

    await button(page, 'Review').click()
    await expect(page.getByRole('listitem').filter({ hasText: 'Review' })).toHaveAttribute('aria-current', 'step')

    // Review: the impact summary, the state re-read from the contract, the required sentences at their home.
    const review = flow(page)
    for (const label of ['You pay', 'You lock', 'Breakeven', 'Most you can lose', 'Deadline', 'Counterparty', 'Offer', 'Your account', 'USDx balance']) {
      await expect(review.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible()
    }
    await expect(review.locator('dl > div', { hasText: 'Offer' }).filter({ hasText: 'Open' })).toContainText('Re-read from the contract at')
    await expect(review.getByText('Authorized by the FUND issuer')).toBeVisible()
    await expect(review.getByText(PREMIUM_DISCLOSURE)).toBeVisible()
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await expect(review.locator('figure figcaption')).toHaveText(PAYOFF_CAPTION)
    await expect(review.getByTestId('payoff-chart')).toBeVisible()
    await expect(review.getByRole('slider', { name: 'Assumed price at expiry' })).toBeVisible()
    await expect(review.getByText('Decided by ledger close time.')).toBeVisible()

    // The consent checkbox gates the action.
    const pay = button(page, `Pay ${pays}`)
    await expect(pay).toBeDisabled()
    await expect(page.getByRole('checkbox', { name: CONSENT.buy })).not.toBeChecked()
    await consent(page)
    await expect(pay).toBeEnabled()
    await pay.click()

    // Receipt: the contract note, the transaction, the reminder, the calendar entry and the way on.
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
    await expect(heading(page, 'Bought. The put is yours.')).toBeFocused()
    const receipt = flow(page)
    await expect(receipt.getByRole('heading', { name: 'Long put, FUND' })).toBeVisible()
    await expect(receipt.getByText('Active', { exact: true })).toBeVisible()
    await expect(receipt.getByTestId('receipt-tx')).toContainText('confirmed')
    await expect(receipt.getByText('Nothing settles by itself. To use the put, exercise before the deadline.')).toBeVisible()
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
    const pays = await totalOf(page)
    await button(page, 'Review').click()
    await consent(page)
    await button(page, `Pay ${pays}`).click()
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
    await button(page, 'Done').click()
    await expect(ticket(page)).toHaveCount(0)
    await expect(page.getByText('Pick an offer to see its terms.')).toBeVisible()
    await expect(page).not.toHaveURL(/offer=/)
  })

  test('refuses the wallet its own offer, with the reason on the button', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await offersList(page).locator('button[data-mine]').first().click()
    await expect(flow(page).getByText('This is your own offer. You cannot buy it.')).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()
  })

  test('opens at the review step when asked to, and Back returns to the terms', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)
    await button(page, 'Close ticket').click()
    await openHarness(page, `offer=${id}&step=review`)
    await expect(page.getByRole('listitem').filter({ hasText: 'Review' })).toHaveAttribute('aria-current', 'step')
    await expect(page.getByRole('checkbox')).toBeVisible()
    await button(page, 'Back').click()
    await expect(page.getByRole('listitem').filter({ hasText: 'Terms' })).toHaveAttribute('aria-current', 'step')
  })

  test('switches between Buy, Write and Request on the same series', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const id = await openOffer(page)
    const strike = /put ([\d.]+) USDx/.exec((await offersList(page).getByRole('button', { name: new RegExp(`^Buy offer ${id}:`) }).textContent()) ?? '')?.[1]
    await page.getByRole('radio', { name: 'Write' }).click()
    await expect(heading(page, 'Write a put on FUND')).toBeVisible()
    await expect(page).toHaveURL(/side=write/)
    await expect(ticket(page).getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio', { checked: true })).toHaveAccessibleName(strike!)
    await page.getByRole('radio', { name: 'Request' }).click()
    await expect(heading(page, 'Request a put on FUND')).toBeVisible()
    await page.getByRole('radio', { name: 'Buy', exact: true }).click()
    await expect(heading(page, 'Buy a put on FUND')).toBeVisible()
    await expect(page).toHaveURL(/offer=\d+/)
  })
})

test.describe('the transaction states', () => {
  test.use({ viewport: DESKTOP })

  async function toSigning(page: Page, outcome: string): Promise<string> {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, `Next ends ${outcome}`).click()
    await openOffer(page)
    const pays = await totalOf(page)
    await button(page, 'Review').click()
    await consent(page)
    await button(page, `Pay ${pays}`).click()
    return pays
  }

  test('an unknown outcome shows the hash, never offers to send again, and resolves with "Check again"', async ({ page }) => {
    await toSigning(page, 'unknown')
    await expect(heading(page, 'Not confirmed yet')).toBeVisible()
    const sign = flow(page)
    await expect(sign.getByText('Outcome unknown')).toBeVisible()
    await expect(sign.getByText(/It can still go through until \d\d:\d\d:\d\d UTC\. Do not send another one before that: check again first\./)).toBeVisible()
    await expect(sign.getByRole('button', { name: 'Copy transaction hash' })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign again|try again|send again/i })).toHaveCount(0)
    await button(page, 'Check again').click()
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
  })

  test('a declined signature says nothing was sent and lets the user sign again', async ({ page }) => {
    await toSigning(page, 'declined')
    await expect(heading(page, 'Declined in the wallet')).toBeVisible()
    await expect(flow(page).getByText(/Nothing was sent and no fee was charged/)).toBeVisible()
    await button(page, 'Sign again').click()
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
  })

  test('a refusal before sending and a failure on the ledger read differently', async ({ page }) => {
    await toSigning(page, 'refused')
    await expect(heading(page, 'The transaction did not go through')).toBeVisible()
    await expect(flow(page).getByText(/Nothing was sent and no fee was charged\. Go back to the review/)).toBeVisible()
    await button(page, 'Back to review').click()
    await expect(page.getByRole('checkbox')).not.toBeChecked()

    await button(page, 'Next ends failed').click()
    await consent(page)
    await button(page, /^Pay /).click()
    await expect(heading(page, 'The transaction did not go through')).toBeVisible()
    await expect(flow(page).getByText(/A ledger included the transaction and the contract refused it\. The network fee was charged\./)).toBeVisible()
  })

  test('an expired transaction says nothing was charged and can be signed again', async ({ page }) => {
    await toSigning(page, 'expired')
    await expect(heading(page, 'The transaction expired')).toBeVisible()
    await expect(flow(page).getByText(/Nothing was charged\. You can sign again\./)).toBeVisible()
    await button(page, 'Sign again').click()
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
  })
})

test.describe('write an offer', () => {
  test.use({ viewport: DESKTOP })

  test('from the standard grid to an open offer', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a put').click()
    await expect(heading(page, 'Write a put on FUND')).toBeVisible()

    // The form starts on the grid: a listed expiry and the strike nearest the reference price are chosen.
    const form = flow(page)
    await expect(form.getByRole('radiogroup', { name: 'Expiry' }).getByRole('radio', { checked: true })).toHaveCount(1)
    const strike = await form.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio', { checked: true }).getAttribute('value')
    expect(Number(strike)).toBeGreaterThan(0)
    await expect(button(page, 'Review')).toBeDisabled()

    await form.getByRole('textbox', { name: /^Quantity/ }).fill('5')
    await form.getByRole('textbox', { name: /^Premium you ask/ }).fill('1.8')
    const locks = `${(Number(strike) * 5).toFixed(2)} USDx`
    await expect(form.locator('dl > div', { hasText: 'You lock' })).toContainText(locks)
    await expect(form.locator('dl > div', { hasText: 'Lowest open offer in this series' })).toBeVisible()
    await expect(form.locator('dl > div', { hasText: 'USDx balance after' })).toBeVisible()
    expect(await totalOf(page)).toBe('1.80 USDx')

    await button(page, 'Review').click()
    const review = flow(page)
    await expect(review.locator('dl > div', { hasText: 'You lock' })).toContainText(locks)
    await expect(review.locator('dl > div', { hasText: 'Your open offers' })).toContainText(/\d+ of 50/)
    await expect(review.getByText('If the holder exercises')).toContainText('waits in the contract until you claim it')
    await expect(review.locator('figure figcaption')).toHaveText(PAYOFF_CAPTION)
    // The issuer sentence has its home on buy, fill and resale buy, not here.
    await expect(review.getByText(ISSUER_DISCLOSURE)).toHaveCount(0)

    const write = button(page, `Write put, lock ${locks}`)
    await expect(write).toBeDisabled()
    await consent(page)
    await write.click()
    await expect(heading(page, 'Written. Your offer is open.')).toBeVisible()
    await expect(flow(page).getByText('Offered', { exact: true })).toBeVisible()
    const view = page.getByRole('link', { name: 'View offer' })
    const id = /\/portfolio\/(\d+)$/.exec((await view.getAttribute('href')) ?? '')?.[1]
    expect(id).toBeTruthy()
    await expect(offersList(page).locator('button[data-mine]', { hasText: `Buy offer ${id}:` })).toBeVisible()
  })

  test('validates with exact reasons and warns on implausible terms', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    const form = flow(page)
    const qty = form.getByRole('textbox', { name: /^Quantity/ })
    const premium = form.getByRole('textbox', { name: /^Premium you ask/ })

    // More than the wallet holds: the collateral check names both figures.
    await qty.fill('500')
    await premium.fill('1')
    await premium.blur()
    await expect(form.getByText(/You have 120\.00 FUND; this locks 500\.00 FUND\./)).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()

    // Max takes the whole balance of the asset a covered call locks.
    await button(page, /^Max/).click()
    await expect(qty).toHaveValue('120')

    // A premium at or above the total strike is allowed, with a warning.
    await qty.fill('1')
    await premium.fill('5000')
    await premium.blur()
    await expect(form.getByText('Check terms', { exact: true })).toBeVisible()
    await expect(form.getByText(/The premium is at least the total strike\./)).toBeVisible()
    await expect(button(page, 'Review')).toBeEnabled()

    // Custom terms: a strike off the ladder and a date beyond the two-year tenor.
    await form.locator('summary', { hasText: 'Custom terms' }).click()
    await form.getByRole('textbox', { name: /^Strike, USDx per FUND/ }).fill('10.33')
    await expect(form.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio', { checked: true })).toHaveCount(0)
    const far = `${new Date().getUTCFullYear() + 3}-01-15`
    await form.getByRole('textbox', { name: 'Expiry date, UTC' }).fill(far)
    await expect(form.getByText('Expiry must be within 2 years.')).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()
    await form.getByRole('textbox', { name: 'Expiry date, UTC' }).fill('not a date')
    await expect(form.getByText('Use the form 2026-12-18.')).toBeVisible()
  })
})

test.describe('write: the other regime', () => {
  test.use({ viewport: DESKTOP })

  test('the Margin card sends the writer to the Margin section instead of mixing the two', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    const group = flow(page).getByRole('radiogroup', { name: 'Collateral' })
    await expect(group.getByRole('radio', { name: /^Full collateral/ })).toBeChecked()
    await expect(group).toContainText(COLLATERAL_CARDS[0].body)
    await expect(group).toContainText(COLLATERAL_CARDS[1].body)
    await group.getByRole('radio', { name: /^Margin/ }).click()
    await expect(flow(page).getByRole('link', { name: 'Continue in Margin' })).toHaveAttribute('href', /\/margin\/trade$/)
    await expect(flow(page).getByRole('textbox', { name: /^Quantity/ })).toHaveCount(0)
    await expect(button(page, 'Review')).toBeDisabled()
    await group.getByRole('radio', { name: /^Full collateral/ }).click()
    await expect(flow(page).getByRole('textbox', { name: /^Quantity/ })).toBeVisible()
  })
})

test.describe('requests', () => {
  test.use({ viewport: DESKTOP })

  test('post a request: the escrow sentence, then the premium in escrow', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Request a put').click()
    await expect(heading(page, 'Request a put on FUND')).toBeVisible()
    const form = flow(page)
    await form.getByRole('textbox', { name: /^Quantity/ }).fill('5')
    await form.getByRole('textbox', { name: /^Premium you offer/ }).fill('2')
    await expect(page.getByTestId('escrow-line')).toHaveText(bidEscrowDisclosure('2.00 USDx'))
    expect(await totalOf(page)).toBe('2.00 USDx')

    await button(page, 'Review').click()
    await expect(flow(page).getByText(bidEscrowDisclosure('2.00 USDx'))).toBeVisible()
    await expect(flow(page).locator('dl > div', { hasText: 'Your open requests' })).toContainText(/\d+ of 50/)
    await expect(page.getByRole('checkbox', { name: CONSENT.bid })).toBeVisible()
    const before = await page.getByTestId('harness-bids').getByRole('button').count()
    await consent(page)
    await button(page, 'Post request, escrow 2.00 USDx').click()
    await expect(heading(page, 'Posted. Your premium is in escrow.')).toBeVisible()
    await expect(flow(page).getByText(/^Request No\. \d{6}/).first()).toBeVisible()
    await expect(page.getByTestId('harness-bids').getByRole('button')).toHaveCount(before + 1)

    const view = page.getByRole('link', { name: 'View my requests' })
    await expect(view).toHaveAttribute('href', /\/requests\?mine=1$/)
  })

  test('fill a request from the second wallet', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'B')
    const row = page.getByTestId('harness-bids').locator('button:not([data-mine])', { hasText: 'FUND' }).first()
    const text = (await row.textContent()) ?? ''
    const kind = /: (put|call) on/.exec(text)![1]
    const premium = /premium ([\d.,]+ USDx)/.exec(text)![1]
    await row.click()
    await expect(heading(page, `Fill a request for a ${kind} on FUND`)).toBeVisible()
    expect(await totalOf(page)).toBe(premium)
    await expect(ticket(page).locator('dl > div', { hasText: 'You lock' })).toBeVisible()

    await button(page, 'Review').click()
    const review = flow(page)
    await expect(review.locator('dl > div', { hasText: 'You receive' })).toContainText(premium)
    await expect(review.locator('dl > div', { hasText: /^Request/ })).toContainText('Open')
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    const fill = button(page, /^Lock [\d.,]+ [A-Za-z]+ and fill$/)
    await expect(fill).toBeDisabled()
    await consent(page)
    await fill.click()
    await expect(heading(page, `Filled. You wrote this ${kind}; the buyer holds it.`)).toBeVisible()
    await expect(flow(page).getByRole('heading', { name: `Short ${kind}, FUND` })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View position' })).toHaveAttribute('href', /\/portfolio\/\d+$/)
  })

  test('refuses the buyer its own request', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'B')
    await page.getByTestId('harness-bids').locator('button[data-mine]').first().click()
    await expect(flow(page).getByText('This is your own request. You cannot fill it.')).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()
  })
})

test.describe('resale', () => {
  test.use({ viewport: DESKTOP })

  test('buy a resale listing: the seller is paid, at the price reviewed', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const row = page.getByTestId('harness-asks').getByRole('button').first()
    const text = (await row.textContent()) ?? ''
    const kind = /: (put|call) on/.exec(text)![1]
    const price = / for ([\d.,]+ USDx)$/.exec(text)![1]
    await row.click()
    await expect(heading(page, new RegExp(`^Buy a ${kind} on [A-Z]+ from its holder$`))).toBeVisible()
    expect(await totalOf(page)).toBe(price)
    await expect(ticket(page).getByText(RESALE_NOTE)).toBeVisible()

    await button(page, 'Review').click()
    const review = flow(page)
    await expect(review.getByText(RESALE_PRICE_DISCLOSURE)).toBeVisible()
    await expect(review.getByText(PREMIUM_DISCLOSURE)).toHaveCount(0)
    await expect(review.locator('dl > div', { hasText: /^Listing/ })).toContainText('For sale')
    await expect(review.getByText(ISSUER_DISCLOSURE)).toBeVisible()
    await consent(page)
    await button(page, `Pay ${price}`).click()
    await expect(heading(page, `Bought from its holder. The ${kind} is yours.`)).toBeVisible()
    await expect(page.getByTestId('harness-asks').getByRole('button')).toHaveCount(0)
  })

  test('list a position for sale, then change its price', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const row = page.getByTestId('harness-held').getByRole('button').first()
    const id = /Sell option (\d+):/.exec((await row.textContent()) ?? '')![1]
    await row.click()
    await expect(heading(page, /^Sell your (put|call) on [A-Z]+$/)).toBeVisible()
    await expect(button(page, 'Review')).toBeDisabled()
    const price = flow(page).getByRole('textbox', { name: /^Your price/ })
    await price.fill('0')
    await price.blur()
    await expect(flow(page).getByText('The price must be above zero.')).toBeVisible()
    await price.fill('2.1')
    await expect(flow(page).getByText(/USDx per [A-Z]+\.$/)).toBeVisible()

    await button(page, 'Review').click()
    await expect(flow(page).locator('dl > div', { hasText: 'You receive' })).toContainText('2.10 USDx')
    await expect(flow(page).locator('dl > div', { hasText: /^Option/ })).toContainText('Active')
    await consent(page)
    await button(page, 'List for 2.10 USDx').click()
    await expect(heading(page, 'Listed. Your option is for sale.')).toBeVisible()
    await expect(page.getByTestId('harness-asks').getByRole('button', { name: new RegExp(`^Buy listing ${id}:.* for 2\\.10 USDx$`) })).toBeVisible()
    await button(page, 'Done').click()

    // Opening it again is a change of price, starting from the current one.
    await page.getByTestId('harness-held').getByRole('button', { name: new RegExp(`^Sell option ${id}:`) }).click()
    await expect(heading(page, /^Change the price of your (put|call) on [A-Z]+$/)).toBeVisible()
    await expect(flow(page).getByRole('textbox', { name: /^Your price/ })).toHaveValue('2.1')
    await expect(flow(page).locator('dl > div', { hasText: 'Listed now' })).toContainText('2.10 USDx')
  })
})

test.describe('guest', () => {
  test.use({ viewport: DESKTOP })

  test('sees the terms and a Connect wallet action, never a dead button', async ({ page }) => {
    await openHarness(page)
    await expect(page.getByTestId('harness-wallet')).toHaveText('Guest')
    await openOffer(page)
    await expect(ticket(page).getByText('Put, American style')).toBeVisible()
    await totalOf(page)
    await expect(ticket(page).getByText(GUEST_NOTE)).toBeVisible()
    await expect(button(page, 'Review')).toHaveCount(0)
    const connect = ticket(page).getByRole('button', { name: 'Connect wallet' })
    await expect(connect).toBeEnabled()
    await connect.click()
    await expect(button(page, 'Review')).toBeEnabled()
    await expect(ticket(page).getByText(GUEST_NOTE)).toHaveCount(0)
  })

  test('sees the form of a request with its terms kept after connecting', async ({ page }) => {
    await openHarness(page, 'side=bid&kind=call&qty=3&premium=1.5')
    await expect(heading(page, 'Request a call on FUND')).toBeVisible()
    await expect(page.getByTestId('escrow-line')).toHaveText(bidEscrowDisclosure('1.50 USDx'))
    await ticket(page).getByRole('button', { name: 'Connect wallet' }).click()
    await expect(flow(page).getByRole('textbox', { name: /^Quantity/ })).toHaveValue('3')
    await expect(button(page, 'Review')).toBeEnabled()
  })
})

test.describe('keyboard', () => {
  test.use({ viewport: DESKTOP })

  /** Presses Tab until the focused element matches, and fails with what had focus if it never does. */
  async function tabTo(page: Page, target: Locator, max = 40): Promise<void> {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab')
      if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return
    }
    throw new Error(`Tab never reached the target. Focus is on: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160))}`)
  }

  test('buys an offer with the keyboard alone, with focus on the heading of every step', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    const row = offersList(page).locator('button[data-kind="put"][data-maker]').first()
    await row.focus()
    await page.keyboard.press('Enter')

    // Opening the ticket moves focus to its heading and says so.
    await expect(heading(page, 'Buy a put on FUND')).toBeFocused()
    const pays = await totalOf(page)

    await tabTo(page, button(page, 'Review'))
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Buy a put on FUND')).toBeFocused()
    await expect(page.getByRole('listitem').filter({ hasText: 'Review' })).toHaveAttribute('aria-current', 'step')

    // The assumed price moves with the arrow keys and reads its outcome.
    const slider = page.getByRole('slider', { name: 'Assumed price at expiry' })
    await tabTo(page, slider)
    const before = await slider.getAttribute('aria-valuenow')
    await page.keyboard.press('ArrowLeft')
    expect(await slider.getAttribute('aria-valuenow')).not.toBe(before)
    await expect(slider).toHaveAttribute('aria-valuetext', /^At [\d.]+ you would /)

    await tabTo(page, page.getByRole('checkbox'))
    await page.keyboard.press('Space')
    await expect(page.getByRole('checkbox')).toBeChecked()
    await tabTo(page, button(page, `Pay ${pays}`))
    await page.keyboard.press('Enter')
    await expect(heading(page, 'Bought. The put is yours.')).toBeFocused()

    await tabTo(page, page.getByRole('link', { name: 'View position' }))
    await tabTo(page, button(page, 'Done'), 3)
    await page.keyboard.press('Enter')
    await expect(ticket(page)).toHaveCount(0)
  })

  test('Escape closes the ticket in the rail, and the strike chips are one tab stop with arrow keys', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a put').click()
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
    const dialog = page.getByRole('dialog', { name: 'Buy a put on FUND' })
    await expect(dialog).toBeVisible()
    await expect(ticket(page)).toHaveAttribute('data-container', 'drawer')
    await expect(dialog.getByRole('button', { name: 'Review' })).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.width).toBe(420)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page).not.toHaveURL(/offer=/)
  })
})

// Tagged @phone: these run in the suite's phone project (390 x 844, touch, mobile viewport).
test.describe('phone, 390 px @phone', () => {

  test('the ticket is a full page with a 64 px action bar that never covers the consent box', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    const dialog = page.getByRole('dialog', { name: 'Buy a put on FUND' })
    await expect(ticket(page)).toHaveAttribute('data-container', 'page')
    const pays = await totalOf(page)

    // A full page: the whole viewport, nothing sideways.
    const box = await dialog.boundingBox()
    expect(Math.round(box!.width)).toBe(PHONE.width)
    expect(Math.round(box!.height)).toBe(PHONE.height)
    await expectNoHorizontalOverflow(page)

    // The action bar: 64 px, one full-width action of at least 48 px.
    const bar = dialog.locator('footer')
    expect(Math.round((await bar.boundingBox())!.height)).toBe(64)
    const review = dialog.getByRole('button', { name: 'Review' })
    const reviewBox = (await review.boundingBox())!
    expect(reviewBox.height).toBeGreaterThanOrEqual(48)
    expect(reviewBox.width).toBeGreaterThanOrEqual(PHONE.width - 32 - 1)
    await review.tap()

    // Focus the consent box with the keyboard: it scrolls into view above the bar, never under it.
    const checkbox = dialog.getByRole('checkbox')
    for (let i = 0; i < 40 && !(await checkbox.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(checkbox).toBeFocused()
    const cb = (await checkbox.boundingBox())!
    const barTop = (await bar.boundingBox())!.y
    expect(cb.y + cb.height).toBeLessThanOrEqual(barTop)
    const hit = await checkbox.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return top === el || el.contains(top) || !!top?.closest('label')?.contains(el)
    })
    expect(hit, 'the consent box is the topmost element at its own position').toBe(true)

    // Every control of the review is a 44 px target or sits in one.
    const label = (await checkbox.locator('xpath=ancestor::label').boundingBox())!
    expect(label.height).toBeGreaterThanOrEqual(44)

    const pay = dialog.getByRole('button', { name: `Pay ${pays}` })
    await expect(pay).toBeDisabled()
    await page.keyboard.press('Space')
    await pay.tap()
    await expect(page.getByRole('dialog', { name: 'Bought. The put is yours.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'View position' })).toBeVisible()
    expect(Math.round((await page.getByRole('dialog').locator('footer').boundingBox())!.height)).toBe(64)
    await expectNoHorizontalOverflow(page)
  })

  test('the page has no axe violation in either theme, on the review and on the form', async ({ page }) => {
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await button(page, 'Review').click()
    await expect(page.getByRole('checkbox')).toBeVisible()
    await expect(ticket(page)).toHaveAttribute('data-container', 'page')
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
    await button(page, 'Close ticket').click()
    await button(page, 'Request a put').click()
    await expect(page.getByRole('dialog', { name: 'Request a put on FUND' })).toBeVisible()
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
  })

  test('the write form fits the phone: inputs at 16 px, chips at 44 px', async ({ page }) => {
    await openHarness(page, 'side=write&kind=put')
    const dialog = page.getByRole('dialog', { name: 'Write a put on FUND' })
    await expect(dialog).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const qty = dialog.getByRole('textbox', { name: /^Quantity/ })
    expect(await qty.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
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
  test('the rail ticket has no axe violation in either theme, on terms, review and receipt', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    const pays = await totalOf(page)
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
    await button(page, 'Review').click()
    await expect(page.getByRole('checkbox')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
    await consent(page)
    await button(page, `Pay ${pays}`).click()
    await expect(heading(page, 'Bought. The put is yours.')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
  })

  test('the forms and the sign step have no axe violation in either theme', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await openHarness(page)
    await connectAs(page, 'A')
    await button(page, 'Write a call').click()
    await flow(page).getByRole('textbox', { name: /^Quantity/ }).fill('500')
    await flow(page).getByRole('textbox', { name: /^Premium you ask/ }).fill('1')
    await flow(page).locator('summary', { hasText: 'Custom terms' }).click()
    await expect(flow(page).getByText(/this locks 500\.00 FUND/)).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })

    await button(page, 'Close ticket').click()
    await button(page, 'Next ends unknown').click()
    await openOffer(page)
    const pays = await totalOf(page)
    await button(page, 'Review').click()
    await consent(page)
    await button(page, `Pay ${pays}`).click()
    await expect(heading(page, 'Not confirmed yet')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[data-testid="ticket"]' })
  })

  test('the drawer has no axe violation in either theme', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await openHarness(page)
    await connectAs(page, 'A')
    await openOffer(page)
    await button(page, 'Review').click()
    await expect(page.getByRole('checkbox')).toBeVisible()
    await expectNoAxeViolations(page, { include: '[role="dialog"]' })
  })
})

test.describe('through the asset route', () => {
  test.use({ viewport: DESKTOP })

  test('a link opens the write ticket in the rail of the asset page, for a guest too', async ({ page }) => {
    await openApp(page, '/markets/fund?side=write&kind=put')
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'Write a put on FUND', level: 2 })).toBeVisible()
    await expect(rail.getByRole('button', { name: 'Connect wallet' })).toBeVisible()
    await rail.getByRole('radiogroup', { name: /^Strike/ }).getByRole('radio').first().check({ force: true })
    await expect(page).toHaveURL(/strike=[\d.]+/)
    await rail.getByRole('button', { name: 'Close ticket' }).click()
    await expect(page).not.toHaveURL(/side=write/)
    await expect(rail.getByTestId('ticket')).toHaveCount(0)
  })
})
