// The app chrome: top bar, tab bar, More, settings, network indicator, wallet menu, connect dialog, banners, footer.
// The router's side of the shell (titles, focus on navigation, error pages) is in shell-router.spec.ts.
//
// Runs on the mock chain with the test wallet, like the rest of the suite. The states that build never reaches
// (the wallet picker, the wrong-network banner, late or failing reads, a footer with contract ids) are staged on
// the dev-only page src/features/shell/specimens/specimens.html.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { BANNED_TAGLINES, BANNED_WORDS, COPYRIGHT_NOTICE, LEGAL_NOTICE, WALLET_DISCLOSURE, findBannedWords, legalNotice } from '../src/core/disclosures'
import { connect, connectButton, expectAnnounced, expectNoAxeViolations, isPhone, openApp, pageHeading, walletButton } from './helpers'

const SPECIMENS = '/src/features/shell/specimens/specimens.html'

/** The suite runs on the mock chain: the footer carries the notice of a build without a contract. */
const NOTICE = legalNotice(true)

/** Everything except the page itself: the bars, the footer, and whatever the chrome has portalled into body. */
const CHROME_ONLY = { exclude: ['main#main'] } as const
/**
 * The same scan while a menu of the ui kit is open. The kit portals a menu popup to the end of <body>, outside
 * every landmark, and axe's best-practice rule `region` reports that. A menu is reached from its trigger and
 * holds focus while it is open, so the rule is switched off for these scans only.
 */
const CHROME_WITH_MENU = { ...CHROME_ONLY, disableRules: ['region'] } as const

const mainNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Main' })
const footer = (page: Page): Locator => page.locator('footer.shell-footer')
const settingsButton = (page: Page): Locator => page.getByRole('button', { name: 'Settings', exact: true })
/** The network indicator: plain text in the top bar, not a control. */
const indicator = (page: Page): Locator => page.locator('header').first().getByText(/^(Mock data|Testnet\b.*|Reads are late|No connection)$/)
const moreButton = (page: Page): Locator => page.getByRole('button', { name: /^More\b/ })
const box = async (locator: Locator) => {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('The element is not on screen.')
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
}
const theme = (page: Page) => page.locator('html').getAttribute('data-theme')
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('stellsec.settings.v1') ?? '{}') as Record<string, string>)

test.describe('desktop top bar', () => {
  test('the tab order is skip link, logo, sections, tools, wallet', async ({ page }) => {
    await openApp(page, '/learn')
    const order: Locator[] = [
      page.getByRole('link', { name: 'Skip to content' }),
      page.getByRole('link', { name: 'StellSec home' }),
      mainNav(page).getByRole('link', { name: 'Markets' }),
      mainNav(page).getByRole('link', { name: 'Portfolio' }),
      mainNav(page).getByRole('link', { name: 'Requests' }),
      mainNav(page).getByRole('link', { name: 'Reserves' }),
      page.getByRole('navigation', { name: 'Secondary' }).getByRole('link', { name: 'Learn' }),
      page.getByRole('navigation', { name: 'Secondary' }).getByRole('link', { name: 'Margin' }),
      // The network indicator is text, not a stop.
      settingsButton(page),
      connectButton(page),
    ]
    for (const stop of order) {
      await page.keyboard.press('Tab')
      await expect(stop).toBeFocused()
    }
    // The next stop is inside the page, not more chrome.
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('main')?.id)).toBe('main')
  })

  test('the skip link moves focus to the page', async ({ page }) => {
    await openApp(page, '/learn')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeFocused()
  })

  test('the current section carries aria-current, also on its sub-pages', async ({ page }) => {
    await openApp(page, '/markets')
    const links = mainNav(page).getByRole('link')
    await expect(links).toHaveText([/^Markets/, /^Portfolio/, /^Requests/, /^Reserves/])
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText('Markets')

    await mainNav(page).getByRole('link', { name: 'Reserves' }).click()
    await expect(page).toHaveURL(/\/reserves$/)
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText('Reserves')

    await page.goto('/markets/bond')
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText('Markets')

    // Margin opens on its entry warning, a modal: the bar behind it is read from the DOM, not by role.
    await page.goto('/margin/vault')
    await expect(page.locator('header a[aria-current="page"]')).toHaveText('Margin')
  })

  test('the logo links to the landing page and is never marked current', async ({ page }) => {
    await openApp(page, '/learn')
    const logo = page.getByRole('link', { name: 'StellSec home' })
    await expect(logo).toHaveAttribute('href', /^\/(\?.*)?$/)
    await expect(logo).not.toHaveAttribute('aria-current', /.*/)
  })

  test('Portfolio carries the count of actions waiting in its name once a wallet is connected', async ({ page }) => {
    await openApp(page, '/learn')
    const portfolio = mainNav(page).getByRole('link', { name: /^Portfolio/ })
    await expect(portfolio).toHaveAccessibleName('Portfolio')
    await connect(page)
    await expect(portfolio).toHaveAccessibleName(/^Portfolio \d+ actions? waiting$/)
  })

  test('the bar does not move between a short page and a long one', async ({ page }) => {
    await openApp(page, '/learn')
    const logo = page.getByRole('link', { name: 'StellSec home' })
    const before = { logo: await box(logo), wallet: await box(connectButton(page)), reserves: await box(mainNav(page).getByRole('link', { name: 'Reserves' })) }
    for (const name of ['Requests', 'Reserves', 'Markets'] as const) {
      await mainNav(page).getByRole('link', { name }).click()
      await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText(name)
      await expect(pageHeading(page)).toBeVisible()
      expect({ logo: await box(logo), wallet: await box(connectButton(page)), reserves: await box(mainNav(page).getByRole('link', { name: 'Reserves' })) }, name).toEqual(before)
    }
  })

  test('the chrome passes axe in both themes, as a guest and connected', async ({ page }) => {
    await openApp(page, '/learn')
    await expectNoAxeViolations(page, CHROME_ONLY)
    await connect(page)
    await expectNoAxeViolations(page, CHROME_ONLY)
  })
})

test.describe('settings menu', () => {
  test('the theme is chosen by keyboard, applies at once and survives a reload', async ({ page }) => {
    await openApp(page, '/learn')
    await settingsButton(page).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')

    // Arrow keys move through the radio items; Enter chooses and the menu stays open.
    const dark = menu.getByRole('menuitemradio', { name: 'Dark' })
    for (let i = 0; i < 8 && !(await dark.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown')
    await expect(dark).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dark).toHaveAttribute('aria-checked', 'true')
    expect(await theme(page)).toBe('dark')
    await expect(menu).toBeVisible()

    // Escape closes the menu and gives focus back to the button.
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(settingsButton(page)).toBeFocused()

    await page.reload()
    await expect(pageHeading(page)).toBeVisible()
    expect(await theme(page)).toBe('dark')
    expect((await stored(page)).theme).toBe('dark')
  })

  test('the gain and loss colours are set on the document and stored; there is no density setting', async ({ page }) => {
    await openApp(page, '/learn')
    await settingsButton(page).click()
    const menu = page.getByRole('menu')
    for (const name of ['Theme', 'Gain and loss colours', 'Guide']) await expect(menu.getByRole('group', { name }).first()).toBeVisible()
    await expect(menu.getByRole('group', { name: 'Table density' })).toHaveCount(0)
    await expect(menu).not.toContainText('Table density')
    await menu.getByRole('menuitemradio', { name: 'Green and red' }).click()
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-pnl', 'classic')
    expect(await stored(page)).toMatchObject({ pnl: 'classic' })

    await menu.getByRole('menuitemradio', { name: 'Ink only' }).click()
    await expect(html).toHaveAttribute('data-pnl', 'mono')
    await menu.getByRole('menuitemradio', { name: 'Light' }).click()
    expect(await theme(page)).toBe('light')
  })

  test('every row of the menu lies inside its box, the last one included', async ({ page }) => {
    await openApp(page, '/learn')
    await settingsButton(page).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const fits = await menu.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const items = [...el.querySelectorAll('[role^="menuitem"]')]
      const last = items[items.length - 1].getBoundingClientRect()
      return { scrolls: el.scrollHeight > el.clientHeight + 1, inside: last.bottom <= box.bottom + 0.5 && last.top >= box.top - 0.5 }
    })
    expect(fits).toEqual({ scrolls: false, inside: true })
  })

  test('the open menu passes axe in both themes', async ({ page }) => {
    await openApp(page, '/learn')
    await settingsButton(page).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectNoAxeViolations(page, CHROME_WITH_MENU)
  })
})

test.describe('network indicator', () => {
  test('a build without a contract reads "Mock data", as plain text in the bar @both', async ({ page }) => {
    await openApp(page, '/learn')
    await expect(indicator(page)).toHaveText('Mock data')
    await expect(indicator(page)).toBeVisible()
    // Words, not a control: no box, no dot, nothing to press.
    expect(await indicator(page).evaluate((el) => ({ tag: el.tagName, border: getComputedStyle(el).borderTopWidth, role: el.getAttribute('role') }))).toEqual({ tag: 'P', border: '0px', role: null })
    await expect(page.locator('header').first().getByRole('button', { name: /network|data source/i })).toHaveCount(0)
    // Named once in the chrome.
    expect((await page.locator('header').first().innerText()).split('Mock data').length - 1).toBe(1)
  })
})

test.describe('wallet menu', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('shows the address, the balances and the way out, by keyboard @both', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    await expect(walletButton(page)).toHaveAccessibleName(/^Wallet menu, GBE6.3ZEG$/)
    await walletButton(page).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem')).toHaveText([/Copy address/, /Refresh balances/, /Activity/, /Disconnect/])

    // The balances of the default test wallet, exact, and the same figures in the name of their group.
    await expect(menu).toContainText('USDx2,500.00')
    await expect(menu.getByRole('group', { name: /^Balances\s*USDx 2,500\.00, RWA 120\.00, BOND 12\.00, EQTY 40\.00$/ })).toBeVisible()

    // Every row is in view, Disconnect included.
    await expect(menu.getByRole('menuitem', { name: 'Disconnect' })).toBeInViewport({ ratio: 1 })

    await menu.getByRole('menuitem', { name: /Copy address/ }).click()
    await expectAnnounced(page, 'Address copied.')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^G[A-Z2-7]{55}$/)
    await expect(menu).toBeVisible()

    await menu.getByRole('menuitem', { name: 'Refresh balances' }).click()
    await expectAnnounced(page, 'Balances refreshed.')

    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Disconnect' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expectAnnounced(page, 'Wallet disconnected.')
    // The button that had focus is gone: focus lands on the one that replaced it.
    await expect(connectButton(page)).toBeFocused()
  })

  test('connecting by keyboard announces the wallet and keeps focus on the wallet control @both', async ({ page }) => {
    await openApp(page, '/learn')
    await connectButton(page).focus()
    await page.keyboard.press('Enter')
    await expectAnnounced(page, /^Wallet connected: GBE6.3ZEG\.$/)
    await expect(walletButton(page)).toBeFocused()
  })

  test('Activity in the menu opens the Activity page and closes the menu', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: /^Activity/ }).click()
    await expect(page).toHaveURL(/\/activity$/)
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(pageHeading(page)).toHaveText('Activity')
  })

  test('the open menu passes axe in both themes @both', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    await walletButton(page).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectNoAxeViolations(page, CHROME_WITH_MENU)
  })
})

test.describe('footer', () => {
  const routes = ['/markets', '/requests', '/reserves', '/activity', '/issuer', '/learn', '/design', '/margin']

  test('is the legal footer on every app route, once, with no taglines @both', async ({ page }) => {
    for (const path of routes) {
      await page.goto(path)
      await expect(footer(page), path).toHaveCount(1)
      const text = await footer(page).innerText()
      expect(text.split(COPYRIGHT_NOTICE).length - 1, `${path}: copyright line`).toBe(1)
      expect(text.split(NOTICE).length - 1, `${path}: legal notice`).toBe(1)
      // One paragraph: the notice of a build on a contract is not stacked under it.
      expect(text, `${path}: one notice`).not.toContain(LEGAL_NOTICE)
      expect(text.indexOf(COPYRIGHT_NOTICE), `${path}: the copyright line comes first`).toBeLessThan(text.indexOf(NOTICE))
    }
  })

  test('the chrome uses no banned wording and no disclaimer taglines @both', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    const chrome = `${await page.locator('header').first().innerText()}\n${await footer(page).innerText()}\n${isPhone(page) ? await mainNav(page).innerText() : ''}`
    expect(findBannedWords(chrome, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(chrome, BANNED_TAGLINES)).toEqual([])
    expect(chrome.toLowerCase()).not.toContain('experimental')
    expect(chrome).not.toMatch(/[—→!]/)
  })

  test('links to Learn, Reserves, Issuer and the repository; the gallery keeps its address but no link', async ({ page }) => {
    await openApp(page, '/markets')
    const nav = footer(page).getByRole('navigation', { name: 'Footer' })
    await expect(nav.getByRole('link')).toHaveText([/^Learn$/, /^Reserves$/, /^Issuer$/, /^GitHub/])
    const github = nav.getByRole('link', { name: /^GitHub/ })
    await expect(github).toHaveAttribute('target', '_blank')
    await expect(github).toHaveAttribute('rel', /noopener/)
    await expect(github).toHaveAccessibleName(/opens in a new tab/)
    await nav.getByRole('link', { name: 'Reserves' }).click()
    await expect(page).toHaveURL(/\/reserves$/)
    await expect(pageHeading(page)).toBeFocused()
    await page.goto('/design')
    await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible()
  })
})

test.describe('tablet widths', () => {
  for (const width of [768, 900, 1199]) {
    test(`the bar holds at ${width} px without overflow, guest and connected`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await openApp(page, '/learn')
      const fits = async () => {
        const bar = page.locator('header').first()
        const edges = await bar.evaluate((el) => [...el.querySelectorAll('a, button')].map((node) => Math.round(node.getBoundingClientRect().right)))
        expect(Math.max(...edges)).toBeLessThanOrEqual(width)
        // No two controls of the bar overlap.
        const overlaps = await bar.evaluate((el) => {
          const rects = [...el.querySelectorAll('a, button')].map((node) => node.getBoundingClientRect()).sort((a, b) => a.left - b.left)
          return rects.some((rect, i) => i > 0 && rect.left < rects[i - 1].right - 0.5)
        })
        expect(overlaps).toBe(false)
      }
      await fits()
      await connect(page)
      await fits()
    })
  }

  test('from 900 px Learn and Margin are in the bar, and there is no More', async ({ page }) => {
    for (const width of [900, 1199]) {
      await page.setViewportSize({ width, height: 800 })
      await openApp(page, '/markets')
      const secondary = page.getByRole('navigation', { name: 'Secondary' })
      await expect(secondary.getByRole('link')).toHaveText(['Learn', 'Margin'])
      await expect(moreButton(page)).toHaveCount(0)
      await expect(indicator(page)).toHaveText('Mock data')
    }
  })

  test('from 768 to 899 px Learn, Margin, Issuer and Activity fold into the More menu, by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 800 })
    await openApp(page, '/markets')
    await expect(page.getByRole('navigation', { name: 'Secondary' })).toHaveCount(0)
    await moreButton(page).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem')).toHaveText(['Learn', 'Margin', 'Issuer', 'Activity'])
    await expectNoAxeViolations(page, CHROME_WITH_MENU)
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Activity' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/activity$/)
    await expect(moreButton(page)).toHaveAttribute('aria-current', 'true')
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0)
  })
})

test.describe('phone chrome @phone', () => {
  test('the top bar holds the logo, the network and the wallet; the tab bar holds five tabs and names the section', async ({ page }) => {
    await openApp(page, '/requests')
    const bar = page.locator('header').first()
    await expect(bar.getByRole('link', { name: 'StellSec home' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'StellSec home' })).toContainText('StellSec')
    // The tab bar names the section; the top bar does not repeat it.
    await expect(bar).not.toContainText('Requests')
    await expect(indicator(page)).toBeVisible()
    await expect(connectButton(page)).toHaveText('Connect wallet')
    await expect(settingsButton(page)).toHaveCount(0)

    const tabs = mainNav(page).locator('a, button')
    await expect(tabs).toHaveText(['Markets', 'Portfolio', 'Requests', 'Reserves', 'More'])
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveText('Requests')
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('every control of the chrome is a 44 px target', async ({ page }) => {
    await openApp(page, '/requests', { connect: true })
    for (const tab of await mainNav(page).locator('a, button').all()) {
      const rect = await box(tab)
      expect(rect.height).toBeGreaterThanOrEqual(44)
      expect(rect.width).toBeGreaterThanOrEqual(44)
    }
    // The wallet button keeps the 28 px look of the bar; its hit area is extended to 44 px. The logo is 44 px tall.
    for (const control of [walletButton(page), page.getByRole('link', { name: 'StellSec home' })]) {
      const rect = await box(control)
      const mid = rect.x + rect.width / 2
      const centre = rect.y + rect.height / 2
      for (const y of [centre - 21, centre + 21]) {
        const hit = await control.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), { x: mid, y })
        expect(hit, `${await control.getAttribute('class')} at ${y}`).toBe(true)
      }
    }
    for (const link of await footer(page).getByRole('navigation').getByRole('link').all()) expect((await box(link)).height).toBeGreaterThanOrEqual(44)
  })

  test('the chrome does not overflow sideways and the tab bar does not cover the footer', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    const width = page.viewportSize()?.width ?? 390
    for (const part of [page.locator('header').first(), mainNav(page), footer(page)]) {
      const edges = await part.evaluate((el) => [el, ...el.querySelectorAll('*')].map((node) => Math.round(node.getBoundingClientRect().right)))
      expect(Math.max(...edges)).toBeLessThanOrEqual(width)
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const foot = await box(footer(page))
    const tabs = await box(mainNav(page))
    expect(foot.y + foot.height).toBeLessThanOrEqual(tabs.y + 1)
  })

  test('More opens a sheet of pages and settings; arrow keys move, a choice navigates and closes it', async ({ page }) => {
    await openApp(page, '/markets')
    await moreButton(page).click()
    const sheet = page.getByRole('dialog', { name: 'More' })
    await expect(sheet).toBeVisible()
    const items = sheet.getByRole('menuitem')
    await expect(items).toHaveText(['Learn', 'Margin', 'Issuer', 'Activity'])
    await expectNoAxeViolations(page, CHROME_ONLY)

    await items.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(items.nth(3)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(0)).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(items.nth(3)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(items.nth(0)).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/learn$/)
    await expect(sheet).toBeHidden()
    await expect(pageHeading(page)).toBeFocused()
    await expect(moreButton(page)).toHaveAttribute('aria-current', 'true')
    await expect(mainNav(page).locator('[aria-current="page"]')).toHaveCount(0)

    // The open page is marked in the sheet.
    await moreButton(page).click()
    await expect(sheet.locator('[aria-current="page"]')).toHaveText('Learn')
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(moreButton(page)).toBeFocused()
  })

  test('the settings in the sheet apply at once and are stored; the sheet fits the screen', async ({ page }) => {
    await openApp(page, '/markets')
    await moreButton(page).click()
    const sheet = page.getByRole('dialog', { name: 'More' })
    await expect(sheet.getByRole('radiogroup')).toHaveCount(2)
    await sheet.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click()
    expect(await theme(page)).toBe('dark')
    const colours = sheet.getByRole('radiogroup', { name: 'Gain and loss colours' })
    // Every option is on screen whole: none is cut or scrolled away at this width.
    for (const option of await colours.getByRole('radio').all()) await expect(option).toBeInViewport({ ratio: 1 })
    await colours.getByRole('radio', { name: 'Ink only' }).click()
    expect(await stored(page)).toMatchObject({ theme: 'dark', pnl: 'mono' })
    // At 390 x 844 the whole sheet fits without scrolling.
    expect(await sheet.evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight + 0.5)).toBe(true)
    await expect(colours.getByRole('radio', { name: 'Ink only' })).toBeInViewport({ ratio: 1 })
    await expectNoAxeViolations(page, { ...CHROME_ONLY, themes: ['dark'] })
  })

  test('keyboard focus never lands under the tab bar', async ({ page }) => {
    await openApp(page, '/reserves')
    const hidden: string[] = []
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab')
      const report = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body || el.closest('nav[aria-label="Main"], header, footer')) return null
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null
        const hit = document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.top + rect.height / 2, window.innerHeight - 1))
        const covered = hit !== null && !el.contains(hit) && !hit.contains(el) && hit.closest('nav[aria-label="Main"]') !== null
        return covered ? `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" at ${Math.round(rect.top)}` : null
      })
      if (report) hidden.push(report)
    }
    expect(hidden).toEqual([])
  })

  test('a tap on the tab of the open page goes back to its top, with focus on the heading', async ({ page }) => {
    await openApp(page, '/reserves')
    await page.evaluate(() => window.scrollTo(0, 900))
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(100)
    await mainNav(page).getByRole('link', { name: 'Reserves' }).click()
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0)
    await expect(pageHeading(page)).toBeFocused()
    expect(new URL(page.url()).pathname).toBe('/reserves')
  })

  test('the chrome passes axe in both themes', async ({ page }) => {
    await openApp(page, '/learn', { connect: true })
    await expectNoAxeViolations(page, CHROME_ONLY)
  })
})

test.describe('states staged on the specimens page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SPECIMENS)
    await expect(page.getByRole('heading', { level: 1, name: 'Shell states' })).toBeVisible()
  })

  test('the wallet picker lists installed wallets first and says whether each can be used from here @both', async ({ page }) => {
    await page.getByRole('button', { name: 'Wallet list' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('listitem')).toHaveText([/Freighter.*Installed/, /xBull.*No install needed/, /Albedo.*No install needed/, /LOBSTR.*Install/, /Rabet.*Install/])
    // A row is the wallet's name and those words: no caption repeated on every row, no initials in a box.
    await expect(dialog).not.toContainText('Browser extension or web wallet')
    await expect(dialog).toContainText(WALLET_DISCLOSURE)
    expect(findBannedWords(await dialog.innerText(), [...BANNED_WORDS, ...BANNED_TAGLINES])).toEqual([])

    // A wallet that is not installed is a link to where it is published, in a new tab.
    const install = dialog.getByRole('link', { name: /LOBSTR/ })
    await expect(install).toHaveAttribute('target', '_blank')
    await expect(install).toHaveAccessibleName(/Install.*opens in a new tab/)
    await expectNoAxeViolations(page)

    // Choosing one asks that wallet; the others say they are unavailable and do nothing.
    await dialog.getByRole('button', { name: /Freighter/ }).click()
    await expect(page.getByTestId('picked')).toHaveText('Picked: freighter')
    await expect(dialog.getByRole('button', { name: /Freighter/ })).toHaveAttribute('aria-busy', 'true')
    await expect(dialog.getByRole('button', { name: /Freighter/ })).toContainText('Waiting')
    await expect(dialog).toContainText('Approve the connection in Freighter. Nothing is signed by connecting.')
    const other = dialog.getByRole('button', { name: /xBull/ })
    await expect(other).toHaveAttribute('aria-disabled', 'true')
    await other.click({ force: true })
    await expect(page.getByTestId('picked')).toHaveText('Picked: freighter')
    await expectNoAxeViolations(page)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  for (const [stage, text] of [
    ['Rejected request', 'You rejected the request in Freighter.'],
    ['No wallets', 'No wallets found.'],
  ] as const) {
    test(`the wallet picker: ${stage.toLowerCase()} @both`, async ({ page }) => {
      await page.getByRole('button', { name: stage }).click()
      const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
      await expect(dialog).toContainText(text)
      await expect(dialog).toContainText(WALLET_DISCLOSURE)
      if (stage === 'Rejected request') await expect(dialog.getByRole('alert')).toContainText(text)
      // The empty state is plain text, not a blank contract note.
      if (stage === 'No wallets') await expect(dialog).not.toContainText('No.')
      await expectNoAxeViolations(page)
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
    })
  }

  test('the wallet picker keeps its size while the list loads @both', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
    // Measured once the box holds still: in its opening frame the dialog is drawn at its starting scale (0.985).
    const settled = async () => {
      let last = await dialog.boundingBox()
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(50)
        const next = await dialog.boundingBox()
        if (last && next && Math.abs(next.width - last.width) < 0.5 && Math.abs(next.height - last.height) < 0.5) return next
        last = next
      }
      return last
    }
    await page.getByRole('button', { name: 'Wallet list' }).click()
    const loaded = await settled()
    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Looking for wallets' }).click()
    await expect(dialog.getByRole('list', { name: 'Looking for wallets' })).toHaveAttribute('aria-busy', 'true')
    const loading = await settled()
    expect(Math.abs((loading?.height ?? 0) - (loaded?.height ?? 0))).toBeLessThanOrEqual(4)
    expect(Math.abs((loading?.width ?? 0) - (loaded?.width ?? 0))).toBeLessThanOrEqual(1)
    await expectNoAxeViolations(page)
  })

  test('a list that could not be loaded shows the error and a way to try again, not the install hint @both', async ({ page }) => {
    await page.getByRole('button', { name: 'List not loaded' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
    await expect(dialog.getByRole('alert')).toContainText('could not be loaded')
    await expect(dialog).not.toContainText('Install a Stellar wallet extension')
    await dialog.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('retried')).toHaveText('Retried: 1')
    await expectNoAxeViolations(page)
  })

  test('on a touch screen the picker lists what opens there, with no store links @both', async ({ page }) => {
    await page.getByRole('button', { name: 'On a touch screen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect a wallet' })
    await expect(dialog.getByRole('listitem')).toHaveText([/Freighter.*Installed/, /xBull.*No install needed/, /Albedo.*No install needed/])
    await expect(dialog.getByRole('link')).toHaveCount(0)
    await expect(dialog).toContainText('Browser extensions are not offered on this device.')
    await expect(dialog).toContainText(WALLET_DISCLOSURE)
    await expectNoAxeViolations(page)
  })

  test('the network indicator names every state in words, with no box and no dot @both', async ({ page }) => {
    const full = page.getByTestId('network').locator('p')
    await expect(full).toHaveText(['Testnet, ledger 58,331,204', 'Testnet, reads are late', 'Testnet, no connection', 'Testnet', 'Mock data'])
    const compact = page.getByTestId('network-compact').locator('p')
    await expect(compact).toHaveText(['Testnet', 'Reads are late', 'No connection', 'Testnet', 'Mock data'])
    await expect(page.getByTestId('network').getByRole('button')).toHaveCount(0)
    // No developer words.
    expect(await page.getByTestId('network').innerText()).not.toMatch(/RPC/)
    await expectNoAxeViolations(page)
  })

  test('the wrong-network banner is an alert that names the fix once @both', async ({ page }) => {
    const banner = page.getByTestId('banners').getByRole('alert')
    await expect(banner).toContainText('Wrong network')
    await expect(banner).toContainText('Freighter is on another network. Open the wallet, choose Testnet')
    await expect(banner).toContainText('Until then nothing can be signed here.')
    expect((await banner.innerText()).split('Testnet').length - 1).toBe(1)
    await expect(banner.getByRole('button', { name: 'Check again' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Disconnect' })).toBeVisible()
  })

  test('late reads: a warning that stays, an alert when nothing could be read @both', async ({ page }) => {
    const delayed = page.getByTestId('banner-delayed')
    await expect(delayed).toContainText('Figures may be out of date')
    await expect(delayed).toContainText('The last ledger read failed or is late.')
    await expect(delayed.getByRole('alert')).toHaveCount(0)
    await expect(page.getByTestId('banner-down').getByRole('alert')).toContainText('No ledger could be read.')
  })

  test('the footer shows each contract id with copy and a link to the explorer, the ids on one edge @both', async ({ page }) => {
    const foot = page.getByTestId('footer-contracts').locator('footer.shell-footer')
    await expect(foot).toContainText('Covered contract')
    await expect(foot).toContainText('Margin contract')
    // A build on a contract: the notice names the network.
    await expect(foot).toContainText(LEGAL_NOTICE)
    const ids = foot.locator('dd')
    await expect(ids).toHaveCount(2)
    const [first, second] = [await ids.nth(0).boundingBox(), await ids.nth(1).boundingBox()]
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 1))).toBeLessThanOrEqual(0.5)
    await expect(foot.getByRole('button', { name: 'Copy the covered contract id' })).toBeVisible()
    await expect(foot.getByRole('link', { name: /View the covered contract on the explorer/ })).toHaveAttribute('href', /\/contract\/CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6$/)
    await expect(foot.getByRole('link', { name: /View the margin contract on the explorer/ })).toHaveAttribute('href', /\/contract\/CBZNS63L23N3Y3GHU6H57AU6OVZ3FOAPM7Z54ATDRC472Q5DWV6UVKCN$/)
  })

  test('the page of states passes axe in both themes @both', async ({ page }) => {
    await expectNoAxeViolations(page)
  })
})
