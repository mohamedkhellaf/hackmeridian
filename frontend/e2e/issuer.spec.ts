/**
 * Issuer (`/issuer`). The suite runs on the mock chain, where the console has nothing to read and nothing to sign:
 * the page must say so in the exact words, explain what the console does on Testnet, and show no control that
 * would do nothing. The console itself (flags, accounts, authorize, freeze, claw back) needs a Testnet contract;
 * it is covered by the unit tests of `src/features/issuer` and by the opt-in Testnet run in
 * `src/features/issuer/actions.live.test.ts`.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_WORDS, ISSUER_DISCLOSURE, clawbackShortfallDisclosure, findBannedWords } from '../src/core/disclosures'
import { COPY } from '../src/features/issuer/copy'
import { PHONE, connect, connectButton, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading, walletButton } from './helpers'

const SENTENCE = 'Issuer actions need a Testnet contract.'
const GUEST_PROMPT = "Connect the asset issuer's account in your wallet."

const main = (page: Page) => page.locator('main')

/** Every control inside the page (the shell's own controls are outside `main`). */
const controls = (page: Page) => main(page).locator('button, input, select, textarea, [role="button"], [role="combobox"], [role="switch"], [role="checkbox"]')

test.describe('Issuer on a build without a Testnet contract', () => {
  test('says the exact sentence and explains what the console does on Testnet', async ({ page }) => {
    await openApp(page, '/issuer')
    await expect(pageHeading(page)).toHaveText('Issuer')
    await expect(page).toHaveTitle('Issuer · StellSec')

    // The sentence, word for word, as the first thing under the page heading.
    expect(COPY.mock.sentence).toBe(SENTENCE)
    const sentence = main(page).getByRole('heading', { level: 2, name: SENTENCE, exact: true })
    await expect(sentence).toBeVisible()
    await expect(main(page).getByText(COPY.mock.hint, { exact: true })).toBeVisible()
    await expect(main(page).locator('h2').first()).toHaveText(SENTENCE)

    // The explanation: the three actions, each with what the issuer signs and what it means for options.
    const what = main(page).getByRole('region', { name: 'What the console does on Testnet' })
    await expect(what).toBeVisible()
    const actions = what.getByRole('listitem')
    await expect(actions).toHaveCount(3)
    await expect(what.getByRole('heading', { level: 3 })).toHaveText(['Authorize', 'Freeze', 'Claw back'])
    for (const [i, action] of COPY.mock.actions.entries()) {
      await expect(actions.nth(i)).toContainText('What the issuer signs')
      await expect(actions.nth(i)).toContainText(action.signs)
      await expect(actions.nth(i)).toContainText('What it means for options')
      await expect(actions.nth(i)).toContainText(action.options)
    }
    // Freezing the options contract stops settlement, and a clawback from it leaves holders short: both are said.
    await expect(actions.nth(1)).toContainText('If the options contract is frozen, no option written on the asset can settle.')
    await expect(actions.nth(2)).toContainText('first come, first served')

    // What it reads and who can sign.
    const reads = main(page).getByRole('region', { name: 'What it reads' })
    await expect(reads.getByRole('term')).toHaveText(['Issuer flags', 'Accounts', 'The options contract'])
    await expect(main(page).getByRole('region', { name: 'Who can sign' })).toContainText('Only the issuer account of the asset.')
  })

  test('headings run in order: one h1, then h2 and h3 with no level skipped', async ({ page }) => {
    await openApp(page, '/issuer')
    const headings = await main(page)
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName[1]), text: (el.textContent ?? '').trim() })))
    expect(headings.filter((h) => h.level === 1)).toEqual([{ level: 1, text: 'Issuer' }])
    expect(headings[0].level).toBe(1)
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i].level, `"${headings[i].text}" after "${headings[i - 1].text}"`).toBeLessThanOrEqual(headings[i - 1].level + 1)
    }
    expect(headings.filter((h) => h.level === 2).map((h) => h.text)).toEqual([SENTENCE, 'What the console does on Testnet', 'What it reads', 'Who can sign'])
  })

  test('a guest sees the same page: nothing asks for a wallet that could not help, and no control is dead', async ({ page }) => {
    await openApp(page, '/issuer')
    // The shell offers the wallet; the page itself does not, because connecting changes nothing on mock data.
    await expect(connectButton(page)).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Connect wallet' })).toHaveCount(0)
    await expect(page.getByText(GUEST_PROMPT)).toHaveCount(0)

    // No console is drawn: no table of accounts, no action button, no field. Nothing in the page is disabled.
    await expect(controls(page)).toHaveCount(0)
    await expect(main(page).locator('table')).toHaveCount(0)
    await expect(main(page).locator(':disabled, [aria-disabled="true"], [data-disabled]')).toHaveCount(0)
    for (const name of ['Authorize', 'Freeze', 'Claw back']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }
    // The old console printed "Mock" in place of every value. Nothing pretends to be a reading here.
    await expect(main(page).getByText('Mock', { exact: true })).toHaveCount(0)
  })

  test('connecting a wallet changes nothing on the page', async ({ page }) => {
    await openApp(page, '/issuer')
    const before = await main(page).innerText()
    await connect(page)
    await expect(walletButton(page)).toBeVisible()
    await expect(main(page).getByRole('heading', { level: 2, name: SENTENCE, exact: true })).toBeVisible()
    await expect(controls(page)).toHaveCount(0)
    expect(await main(page).innerText()).toBe(before)
  })

  test('the two links lead on, with the keyboard too', async ({ page }) => {
    await openApp(page, '/issuer')
    const links = main(page).getByRole('link')
    await expect(links).toHaveText(['See what the contract holds', 'How an issuer action affects an option'])

    await links.nth(0).focus()
    await expect(links.nth(0)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === '/reserves')
    await expect(pageHeading(page)).toHaveText('Reserves')

    await page.goBack()
    await expect(pageHeading(page)).toHaveText('Issuer')
    // Tab moves from the first link to the second: they are the only stops inside the page.
    await main(page).getByRole('link').nth(0).focus()
    await page.keyboard.press('Tab')
    await expect(main(page).getByRole('link').nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === '/learn')
    expect(await currentPath(page)).toBe('/learn#risks')
  })

  test('the wording keeps to the honest-claims rules and repeats no required sentence', async ({ page }) => {
    await openApp(page, '/issuer')
    const text = await main(page).innerText()
    expect(findBannedWords(text, BANNED_WORDS)).toEqual([])
    expect(text).not.toMatch(/[—→←!]/)
    // The issuer and shortfall disclosures have their own homes (ticket review, About tab, Reserves).
    expect(text).not.toContain(ISSUER_DISCLOSURE)
    expect(text).not.toContain(clawbackShortfallDisclosure('BOND').split(':')[1])
  })

  test('axe finds nothing in either theme, as a guest and connected', async ({ page }) => {
    await openApp(page, '/issuer')
    await expectNoAxeViolations(page)
    await connect(page)
    await expectNoAxeViolations(page)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

    test('reads top to bottom with no sideways scroll, and its links are 44 px targets', async ({ page }) => {
      await openApp(page, '/issuer')
      await expect(main(page).getByRole('heading', { level: 2, name: SENTENCE, exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(page)

      // The three actions stack: each name sits above its two answers, and every answer keeps its label.
      const what = main(page).getByRole('region', { name: 'What the console does on Testnet' })
      const boxes = await what.getByRole('listitem').evaluateAll((items) =>
        items.map((item) => {
          const name = item.querySelector('h3')!.getBoundingClientRect()
          const cells = [...item.querySelectorAll('h3 ~ div')].map((cell) => cell.getBoundingClientRect())
          return { nameBottom: name.bottom, cellTops: cells.map((c) => c.top), cellLefts: cells.map((c) => Math.round(c.left)), nameLeft: Math.round(name.left) }
        }),
      )
      expect(boxes).toHaveLength(3)
      for (const box of boxes) {
        expect(box.cellTops).toHaveLength(2)
        expect(box.cellTops[0]).toBeGreaterThanOrEqual(box.nameBottom)
        expect(box.cellTops[1]).toBeGreaterThan(box.cellTops[0])
        expect(box.cellLefts).toEqual([box.nameLeft, box.nameLeft])
      }
      await expect(what.getByText('What the issuer signs', { exact: true })).toHaveCount(3)
      for (const label of await what.getByText('What it means for options', { exact: true }).all()) await expect(label).toBeVisible()

      for (const link of await main(page).getByRole('link').all()) {
        const box = await link.boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      }
      // Text never runs under the edge of the screen.
      const widest = await main(page).evaluate((el) => Math.max(...[...el.querySelectorAll('p, h1, h2, h3, dt, dd, a')].map((n) => n.getBoundingClientRect().right)))
      expect(widest).toBeLessThanOrEqual(PHONE.width)
    })

    test('axe finds nothing in either theme', async ({ page }) => {
      await openApp(page, '/issuer')
      await expectNoAxeViolations(page)
    })
  })
})
