// The welcome guide: the welcome on Markets, the notes of a tour, the one note that opens by itself on an asset
// page, and the two places the guide is started again (Settings from 768 px, More under it).
//
// Every other spec runs as a returning visitor (playwright.config.ts seeds the guide's mark). This one starts
// without it. Each test is a fresh context: an answer given in one test is not there in the next.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { GUIDE_COPY } from '../src/core/guide'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'
import { FIRST_VISIT, GUIDE_KEY, guideNote, guideSlip, ringed } from './guideState'
import { connect, currentPath, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, isPhone, openApp, pageHeading, routeTo, walletButton } from './helpers'

test.use({ storageState: FIRST_VISIT })

// --- What the guide says, as a reader sees it ----------------------------------------------------------------

const MARKETS_TOUR = [
  { anchor: 'intents', title: 'What do you want to do?' },
  { anchor: 'assets', title: 'Assets' },
  { anchor: 'nav', title: 'Where things are' },
  { anchor: 'wallet', title: 'Connect wallet' },
] as const
const ASSET_TOUR = ['Guided and Chain', 'Where things are', 'Connect wallet'] as const
const SHELL_TOUR = ['Where things are', 'Connect wallet'] as const

// --- Locators ------------------------------------------------------------------------------------------------

const startButton = (page: Page): Locator => page.getByRole('button', { name: GUIDE_COPY.start })
const declineButton = (page: Page): Locator => page.getByRole('button', { name: GUIDE_COPY.decline })
/** The one line the welcome leaves behind once it was answered. */
const staysLine = (page: Page): Locator => page.getByText(isPhone(page) ? GUIDE_COPY.staysPhone : GUIDE_COPY.stays, { exact: true })
const noteTitle = (page: Page): Locator => guideNote(page).getByRole('heading')
const noteButton = (page: Page, name: 'Next' | 'Back' | 'Done' | 'Close guide'): Locator => guideNote(page).getByRole('button', { name, exact: true })
const settingsButton = (page: Page): Locator => page.getByRole('button', { name: 'Settings', exact: true })
const moreButton = (page: Page): Locator => page.getByRole('button', { name: /^More\b/ })
const tabBar = (page: Page): Locator => page.locator('nav[data-tour="nav"]')
const stored = (page: Page): Promise<string | null> => page.evaluate((key) => localStorage.getItem(key), GUIDE_KEY)

interface Box {
  x: number
  y: number
  width: number
  height: number
}
async function boxOf(locator: Locator): Promise<Box> {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('The element is not on screen.')
  return rect
}
const intersect = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * The box of the open note once it has settled: a new note is placed a frame after its words change, and the
 * page may still be scrolling its control into view.
 */
async function noteBox(page: Page): Promise<Box> {
  await expect(ringed(page)).toBeInViewport()
  const read = () =>
    page.evaluate(async () => {
      const rect = () => {
        const r = document.querySelector('[data-coachmark]')?.getBoundingClientRect()
        return r ? `${r.x}|${r.y}|${r.width}|${r.height}|${window.scrollY}` : ''
      }
      const first = rect()
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return first !== '' && first === rect()
    })
  await expect.poll(read).toBe(true)
  return boxOf(guideNote(page))
}

/** Starts the guide again the way this layout offers it: the Settings menu, or the More sheet on a phone. */
async function replay(page: Page): Promise<void> {
  if (isPhone(page)) {
    await moreButton(page).click()
    const sheet = page.getByRole('dialog', { name: 'More' })
    await sheet.getByRole('button', { name: GUIDE_COPY.start }).click()
    // The note never opens over the sheet: when it is there, the sheet is gone.
    await expect(guideNote(page)).toBeVisible()
    await expect(sheet).toHaveCount(0)
  } else {
    await settingsButton(page).click()
    await page.getByRole('menuitem', { name: GUIDE_COPY.start }).click()
    await expect(guideNote(page)).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
  }
}

/** Walks an open tour to its end with the main button, checking each note's title and count on the way. */
async function walk(page: Page, expected: readonly string[]): Promise<void> {
  for (const [i, title] of expected.entries()) {
    await expect(noteTitle(page)).toHaveText(title)
    await expect(guideNote(page)).toContainText(`${i + 1} of ${expected.length}`)
    await expect(ringed(page)).toHaveCount(1)
    await noteButton(page, i === expected.length - 1 ? 'Done' : 'Next').click()
  }
  await expect(guideNote(page)).toHaveCount(0)
  await expect(ringed(page)).toHaveCount(0)
}

// --- The welcome ---------------------------------------------------------------------------------------------

test.describe('the welcome on Markets @both', () => {
  test('a first visit shows it in the page, opens nothing and takes no focus', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    await expect(startButton(page)).toBeVisible()
    await expect(declineButton(page)).toBeVisible()
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(startButton(page)).not.toBeFocused()
    expect(await stored(page)).toBeNull()

    // In the flow, between the page header and the first section, as the second heading of the page.
    const head = await boxOf(pageHeading(page))
    const welcome = await boxOf(guideSlip(page))
    const first = await boxOf(page.locator('[data-tour="intents"]'))
    expect(welcome.y).toBeGreaterThan(head.y + head.height)
    expect(first.y).toBeGreaterThan(welcome.y + welcome.height)
    expect(await page.locator('main :is(h1, h2)').allInnerTexts()).toEqual(['Markets', GUIDE_COPY.welcomeTitle, 'What do you want to do?', 'Assets'])

    // It does not move the page and nothing in it advances or opens by itself.
    await page.waitForTimeout(1200)
    await expect(guideNote(page)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })

  test('is offered on Markets only, and waits there until it is answered', async ({ page }) => {
    for (const path of ['/portfolio', '/markets/bond', '/learn', '/']) {
      await openApp(page, path)
      await expect(guideSlip(page)).toHaveCount(0)
      await expect(guideNote(page)).toHaveCount(0)
    }
    expect(await stored(page)).toBeNull()
    // Leaving the page is not an answer.
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
  })

  test('"Not now" leaves one line with focus on it, and nothing comes back', async ({ page }) => {
    await openApp(page, '/markets')
    const below = await boxOf(page.locator('[data-tour="intents"]'))
    await declineButton(page).click()
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(staysLine(page)).toBeVisible()
    await expect(staysLine(page)).toBeFocused()
    await expect(guideNote(page)).toHaveCount(0)
    expect(await stored(page)).toBe('{"tour":0}')
    // From 768 px the line takes the room the welcome had: nothing under it moved.
    if (!isPhone(page)) expect((await boxOf(page.locator('[data-tour="intents"]'))).y).toBeCloseTo(below.y, 0)

    await page.reload()
    await expect(pageHeading(page)).toBeVisible()
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(staysLine(page)).toHaveCount(0)

    // A visitor who declined never gets the note on the mode switch by itself.
    await openApp(page, '/markets/bond')
    await expect(page.locator('[data-tour="mode"]')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(guideNote(page)).toHaveCount(0)
    expect(await stored(page)).toBe('{"tour":0}')
  })

  test('gives way to the "Get test funds" strip of a wallet without balances', async ({ page }) => {
    await openApp(page, '/markets', { connect: DEMO_WALLETS.c })
    await expect(page.getByRole('region', { name: 'Get test funds' })).toBeVisible()
    await expect(guideSlip(page)).toHaveCount(0)
    expect(await stored(page)).toBeNull()
  })

  test('stays for a wallet that has balances', async ({ page }) => {
    await openApp(page, '/markets', { connect: true })
    await expect(guideSlip(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Get test funds' })).toHaveCount(0)
  })

  test('answered in another tab, it goes without a word', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    const other = await page.context().newPage()
    await openApp(other, '/markets')
    await declineButton(other).click()
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(staysLine(page)).toHaveCount(0)
    await other.close()
  })
})

// --- A tour --------------------------------------------------------------------------------------------------

test.describe('a tour of Markets @both', () => {
  test('"Show me around" opens the first note beside its control, with focus on Next', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await expect(noteTitle(page)).toHaveText('What do you want to do?')
    await expect(guideNote(page)).toContainText('1 of 4')
    await expect(noteButton(page, 'Next')).toBeFocused()
    await expect(noteButton(page, 'Back')).toHaveCount(0)
    await expect(ringed(page)).toHaveAttribute('data-tour', 'intents')

    // A dialog that is not modal: named by its title, described by the count and the body; the page stays in reach.
    await expect(guideNote(page)).toHaveRole('dialog')
    await expect(guideNote(page)).toHaveAccessibleName('What do you want to do?')
    await expect(guideNote(page)).toHaveAccessibleDescription(/^Note 1 of 4 Each row is one thing you can do here/)
    await expect(guideNote(page)).not.toHaveAttribute('aria-modal', 'true')
    expect(await page.locator('main').getAttribute('aria-hidden')).toBeNull()
    expect(await page.locator('main').getAttribute('inert')).toBeNull()
    // The control is described by the note while the note is open.
    const describedBy = (await ringed(page).getAttribute('aria-describedby')) ?? ''
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText('Each row is one thing you can do here')

    // The welcome is now its one line, and the tour is remembered.
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(staysLine(page)).toBeVisible()
    expect(await stored(page)).toBe('{"tour":1}')

    const note = await noteBox(page)
    const viewport = page.viewportSize()!
    expect(note.x).toBeGreaterThanOrEqual(0)
    expect(note.x + note.width).toBeLessThanOrEqual(viewport.width)
    if (isPhone(page)) {
      // Docked: the note sits just above the tab bar and never covers it; the mark stays on the section.
      const bar = await boxOf(tabBar(page))
      expect(note.y + note.height).toBeLessThanOrEqual(bar.y)
      expect(bar.y - (note.y + note.height)).toBeLessThan(24)
    } else {
      expect(intersect(note, await boxOf(ringed(page)))).toBe(false)
    }

    // Nothing is timed: the note is still the first one a moment later.
    await page.waitForTimeout(1500)
    await expect(guideNote(page)).toContainText('1 of 4')
  })

  test('Next to Done shows four notes, each on its own control and titled with its label', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    for (const [i, step] of MARKETS_TOUR.entries()) {
      await expect(noteTitle(page)).toHaveText(step.title)
      await expect(guideNote(page)).toContainText(`${i + 1} of 4`)
      await expect(ringed(page)).toHaveCount(1)
      await expect(ringed(page)).toHaveAttribute('data-tour', step.anchor)
      await expect(ringed(page)).toBeInViewport()
      // The title is the label the control carries on screen.
      if (step.anchor === 'intents' || step.anchor === 'assets') await expect(ringed(page).getByRole('heading', { level: 2 })).toHaveText(step.title)
      if (step.anchor === 'wallet') await expect(ringed(page)).toHaveAccessibleName(step.title)
      // The buttons are inside the viewport, and the note does not cover a control that fits beside it.
      await expect(noteButton(page, 'Close guide')).toBeInViewport({ ratio: 1 })
      await expect(noteButton(page, i === 3 ? 'Done' : 'Next')).toBeInViewport({ ratio: 1 })
      const note = await noteBox(page)
      if (!isPhone(page) || step.anchor === 'nav' || step.anchor === 'wallet') expect(intersect(note, await boxOf(ringed(page)))).toBe(false)
      if (isPhone(page) && step.anchor !== 'wallet') {
        const bar = await boxOf(tabBar(page))
        expect(note.y + note.height).toBeLessThanOrEqual(bar.y)
      }
      // Only the last note says where the guide lives afterwards.
      const closing = isPhone(page) ? 'This guide stays under More.' : 'This guide stays in Settings.'
      if (i === 3) await expect(guideNote(page)).toContainText(closing)
      else await expect(guideNote(page)).not.toContainText(closing)
      if (i < 3) {
        await noteButton(page, 'Next').click()
        await expectAnnounced(page, new RegExp(`^Note ${i + 2} of 4\\. ${MARKETS_TOUR[i + 1].title.replace('?', '\\?')}`))
      }
    }
    await noteButton(page, 'Done').click()
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(staysLine(page)).toBeFocused()
    await expectAnnounced(page, 'Guide closed.')
    // The description the note lent to its control is taken back.
    expect(await page.locator('[data-tour="wallet"]').first().getAttribute('aria-describedby')).toBeNull()
    expect(await currentPath(page)).toBe('/markets')

    await page.reload()
    await expect(pageHeading(page)).toBeVisible()
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(guideNote(page)).toHaveCount(0)
  })

  test('the navigation note names the pages; on a phone it names More too', async ({ page }) => {
    await openApp(page, '/portfolio')
    await replay(page)
    await expect(noteTitle(page)).toHaveText('Where things are')
    const terms = guideNote(page).locator('dl > div > dt')
    await expect(terms).toHaveText(isPhone(page) ? ['Portfolio', 'Requests', 'Reserves', 'More'] : ['Portfolio', 'Requests', 'Reserves'])
    await expect(guideNote(page).locator('dl > div > dd')).toHaveCount(isPhone(page) ? 4 : 3)
    if (isPhone(page)) await expect(ringed(page)).toHaveAttribute('data-coach-target', 'inset')
  })

  test('Back returns to the note before, and focus is never dropped', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Assets')
    await noteButton(page, 'Back').click()
    await expect(noteTitle(page)).toHaveText('What do you want to do?')
    await expect(guideNote(page)).toContainText('1 of 4')
    // The first note has no Back: focus went to the main button.
    await expect(noteButton(page, 'Back')).toHaveCount(0)
    await expect(noteButton(page, 'Next')).toBeFocused()
    await expectAnnounced(page, /^Note 1 of 4\. What do you want to do\? Each row/)
  })

  test('the close button ends it for good', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await noteButton(page, 'Close guide').click()
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(staysLine(page)).toBeFocused()
    await expectAnnounced(page, 'Guide closed.')
    await page.reload()
    await expect(pageHeading(page)).toBeVisible()
    await expect(guideSlip(page)).toHaveCount(0)
    await expect(guideNote(page)).toHaveCount(0)
  })

  test('a note whose control is missing or hidden is left out, and the count follows', async ({ page }) => {
    await openApp(page, '/markets')
    // One control loses its anchor, another is on the page but hidden.
    await page.evaluate(() => {
      document.querySelector('[data-tour="assets"]')?.removeAttribute('data-tour')
      for (const el of document.querySelectorAll<HTMLElement>('[data-tour="wallet"]')) el.style.display = 'none'
    })
    await startButton(page).click()
    await walk(page, ['What do you want to do?', 'Where things are'])
  })
})

// --- Keyboard ------------------------------------------------------------------------------------------------

test.describe('the guide by keyboard', () => {
  test('Tab reaches the welcome right after the top bar; Enter walks the four notes; Tab stays on the note', async ({ page }) => {
    await openApp(page, '/markets')
    // The last stop of the top bar is the wallet button; the next is the welcome's first button.
    await page.getByRole('button', { name: 'Connect wallet' }).focus()
    await page.keyboard.press('Tab')
    await expect(startButton(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(noteTitle(page)).toHaveText('What do you want to do?')
    await expect(noteButton(page, 'Next')).toBeFocused()

    // Enter keeps advancing: the main button stays mounted and keeps focus.
    for (const title of ['Assets', 'Where things are', 'Connect wallet']) {
      await page.keyboard.press('Enter')
      await expect(noteTitle(page)).toHaveText(title)
    }
    await expect(noteButton(page, 'Done')).toBeFocused()

    // Tab and Shift+Tab loop over the note's own controls, in document order: Close, Back, Done.
    await page.keyboard.press('Shift+Tab')
    await expect(noteButton(page, 'Back')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(noteButton(page, 'Close guide')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(noteButton(page, 'Done')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(noteButton(page, 'Close guide')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(noteButton(page, 'Back')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(noteButton(page, 'Done')).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(guideNote(page)).toHaveCount(0)
    await expect(staysLine(page)).toBeFocused()
  })

  test('Escape ends the tour at any note and gives focus back, never to the body', async ({ page }) => {
    await openApp(page, '/markets')
    for (let at = 0; at < MARKETS_TOUR.length; at++) {
      if (at === 0) await startButton(page).click()
      else await replay(page)
      for (let i = 0; i < at; i++) await noteButton(page, 'Next').click()
      await expect(noteTitle(page)).toHaveText(MARKETS_TOUR[at].title)
      await page.keyboard.press('Escape')
      await expect(guideNote(page)).toHaveCount(0)
      await expect(ringed(page)).toHaveCount(0)
      // From the welcome, the button that started the tour is gone: its line takes focus. After a replay, the
      // Settings button does.
      await expect(at === 0 ? staysLine(page) : settingsButton(page)).toBeFocused()
      await expectAnnounced(page, 'Guide closed.')
    }
  })

  test('Escape closes it also when focus is in the page', async ({ page }) => {
    await openApp(page, '/learn')
    await replay(page)
    // Focus leaves the note without a click: the note stays (a note is not closed by focus going elsewhere).
    await pageHeading(page).focus()
    await expect(guideNote(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(guideNote(page)).toHaveCount(0)
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false)
  })
})

// --- The page stays usable -----------------------------------------------------------------------------------

test.describe('a press outside the note @both', () => {
  test('on a section link ends the tour and follows the link', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await noteButton(page, 'Next').click()
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Where things are')
    // The marked control itself is pressed: it does what it always does.
    await ringed(page).getByRole('link', { name: /Portfolio/ }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/portfolio')
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(pageHeading(page)).toHaveText('Portfolio')
  })

  test('on a card ends the tour and opens the asset choice', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await expect(ringed(page)).toHaveAttribute('data-tour', 'intents')
    await page.getByRole('link', { name: /Set a floor/ }).first().click()
    await expect(page).toHaveURL(/intent=floor/)
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Set a floor on which asset?' })).toBeVisible()
  })

  test('on "Connect wallet" ends the tour and connects', async ({ page }) => {
    await openApp(page, '/portfolio')
    await replay(page)
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Connect wallet')
    await ringed(page).click()
    await expect(walletButton(page)).toBeVisible()
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
  })
})

test.describe('on a phone @phone', () => {
  test('a finger that scrolls the page leaves the note open; a tap outside ends the tour and lands', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await expect(noteButton(page, 'Next')).toBeVisible()
    await expect(ringed(page)).toBeInViewport()
    const before = await page.evaluate(() => window.scrollY)
    const cdp = await page.context().newCDPSession(page)
    const point = (y: number) => ({ touchPoints: [{ x: 195, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', ...point(380) })
    for (let y = 360; y >= 180; y -= 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', ...point(y) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 60)
    await expect(guideNote(page)).toBeVisible()
    await expect(guideNote(page)).toContainText('1 of 4')
    // Let the page come to rest: a tap during the glide only stops the glide.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const at = window.scrollY
          await new Promise((resolve) => setTimeout(resolve, 150))
          return at === window.scrollY
        }),
      )
      .toBe(true)
    // Still docked above the tab bar, with its button in reach.
    const bar = await boxOf(tabBar(page))
    const note = await boxOf(guideNote(page))
    expect(note.y + note.height).toBeLessThanOrEqual(bar.y)
    await expect(noteButton(page, 'Next')).toBeInViewport({ ratio: 1 })

    // A tap on the Requests tab: the tour ends and the tab opens.
    await tabBar(page).getByRole('link', { name: /Requests/ }).tap()
    await expect(page).toHaveURL((url) => url.pathname === '/requests')
    await expect(guideNote(page)).toHaveCount(0)
  })

  test('targets are 44 px: the welcome buttons and the buttons of a note', async ({ page }) => {
    await openApp(page, '/markets')
    for (const button of [startButton(page), declineButton(page)]) expect((await boxOf(button)).height).toBeGreaterThanOrEqual(44)
    await startButton(page).click()
    await noteButton(page, 'Next').click()
    for (const name of ['Next', 'Back', 'Close guide'] as const) {
      const box = await boxOf(noteButton(page, name))
      expect(box.height, name).toBeGreaterThanOrEqual(44)
      expect(box.width, name).toBeGreaterThanOrEqual(44)
    }
  })

  test('the entry under More is the last row of the list of pages', async ({ page }) => {
    await openApp(page, '/learn')
    await moreButton(page).click()
    const sheet = page.getByRole('dialog', { name: 'More' })
    const row = sheet.getByRole('button', { name: GUIDE_COPY.start })
    const list = await boxOf(sheet.getByRole('menu'))
    const lastPage = await boxOf(sheet.getByRole('menuitem').last())
    const entry = await boxOf(row)
    // Flush under the list, with the look of its rows; above the settings.
    expect(Math.abs(entry.y - (list.y + list.height))).toBeLessThanOrEqual(1)
    expect(entry.height).toBeCloseTo(lastPage.height, 0)
    expect(entry.x).toBeCloseTo(lastPage.x, 0)
    expect(entry.width).toBeCloseTo(lastPage.width, 0)
    expect((await boxOf(sheet.getByRole('heading', { name: 'Settings' }))).y).toBeGreaterThan(entry.y + entry.height)
    // The pages are still a menu of four; the guide is a button, not a page.
    await expect(sheet.getByRole('menuitem')).toHaveText(['Learn', 'Margin', 'Issuer', 'Activity'])
  })
})

// --- Starting it again ---------------------------------------------------------------------------------------

test.describe('"Show me around" in Settings, or under More on a phone @both', () => {
  for (const { path, titles } of [
    { path: '/markets', titles: MARKETS_TOUR.map((step) => step.title) },
    { path: '/markets/bond', titles: ASSET_TOUR },
    { path: '/portfolio', titles: SHELL_TOUR },
  ] as const) {
    test(`on ${path} shows the ${titles.length} notes of that page and stays on it`, async ({ page }) => {
      await openApp(page, path)
      await replay(page)
      await expect(noteButton(page, titles.length > 1 ? 'Next' : 'Done')).toBeFocused()
      // Started from Settings with the welcome still offered: the welcome becomes its line.
      if (path === '/markets') {
        await expect(guideSlip(page)).toHaveCount(0)
        await expect(staysLine(page)).toBeVisible()
      }
      await walk(page, titles)
      expect(await currentPath(page)).toBe(path)
      // Focus is back on what opened the menu or the sheet.
      await expect(isPhone(page) ? moreButton(page) : settingsButton(page)).toBeFocused()
      expect(await stored(page)).toBe(path === '/markets/bond' ? '{"tour":1,"mode":1}' : '{"tour":1}')

      // Any number of times.
      await replay(page)
      await expect(noteTitle(page)).toHaveText(titles[0])
      await expect(guideNote(page)).toContainText(`1 of ${titles.length}`)
    })
  }

  test('with a wallet connected, the last note is about the wallet menu', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: true })
    await replay(page)
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Wallet menu')
    await expect(guideNote(page)).toContainText('2 of 2')
    await expect(guideNote(page)).toContainText('Disconnect is here too.')
    await expect(ringed(page)).toHaveAccessibleName(/^Wallet menu/)
    await expect(ringed(page)).toHaveAttribute('data-tour', 'wallet')
  })

  test('the entry is in the same place on every page', async ({ page }) => {
    for (const path of ['/markets', '/markets/bond', '/portfolio', '/reserves', '/learn', '/activity']) {
      await openApp(page, path)
      if (isPhone(page)) {
        await moreButton(page).click()
        await expect(page.getByRole('dialog', { name: 'More' }).getByRole('button', { name: GUIDE_COPY.start })).toBeVisible()
      } else {
        await settingsButton(page).click()
        const menu = page.getByRole('menu')
        await expect(menu.getByRole('group', { name: GUIDE_COPY.group }).getByRole('menuitem')).toHaveText([GUIDE_COPY.start])
        // On screen without scrolling the menu.
        await expect(menu.getByRole('menuitem', { name: GUIDE_COPY.start })).toBeInViewport({ ratio: 1 })
        // After the two groups of settings (theme, gain and loss colours), as the last row.
        await expect(menu.getByRole('menuitemradio')).toHaveCount(6)
        await expect(menu.locator('[role^="menuitem"]').last()).toHaveText(GUIDE_COPY.start)
      }
      await page.keyboard.press('Escape')
    }
  })
})

// --- The one note that opens by itself -----------------------------------------------------------------------

/** A visitor who took the tour earlier and has not seen the note on the mode switch. */
const TOOK_THE_TOUR = '{"tour":1}'
async function seedTourTaken(page: Page): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.getItem(key) ?? localStorage.setItem(key, value), [GUIDE_KEY, TOOK_THE_TOUR])
}

test.describe('the note on the mode switch @both', () => {
  test('opens once, on the first asset page after a tour, and takes no focus', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await noteButton(page, 'Close guide').click()
    await expect(guideNote(page)).toHaveCount(0)

    await page.getByRole('link', { name: /^Trade [A-Z]+$/ }).first().click()
    await expect(page).toHaveURL(/\/markets\/[a-z]+$/)
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
    await expect(ringed(page)).toHaveAttribute('data-tour', 'mode')
    // Alone: no count, no Next, and focus is still where the router put it.
    await expect(guideNote(page)).not.toContainText(/\d of \d/)
    await expect(noteButton(page, 'Next')).toHaveCount(0)
    await expect(noteButton(page, 'Done')).toBeVisible()
    await expect(pageHeading(page)).toBeFocused()
    await expectAnnounced(page, /^Note\. Guided and Chain\. Guided asks what you want .* Press Escape to close\.$/)
    expect(intersect(await noteBox(page), await boxOf(ringed(page)))).toBe(false)
    expect(await stored(page)).toBe('{"tour":1,"mode":1}')

    // Escape closes it without moving focus.
    await page.keyboard.press('Escape')
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    await expect(pageHeading(page)).toBeFocused()

    // Never a second time.
    await routeTo(page, '/markets/eqty')
    await expect(page.locator('[data-tour="mode"]')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(guideNote(page)).toHaveCount(0)
  })

  test('using the switch closes it, and the switch works', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/bond')
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
    await ringed(page).getByRole('radio', { name: 'Chain' }).check({ force: true })
    await expect(page).toHaveURL(/mode=chain/)
    await expect(guideNote(page)).toHaveCount(0)
  })

  test('Done closes it and gives focus back to the page', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/bond')
    await noteButton(page, 'Done').click()
    await expect(guideNote(page)).toHaveCount(0)
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false)
  })

  test('does not open over an order ticket, and is not recorded then', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/fund?side=write&kind=put')
    await expect(page.getByRole('heading', { name: 'Write a put on FUND' })).toBeVisible()
    await page.waitForTimeout(800)
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
    expect(await stored(page)).toBe(TOOK_THE_TOUR)
  })

  test('does not open when the switch is outside the viewport, and a later asset page shows it', async ({ page }) => {
    test.skip(isPhone(page), 'The viewport is resized: one layout is enough.')
    await seedTourTaken(page)
    await page.setViewportSize({ width: 1440, height: 240 })
    await openApp(page, '/markets/bond')
    await expect(page.locator('[data-tour="mode"]')).toBeAttached()
    await expect(page.locator('[data-tour="mode"]')).not.toBeInViewport({ ratio: 1 })
    await page.waitForTimeout(800)
    await expect(guideNote(page)).toHaveCount(0)
    expect(await stored(page)).toBe(TOOK_THE_TOUR)
    // The page is never scrolled to make room for it.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.setViewportSize({ width: 1440, height: 900 })
    await routeTo(page, '/markets/fund')
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
  })

  test('does not open on the Requests or About tab', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/bond?tab=about')
    await page.waitForTimeout(800)
    await expect(guideNote(page)).toHaveCount(0)
    expect(await stored(page)).toBe(TOOK_THE_TOUR)
  })
})

test.describe('the note on the mode switch and other overlays', () => {
  test('does not open while a menu is open; a later asset page shows it', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets')
    await settingsButton(page).click()
    await expect(page.getByRole('menu')).toBeVisible()
    // The address changes under the open menu (the router is driven directly: a click would close the menu).
    await routeTo(page, '/markets/bond')
    await expect(page.locator('[data-tour="mode"]')).toBeVisible()
    await page.waitForTimeout(800)
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(guideNote(page)).toHaveCount(0)
    expect(await stored(page)).toBe(TOOK_THE_TOUR)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await routeTo(page, '/markets/fund')
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
  })

  test('a tour started beside an open order never puts a note on it', async ({ page }) => {
    await openApp(page, '/markets/fund?side=write&kind=put')
    const rail = page.getByRole('complementary', { name: 'Order ticket' })
    await expect(rail.getByRole('heading', { name: 'Write a put on FUND' })).toBeVisible()
    await replay(page)
    for (const [i, title] of ASSET_TOUR.entries()) {
      await expect(noteTitle(page)).toHaveText(title)
      expect(intersect(await noteBox(page), await boxOf(rail.getByTestId('ticket'))), `the "${title}" note covers the order`).toBe(false)
      await noteButton(page, i === ASSET_TOUR.length - 1 ? 'Done' : 'Next').click()
    }
    // The order is as it was: same address, same ticket.
    await expect(page).toHaveURL(/side=write/)
    await expect(rail.getByRole('heading', { name: 'Write a put on FUND' })).toBeVisible()
  })
})

// --- Layout changes and storage ------------------------------------------------------------------------------

test.describe('when the page changes under a note', () => {
  test('crossing 768 px moves the mark to the tab bar and keeps the note', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await noteButton(page, 'Next').click()
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Where things are')
    await expect(ringed(page)).toHaveAttribute('data-coach-target', '')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(ringed(page)).toHaveAttribute('data-coach-target', 'inset')
    await expect(ringed(page)).toHaveAttribute('data-tour', 'nav')
    await expect(noteTitle(page)).toHaveText('Where things are')
    await expect(guideNote(page)).toContainText('3 of 4')
    // The phone's fifth tab is named now.
    await expect(guideNote(page).locator('dt')).toHaveText(['Portfolio', 'Requests', 'Reserves', 'More'])
    const note = await noteBox(page)
    const bar = await boxOf(ringed(page))
    expect(note.y + note.height).toBeLessThanOrEqual(bar.y)
    await expect(noteButton(page, 'Next')).toBeInViewport({ ratio: 1 })
  })

  test('a control that leaves the page hands the note on; when none is left the tour ends', async ({ page }) => {
    await openApp(page, '/portfolio')
    await replay(page)
    await expect(noteTitle(page)).toHaveText('Where things are')
    await expect(guideNote(page)).toContainText('1 of 2')
    // The control of the note on screen goes: the next note that has one takes over, and the count follows.
    await page.evaluate(() => document.querySelector('[data-tour="nav"]')?.setAttribute('hidden', ''))
    await expect(noteTitle(page)).toHaveText('Connect wallet')
    await expect(guideNote(page)).toContainText('1 of 1')
    await expect(noteButton(page, 'Done')).toBeVisible()
    // The last one goes too: the tour ends and focus is given back, not dropped.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-tour="wallet"]')) el.setAttribute('hidden', '')
    })
    await expect(guideNote(page)).toHaveCount(0)
    await expectAnnounced(page, 'Guide closed.')
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false)
  })

  test('leaving the page by the back button ends the tour', async ({ page }) => {
    await openApp(page, '/markets')
    await routeTo(page, '/portfolio')
    await expect(pageHeading(page)).toHaveText('Portfolio')
    await replay(page)
    await page.goBack()
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
    await expect(guideNote(page)).toHaveCount(0)
    await expect(ringed(page)).toHaveCount(0)
  })
})

test.describe('scrolling under a note', () => {
  // A short window: the Markets page is then long enough to scroll its first section off the screen (the page is
  // about 1,000 px tall at this width, so the window must be well under half of it).
  test.use({ viewport: { width: 1440, height: 400 } })

  test('scrolling with the wheel leaves the note open, and its buttons stay in reach', async ({ page }) => {
    await openApp(page, '/markets')
    await startButton(page).click()
    await expect(noteButton(page, 'Next')).toBeFocused()
    await noteBox(page)
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(700, 450)
    await page.mouse.wheel(0, 120)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
    await expect(guideNote(page)).toContainText('1 of 4')
    // Scrolled until the marked section has left the screen: the note waits at the edge of the viewport.
    await page.mouse.wheel(0, 2000)
    await expect(page.locator('[data-tour="intents"]')).not.toBeInViewport()
    await expect(noteTitle(page)).toHaveText('What do you want to do?')
    await expect(noteButton(page, 'Next')).toBeInViewport({ ratio: 1 })
    await expect(noteButton(page, 'Close guide')).toBeInViewport({ ratio: 1 })
    await expect(noteButton(page, 'Next')).toBeFocused()
  })
})

test.describe('where storage is blocked @both', () => {
  test('there is no welcome and no note by itself; the entry in Settings still runs the tour', async ({ page }) => {
    // Reading works, writing does not: an answer could never be put away for good.
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
    })
    await openApp(page, '/markets')
    await expect(page.locator('[data-tour="intents"]')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(guideSlip(page)).toHaveCount(0)
    await replay(page)
    await walk(page, MARKETS_TOUR.map((step) => step.title))
    expect(await stored(page)).toBeNull()
    // Nothing was remembered, so nothing opens by itself on an asset page either.
    await routeTo(page, '/markets/bond')
    await expect(page.locator('[data-tour="mode"]')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(guideNote(page)).toHaveCount(0)
  })
})

test.describe('where reaching for storage throws @both', () => {
  test('there is no welcome; the entry still runs the tour', async ({ page }) => {
    // What a browser does with site data blocked: the property itself throws.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    await openApp(page, '/markets')
    await expect(page.locator('[data-tour="intents"]')).toBeVisible()
    await page.waitForTimeout(600)
    await expect(guideSlip(page)).toHaveCount(0)
    await replay(page)
    await walk(page, MARKETS_TOUR.map((step) => step.title))
  })
})

// --- Accessibility and reflow --------------------------------------------------------------------------------

test.describe('axe and reflow @both', () => {
  test('the welcome, and its line, are clean in both themes', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    await expectNoAxeViolations(page)
    await expectNoHorizontalOverflow(page)
    await declineButton(page).click()
    await expect(staysLine(page)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('each of the four notes is clean in both themes', async ({ page }) => {
    test.slow()
    await openApp(page, '/markets')
    await startButton(page).click()
    for (const [i, step] of MARKETS_TOUR.entries()) {
      await expect(noteTitle(page)).toHaveText(step.title)
      await expect(noteButton(page, i === 3 ? 'Done' : 'Next')).toBeInViewport({ ratio: 1 })
      await expectNoAxeViolations(page)
      await expectNoHorizontalOverflow(page)
      // The scan switches themes, which is not a press: the note is still there.
      await expect(noteTitle(page)).toHaveText(step.title)
      if (i < 3) await noteButton(page, 'Next').click()
    }
  })

  test('the wallet-menu note and the mode note are clean in both themes', async ({ page }) => {
    test.slow()
    await seedTourTaken(page)
    await openApp(page, '/markets/bond', { connect: true })
    // Connecting is a press outside: if the note had opened, it is closed now. Start from a known state.
    await page.keyboard.press('Escape')
    await replay(page)
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
    await expectNoAxeViolations(page)
    await noteButton(page, 'Next').click()
    await noteButton(page, 'Next').click()
    await expect(noteTitle(page)).toHaveText('Wallet menu')
    await expectNoAxeViolations(page)
    await expectNoHorizontalOverflow(page)
  })

  test('the note that opens by itself is clean in both themes', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/bond')
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
    await expectNoAxeViolations(page)
    await expectNoHorizontalOverflow(page)
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
  })
})

test.describe('at 320 by 640 @phone', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('the welcome and every note fit: no sideways scroll, every button in reach', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expect(startButton(page)).toBeInViewport({ ratio: 1 })
    await startButton(page).click()
    for (const [i, step] of MARKETS_TOUR.entries()) {
      await expect(noteTitle(page)).toHaveText(step.title)
      await expectNoHorizontalOverflow(page)
      const note = await noteBox(page)
      expect(note.x).toBeGreaterThanOrEqual(0)
      expect(note.x + note.width).toBeLessThanOrEqual(320)
      expect(note.y).toBeGreaterThanOrEqual(0)
      expect(note.y + note.height).toBeLessThanOrEqual(640)
      for (const name of i === 0 ? (['Close guide', 'Next'] as const) : i === 3 ? (['Close guide', 'Back', 'Done'] as const) : (['Close guide', 'Back', 'Next'] as const)) {
        await expect(noteButton(page, name)).toBeInViewport({ ratio: 1 })
      }
      // Nothing of the note's words is cut off: its body does not need to scroll.
      expect(await guideNote(page).locator('div[id]').first().evaluate((body) => body.scrollHeight <= body.clientHeight + 1)).toBe(true)
      if (i < 3) await noteButton(page, 'Next').click()
    }
  })

  test('the mode note fits beside the switch', async ({ page }) => {
    await seedTourTaken(page)
    await openApp(page, '/markets/bond')
    await expect(noteTitle(page)).toHaveText('Guided and Chain')
    // The note is inside the screen and clear of the switch. (The page's own width at 320 px is the markets
    // spec's business, not this one's.)
    const note = await noteBox(page)
    expect(note.x).toBeGreaterThanOrEqual(0)
    expect(note.x + note.width).toBeLessThanOrEqual(320)
    expect(intersect(note, await boxOf(ringed(page)))).toBe(false)
    await expect(noteButton(page, 'Done')).toBeInViewport({ ratio: 1 })
  })
})

test.describe('zoomed to 200 % on a 1280 px window', () => {
  // 200 % zoom of a 1280 px window is a 640 px layout: the phone layout, drawn large.
  test.use({ viewport: { width: 640, height: 450 } })

  test('the welcome and the notes reflow without a sideways scroll', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await startButton(page).click()
    for (const [i, step] of MARKETS_TOUR.entries()) {
      await expect(noteTitle(page)).toHaveText(step.title)
      await expectNoHorizontalOverflow(page)
      await expect(noteButton(page, 'Close guide')).toBeInViewport({ ratio: 1 })
      await expect(noteButton(page, i === 3 ? 'Done' : 'Next')).toBeInViewport({ ratio: 1 })
      if (i < 3) await noteButton(page, 'Next').click()
    }
  })
})

test.describe('with a wallet connected @both', () => {
  test('the tour of Markets ends on the wallet menu', async ({ page }) => {
    await openApp(page, '/markets', { connect: true })
    await expect(guideSlip(page)).toBeVisible()
    await startButton(page).click()
    await walk(page, ['What do you want to do?', 'Assets', 'Where things are', 'Wallet menu'])
    await expect(staysLine(page)).toBeFocused()
  })

  test('after a connect, the welcome is still there to be answered', async ({ page }) => {
    await openApp(page, '/markets')
    await expect(guideSlip(page)).toBeVisible()
    await connect(page)
    await expect(guideSlip(page)).toBeVisible()
    await declineButton(page).click()
    await expect(staysLine(page)).toBeFocused()
  })
})
