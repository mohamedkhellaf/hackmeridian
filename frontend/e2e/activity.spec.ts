/**
 * /activity: the transactions started from this browser as the connected wallet. What each one is, when, its
 * state in words (pending, confirmed, failed, outcome unknown, expired), its hash, a link to what it concerns,
 * and the line that says the list lives in this browser only.
 *
 * Two tests make a real transaction through the interface (an offer written in the ticket, a request cancelled
 * on the board) and then read the list. The states a mock transaction rarely ends in are staged: `stageEntries`
 * writes them into the page's own Activity store, the same store the transaction runner writes to.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BANNED_TAGLINES, MARGIN_BANNED_WORDS, findBannedWords } from '../src/core/disclosures'
import { ADDR_A, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, failNextTx, goTo, isPhone, openApp, pageHeading, walletButton } from './helpers'
import type { OpenOptions } from './helpers'

const LOCAL_ONLY = 'This list is kept in this browser only. Another browser or device shows none of it, and clearing site data erases it.'
const HASH = /[0-9a-f]{8}…[0-9a-f]{4}/

const rows = (page: Page): Locator => page.getByTestId('activity-row')
const rowOf = (page: Page, label: string | RegExp): Locator => rows(page).filter({ hasText: label })
const state = (row: Locator): Locator => row.getByTestId('tx-state')
const main = (page: Page): Locator => page.getByRole('main')

/** Opens a route of the app. */
async function open(page: Page, path: string, options: OpenOptions = {}): Promise<void> {
  await openApp(page, path, options)
}

/** Activity is in the wallet menu on the desktop and under "More" on a phone. Moves without a page load. */
async function goToActivity(page: Page): Promise<void> {
  if (isPhone(page)) {
    await goTo(page, 'Activity')
  } else {
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: /^Activity/ }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/activity')
  }
  await expect(pageHeading(page)).toHaveText('Activity')
}

/** Client-side navigation through the router of the test build: the mock chain and the Activity list survive. */
async function navigate(page: Page, href: string): Promise<void> {
  await page.evaluate((to) => (window as unknown as { __stellsec: { router: { navigate(target: { href: string }): Promise<void> } } }).__stellsec.router.navigate({ href: to }), href)
}

/**
 * Writes a put on 1.00 BOND at 95.00 through the ticket and returns the scope its controls live in. It ends on
 * the receipt, or on the outcome the mock was told to give. On a phone the ticket is a page of its own whose
 * action bar sits outside the ticket body, so the controls are looked up on the page.
 */
async function writeOffer(page: Page): Promise<Page | Locator> {
  await navigate(page, '/markets/bond?mode=chain&side=write&kind=put&strike=95&qty=1&premium=1.5')
  const ticket = page.getByTestId('ticket')
  await expect(ticket).toContainText('95.00 USDx')
  const scope = isPhone(page) ? page : ticket
  await scope.getByRole('button', { name: 'Review' }).click()
  await scope.getByRole('checkbox').check()
  await scope.getByRole('button', { name: /^Write put/ }).click()
  return scope
}

interface Staged {
  action: string
  label: string
  detail?: string
  done?: string
  subject?: string | null
  phase: 'pending' | 'confirmed' | 'failed' | 'unknown' | 'expired'
  effect: 'nothing-sent' | 'outcome-unknown' | 'fee-charged'
  error?: string
}

const STAGED: readonly Staged[] = [
  { action: 'reclaim', label: 'Reclaim 48.00 USDx', done: 'Reclaimed', subject: 'option:4', phase: 'confirmed', effect: 'fee-charged' },
  { action: 'claim-delivery', label: 'Claim 98.00 USDx', done: 'Delivery claimed', subject: 'option:3', phase: 'expired', effect: 'nothing-sent' },
  {
    action: 'buy',
    label: 'Buy put on 5.00 BOND',
    detail: 'Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC',
    done: 'Bought',
    subject: 'option:31',
    phase: 'failed',
    effect: 'fee-charged',
    error: 'This action is not valid for the option in its current state.',
  },
  { action: 'write-offer', label: 'Write call on 2.00 FUND', done: 'Offer written', subject: null, phase: 'unknown', effect: 'outcome-unknown' },
  { action: 'exercise', label: 'Exercise put on 5.00 FUND', done: 'Exercised', subject: 'option:0', phase: 'pending', effect: 'outcome-unknown' },
]

/** Puts entries into the Activity store the app itself uses (the E2E hook), oldest first, as mock transactions of `address`. */
async function stageEntries(page: Page, address: string, entries: readonly Staged[]): Promise<void> {
  await page.evaluate(
    ({ address, entries }) => {
      const hook = (window as unknown as { __stellsec?: { activityStore: { begin(entry: Record<string, unknown>): { id: string }; apply(address: string, id: string, state: Record<string, unknown>): void } } }).__stellsec
      if (!hook) throw new Error('The E2E hook is missing: the app was not built with VITE_E2E=1.')
      const { activityStore } = hook
      entries.forEach((e, i) => {
        const created = activityStore.begin({ address, product: 'covered', mock: true, action: e.action, label: e.label, detail: e.detail ?? null, done: e.done ?? null, subject: e.subject ?? null })
        // A hash the mock client never produced: looking it up again leaves the outcome unknown.
        const hash = Array.from({ length: 64 }, (_, n) => '0123456789abcdef'[(i * 7 + n * 13 + ((n * n) % 11)) % 16]).join('')
        activityStore.apply(address, created.id, { phase: e.phase, effect: e.effect, hash, maxTime: Math.floor(Date.now() / 1000) + 3600, ledger: null, error: e.error ?? null })
      })
    },
    { address, entries: entries.map((e) => ({ ...e })) },
  )
}

/** Tells the mock client how its next transaction ends. */
const failNextWith = failNextTx

test.describe('Activity', () => {
  test('a guest is told where the list lives and can connect from the page', async ({ page }) => {
    await open(page, '/activity')
    await expect(pageHeading(page)).toHaveText('Activity')
    await expect(page.getByTestId('local-only')).toContainText(LOCAL_ONLY)
    await expect(main(page).getByRole('heading', { name: 'Connect a wallet to see its transactions.' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)

    await main(page).getByRole('button', { name: 'Connect wallet' }).click()
    await expect(walletButton(page)).toBeVisible()
    await expect(main(page).getByRole('heading', { name: 'No transactions from this browser yet.' })).toBeVisible()
    await expect(main(page).getByRole('link', { name: 'Go to markets' })).toHaveAttribute('href', /^\/markets/)
    // Still said, also with a wallet connected and nothing to list.
    await expect(page.getByTestId('local-only')).toContainText(LOCAL_ONLY)
  })

  test('lists a transaction after one is made: what, state, when, hash and a link', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await expect(rows(page)).toHaveCount(0)

    const ticket = await writeOffer(page)
    await expect(ticket.getByText(/Offer No\. \d{6}/).first()).toBeVisible()
    await ticket.getByRole('button', { name: 'Done' }).click()
    await goToActivity(page)

    await expect(rows(page)).toHaveCount(1)
    const row = rowOf(page, 'Write put on 1.00 BOND')
    await expect(row.getByRole('rowheader')).toContainText('Write put on 1.00 BOND')
    await expect(row.getByRole('rowheader')).toContainText('Strike 95.00 USDx per BOND')
    await expect(state(row)).toHaveText('Confirmed')
    await expect(row).toContainText('Offer written.')
    await expect(row.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    await expect(row.locator('time')).toContainText('UTC')
    await expect(row).toContainText(HASH)
    await expect(row.getByRole('button', { name: 'Copy transaction hash' })).toBeVisible()
    // A mock hash has no explorer page: it is text, not a link.
    await expect(row.getByRole('link', { name: /^View transaction/ })).toHaveCount(0)
    await expect(page.getByTestId('activity-count')).toHaveText('1 transaction.')
    await expect(page.getByRole('table', { name: 'Transactions from this browser' }).getByRole('columnheader')).toHaveText(['Transaction', 'State', 'Started', 'Hash', 'Position or request'])

    // The entry records the option the contract created, so the link goes to that option, not to a list.
    const created = row.getByRole('link', { name: /^Position \d+$/ })
    const id = ((await created.textContent()) ?? '').replace('Position ', '')
    await created.click()
    await expect(page).toHaveURL((url) => url.pathname === `/portfolio/${id}`)
    await expect(pageHeading(page)).toContainText('BOND')
  })

  test('a cancelled request is listed with a link back to the requests', async ({ page }) => {
    await open(page, '/requests', { connect: true })
    const mine = page.getByTestId('request-row').filter({ hasText: 'No. 000000' })
    await mine.getByRole('button', { name: /^Cancel request No\. 000000/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel request No. 000000' })
    await dialog.getByRole('button', { name: 'Cancel request', exact: true }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await goToActivity(page)

    const row = rowOf(page, /Cancel request for put on 2\.00 BOND/)
    await expect(state(row)).toHaveText('Confirmed')
    await expect(row).toContainText('Request cancelled.')
    await row.getByRole('link', { name: 'Request 0' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/requests' && url.searchParams.get('mine') === '1')
  })

  test('an unknown outcome is not a failure: it is checked again, and the offer turns out written', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await failNextWith(page, 'unknown')
    await writeOffer(page)
    await goToActivity(page)

    const row = rowOf(page, 'Write put on 1.00 BOND')
    // The page looks the hash up by itself every ten seconds; whichever comes first, the answer is the ledger's.
    await expect(state(row)).toHaveText(/^(Outcome unknown|Confirmed)$/)
    const check = row.getByRole('button', { name: 'Check again' })
    // The click may lose the race against the page's own lookup: then the button is gone and the row is settled.
    if (await check.isVisible()) await check.click({ timeout: 3_000 }).catch(() => undefined)
    await expect(state(row)).toHaveText('Confirmed')
    await expect(row).toContainText('Offer written.')
    await expect(row.getByRole('button', { name: 'Check again' })).toHaveCount(0)
    await expect(main(page)).not.toContainText('unknown outcome')
  })

  test('every state reads in words, with what it means and what happened to the fee', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED)
    await expect(rows(page)).toHaveCount(STAGED.length)
    // Newest first.
    await expect(rows(page).first()).toContainText('Exercise put on 5.00 FUND')
    await expect(page.getByTestId('activity-count')).toHaveText('5 transactions. 1 in progress. 1 with an unknown outcome.')

    const pending = rowOf(page, 'Exercise put on 5.00 FUND')
    await expect(state(pending)).toHaveText('Pending')
    await expect(pending).toContainText('Waiting for a ledger to include it.')
    await expect(pending.getByRole('link', { name: 'Position 0' })).toHaveAttribute('href', /^\/portfolio\/0(\?|$)/)

    const unknown = rowOf(page, 'Write call on 2.00 FUND')
    await expect(state(unknown)).toHaveText('Outcome unknown')
    await expect(unknown).toContainText('Do not send it again: check again first.')
    await expect(main(page)).toContainText('One transaction has an unknown outcome')
    // A hash the chain does not know yet stays unknown: the row keeps its state and its one action.
    await unknown.getByRole('button', { name: 'Check again' }).click()
    await expect(state(unknown)).toHaveText('Outcome unknown')
    await expect(unknown.getByRole('button', { name: 'Check again' })).toBeEnabled()
    // Never an offer to send it a second time.
    await expect(unknown.getByRole('button', { name: /send|try again|retry/i })).toHaveCount(0)

    const failed = rowOf(page, 'Buy put on 5.00 BOND')
    await expect(state(failed)).toHaveText('Failed')
    await expect(failed).toContainText('This action is not valid for the option in its current state.')
    await expect(failed).toContainText('The network fee was charged.')
    await expect(failed).toContainText('Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC')
    await expect(failed.getByRole('link', { name: 'Position 31' })).toBeVisible()

    const expired = rowOf(page, 'Claim 98.00 USDx')
    await expect(state(expired)).toHaveText('Expired')
    await expect(expired).toContainText('Nothing was charged. You can send it again.')

    const confirmed = rowOf(page, 'Reclaim 48.00 USDx')
    await expect(state(confirmed)).toHaveText('Confirmed')
    await expect(confirmed).toContainText('Reclaimed.')
    // Only the unknown one offers an action.
    await expect(page.getByRole('button', { name: 'Check again' })).toHaveCount(1)
  })

  test('Clear finished removes what is settled and keeps what is still open', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED)
    await expect(rows(page)).toHaveCount(5)
    await main(page).getByRole('button', { name: 'Clear finished' }).click()
    await expectAnnounced(page, '3 finished transactions removed from the list.')
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page)).toContainText([/Exercise put on 5\.00 FUND/, /Write call on 2\.00 FUND/])
    await expect(main(page).getByRole('button', { name: 'Clear finished' })).toHaveCount(0)
    await expect(page.getByTestId('activity-count')).toHaveText('2 transactions. 1 in progress. 1 with an unknown outcome.')
  })

  test('each wallet has its own list', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED.slice(0, 1))
    await expect(rows(page)).toHaveCount(1)
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: 'Disconnect' }).click()
    await expect(main(page).getByRole('heading', { name: 'Connect a wallet to see its transactions.' })).toBeVisible()
    await expect(rows(page)).toHaveCount(0)
  })

  test('headings come in order, and the page uses no promise word and no disclaimer tagline', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED)
    await expect(rows(page)).toHaveCount(5)
    const levels = await main(page).locator('h1, h2, h3, h4, h5, h6').evaluateAll((list) => list.map((h) => Number(h.tagName[1])))
    expect(levels).toEqual([1])
    const text = await main(page).innerText()
    expect(findBannedWords(text, MARGIN_BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
    // No em dash, no arrow, no exclamation mark.
    expect(text).not.toMatch(/[\u{2014}\u{2192}!]/u)
  })

  test('axe finds nothing in either theme: guest, empty, and with every state listed', async ({ page }) => {
    await open(page, '/activity')
    await expectNoAxeViolations(page)
    await main(page).getByRole('button', { name: 'Connect wallet' }).click()
    await expect(main(page).getByRole('heading', { name: 'No transactions from this browser yet.' })).toBeVisible()
    await expectNoAxeViolations(page)
    await stageEntries(page, ADDR_A, STAGED)
    await expect(rows(page)).toHaveCount(5)
    await expectNoAxeViolations(page)
  })
})

test.describe('Activity on a phone', () => {
  test('the list is blocks with every field, 44 px targets and no sideways scroll @phone', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED)
    const list = page.getByRole('list', { name: 'Transactions from this browser' })
    await expect(list.getByRole('listitem')).toHaveCount(5)
    await expect(page.getByRole('table')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    const failed = rowOf(page, 'Buy put on 5.00 BOND')
    await expect(state(failed)).toHaveText('Failed')
    await expect(failed).toContainText('The network fee was charged.')
    await expect(failed).toContainText('Started')
    await expect(failed).toContainText(HASH)
    expect((await failed.getByRole('link', { name: 'Position 31' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)

    const check = rowOf(page, 'Write call on 2.00 FUND').getByRole('button', { name: 'Check again' })
    expect((await check.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await main(page).getByRole('button', { name: 'Clear finished' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByTestId('local-only')).toContainText(LOCAL_ONLY)
  })

  test('a transaction made on a phone shows up in the list @phone', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    const ticket = await writeOffer(page)
    await expect(ticket.getByText(/Offer No\. \d{6}/).first()).toBeVisible()
    await ticket.getByRole('button', { name: 'Done' }).click()
    await goToActivity(page)
    await expect(state(rowOf(page, 'Write put on 1.00 BOND'))).toHaveText('Confirmed')
    await expectNoHorizontalOverflow(page)
  })

  test('axe finds nothing in either theme @phone', async ({ page }) => {
    await open(page, '/activity', { connect: true })
    await stageEntries(page, ADDR_A, STAGED)
    await expect(rows(page)).toHaveCount(5)
    await expectNoAxeViolations(page)
  })
})
