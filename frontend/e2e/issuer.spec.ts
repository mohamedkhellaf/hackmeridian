/**
 * Issuer (`/issuer`). The suite runs on the mock chain, where there is no asset contract to read and no
 * transaction to sign: the page says so in the one sentence of ruling R24 and shows only what the mock data
 * holds, read only (the demo flags of each asset and what the Covered contract holds and reserves in it), with
 * no control that would act. The console itself (accounts, authorize, freeze, claw back) needs a Testnet
 * contract; it is covered by the unit tests of `src/features/issuer` and by the opt-in Testnet run in
 * `src/features/issuer/actions.live.test.ts`.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_TAGLINES, BANNED_WORDS, ISSUER_DISCLOSURE, clawbackShortfallDisclosure, findBannedWords } from '../src/core/disclosures'
import { COPY } from '../src/features/issuer/copy'
import { PHONE, clawBack, connect, connectButton, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading, walletButton } from './helpers'

const SENTENCE = 'On mock data there is no asset contract to read and no transaction to sign.'
const DESCRIPTION = "Who can hold a listed asset, who is frozen and what is taken back. Only the asset's issuer can sign."

const main = (page: Page) => page.locator('main')
const statement = (page: Page) => main(page).getByRole('region', { name: 'Covered contract' })
const powers = (page: Page) => main(page).getByRole('table', { name: 'Issuer powers' })
/** The value of a row of a definition list, by its label. */
const fact = (scope: ReturnType<typeof main>, label: string) =>
  scope.locator('dl > div').filter({ has: scope.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd')

async function pickAsset(page: Page, code: string): Promise<void> {
  await main(page).getByRole('combobox', { name: 'Asset' }).click()
  await page.getByRole('option', { name: code }).click()
  await expect(main(page).getByRole('combobox', { name: 'Asset' })).toHaveText(code)
}

test.describe('Issuer on mock data', () => {
  test('says the one sentence and shows what the mock data holds, read only', async ({ page }) => {
    await openApp(page, '/issuer')
    await expect(pageHeading(page)).toHaveText('Issuer')
    await expect(page).toHaveTitle('Issuer · StellSec')

    // The sentence, word for word, directly under the page heading; the console's description is not there.
    expect(COPY.mock.sentence).toBe(SENTENCE)
    await expect(main(page).locator('header p').first()).toHaveText(SENTENCE)
    await expect(main(page).getByText(DESCRIPTION)).toHaveCount(0)
    await expect(main(page).getByText('Issuer actions need a Testnet contract.')).toHaveCount(0)

    // The Covered contract as a statement: what it holds and owes, and how many options depend on it. The mock
    // chain has no authorization model, so no authorization is shown.
    await expect(statement(page)).toBeVisible()
    await expect(fact(statement(page), 'Held')).toHaveText(/^[\d,]+\.\d{2} FUND/)
    await expect(fact(statement(page), 'Reserved for open options')).toHaveText(/^[\d,]+\.\d{2} FUND/)
    await expect(fact(statement(page), 'Open options')).toContainText(/\d/)
    await expect(statement(page).getByText('Authorization', { exact: true })).toHaveCount(0)

    // What the issuer can do: the demo flags as the same table as the asset's About tab.
    await expect(main(page).getByRole('heading', { level: 2, name: 'What the issuer can do' })).toBeVisible()
    await expect(powers(page).getByRole('rowheader')).toHaveText(['Authorization required', 'Authorization revocable', 'Clawback enabled', 'Change these settings'])

    // The asset's identity, with no explorer link: mock ids never reach the network.
    const card = main(page).getByRole('complementary', { name: 'Asset' })
    await expect(fact(card, 'Code')).toHaveText('FUND')
    await expect(card.getByRole('link')).toHaveCount(0)
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
    expect(headings.filter((h) => h.level === 2).map((h) => h.text)).toEqual(['Covered contract', 'What the issuer can do', 'Asset'])
  })

  test('the asset select switches every figure to that asset', async ({ page }) => {
    await openApp(page, '/issuer')
    const state = (power: string) => powers(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name: power }) }).getByRole('cell').first()

    await pickAsset(page, 'BOND')
    await expect(fact(statement(page), 'Held')).toContainText('BOND')
    await expect(state('Authorization required')).toHaveText('On')
    await expect(state('Clawback enabled')).toHaveText('On')

    await pickAsset(page, 'EQTY')
    await expect(fact(statement(page), 'Reserved for open options')).toContainText('EQTY')
    await expect(state('Clawback enabled')).toHaveText('Off')
  })

  test('the reserves follow the mock chain: a clawback leaves the contract short, and the page says by how much', async ({ page }) => {
    await openApp(page, '/issuer')
    await pickAsset(page, 'BOND')
    await expect(statement(page).getByText('Short', { exact: true })).toHaveCount(0)
    const held = await fact(statement(page), 'Held').innerText()
    await clawBack(page, 'C_MOCK_BOND', 15n * 10n ** 7n)
    // The page has no refresh of its own on mock data: the reads are invalidated the way a transaction would.
    await page.evaluate(() => (window as unknown as { __stellsec: { queryClient: { invalidateQueries: () => Promise<void> } } }).__stellsec.queryClient.invalidateQueries())
    await expect(fact(statement(page), 'Held')).not.toHaveText(held)
    await expect(fact(statement(page), 'Short')).toHaveText(/^15\.00 BOND/)
  })

  test('nothing acts and nothing asks for a wallet that could not help, connected or not', async ({ page }) => {
    await openApp(page, '/issuer')
    // The shell offers the wallet; the page itself does not, because connecting changes nothing on mock data.
    await expect(connectButton(page)).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Connect wallet' })).toHaveCount(0)

    const noActions = async () => {
      for (const name of [/^Authorize/, /^Freeze/, /^Claw back/, /^More actions/]) await expect(main(page).getByRole('button', { name })).toHaveCount(0)
      await expect(main(page).getByRole('textbox')).toHaveCount(0)
      await expect(main(page).getByRole('heading', { name: 'Accounts' })).toHaveCount(0)
      await expect(main(page).locator(':disabled, [aria-disabled="true"]')).toHaveCount(0)
    }
    await noActions()
    const before = await main(page).innerText()

    await connect(page)
    await expect(walletButton(page)).toBeVisible()
    await noActions()
    await expect(main(page).getByText(/^Read only\./)).toHaveCount(0)
    expect(await main(page).innerText()).toBe(before)
  })

  test('the two links lead on, with the keyboard too', async ({ page }) => {
    await openApp(page, '/issuer')
    const reserves = main(page).getByRole('link', { name: 'See what the contract holds' })
    const learn = main(page).getByRole('link', { name: 'How an issuer action affects an option' })
    await expect(reserves).toBeVisible()
    await expect(learn).toBeVisible()

    await reserves.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === '/reserves')
    await expect(pageHeading(page)).toHaveText('Reserves')

    await page.goBack()
    await expect(pageHeading(page)).toHaveText('Issuer')
    await main(page).getByRole('link', { name: 'How an issuer action affects an option' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === '/learn')
    expect(await currentPath(page)).toBe('/learn#risks')
  })

  test('the wording keeps to the honest-claims rules, carries no tagline and repeats no required sentence', async ({ page }) => {
    await openApp(page, '/issuer')
    const text = await main(page).innerText()
    expect(findBannedWords(text, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
    expect(text).not.toMatch(/[—→←!]/)
    expect(text).not.toMatch(/fictional|experimental/i)
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
      await expect(main(page).getByText(SENTENCE, { exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(page)

      // The statement comes before the powers, the asset's facts last.
      const tops = await Promise.all(
        [statement(page), main(page).getByRole('heading', { name: 'What the issuer can do' }), main(page).getByRole('complementary', { name: 'Asset' })].map(async (l) => (await l.boundingBox())?.y ?? 0),
      )
      expect([...tops].sort((a, b) => a - b)).toEqual(tops)

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
