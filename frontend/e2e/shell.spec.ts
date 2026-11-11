/**
 * The whole app, route by route: a smoke suite over every page of a default test build.
 *
 * Each feature has its own spec for what it does; this one asks the questions that are the same for all of
 * them: does the page render one heading and its title, do the sections follow each other by keyboard, is the
 * legal footer there, does a display setting last, do old links still land, does a phone fit, is axe clean in
 * both themes, and is the copy free of the words the product never uses.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_TAGLINES, BANNED_WORDS, COPYRIGHT_NOTICE, LEGAL_NOTICE, MARGIN_BANNED_WORDS, findBannedWords } from '../src/core/disclosures'
import {
  ALL_ROUTES,
  APP_ROUTES,
  MARGIN_ROUTES,
  bodyText,
  currentPath,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  pageHeading,
  quietDevOverlay,
  titleOf,
} from './helpers'
import type { RouteInfo } from './helpers'

/** The one `h1` of each route. */
const HEADING: Record<string, string | RegExp> = {
  '/': 'Set the lowest price you would sell at.',
  '/markets': 'Markets',
  '/markets/bond': 'BOND',
  '/portfolio': 'Portfolio',
  '/requests': 'Requests',
  '/reserves': 'Reserves',
  '/activity': 'Activity',
  '/issuer': 'Issuer',
  '/learn': 'How it works',
  '/design': 'Design system',
  '/margin': 'Margin account',
  '/margin/trade': 'Margin trade',
  '/margin/positions': 'Margin positions',
  '/margin/liquidations': 'Liquidations',
  '/margin/vault': 'Vault',
}

const isMargin = (route: RouteInfo): boolean => route.path.startsWith('/margin')

/**
 * Margin opens on its entry warning, once per session: the screens behind it are inert until it is accepted.
 * Accepts it when it is up, so the screen itself can be read and scanned.
 */
async function passMarginWarning(page: Page): Promise<void> {
  const consent = page.getByRole('checkbox', { name: 'I understand' })
  if (!(await consent.isVisible().catch(() => false))) return
  await consent.check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(consent).toBeHidden()
}

/** Loads a route cold and waits until its content has settled (first reads in, skeletons gone). */
async function load(page: Page, route: RouteInfo): Promise<void> {
  await page.goto(route.path)
  await expect(pageHeading(page)).toBeVisible()
  if (isMargin(route)) await passMarginWarning(page)
  // The gallery shows skeletons as specimens: they are busy for good.
  if (route.path !== '/design') await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 })
}

test.beforeEach(async ({ page }) => {
  await quietDevOverlay(page)
})

test.describe('every route', () => {
  for (const route of ALL_ROUTES) {
    test(`${route.path} renders one heading and its title`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(String(error)))
      await load(page, route)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(pageHeading(page)).toHaveText(HEADING[route.path])
      await expect(page).toHaveTitle(titleOf(route))
      expect(errors, `uncaught errors on ${route.path}`).toEqual([])
    })
  }

  for (const route of ALL_ROUTES) {
    test(`${route.path} passes axe in both themes @both`, async ({ page }) => {
      await load(page, route)
      await expectNoAxeViolations(page)
    })
  }

  for (const route of ALL_ROUTES) {
    test(`${route.path} does not scroll sideways at 390 px @phone`, async ({ page }) => {
      await load(page, route)
      await expectNoHorizontalOverflow(page)
    })
  }

  for (const route of ALL_ROUTES) {
    test(`${route.path} uses no banned word and no disclaimer tagline`, async ({ page }) => {
      await load(page, route)
      const text = await bodyText(page)
      const words = isMargin(route) ? MARGIN_BANNED_WORDS : BANNED_WORDS
      expect(findBannedWords(text, words), `banned words in the text of ${route.path}`).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), `disclaimer taglines in the text of ${route.path}`).toEqual([])
    })
  }
})

test.describe('the legal footer', () => {
  for (const route of ALL_ROUTES) {
    test(`${route.path} ends with the copyright line and the legal notice, once each @both`, async ({ page }) => {
      await load(page, route)
      // The app shell's footer on app routes; the landing page has the same two sentences in its own footer.
      const footer = route.shell ? page.locator('footer.shell-footer') : page.locator('footer').last()
      await expect(footer).toHaveCount(1)
      const text = await bodyText(page)
      expect(text.split(COPYRIGHT_NOTICE).length - 1, 'copyright line').toBe(1)
      expect(text.split(LEGAL_NOTICE).length - 1, 'legal notice').toBe(1)
      const inFooter = await footer.innerText()
      expect(inFooter).toContain(COPYRIGHT_NOTICE)
      expect(inFooter).toContain(LEGAL_NOTICE)
    })
  }
})

test.describe('navigation by keyboard', () => {
  /** Tabs forward until the focused element is a link with this name, then follows it with Enter. */
  async function followByKeyboard(page: Page, name: RegExp, path: string): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return el instanceof HTMLAnchorElement ? { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), inNav: el.closest('nav') !== null } : null
      })
      if (focused?.inNav && name.test(focused.text)) {
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL((url) => url.pathname === path)
        return
      }
    }
    throw new Error(`No navigation link ${name} was reached with Tab.`)
  }

  test('the sections of the top bar follow each other with Tab and Enter, and focus lands on each heading', async ({ page }) => {
    await page.goto('/markets')
    await expect(pageHeading(page)).toHaveText('Markets')
    const steps: [RegExp, string, string][] = [
      [/^Portfolio/, '/portfolio', 'Portfolio'],
      [/^Requests/, '/requests', 'Requests'],
      [/^Reserves/, '/reserves', 'Reserves'],
      [/^Learn/, '/learn', 'How it works'],
      [/^Markets/, '/markets', 'Markets'],
    ]
    for (const [name, path, heading] of steps) {
      await followByKeyboard(page, name, path)
      await expect(pageHeading(page)).toHaveText(heading)
      // The router moves focus to the new page's heading, so the next Tab starts from the page, not from the bar.
      await expect(pageHeading(page)).toBeFocused()
      // Back to the top of the document for the next lap: the skip link is the first stop.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    }
  })

  test('the skip link is the first stop and moves focus into the page', async ({ page }) => {
    await page.goto('/reserves')
    await expect(pageHeading(page)).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeFocused()
  })
})

test.describe('the theme setting', () => {
  test('chosen in the settings menu, it is painted at once and lasts across a reload and a change of page', async ({ page }) => {
    await page.goto('/markets')
    await expect(pageHeading(page)).toBeVisible()
    const painted = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(await painted()).toBeNull()

    await page.getByRole('button', { name: /settings/i }).filter({ visible: true }).first().click()
    const menu = page.getByRole('menu')
    await menu.getByRole('menuitemradio', { name: 'Dark' }).click()
    expect(await painted()).toBe('dark')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    await page.reload()
    await expect(pageHeading(page)).toBeVisible()
    expect(await painted()).toBe('dark')
    // A dark ground, not only the attribute.
    const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const [r, g, b] = (ground.match(/\d+/g) ?? []).map(Number)
    expect(r + g + b, `page ground ${ground}`).toBeLessThan(120)

    await page.goto('/learn')
    await expect(pageHeading(page)).toBeVisible()
    expect(await painted()).toBe('dark')
    // The landing page has no switch of its own and follows the stored choice.
    await page.goto('/')
    await expect(pageHeading(page)).toBeVisible()
    expect(await painted()).toBe('dark')
  })
})

test.describe('links from before the path URLs', () => {
  const cases: [string, string][] = [
    ['/#/markets', '/markets'],
    ['/#/portfolio', '/portfolio'],
    ['/#/reserves', '/reserves'],
    ['/#/issuer', '/issuer'],
    ['/#/pro', '/margin'],
    ['/#/pro/vault', '/margin/vault'],
  ]
  for (const [from, to] of cases) {
    test(`${from} lands on ${to} with its heading`, async ({ page }) => {
      await page.goto(from)
      await expect(page).toHaveURL((url) => url.pathname === to && url.hash === '')
      expect(await currentPath(page)).toBe(to)
      await expect(pageHeading(page)).toHaveText(HEADING[to])
    })
  }
})

test.describe('the route list of this spec', () => {
  test('covers every route of the build', () => {
    for (const route of [...APP_ROUTES, ...MARGIN_ROUTES]) expect(HEADING[route.path], route.path).toBeDefined()
    expect(Object.keys(HEADING).sort()).toEqual(ALL_ROUTES.map((r) => r.path).sort())
  })
})
