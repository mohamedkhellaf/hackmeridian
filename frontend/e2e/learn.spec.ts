/**
 * Learn (`/learn`): the page that explains the product. It is a document with no chain data, so the suite checks
 * its structure (headings, in-page navigation, captions), its wording, and that it reads well on a phone.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, PAYOFF_CAPTION, findBannedWords } from '../src/core/disclosures'
import { GLOSSARY, QUESTIONS, SECTIONS } from '../src/features/learn/content'
import { bodyText, currentPath, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading } from './helpers'

const sectionHeading = (page: Page, title: string) => page.getByRole('heading', { level: 2, name: title, exact: true })
/** Opens every disclosure of the page: the four examples and the questions. */
const openAll = (page: Page) => page.locator('main details').evaluateAll((items) => items.forEach((item) => ((item as HTMLDetailsElement).open = true)))
const sectionList = (page: Page) => page.getByRole('navigation', { name: 'On this page' })
const sectionSelect = (page: Page) => page.getByRole('combobox', { name: 'On this page' })

/** How far the top of an element is from the top of the viewport, in CSS pixels. */
const topOf = (page: Page, title: string) => sectionHeading(page, title).evaluate((el) => Math.round(el.getBoundingClientRect().top))

test.describe('Learn', () => {
  test('has one h1, every section as an h2 in order, and no skipped heading level', async ({ page }) => {
    await openApp(page, '/learn')
    // One name for the page: the navigation, the h1 and the browser tab all say Learn.
    await expect(pageHeading(page)).toHaveText('Learn')
    await expect(page).toHaveTitle('Learn · StellSec')

    const headings = await page.locator('main').locator('h1, h2, h3, h4, h5, h6').evaluateAll((els) => els.map((el) => ({ level: Number(el.tagName[1]), text: (el.textContent ?? '').trim() })))
    expect(headings.filter((h) => h.level === 1)).toHaveLength(1)
    expect(headings[0].level).toBe(1)
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i].level, `"${headings[i].text}" after "${headings[i - 1].text}"`).toBeLessThanOrEqual(headings[i - 1].level + 1)
    }
    // The h2s are the seven sections, in reading order. The number before each title is decoration.
    const sections = await page.locator('main h2').evaluateAll((els) => els.map((el) => (el.lastElementChild?.textContent ?? '').trim()))
    expect(sections).toEqual(SECTIONS.map((s) => s.title))
    // The four intents are the h3s of their section, named as everywhere else in the app, each the row that opens
    // its example. Only the first is open when the page loads.
    const names = ['Set a floor', 'Earn on what you hold', 'Earn while waiting to buy', 'Lock a buy price']
    for (const name of names) {
      await expect(page.locator('#intents').getByRole('heading', { level: 3, name, exact: true })).toBeVisible()
    }
    await expect(page.locator('#intents details')).toHaveCount(4)
    expect(await page.locator('#intents details').evaluateAll((items) => items.map((item) => (item as HTMLDetailsElement).open))).toEqual([true, false, false, false])
    // No serial on a made-up example.
    await expect(page.locator('#intents')).not.toContainText(/Example \d of \d/)
  })

  test('the section list moves the view and focus to a section and records it in the URL', async ({ page }) => {
    await openApp(page, '/learn')
    const list = sectionList(page)
    await expect(list.getByRole('link')).toHaveText(SECTIONS.map((s, i) => `${i + 1}${s.title}`))
    await expect(list.getByRole('link', { name: 'What this is' })).toHaveAttribute('aria-current', 'location')

    await list.getByRole('link', { name: 'Glossary' }).click()
    await expect(sectionHeading(page, 'Glossary')).toBeFocused()
    await expect(sectionHeading(page, 'Glossary')).toBeInViewport()
    expect(await topOf(page, 'Glossary')).toBeLessThan(120)
    expect(await currentPath(page)).toBe('/learn#glossary')
    await expect(list.getByRole('link', { name: 'Glossary' })).toHaveAttribute('aria-current', 'location')
    await expect(list.locator('[aria-current]')).toHaveCount(1)
    // The list stays in view beside the text.
    await expect(list).toBeInViewport()

    // With the keyboard: the link is reached by Tab order and followed with Enter.
    await list.getByRole('link', { name: 'The life of an option' }).focus()
    await page.keyboard.press('Enter')
    await expect(sectionHeading(page, 'The life of an option')).toBeFocused()
    expect(await currentPath(page)).toBe('/learn#lifecycle')
    // Reading continues from the section: the next Tab stop comes after its heading, not back at the top of the page.
    await page.keyboard.press('Tab')
    const follows = await page.evaluate(() => {
      const heading = document.getElementById('lifecycle-title')
      const focused = document.activeElement
      return !!heading && !!focused && (heading.compareDocumentPosition(focused) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    })
    expect(follows).toBe(true)

    // Jumping within the page does not pile up history: Back leaves the page.
    expect(await page.evaluate(() => window.history.length)).toBeLessThanOrEqual(2)
  })

  test('the current section follows the reader', async ({ page }) => {
    await openApp(page, '/learn')
    await page.locator('#risks').scrollIntoViewIfNeeded()
    await page.locator('#risks').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(sectionList(page).getByRole('link', { name: 'What can go wrong' })).toHaveAttribute('aria-current', 'location')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect(sectionList(page).getByRole('link', { name: 'Questions' })).toHaveAttribute('aria-current', 'location')
  })

  test('a link to a section opens on that section', async ({ page }) => {
    await openApp(page, '/learn#risks')
    await expect(sectionHeading(page, 'What can go wrong')).toBeFocused()
    await expect(sectionHeading(page, 'What can go wrong')).toBeInViewport()
    expect(await topOf(page, 'What can go wrong')).toBeLessThan(120)
  })

  test('every payoff figure carries the required caption and a text alternative', async ({ page }) => {
    await openApp(page, '/learn')
    await openAll(page)
    const figures = page.locator('#intents figure')
    await expect(figures).toHaveCount(4)
    for (const figure of await figures.all()) {
      await expect(figure.locator('figcaption')).toHaveText(PAYOFF_CAPTION)
      // The drawing is named, and a table of sampled points follows it for screen readers.
      await expect(figure.getByRole('img')).toHaveAccessibleName(/BOND/)
      await expect(figure.locator('table')).toHaveCount(1)
    }
    // The figure the guided page draws, for all four: what you would hold, with and without.
    await expect(page.getByTestId('with-without-chart')).toHaveCount(4)
    await expect(page.getByTestId('payoff-chart')).toHaveCount(0)
    // The caption is said where a figure is, and nowhere else on the page.
    expect((await bodyText(page)).split(PAYOFF_CAPTION).length - 1).toBe(4)
  })

  test('the worked examples print exact figures, and the price handle works with the keyboard', async ({ page }) => {
    await openApp(page, '/learn')
    const floor = page.locator('[data-intent="floor"]')
    await expect(floor).toContainText(/Pay 1\.80\sUSDx\. Until \d{1,2}\s\w{3}\s\d{4},\s08:00\sUTC you can sell 5\.00\sBOND for 50\.00\sUSDx\./)
    const note = floor.getByRole('article')
    await expect(note.getByRole('heading', { level: 4 })).toHaveText('Long put, BOND')
    const terms = await note.locator('dl > div').evaluateAll((rows) => rows.map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd > span')?.textContent?.replace(/ /g, ' ')]))
    expect(terms.filter(([label]) => label !== 'Deadline')).toEqual([
      ['Quantity', '5.00 BOND'],
      ['Floor, per BOND', '10.00 USDx'],
      ['You pay', '1.80 USDx'],
      ['Locked by the maker', '50.00 USDx'],
      ['Breakeven, per BOND', '9.64 USDx'],
      ['Most you can lose', '1.80 USDx'],
      ['Most you can gain', 'No cap'],
    ])
    // An example is not anybody's order: nothing on it is marked.
    await expect(floor.locator('mark')).toHaveCount(0)
    // The deadline is a Friday at 08:00 UTC that has not passed.
    const deadline = await note.locator('time').getAttribute('datetime')
    expect(deadline).toMatch(/T08:00:00Z$/)
    expect(new Date(deadline!).getUTCDay()).toBe(5)
    expect(Date.parse(deadline!)).toBeGreaterThan(Date.now())

    // Three outcomes under a visible heading, each a figure, a signed difference and who acts.
    await expect(floor.getByRole('heading', { level: 4, name: 'What you would hold at the deadline' })).toBeVisible()
    const outcomes = floor.getByRole('list', { name: /Three outcomes at the deadline/ }).getByRole('listitem')
    await expect(outcomes).toHaveCount(3)
    await expect(outcomes.nth(0)).toContainText('If BOND is at 8.00')
    await expect(outcomes.nth(0)).toContainText('48.20')
    await expect(outcomes.nth(0)).toContainText(/\+8\.20\sUSDx compared with no floor/)
    await expect(outcomes.nth(0)).toContainText(/You exercise: deliver 5\.00\sBOND and receive 50\.00\sUSDx/)
    await expect(outcomes.nth(2)).toContainText(/\u22121\.80\sUSDx compared with no floor/)

    // The assumed price is a slider: arrow keys move it and the read-out follows.
    const handle = floor.getByRole('slider')
    await expect(handle).toHaveAttribute('aria-valuenow', '8')
    await expect(handle).toHaveAttribute('aria-valuetext', /At 8\.00\. With the floor: 48\.20 USDx\. Without: 40\.00 USDx\./)
    await handle.focus()
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '14')
    await expect(handle).toHaveAttribute('aria-valuetext', /At 14\.00\. With the floor: 68\.20 USDx\. Without: 70\.00 USDx\./)

    // A written put: what the user locks, and the loss said as plainly as the gain. Its example opens on a click.
    const earnBuy = page.locator('[data-intent="earn-buy"]')
    await earnBuy.getByRole('heading', { level: 3, name: 'Earn while waiting to buy' }).click()
    await expect(earnBuy).toHaveAttribute('open', '')
    await expect(earnBuy.getByRole('article')).toContainText('You lock')
    await expect(earnBuy.getByRole('article')).toContainText(/47\.50\sUSDx/)
    await expect(earnBuy.getByRole('article')).toContainText(/46\.30\sUSDx/)
    await expect(earnBuy).toContainText(/\u22126\.30\sUSDx compared with keeping the cash/)

    // A written call cannot lose more than the asset it locks: no loss figure, what is given up instead.
    const earnHold = page.locator('[data-intent="earn-hold"]')
    await earnHold.locator('summary').click()
    const holdNote = earnHold.getByRole('article')
    await expect(holdNote).toContainText('You give up')
    await expect(holdNote).toContainText(/Every rise above 10\.50\sUSDx per BOND/)
    await expect(holdNote).not.toContainText('Most you can lose')
    await expect(holdNote).not.toContainText(/No cap|unlimited/)
  })

  test('each example ends on the way into the guided flow with its intent', async ({ page }) => {
    await openApp(page, '/learn')
    const example = page.locator('[data-intent="earn-hold"]')
    await example.locator('summary').click()
    const action = example.getByRole('link', { name: 'Earn on what you hold in Markets' })
    // After the outcomes, not before them.
    const after = await example.evaluate((root) => {
      const list = root.querySelector('ul')
      const link = [...root.querySelectorAll('a')].find((a) => a.textContent?.includes('in Markets'))
      return !!list && !!link && (list.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    })
    expect(after).toBe(true)
    await action.click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets' && url.searchParams.get('intent') === 'earn-hold')
  })

  test('the lifecycle says who acts and by when, and that nothing settles by itself', async ({ page }) => {
    await openApp(page, '/learn')
    const life = page.locator('#lifecycle')
    const spine = life.getByRole('list', { name: 'The life of one put, step by step' }).getByRole('listitem')
    await expect(spine).toHaveCount(3)
    // Each title says who acts; the line above it says by when.
    await expect(spine.nth(0)).toContainText('The maker locks the collateral and posts an offer')
    await expect(spine.nth(1)).toContainText('A buyer pays the premium and becomes the holder')
    await expect(spine.nth(2)).toContainText(/Until \d{1,2}\s\w{3}\s\d{4},\s08:00\sUTC/)
    // A walk-through of nobody's position: no step is marked done, current or ahead.
    await expect(life.locator('[aria-current]')).toHaveCount(0)
    const exercised = life.getByRole('list', { name: 'If the holder exercises, step by step' }).getByRole('listitem')
    const expired = life.getByRole('list', { name: 'If the deadline passes without an exercise, step by step' }).getByRole('listitem')
    await expect(exercised).toHaveCount(2)
    await expect(expired).toHaveCount(2)
    // The first step of each ending names it, once.
    await expect(exercised.nth(0)).toContainText('The holder exercises')
    await expect(expired.nth(0)).toContainText('The deadline passes')
    expect((await life.innerText()).split('The holder exercises').length - 1).toBe(1)
    expect((await life.innerText()).split('The deadline passes').length - 1).toBe(1)
    await expect(life).toContainText('The maker claims what was delivered')
    await expect(life).toContainText('The maker reclaims the collateral')
    await expect(life).toContainText('Nothing settles by itself')
    // The contract's own state names, in the order an option goes through them.
    const states = await life.locator('p', { hasText: 'State after' }).evaluateAll((els) => els.map((el) => el.lastElementChild?.textContent))
    expect(states).toEqual(['Offered', 'Active', 'Exercised', 'Settled', 'Expired'])
    await expect(life.getByRole('table', { name: 'What each side locks, pays and receives for a put and for a call' })).toBeVisible()
  })

  test('the glossary terms can be linked to', async ({ page }) => {
    await openApp(page, '/learn#term-breakeven')
    const entry = page.locator('#term-breakeven')
    await expect(entry.locator('dt')).toHaveText('Breakeven')
    await expect(entry).toBeInViewport()
    await expect(page.locator('#term-in-the-money dt')).toHaveText('In the money')
  })

  test('the glossary and the questions are complete, and a question opens with the keyboard', async ({ page }) => {
    await openApp(page, '/learn')
    const entries = page.locator('#glossary dl > div')
    await expect(entries).toHaveCount(GLOSSARY.length)
    expect(await entries.locator('dt').allTextContents()).toEqual(GLOSSARY.map((g) => g.term))

    const questions = page.locator('#questions details')
    await expect(questions).toHaveCount(QUESTIONS.length)
    const first = questions.first()
    const summary = first.locator('summary')
    await expect(first).not.toHaveAttribute('open', '')
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(first).toHaveAttribute('open', '')
    await expect(first).toContainText(QUESTIONS[0].answer[0])
    await page.keyboard.press('Space')
    await expect(first).not.toHaveAttribute('open', '')
  })

  test('Margin is set apart, and the page uses none of the banned wording', async ({ page }) => {
    await openApp(page, '/learn')
    await openAll(page)
    // The page itself: the footer notice belongs to the shell and has its own tests.
    const text = await page.locator('main').innerText()
    expect(findBannedWords(text, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_PRICE_TERMS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
    expect(text).not.toMatch(/[\u2014!]|[\u2190-\u21FF]/)
    // No hedge word as a caption (owner's direction of 11 Nov).
    expect(text).not.toMatch(/\b(experimental|fictional)\b/i)

    const margin = page.getByRole('region', { name: 'Margin has its own risks' })
    await expect(margin).toBeVisible()
    const marginText = await margin.innerText()
    expect(findBannedWords(marginText, [...BANNED_WORDS, 'fully collateralized', 'fully collateralised'])).toEqual([])
    await expect(margin).toContainText('partial margin')
    await expect(margin).toContainText('the deficit is recorded and shown')
    await expect(margin).toContainText('published by the team')
    // Outside that block, nothing about Margin's mechanics leaks into the Covered sections.
    await expect(page.locator('#lifecycle')).not.toContainText(/margin/i)
    await expect(page.locator('#intents')).not.toContainText(/margin/i)
  })

  test('axe finds nothing in either theme, with the disclosures closed and open', async ({ page }) => {
    await openApp(page, '/learn')
    await expectNoAxeViolations(page)
    await openAll(page)
    await expectNoAxeViolations(page, { include: '#intents' })
    await expectNoAxeViolations(page, { include: '#questions' })
  })

  test('@phone the section select names the section being read and moves focus to the one chosen', async ({ page }) => {
    await openApp(page, '/learn')
    await expect(sectionList(page)).toBeHidden()
    const select = sectionSelect(page)
    await expect(select).toBeVisible()
    await expect(select).toHaveText('1. What this is')
    expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    // Taps, as on a phone: a mouse pointer left over the list would highlight whatever opens under it later.
    const firstInstance = await select.getAttribute('id')
    await select.tap()
    await expect(page.getByRole('option')).toHaveText(SECTIONS.map((s, i) => `${i + 1}. ${s.title}`))
    await page.getByRole('option', { name: '5. What can go wrong' }).tap()
    await expect(sectionHeading(page, 'What can go wrong')).toBeFocused()
    await expect(sectionHeading(page, 'What can go wrong')).toBeInViewport()
    expect(await currentPath(page)).toBe('/learn#risks')
    await expect(select).toHaveText('5. What can go wrong')

    // The select stays at the top while the page scrolls, and follows the reader.
    await page.locator('#glossary').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(select).toBeInViewport()
    await expect(select).toHaveText('6. Glossary')
    // The heading it jumped to is not hidden under it.
    const selectBottom = await select.evaluate((el) => el.getBoundingClientRect().bottom)
    expect(await topOf(page, 'Glossary')).toBeGreaterThanOrEqual(Math.floor(selectBottom))

    // With the keyboard: open (the list opens on the section being read), move, choose. The select renews itself
    // shortly after a choice (see SectionNav); a reader cannot be back on it sooner, a test can.
    await expect(select).not.toHaveAttribute('id', firstInstance!)
    await select.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('option', { name: '6. Glossary' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(sectionHeading(page, 'Questions')).toBeFocused()
    expect(await currentPath(page)).toBe('/learn#questions')
  })

  test('@phone the page fits a phone: no sideways scroll, 44 px targets, figures inside the column', async ({ page }) => {
    await openApp(page, '/learn')
    await expectNoHorizontalOverflow(page)
    for (const summary of await page.locator('main summary').all()) {
      expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await openAll(page)
    const width = page.viewportSize()!.width
    for (const figure of await page.locator('#intents figure').all()) {
      const box = (await figure.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    // Prose tables keep their sentences on the page: none of them needs to scroll sideways.
    for (const wrap of await page.locator('main .ui-table-wrap').all()) {
      expect(await wrap.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    // On a phone a prose table stacks its rows, and each sentence says which column it belongs to.
    const sides = page.getByRole('table', { name: 'What each side locks, pays and receives for a put and for a call' })
    const firstRow = sides.getByRole('row').nth(1)
    await expect(firstRow).toContainText('Put: Sell the quantity for the strike')
    await expect(firstRow).toContainText('Call: Buy the quantity for the strike')
    // Still a table for a screen reader: the column headers are there, out of sight.
    await expect(sides.getByRole('columnheader')).toHaveCount(3)
    await expectNoHorizontalOverflow(page)
  })

  test('@phone axe finds nothing in either theme', async ({ page }) => {
    await openApp(page, '/learn')
    await expectNoAxeViolations(page)
  })
})
