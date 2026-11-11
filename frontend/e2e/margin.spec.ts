/**
 * Margin (experimental): the five screens on fixtures (the dev server runs with VITE_ENABLE_PRO=1 and no Margin
 * contract id). The fixture client lives in the page: a full page load restarts the default scenario ("Early
 * exercise" at step 22, acting as Maker A), so a flow that builds on its own earlier calls moves with the
 * section's links, never with a second `page.goto`.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { MARGIN_BANNED_WORDS, MARGIN_BANNER_SIMULATED, MARGIN_WARNING_BULLETS, MARGIN_WARNING_CONSENT, MARGIN_WARNING_TITLE, findBannedWords } from '../src/core/disclosures'
import { MARGIN_ACK_KEY } from '../src/core/market/marginAck'
import { PHONE, countVisible, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading } from './helpers'

const SCREENS = [
  { path: '/margin', nav: 'Account', title: 'Margin account' },
  { path: '/margin/trade', nav: 'Trade', title: 'Margin trade' },
  { path: '/margin/positions', nav: 'Positions', title: 'Margin positions' },
  { path: '/margin/liquidations', nav: 'Liquidations', title: 'Liquidations' },
  { path: '/margin/vault', nav: 'Vault', title: 'Vault' },
] as const

const PUBLISHER_LINE = "Prices and the settlement price are set by the team's publisher."
const BUY_CONSENT = 'I understand my payout can be reduced.'

const subNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Margin sections' })
const oracle = (page: Page): Locator => page.getByRole('region', { name: 'Oracle' })
const result = (page: Page): Locator => page.getByRole('region', { name: 'Result' })
const replay = (page: Page): Locator => page.locator('#replay')

/** Records the session acknowledgement before the app boots, so a test starts past the entry warning. */
async function acknowledge(page: Page): Promise<void> {
  await page.addInitScript((key) => sessionStorage.setItem(key, '1'), MARGIN_ACK_KEY)
}

/** Moves between Margin screens the way a user does. The replay keeps its scenario and step. */
async function goToScreen(page: Page, nav: (typeof SCREENS)[number]['nav']): Promise<void> {
  const screen = SCREENS.find((s) => s.nav === nav)!
  await subNav(page).getByRole('link', { name: nav, exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === screen.path)
  await expect(pageHeading(page)).toHaveText(screen.title)
}

async function pickScenario(page: Page, title: RegExp): Promise<void> {
  await replay(page).getByRole('combobox', { name: 'Scenario' }).click()
  await page.getByRole('option', { name: title }).click()
}

async function actAs(page: Page, name: string): Promise<void> {
  await replay(page).getByRole('combobox', { name: 'Acting as' }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

/** Puts the scenario at `step` with the keyboard: Home, then one arrow press per step. */
async function stepTo(page: Page, step: number): Promise<void> {
  const slider = replay(page).getByRole('slider', { name: 'Step' })
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < step; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuetext', new RegExp(`^${step} of \\d+$`))
}

test.describe('Margin, the entry warning', () => {
  test('is shown once per tab; Continue needs "I understand"', async ({ page }) => {
    await page.goto('/margin')
    const dialog = page.getByRole('dialog', { name: MARGIN_WARNING_TITLE })
    await expect(dialog).toBeVisible()
    for (const bullet of MARGIN_WARNING_BULLETS) await expect(dialog).toContainText(bullet)
    await expect(dialog.getByRole('listitem')).toHaveCount(3)

    const go = dialog.getByRole('button', { name: 'Continue' })
    await expect(go).toBeDisabled()
    await dialog.getByRole('checkbox', { name: MARGIN_WARNING_CONSENT }).check()
    await expect(go).toBeEnabled()
    await go.click()
    await expect(dialog).toHaveCount(0)

    // Acknowledged for the session: another screen, and a reload, do not ask again.
    await goToScreen(page, 'Vault')
    await page.reload()
    await expect(pageHeading(page)).toHaveText('Vault')
    await expect(page.getByRole('dialog', { name: MARGIN_WARNING_TITLE })).toHaveCount(0)
  })

  test('Cancel leaves the section for Markets', async ({ page }) => {
    await page.goto('/margin/trade')
    await page.getByRole('dialog', { name: MARGIN_WARNING_TITLE }).getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
  })

  test('Escape leaves too, and focus starts on the checkbox', async ({ page }) => {
    await page.goto('/margin/positions')
    const dialog = page.getByRole('dialog', { name: MARGIN_WARNING_TITLE })
    await expect(dialog.getByRole('checkbox', { name: MARGIN_WARNING_CONSENT })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
  })
})

test.describe('Margin on fixtures', () => {
  test.beforeEach(async ({ page }) => {
    await acknowledge(page)
  })

  test('every screen carries the one banner, the sub-navigation and the oracle region', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(pageHeading(page)).toHaveText(screen.title)
      await expect(oracle(page)).toBeVisible()
      expect(await countVisible(page, MARGIN_BANNER_SIMULATED), `banner on ${screen.path}`).toBe(1)
      await expect(subNav(page).getByRole('link')).toHaveText(SCREENS.map((s) => s.nav))
      await expect(subNav(page).locator('[aria-current="page"]')).toHaveText(screen.nav)
      await expect(oracle(page)).toContainText(PUBLISHER_LINE)
    }
  })

  test('the oracle region gives the price, the snapshot, its age in words and the early-exercise window', async ({ page }) => {
    await openApp(page, '/margin')
    const o = oracle(page)
    await expect(o.getByText('EQTY, publisher price')).toBeVisible()
    await expect(o).toContainText('140.00')
    await expect(o).toContainText('No. 4')
    await expect(o).toContainText('0 s, fresh')
    await expect(o).toContainText('Open, snapshot within 2 min')

    // One step later the clock is at expiry: the snapshot is stale, exercise is paused, a settlement price is pending.
    await stepTo(page, 26)
    await expect(o).toContainText('stale (limit 1 h)')
    await expect(o).toContainText('Paused, snapshot older than 2 min')
    await expect(o).toContainText('Pending for series 0')
  })

  test('the account shows a writer below the liquidation level, with the distance in words', async ({ page }) => {
    await openApp(page, '/margin')
    const main = page.getByRole('main')
    await expect(main.getByText('Account value (NLV)')).toBeVisible()
    await expect(main.getByText('Liquidation level (MM)')).toBeVisible()
    await expect(main.getByText('Opening requirement (IM)')).toBeVisible()
    await expect(main.getByText('Liquidatable.')).toBeVisible()
    await expect(main.getByText('20,437.84 USDx below the liquidation level. A deposit of at least 20,437.8473 USDx brings the account value back to it.')).toBeVisible()
    await expect(main.getByRole('img', { name: /Account value 23,507\.59.*Liquidation \(MM\) 43,945\.44.*Liquidatable/ })).toBeVisible()

    // Deposit needs an amount; the shortfall can be filled in with one press, and nothing is sent by that.
    const deposit = main.getByRole('button', { name: 'Deposit', exact: true })
    await expect(deposit).toBeDisabled()
    await main.getByRole('button', { name: 'Fill in 20,437.8473 USDx' }).click()
    const amount = main.getByRole('textbox', { name: /^Amount/ })
    await expect(amount).toHaveValue('20437.8473')
    await expect(amount).toBeFocused()
    await expect(deposit).toBeEnabled()

    // The default scenario records no later deposit: the result says so instead of pretending.
    await deposit.click()
    await expect(result(page)).toContainText('Deposit: the recorded scenario has no later step for this action.')
    await expect(result(page)).toBeFocused()
  })

  test('withdrawals are blocked while an expired position is unsettled, and the reason is on screen', async ({ page }) => {
    await openApp(page, '/margin')
    await pickScenario(page, /^Uncovered sale/)
    await stepTo(page, 10)
    const main = page.getByRole('main')
    await expect(main.getByText('Withdrawals blocked')).toBeVisible()
    await expect(main.getByText(/SeriesExpired, 205/)).toBeVisible()
    await main.getByRole('textbox', { name: /^Amount/ }).fill('1')
    await expect(main.getByRole('button', { name: 'Withdraw', exact: true })).toBeDisabled()
  })

  test('early exercise is refused with LiquidateFirst (224); after a takeover to the vault, with the vault-owned reason', async ({ page }) => {
    await openApp(page, '/margin/positions')
    const exercise = page.getByRole('button', { name: 'Exercise early, position 1, as Bob' })

    // The dialog says what to expect before anything runs.
    await exercise.click()
    let dialog = page.getByRole('dialog', { name: 'Exercise early' })
    await expect(dialog).toContainText('140.00 USDx')
    await expect(dialog).toContainText('LiquidateFirst (224)')
    await dialog.getByRole('button', { name: 'Exercise early' }).click()
    await expect(result(page)).toContainText('Early exercise refused: LiquidateFirst (224)')
    await expect(result(page)).toContainText('The writer is below its liquidation level (MM) and must be taken over first.')
    await expect(result(page)).toBeFocused()

    await goToScreen(page, 'Liquidations')
    const accounts = page.getByRole('table', { name: 'Margin accounts and their distance to liquidation' })
    await expect(accounts.getByRole('row', { name: /Maker A/ })).toContainText('Liquidatable')
    await page.getByRole('button', { name: 'Take over to the vault: Maker A' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Take over to the vault' })
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await confirm.getByRole('button', { name: 'Take over to the vault' }).click()
    await expect(result(page)).toContainText('Taken over by the vault')
    await expect(result(page)).toContainText('Takeover price')
    await expect(result(page)).toContainText('31,503.69 USDx')
    const log = page.getByRole('table', { name: 'Takeovers' })
    await expect(log.getByRole('row', { name: /Maker A/ })).toContainText('Vault')
    await expect(log.getByRole('row', { name: /Maker A/ })).toContainText('31,503.69')

    await goToScreen(page, 'Positions')
    await expect(page.getByRole('table', { name: 'Margin positions' }).getByRole('row', { name: /Position 1/ })).toContainText('settles at expiry')
    await exercise.click()
    dialog = page.getByRole('dialog', { name: 'Exercise early' })
    await expect(dialog).toContainText('NoEarlyExercise (226)')
    await dialog.getByRole('button', { name: 'Exercise early' }).click()
    await expect(result(page)).toContainText('Early exercise refused: NoEarlyExercise (226)')
    await expect(result(page)).toContainText('This position is owned by the vault and settles at expiry.')
  })

  test('the exercise flow works from the keyboard, and focus is never lost', async ({ page }) => {
    await openApp(page, '/margin/positions')
    const opener = page.getByRole('button', { name: 'Exercise early, position 1, as Bob' })
    const dialog = page.getByRole('dialog', { name: 'Exercise early' })
    const action = dialog.getByRole('button', { name: 'Exercise early' })

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
    for (let i = 0; i < 8; i++) {
      if (await action.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(result(page)).toContainText('LiquidateFirst (224)')
    await expect(result(page)).toBeFocused()

    // The next stop is the result's own action; dismissing it sends focus to the page heading.
    await page.keyboard.press('Tab')
    await expect(result(page).getByRole('button', { name: 'Dismiss' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(pageHeading(page)).toBeFocused()
  })

  test('the five early-exercise refusals are explained on the Positions screen', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await page.getByRole('button', { name: 'When early exercise is refused' }).click()
    const popup = page.getByRole('dialog', { name: 'When early exercise is refused' })
    for (const name of ['NoEarlyExercise (226)', 'StaleSnapshot (207)', 'OutOfTheMoney (223)', 'SettlementPending (225)', 'LiquidateFirst (224)']) await expect(popup).toContainText(name)
  })

  test('the buy dialog draws who pays, and needs the payout acknowledgement', async ({ page }) => {
    await openApp(page, '/margin/trade')
    await pickScenario(page, /^Uncovered sale/)
    await stepTo(page, 5)

    // The writer sees its own offer with Cancel, not Buy.
    await expect(page.getByRole('button', { name: /^Cancel offer 0/ })).toBeVisible()
    await actAs(page, 'Alice')
    await page.getByRole('button', { name: /^Buy offer 0/ }).click()

    const dialog = page.getByRole('dialog', { name: 'Buy EQTY call' })
    await expect(dialog).toContainText('EQTY 110.00 call, 1,000 lots, expires 5 Feb 2027, 08:00 UTC.')
    await expect(dialog).toContainText('619.17')
    await expect(dialog).toContainText('Partial')
    await expect(dialog.getByRole('img', { name: 'Hypothetical. Owed 28,000.00 USDx: writer margin 26,499.93, vault 1,500.07, no deficit.' })).toBeVisible()
    for (const line of ['Writer margin.', 'Vault.', 'Deficit.', 'It cuts your payout.', 'Hypothetical.']) await expect(dialog).toContainText(line)
    await expect(dialog).toContainText('covered in full up to a settlement price of 336.49 USDx')

    // The assumed price is a slider: at the top of its range the vault has run out and a deficit is drawn.
    const price = dialog.getByRole('slider', { name: 'If EQTY settles at' })
    await price.focus()
    await price.press('End')
    await expect(dialog.getByRole('img', { name: 'Hypothetical. Owed 277,000.00 USDx: writer margin 26,499.93, vault 200,000.00, deficit 50,500.07 not paid.' })).toBeVisible()
    await expect(dialog).toContainText(/Paid 226,499\.93 of/)

    const confirm = dialog.getByRole('button', { name: /^Buy for 619\.17 USDx$/ })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox', { name: BUY_CONSENT }).check()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(dialog).toHaveCount(0)
    await expect(result(page)).toContainText('Bought')

    await goToScreen(page, 'Positions')
    await expect(page.getByRole('table', { name: 'Margin positions' }).getByRole('row', { name: /Position 0/ })).toContainText('Alice (you)')
  })

  test('writing a call previews the requirement from the fixture and warns under the mark floor', async ({ page }) => {
    await openApp(page, '/margin/trade')
    await pickScenario(page, /^Uncovered sale/)
    await stepTo(page, 4)
    const form = page.locator('#write')
    await expect(form.getByRole('heading', { name: 'Write an uncovered call' })).toBeVisible()
    await expect(form).toContainText('At the latest mark a buy needs at least 562.8819 USDx.')

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

  test('after expiry: settle the book, settle the series, claim; due, paid and deficit stay on the row', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await pickScenario(page, /^Settlement with a deficit/)
    await stepTo(page, 10)
    const table = page.getByRole('table', { name: 'Margin positions' })
    await expect(table.getByRole('row', { name: /Position 0/ })).toContainText('Waiting for settlement price')

    await stepTo(page, 12)
    await page.getByRole('button', { name: 'Settle book, position 0' }).click()
    await expect(result(page)).toContainText('Book settled')
    await expect(result(page)).toContainText('24,942.80 USDx')

    await page.getByRole('button', { name: 'Settle series, position 0' }).click()
    await expect(result(page)).toContainText('Series settled')
    await expect(result(page)).toContainText('23,880.89 USDx')

    await page.getByRole('button', { name: 'Claim, position 0, as Alice' }).click()
    await expect(result(page)).toContainText('Claimed')
    const row = table.getByRole('row', { name: /Position 0/ })
    await expect(row).toContainText('30,000.00')
    await expect(row).toContainText('15,671.46')
    await expect(row).toContainText('14,328.53')
    await expect(row).toContainText('Claimed')

    await goToScreen(page, 'Vault')
    const series = page.getByRole('table', { name: 'Shortfall, vault payment and deficit per series' })
    await expect(series.getByRole('row', { name: /Series 0/ })).toContainText('23,880.89')
    await expect(series.getByRole('row', { name: /Series 0/ })).toContainText('Closed')
    await expect(page.getByRole('img', { name: 'EQTY 110.00 call, 5 Feb 2027. Owed 50,000.00 USDx: writer margin 25,057.19, vault 1,061.91, deficit 23,880.89 not paid.' })).toBeVisible()
  })

  test('the vault says plainly that LP capital stays in, and asks before a deposit', async ({ page }) => {
    await openApp(page, '/margin/vault')
    const main = page.getByRole('main')
    await expect(main.getByText('LP capital cannot be withdrawn in this version. A deposit stays in the vault.')).toBeVisible()
    await expect(main.getByText('Vault value')).toBeVisible()
    await expect(main.getByText('Reserved for takeovers')).toBeVisible()
    await expect(page.getByRole('table', { name: 'LP shares of the vault' }).getByRole('row', { name: /LP 1/ })).toContainText('100.00 %')

    const deposit = main.getByRole('button', { name: 'Deposit to the vault' })
    await expect(deposit).toBeDisabled()
    await main.getByRole('textbox', { name: /^Amount/ }).fill('500')
    await deposit.click()
    const dialog = page.getByRole('dialog', { name: 'Deposit to the vault' })
    await expect(dialog).toContainText('500.00 USDx')
    await expect(dialog).toContainText('it can be lost')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(deposit).toBeFocused()
  })

  test('a private takeover is not offered on your own account; another writer can make it', async ({ page }) => {
    await openApp(page, '/margin/liquidations')
    await pickScenario(page, /^Takeover by another writer/)
    // Step 26 of the script: Maker A is below its liquidation level, and the next takeover on record is Maker B's.
    await stepTo(page, 26)
    await expect(page.getByRole('button', { name: 'Private takeover: Maker A' })).toBeDisabled()
    await actAs(page, 'Maker B')
    await page.getByRole('button', { name: 'Private takeover: Maker A' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Private takeover' })
    await expect(confirm).toContainText('InsolventTakeover, 218')
    await confirm.getByRole('button', { name: 'Take over privately' }).click()
    await expect(result(page)).toContainText('Taken over privately')
    await expect(page.getByRole('table', { name: 'Takeovers' }).getByRole('row', { name: /Maker A/ }).last()).toContainText('Maker B (you)')
  })

  test('the scenario replay: scenario, step slider, back and next, acting as, recent steps', async ({ page }) => {
    await openApp(page, '/margin')
    const card = replay(page)
    await expect(card.getByRole('heading', { name: 'Replay a scenario' })).toBeVisible()
    await expect(page.getByText('Replaying Early exercise, step 22 of 31. You act as Maker A.')).toBeVisible()

    const slider = card.getByRole('slider', { name: 'Step' })
    await expect(slider).toHaveAttribute('aria-valuetext', '22 of 31')
    await expect(card).toContainText('Next: exercise early, by Bob')
    await card.getByRole('button', { name: 'Next' }).click()
    await expect(slider).toHaveAttribute('aria-valuetext', '23 of 31')
    const steps = card.getByRole('table', { name: 'Recent steps of the scenario, latest first' })
    await expect(steps.getByRole('row').nth(1)).toContainText('Exercise early')
    await expect(steps.getByRole('row').nth(1)).toContainText('Refused: LiquidateFirst (224)')
    await card.getByRole('button', { name: 'Back' }).click()
    await expect(slider).toHaveAttribute('aria-valuetext', '22 of 31')

    await actAs(page, 'Bob')
    await expect(page.getByText('You act as Bob.')).toBeVisible()
    await expect(page.getByRole('main').getByText('Bob has no margin posted yet.')).toBeVisible()

    await pickScenario(page, /^Price gap/)
    await expect(slider).toHaveAttribute('aria-valuetext', '0 of 23')
    await expect(card.getByRole('button', { name: 'Back' })).toBeDisabled()
    await expect(card).toContainText('No step has run yet.')

    // The card folds away and comes back.
    await card.getByRole('button', { name: 'Hide controls' }).click()
    await expect(slider).toBeHidden()
    await expect(card).toContainText('Price gap, takeover by the vault, step 0 of 23.')
    await card.getByRole('button', { name: 'Show controls' }).click()
    await expect(slider).toBeVisible()
  })

  test('the sub-navigation keeps the scenario and the step from screen to screen', async ({ page }) => {
    await openApp(page, '/margin')
    await replay(page).getByRole('button', { name: 'Next' }).click()
    await goToScreen(page, 'Trade')
    await goToScreen(page, 'Vault')
    await expect(page.getByText('Replaying Early exercise, step 23 of 31.')).toBeVisible()
  })

  test('no Margin screen uses a word the product may not say', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      const text = await page.getByRole('main').innerText()
      expect(findBannedWords(text, MARGIN_BANNED_WORDS), screen.path).toEqual([])
      expect(text, screen.path).not.toMatch(/[—→!]/)
    }
  })

  test('axe finds nothing on the five screens, in both themes', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(oracle(page)).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })

  test('axe finds nothing in the buy dialog and in a refusal, in both themes', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await page.getByRole('button', { name: 'Exercise early, position 1, as Bob' }).click()
    await expect(page.getByRole('dialog', { name: 'Exercise early' })).toBeVisible()
    await expectNoAxeViolations(page)
    await page.getByRole('dialog', { name: 'Exercise early' }).getByRole('button', { name: 'Exercise early' }).click()
    await expect(result(page)).toContainText('LiquidateFirst (224)')
    await expectNoAxeViolations(page)

    await goToScreen(page, 'Trade')
    await pickScenario(page, /^Uncovered sale/)
    await stepTo(page, 5)
    await actAs(page, 'Alice')
    await page.getByRole('button', { name: /^Buy offer 0/ }).click()
    await expect(page.getByRole('dialog', { name: 'Buy EQTY call' })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})

// The `@phone` tag runs these in the 390 x 844 touch project only (playwright.config.ts).
test.describe('Margin on a phone @phone', () => {

  test.beforeEach(async ({ page }) => {
    await acknowledge(page)
  })

  test('no screen scrolls sideways, tables are lists with every value, and the replay starts folded', async ({ page }) => {
    expect(page.viewportSize()?.width).toBe(PHONE.width)
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(oracle(page)).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expect(replay(page).getByRole('button', { name: 'Show controls' })).toHaveAttribute('aria-expanded', 'false')
      await expect(replay(page).getByRole('slider', { name: 'Step' })).toBeHidden()
      expect(await countVisible(page, MARGIN_BANNER_SIMULATED), `banner on ${screen.path}`).toBe(1)
    }

    // Positions: a list, not a table; the holder and the action are both there.
    await openApp(page, '/margin/positions')
    await expect(page.getByRole('table')).toHaveCount(0)
    const item = page.getByRole('list', { name: 'Margin positions' }).getByRole('listitem').filter({ hasText: 'Position 1' })
    await expect(item).toContainText('Holder')
    await expect(item).toContainText('Bob')
    const button = item.getByRole('button', { name: 'Exercise early, position 1, as Bob' })
    await expect(button).toBeVisible()
    const box = await button.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('the replay opens on demand and the flows work with it', async ({ page }) => {
    await openApp(page, '/margin/positions')
    await replay(page).getByRole('button', { name: 'Show controls' }).click()
    await replay(page).getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Replaying Early exercise, step 23 of 31.')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('axe finds nothing on the five screens at 390 px, in both themes', async ({ page }) => {
    for (const screen of SCREENS) {
      await openApp(page, screen.path)
      await expect(oracle(page)).toBeVisible()
      await expectNoAxeViolations(page)
    }
  })
})
