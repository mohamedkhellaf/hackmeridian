/**
 * Margin: the five screens on fixtures (the dev server runs with VITE_ENABLE_PRO=1 and no Margin contract id).
 * The fixture client lives in the page: a full page load restarts the default scenario, so a flow that builds on
 * its own earlier calls moves with the section's links, never with a second `page.goto`. Every test that needs a
 * moment of a scenario picks it (`startAt`), so none depends on where the default replay starts.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { MARGIN_BANNED_WORDS, MARGIN_BANNER_SIMULATED, MARGIN_PAYOUT_RISK, MARGIN_PUBLISHER_LINE, MARGIN_WARNING_TITLE, findBannedWords } from '../src/core/disclosures'
import { PRO_ERRORS } from '../src/core/pro/errors'
import { PHONE, countVisible, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading } from './helpers'

const SCREENS = [
  { path: '/margin', nav: 'Account', title: 'Account' },
  { path: '/margin/trade', nav: 'Trade', title: 'Trade' },
  { path: '/margin/positions', nav: 'Positions', title: 'Positions' },
  { path: '/margin/liquidations', nav: 'Liquidations', title: 'Liquidations' },
  { path: '/margin/vault', nav: 'Vault', title: 'Vault' },
] as const

const BUY_PAYOUT_LINE = 'Your payout can be reduced: writer margin first, then the vault, then a deficit.'

const subNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Margin sections' })
const prices = (page: Page): Locator => page.getByRole('region', { name: 'Publisher prices' })
const result = (page: Page): Locator => page.getByRole('region', { name: 'Result' })
const replay = (page: Page): Locator => page.locator('#replay')
const positions = (page: Page): Locator => page.getByRole('table', { name: 'Margin positions' })

/** Moves between Margin screens the way a user does. The replay keeps its scenario and step. */
async function goToScreen(page: Page, nav: (typeof SCREENS)[number]['nav']): Promise<void> {
  const screen = SCREENS.find((s) => s.nav === nav)!
  await subNav(page).getByRole('link', { name: nav, exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === screen.path)
  await expect(pageHeading(page)).toHaveText(screen.title)
}

/** The replay starts folded on phones. */
async function openReplay(page: Page): Promise<void> {
  const show = replay(page).getByRole('button', { name: 'Show controls' })
  if (await show.isVisible()) await show.click()
}

async function pickScenario(page: Page, title: RegExp): Promise<void> {
  await openReplay(page)
  await replay(page).getByRole('combobox', { name: 'Scenario' }).click()
  await page.getByRole('option', { name: title }).click()
}

async function actAs(page: Page, name: string): Promise<void> {
  await openReplay(page)
  await replay(page).getByRole('combobox', { name: 'Acting as' }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

/** Puts the scenario at `step` with the keyboard: Home, then one arrow press per step. */
async function stepTo(page: Page, step: number): Promise<void> {
  await openReplay(page)
  const slider = replay(page).getByRole('slider', { name: 'Step' })
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < step; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuetext', new RegExp(`^${step} of \\d+$`))
}

/** A scenario at a step, acting as Maker A (every scenario's first writer). */
async function startAt(page: Page, scenario: RegExp, step: number): Promise<void> {
  await pickScenario(page, scenario)
  await stepTo(page, step)
  await actAs(page, 'Maker A')
}

const EARLY = /^Early exercise/
const UNCOVERED = /^Uncovered sale/

test.describe('Margin on fixtures', () => {
  test('the entry warning is not asked on a fixture build, where nothing is signed', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await expect(pageHeading(page)).toHaveText('Positions')
    await expect(page.getByRole('dialog', { name: MARGIN_WARNING_TITLE })).toHaveCount(0)
  })

  test('every screen carries the sentences once, the sub-navigation and the publisher prices', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(pageHeading(page)).toHaveText(screen.title)
      await expect(prices(page)).toBeVisible()
      for (const sentence of [MARGIN_BANNER_SIMULATED, MARGIN_PAYOUT_RISK, MARGIN_PUBLISHER_LINE]) expect(await countVisible(page, sentence), `${sentence} on ${screen.path}`).toBe(1)
      await expect(subNav(page).getByRole('link')).toHaveText(SCREENS.map((s) => s.nav))
      await expect(subNav(page).locator('[aria-current="page"]')).toHaveText(screen.nav)
      // No amber banner and no label word: the sentences are a plain paragraph.
      await expect(page.getByText('Notice', { exact: true })).toHaveCount(0)
    }
  })

  test('the publisher prices give the price, the snapshot, its age in words and the early-exercise window', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, EARLY, 22)
    const o = prices(page)
    await expect(o.getByText('EQTY, publisher price')).toBeVisible()
    await expect(o).toContainText('140.00')
    await expect(o).toContainText('No. 4')
    await expect(o).toContainText('0 s, fresh')
    await expect(o).toContainText('Open, snapshot within 2 min')

    // At step 26 the clock is at expiry: the snapshot is stale, exercise is paused, a settlement price is pending.
    await stepTo(page, 26)
    await expect(o).toContainText('stale (limit 1 h)')
    await expect(o).toContainText('Paused, snapshot older than 2 min')
    await expect(o).toContainText('Pending for series 0')
  })

  test('the account leads with the distance to liquidation, and a deposit the scenario cannot run is not offered', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, EARLY, 22)
    const main = page.getByRole('main')
    await expect(main.getByText('20,437.84 USDx below the liquidation level', { exact: true })).toBeVisible()
    await expect(main.getByText('Liquidatable.')).toBeVisible()
    await expect(main.getByText('A deposit of at least 20,437.8473 USDx brings the account value back to the liquidation level.')).toBeVisible()
    await expect(main.getByRole('img', { name: /Account value 23,507\.59.*Liquidation \(MM\) 43,945\.44.*Liquidatable/ })).toBeVisible()
    for (const label of ['Account value (NLV)', 'Liquidation level (MM)', 'Opening requirement (IM)']) await expect(main.getByText(label, { exact: true }).first()).toBeVisible()
    await expect(main.getByText("In Maker A's wallet")).toBeVisible()

    // The scenario records no later deposit by Maker A: the button says so instead of answering after a press.
    await main.getByRole('textbox', { name: /^Amount/ }).fill('1')
    await expect(main.getByRole('button', { name: 'Deposit', exact: true })).toBeDisabled()
    // Typed amounts are not used by the replay, so there is no "Fill in" on fixtures.
    await expect(main.getByRole('button', { name: /^Fill in/ })).toHaveCount(0)
  })

  test('a deposit the scenario records runs, and the result takes focus', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, UNCOVERED, 3)
    const main = page.getByRole('main')
    await expect(main.getByText('Maker A has no margin posted yet.')).toBeVisible()
    await main.getByRole('textbox', { name: /^Amount/ }).fill('26499.938194')
    await main.getByRole('button', { name: 'Deposit', exact: true }).click()
    await expect(result(page)).toContainText('Deposited')
    await expect(result(page)).toBeFocused()
    await expect(main.getByText('Maker A has no margin posted yet.')).toHaveCount(0)
  })

  test('withdrawals are blocked while an expired position is unsettled, and the reason is on screen', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, UNCOVERED, 10)
    const main = page.getByRole('main')
    await expect(main.getByText('Withdrawals are blocked: an expired position is not settled yet.')).toBeVisible()
    await expect(main.getByText(/SeriesExpired, 205/)).toBeVisible()
    await expect(main.getByText(/Waiting for the publisher's settlement price for series 0/)).toBeVisible()
    await main.getByRole('textbox', { name: /^Amount/ }).fill('1')
    await expect(main.getByRole('button', { name: 'Withdraw', exact: true })).toBeDisabled()
  })

  test('early exercise is refused with LiquidateFirst (224); after a takeover to the vault, with the vault-owned reason', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    const exercise = page.getByRole('button', { name: 'Exercise early, position 1, as Bob' })

    // The row says what to expect; the dialog prints the amount and the reason before anything runs.
    await expect(positions(page).getByRole('row', { name: /Position 1/ })).toContainText('The writer must be taken over first.')
    await exercise.click()
    let dialog = page.getByRole('dialog', { name: 'Exercise early' })
    await expect(dialog).toContainText('140.00 USDx')
    await expect(dialog).toContainText('You receive')
    await expect(dialog).toContainText('30,000.00 USDx')
    await expect(dialog).toContainText('LiquidateFirst (224)')
    await dialog.getByRole('button', { name: 'Try anyway' }).click()
    await expect(result(page)).toContainText('Early exercise refused: LiquidateFirst (224)')
    await expect(result(page)).toContainText(PRO_ERRORS[224].message)
    await expect(result(page).getByRole('link', { name: 'Go to Liquidations' })).toBeVisible()
    await expect(result(page)).toBeFocused()

    await goToScreen(page, 'Liquidations')
    const accounts = page.getByRole('table', { name: 'Margin accounts and their distance to liquidation' })
    await expect(accounts.getByRole('row', { name: /Maker A/ })).toContainText('Liquidatable')
    // Your own account: the way out is a deposit; a private takeover of yourself is not offered.
    await expect(accounts.getByRole('link', { name: 'Deposit 20,437.8473 USDx' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Private takeover: Maker A' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Take over to the vault: Maker A' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Take over to the vault' })
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await confirm.getByRole('button', { name: 'Take over to the vault' }).click()
    await expect(result(page)).toContainText('Taken over by the vault')
    await expect(result(page)).toContainText('Takeover price')
    await expect(result(page)).toContainText('31,503.69')
    const log = page.getByRole('table', { name: 'Takeovers' })
    await expect(log.getByRole('row', { name: /Maker A/ })).toContainText('Vault')
    await expect(log.getByRole('row', { name: /Maker A/ })).toContainText('31,503.69')

    // The book now belongs to the vault: the position is no longer Maker A's, so it is listed under All.
    await goToScreen(page, 'Positions')
    await page.getByRole('radio', { name: /^All/ }).click()
    await expect(positions(page).getByRole('row', { name: /Position 1/ })).toContainText('Settles at expiry')
    await exercise.click()
    dialog = page.getByRole('dialog', { name: 'Exercise early' })
    await expect(dialog).toContainText('NoEarlyExercise (226)')
    await dialog.getByRole('button', { name: 'Try anyway' }).click()
    await expect(result(page)).toContainText('Early exercise refused: NoEarlyExercise (226)')
    await expect(result(page)).toContainText(PRO_ERRORS[226].message)
  })

  test('the exercise flow works from the keyboard, and focus is never lost', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    const opener = page.getByRole('button', { name: 'Exercise early, position 1, as Bob' })
    const dialog = page.getByRole('dialog', { name: 'Exercise early' })
    const action = dialog.getByRole('button', { name: 'Try anyway' })

    // Escape closes the dialog and hands focus back to the button that opened it.
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()

    // Enter opens it again; Tab reaches the action; Enter runs it; focus lands on the result.
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 12; i++) {
      if (await action.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(result(page)).toContainText('LiquidateFirst (224)')
    await expect(result(page)).toBeFocused()

    // The result's own controls follow: the link on to Liquidations, then Dismiss, which sends focus to the heading.
    const dismiss = result(page).getByRole('button', { name: 'Dismiss' })
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      if (await dismiss.evaluate((el) => el === document.activeElement)) break
    }
    await expect(dismiss).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(pageHeading(page)).toBeFocused()
  })

  test('the five early-exercise refusals are explained on the Positions screen, sentence first', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    await page.getByRole('button', { name: 'When early exercise is refused' }).click()
    const popup = page.getByRole('dialog', { name: 'When early exercise is refused' })
    for (const code of [226, 207, 223, 225, 224]) {
      await expect(popup).toContainText(`${PRO_ERRORS[code].name} (${code})`)
      await expect(popup.getByRole('listitem').filter({ hasText: `(${code})` })).toHaveText(new RegExp(`^${PRO_ERRORS[code].message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    }
  })

  test('the buy dialog states the fee, the breakeven and the most you can lose, draws who pays, and asks no tick box', async ({ page }) => {
    await openApp(page, '/margin/trade')
    await startAt(page, UNCOVERED, 5)

    // The writer sees its own offer with Cancel, not Buy.
    await expect(page.getByRole('button', { name: /^Cancel offer 0/ })).toBeVisible()
    await actAs(page, 'Alice')
    await page.getByRole('button', { name: /^Buy offer 0/ }).click()

    const dialog = page.getByRole('dialog', { name: 'Buy EQTY call' })
    await expect(dialog).toContainText('619.17')
    await expect(dialog).toContainText('10 % goes to the vault as a reserve fee, the rest to the writer.')
    await expect(dialog).toContainText('Breakeven')
    await expect(dialog).toContainText('110.6191')
    await expect(dialog).toContainText('Most you can lose')
    await expect(dialog).toContainText('Partial')
    await expect(dialog.getByRole('img', { name: 'Hypothetical. Owed 28,000.00 USDx: writer margin 26,499.93, vault 1,500.07, no deficit.' })).toBeVisible()
    for (const line of ['Writer margin.', 'Vault.', 'Deficit.', 'It cuts your payout.']) await expect(dialog).toContainText(line)
    await expect(dialog).toContainText('a deficit starts above a settlement price of 336.49 USDx, or lower if the vault also pays other positions')
    await expect(dialog).not.toContainText('covered in full')

    // The assumed price is a slider: at the top of its range the vault has run out and a deficit is drawn.
    const price = dialog.getByRole('slider', { name: 'If EQTY settles at' })
    await price.focus()
    await price.press('End')
    await expect(dialog.getByRole('img', { name: 'Hypothetical. Owed 277,000.00 USDx: writer margin 26,499.93, vault 200,000.00, deficit 50,500.07 not paid.' })).toBeVisible()
    await expect(dialog).toContainText(/Paid 226,499\.93 of/)

    // No consent box: the sentence of what is agreed to is printed with the action, and the action is ready.
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    await expect(dialog).toContainText(BUY_PAYOUT_LINE)
    const confirm = dialog.getByRole('button', { name: /^Buy for 619\.17 USDx$/ })
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(dialog).toHaveCount(0)

    // The receipt: what was paid, for which contract, until when, and the way to the position.
    await expect(result(page)).toContainText('Bought')
    await expect(result(page)).toContainText('Premium paid')
    await expect(result(page)).toContainText('EQTY 110.00 call, 5 Feb 2027')
    await expect(result(page)).toContainText('1,000 lots')
    await result(page).getByRole('link', { name: 'View your positions' }).click()
    await expect(pageHeading(page)).toHaveText('Positions')
    await expect(positions(page).getByRole('row', { name: /Position 0/ })).toContainText('Alice (you)')
  })

  test('writing a call states the reserve fee, previews the requirement and warns under the mark floor', async ({ page }) => {
    await openApp(page, '/margin/trade')
    await startAt(page, UNCOVERED, 4)
    const form = page.locator('#write')
    await expect(form.getByRole('heading', { name: 'Write an uncovered call' })).toBeVisible()
    await expect(form).toContainText('At the latest mark a buy needs at least 562.8819 USDx.')
    await expect(form).toContainText('You receive 90 % of the premium when the offer is bought; 10 % goes to the vault as a reserve fee.')
    // Before a full order the panel shows the account as it stands.
    await expect(form.getByRole('region', { name: 'Your margin now' })).toBeVisible()

    const premium = form.getByRole('textbox', { name: /^Premium, total/ })
    await premium.fill('100')
    await expect(form).toContainText('PremiumBelowMark (222)')
    await premium.fill('619.17009')
    await expect(form).not.toContainText('PremiumBelowMark (222)')
    const preview = form.getByRole('region', { name: 'Margin after the fill' })
    await expect(preview).toContainText('24,494.30')
    await expect(preview).toContainText('26,494.30')

    await form.getByRole('button', { name: 'Write call' }).click()
    await expect(result(page)).toContainText('Offer written')
    await expect(page.getByRole('table', { name: 'Open offers' }).getByRole('row', { name: /Offer 0/ })).toContainText('Maker A (you)')
  })

  test('after expiry: one block settles the books, then the series; each holder claims; the row keeps what was paid', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, /^Settlement with a deficit/, 10)
    const block = page.getByRole('region', { name: 'After expiry' })
    await expect(block).toContainText("Waiting for the publisher's settlement price.")
    await expect(block).toContainText('Anyone can make the first two calls.')
    await expect(positions(page).getByRole('row', { name: /Position 0/ })).toContainText('Waiting for settlement price')

    await stepTo(page, 12)
    // One call per book and one per series, never one button per row.
    await expect(positions(page).getByRole('button', { name: /^Settle/ })).toHaveCount(0)
    await block.getByRole('button', { name: /^Settle book 0/ }).click()
    await expect(result(page)).toContainText('Book settled')
    await expect(result(page).getByRole('img', { name: 'Owed 50,000.00 USDx: writer margin 25,057.19, passed to the vault 24,942.80.' })).toBeVisible()

    await block.getByRole('button', { name: /^Settle series 0/ }).click()
    await expect(result(page)).toContainText('Series settled')
    await expect(result(page)).toContainText('23,880.89')

    await page.getByRole('button', { name: 'Claim, position 0, as Alice' }).click()
    await expect(result(page)).toContainText('Claimed')
    await expect(result(page).getByRole('img', { name: /Owed 30,000\.00 USDx: paid 15,671\.46, deficit 14,328\.53 not paid/ })).toBeVisible()
    const row = positions(page).getByRole('row', { name: /Position 0/ })
    await expect(row).toContainText('Paid 15,671.46 of 30,000.00, deficit 14,328.53')
    await expect(row).toContainText('Claimed')

    await goToScreen(page, 'Vault')
    const series = page.getByRole('table', { name: 'Shortfall, vault payment and deficit per series' })
    await expect(series.getByRole('row', { name: /Series 0/ })).toContainText('23,880.89')
    await expect(series.getByRole('row', { name: /Series 0/ })).toContainText('Closed')
    await expect(page.getByRole('img', { name: 'EQTY 110.00 call, 5 Feb 2027. Owed 50,000.00 USDx: writer margin 25,057.19, vault 1,061.91, deficit 23,880.89 not paid.' })).toBeVisible()
  })

  test('the vault says plainly that LP capital stays in, totals the shares, and asks before a deposit', async ({ page }) => {
    await openApp(page, '/margin/vault')
    await startAt(page, /^Price gap/, 16)
    await actAs(page, 'LP 2')
    const main = page.getByRole('main')
    await expect(main.getByText('LP capital cannot be withdrawn in this version. A deposit stays in the vault.')).toBeVisible()
    await expect(main.getByText('Vault value')).toBeVisible()
    await expect(main.getByText('Reserved for takeovers')).toBeVisible()
    await expect(main.getByText('Includes the 10 % reserve fee taken from every premium.')).toBeVisible()
    const shares = page.getByRole('table', { name: 'LP shares of the vault' })
    await expect(shares.getByRole('row', { name: /LP 1/ })).toContainText('100.00 %')
    await expect(shares.getByRole('row', { name: /All shares/ })).toContainText('250,000.00')

    const deposit = main.getByRole('button', { name: 'Deposit to the vault' })
    await expect(deposit).toBeDisabled()
    await main.getByRole('textbox', { name: /^Amount/ }).fill('500')
    await deposit.click()
    const dialog = page.getByRole('dialog', { name: 'Deposit to the vault' })
    await expect(dialog).toContainText('500.00')
    await expect(dialog).toContainText('it can be lost')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(deposit).toBeFocused()
  })

  test('another writer can take over privately', async ({ page }) => {
    await openApp(page, '/margin/liquidations')
    // Step 26 of the script: Maker A is below its liquidation level, and the next takeover on record is Maker B's.
    await startAt(page, /^Takeover by another writer/, 26)
    await expect(page.getByRole('button', { name: 'Private takeover: Maker A' })).toHaveCount(0)
    await actAs(page, 'Maker B')
    await page.getByRole('button', { name: 'Private takeover: Maker A' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Private takeover' })
    await expect(confirm).toContainText('InsolventTakeover, 218')
    await confirm.getByRole('button', { name: 'Take over privately' }).click()
    await expect(result(page)).toContainText('Taken over privately')
    await expect(page.getByRole('table', { name: 'Takeovers' }).getByRole('row', { name: /Maker A/ }).last()).toContainText('Maker B (you)')
  })

  test('the scenario replay: scenario, step slider, back and next, acting as, recent steps on demand', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, EARLY, 22)
    const card = replay(page)
    await expect(card.getByRole('heading', { name: 'Replay a scenario' })).toBeVisible()
    await expect(page.locator('p', { hasText: 'Early exercise, step 22 of 31, as Maker A.' })).toBeVisible()
    await expect(page.locator('p', { hasText: 'The scenario stands at' })).toContainText('UTC')

    const slider = card.getByRole('slider', { name: 'Step' })
    await expect(slider).toHaveAttribute('aria-valuetext', '22 of 31')
    await expect(card).toContainText('Next: exercise early, by Bob')
    await card.getByRole('button', { name: 'Next' }).click()
    await expect(slider).toHaveAttribute('aria-valuetext', '23 of 31')

    // The steps are closed until asked for.
    const steps = card.getByRole('table', { name: 'Recent steps of the scenario, latest first' })
    await expect(steps).toHaveCount(0)
    await card.getByRole('button', { name: 'Show steps' }).click()
    await expect(steps.getByRole('row').nth(1)).toContainText('Exercise early')
    await expect(steps.getByRole('row').nth(1)).toContainText('Refused: LiquidateFirst (224)')
    await card.getByRole('button', { name: 'Back' }).click()
    await expect(slider).toHaveAttribute('aria-valuetext', '22 of 31')

    await actAs(page, 'Bob')
    await expect(page.locator('p', { hasText: 'step 22 of 31, as Bob.' })).toBeVisible()
    await expect(page.getByRole('main').getByText('Bob has no margin posted yet.')).toBeVisible()

    await pickScenario(page, /^Price gap/)
    await expect(slider).toHaveAttribute('aria-valuetext', '0 of 23')
    await expect(card.getByRole('button', { name: 'Back' })).toBeDisabled()
    await expect(card).toContainText('No step has run yet.')

    // The card folds away and comes back.
    await card.getByRole('button', { name: 'Hide controls' }).click()
    await expect(slider).toBeHidden()
    await expect(card).toContainText('Price gap, takeover by the vault, step 0 of 23, as Maker A.')
    await card.getByRole('button', { name: 'Show controls' }).click()
    await expect(slider).toBeVisible()
  })

  test('the sub-navigation keeps the scenario and the step from screen to screen', async ({ page }) => {
    await openApp(page, '/margin')
    await startAt(page, EARLY, 22)
    await replay(page).getByRole('button', { name: 'Next' }).click()
    await goToScreen(page, 'Trade')
    await goToScreen(page, 'Vault')
    await expect(page.locator('p', { hasText: 'Early exercise, step 23 of 31, as Maker A.' })).toBeVisible()
  })

  test('no Margin screen uses a word the product may not say', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      const text = await page.getByRole('main').innerText()
      expect(findBannedWords(text, MARGIN_BANNED_WORDS), screen.path).toEqual([])
      expect(text, screen.path).not.toMatch(/[—→!]/)
      expect(text, screen.path).not.toMatch(/Nothing is computed in the page|come from the contract, never from this page|the script decides/)
    }
  })

  test('axe finds nothing on the five screens, in both themes', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(prices(page)).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })

  test('axe finds nothing in the buy dialog, the exercise dialog and a refusal, in both themes', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    await page.getByRole('button', { name: 'Exercise early, position 1, as Bob' }).click()
    await expect(page.getByRole('dialog', { name: 'Exercise early' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('dialog', { name: 'Exercise early' }).getByRole('button', { name: 'Try anyway' }).click()
    await expect(result(page)).toContainText('LiquidateFirst (224)')
    await expectNoAxeViolations(page)

    await goToScreen(page, 'Trade')
    await startAt(page, UNCOVERED, 5)
    await actAs(page, 'Alice')
    await page.getByRole('button', { name: /^Buy offer 0/ }).click()
    await expect(page.getByRole('dialog', { name: 'Buy EQTY call' })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})

// The `@phone` tag runs these in the 390 x 844 touch project only (playwright.config.ts).
test.describe('Margin on a phone @phone', () => {
  test('no screen scrolls sideways, tables are lists with every value, and the replay starts folded', async ({ page }) => {
    expect(page.viewportSize()?.width).toBe(PHONE.width)
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(prices(page)).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expect(replay(page).getByRole('button', { name: 'Show controls' })).toHaveAttribute('aria-expanded', 'false')
      await expect(replay(page).getByRole('slider', { name: 'Step' })).toBeHidden()
      expect(await countVisible(page, MARGIN_BANNER_SIMULATED), `sentences on ${screen.path}`).toBe(1)
    }

    // Positions: a list, not a table; the holder and the action are both there.
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    await expect(page.getByRole('table')).toHaveCount(0)
    const item = page.getByRole('list', { name: 'Margin positions' }).getByRole('listitem').filter({ hasText: 'Position 1' })
    await expect(item).toContainText('Holder')
    await expect(item).toContainText('Bob')
    const button = item.getByRole('button', { name: 'Exercise early, position 1, as Bob' })
    await expect(button).toBeVisible()
    const box = await button.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('Buy is a full page: the terms first, and the action with its sentence in the bar at the bottom', async ({ page }) => {
    await openApp(page, '/margin/trade')
    await startAt(page, UNCOVERED, 5)
    await actAs(page, 'Alice')
    await page.getByRole('button', { name: /^Buy offer 0/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Buy EQTY call' })
    await expect(sheet).toBeVisible()
    const confirm = sheet.getByRole('button', { name: /^Buy for 619\.17 USDx$/ })
    await expect(confirm).toBeInViewport()
    await expect(confirm).toBeEnabled()
    await expect(sheet.getByText(BUY_PAYOUT_LINE)).toBeInViewport()
    const box = await sheet.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(PHONE.width - 1)
    await expectNoHorizontalOverflow(page)
  })

  test('the replay opens on demand and the flows work with it', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await startAt(page, EARLY, 22)
    await replay(page).getByRole('button', { name: 'Next' }).click()
    await expect(page.locator('p', { hasText: 'Early exercise, step 23 of 31, as Maker A.' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('axe finds nothing on the five screens at 390 px, in both themes', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(prices(page)).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })
})
