// The application spine: the route manifest, titles, search params, old links, focus and scroll around a
// navigation, the error boundary, the not-found page and the pre-paint theme script. The chrome itself (bars,
// wallet, settings, footer) is covered by the shell's own spec.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../src/core/disclosures'
import {
  ADDR_A,
  ADDR_B,
  ALL_ROUTES,
  MARGIN_ROUTES,
  connectButton,
  currentPath,
  disconnect,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  goTo,
  openApp,
  pageHeading,
  quietDevOverlay,
  switchAccount,
  titleOf,
  walletButton,
} from './helpers'

/** What the router holds as the validated search of the current location. */
const routerSearch = (page: Page): Promise<Record<string, unknown>> =>
  page.evaluate(() => {
    const hook = (window as unknown as { __stellsec: { router: { state: { location: { search: Record<string, unknown> } } } } }).__stellsec
    return JSON.parse(JSON.stringify(hook.router.state.location.search)) as Record<string, unknown>
  })

/** A client-side navigation through the router, as a link would do it. */
const navigate = (page: Page, options: Record<string, unknown>): Promise<void> =>
  page.evaluate(async (opts) => {
    const hook = (window as unknown as { __stellsec: { router: { navigate(o: unknown): Promise<void> } } }).__stellsec
    await hook.router.navigate(opts)
  }, options)

const shell = (page: Page) => page.locator('footer.shell-footer')

// These tests load pages with `page.goto` (they are about what a cold load does), so the dev overlay guard that
// `openApp` installs is installed here.
test.beforeEach(async ({ page }) => {
  await quietDevOverlay(page)
})

test.describe('routes', () => {
  for (const route of ALL_ROUTES) {
    test(`${route.path} loads with its title${route.shell ? ', inside the shell' : ', without the shell'}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(String(error)))
      await page.goto(route.path)
      await expect(page).toHaveTitle(titleOf(route))
      await expect(page.locator('#root')).not.toBeEmpty()
      if (route.shell) {
        await expect(page.locator('main#main')).toBeVisible()
        await expect(shell(page)).toBeVisible()
      } else {
        await expect(shell(page)).toHaveCount(0)
      }
      expect(await currentPath(page)).toBe(route.path)
      expect(errors, 'uncaught errors').toEqual([])
    })
  }

  test('a position has its id in the title', async ({ page }) => {
    await page.goto('/portfolio/12')
    await expect(page).toHaveTitle('Position 12 · Portfolio · StellSec')
  })

  test('the Margin screens share one mounted page', async ({ page }) => {
    await page.goto('/margin')
    await expect(page.locator('main#main')).toBeVisible()
    await page.evaluate(() => {
      document.querySelector('main#main')?.setAttribute('data-probe', 'kept')
    })
    for (const route of MARGIN_ROUTES.slice(1)) {
      await navigate(page, { to: route.path })
      await expect(page).toHaveTitle(titleOf(route))
    }
    // No document load happened on the way: the marker set on the first screen is still there.
    await expect(page.locator('main#main')).toHaveAttribute('data-probe', 'kept')
  })
})

test.describe('search params', () => {
  test('a valid link reaches the page as strings, exactly as written', async ({ page }) => {
    const link = '/markets/bond?mode=chain&expiry=2026-11-27&kind=put&strike=10.00&offer=12&step=review'
    await page.goto(link)
    await expect(page).toHaveTitle('BOND · Markets · StellSec')
    expect(await routerSearch(page)).toEqual({ mode: 'chain', kind: 'put', strike: '10.00', expiry: '2026-11-27', offer: '12', step: 'review' })
    expect(await currentPath(page)).toBe(link)
  })

  test('invalid and unknown fields are dropped from the page and from the address bar', async ({ page }) => {
    await page.goto('/markets/bond?mode=expert&strike=10.00&offer=1e3&utm_source=x&kind=put&expiry=2026-02-30')
    await expect(page).toHaveURL((url) => url.pathname === '/markets/bond' && !url.search.includes('mode'))
    expect(await routerSearch(page)).toEqual({ strike: '10.00', kind: 'put' })
    // What is left is written in the order of the route's fields, whatever order the link used.
    expect(await currentPath(page)).toBe('/markets/bond?kind=put&strike=10.00')
  })

  test('each route keeps only its own fields', async ({ page }) => {
    await page.goto('/portfolio?tab=written&closed=1&mode=chain')
    await expect(page).toHaveURL((url) => !url.search.includes('mode'))
    expect(await routerSearch(page)).toEqual({ tab: 'written', closed: '1' })

    await page.goto('/requests?kind=call&sort=deadline&bid=3&mine=1&new=yes')
    await expect(page).toHaveURL((url) => !url.search.includes('new'))
    expect(await routerSearch(page)).toEqual({ kind: 'call', sort: 'deadline', bid: '3', mine: '1' })

    await page.goto('/portfolio/7?do=exercise')
    expect(await routerSearch(page)).toEqual({ do: 'exercise' })

    await page.goto('/markets?all=1&intent=earn-buy')
    expect(await routerSearch(page)).toEqual({ all: '1', intent: 'earn-buy' })
  })

  test('the test wallet account param survives navigation', async ({ page }) => {
    await page.goto(`/markets?as=${ADDR_B}`)
    await navigate(page, { to: '/reserves' })
    await expect(page).toHaveURL((url) => url.pathname === '/reserves' && url.searchParams.get('as') === ADDR_B)
  })
})

test.describe('old hash links', () => {
  const cases: [string, string][] = [
    ['/#/markets', '/markets'],
    ['/#/portfolio', '/portfolio'],
    ['/#/reserves', '/reserves'],
    ['/#/issuer', '/issuer'],
    ['/#/pro', '/margin'],
    ['/#/pro/trade', '/margin/trade'],
    ['/#/pro/positions', '/margin/positions'],
    ['/#/pro/liquidations', '/margin/liquidations'],
    ['/#/pro/vault', '/margin/vault'],
    ['/#/write', '/markets'],
  ]
  for (const [from, to] of cases) {
    test(`${from} opens ${to}`, async ({ page }) => {
      await page.goto(from)
      await expect(page).toHaveURL((url) => url.pathname === to && url.hash === '')
      await expect(shell(page)).toBeVisible()
    })
  }

  test('an in-page anchor on the landing page is not a route', async ({ page }) => {
    await page.goto('/#limits')
    await expect(page.locator('#root')).not.toBeEmpty()
    expect(new URL(page.url()).pathname).toBe('/')
    expect(new URL(page.url()).hash).toBe('#limits')
    await expect(shell(page)).toHaveCount(0)
  })
})

test.describe('around a navigation', () => {
  test('focus moves to the page heading when the path changes', async ({ page }) => {
    await page.goto('/design')
    await expect(pageHeading(page)).toHaveText('Design system')
    // The first load leaves focus at the top of the document, where the skip link is the first stop.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')
    await navigate(page, { to: '/no-such-page' })
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeFocused()
    await page.getByRole('link', { name: 'Go to Markets' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
    await expect(page.locator('main h1').first()).toBeFocused()
  })

  test('a new page starts at the top, a search change does not move it, back restores the position', async ({ page }) => {
    await page.goto('/design')
    await expect(pageHeading(page)).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 1400))
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(1400)

    // Same path, another search param (a push, with the router's default scroll handling).
    await navigate(page, { to: '/design', search: { as: ADDR_B } })
    await expect(page).toHaveURL((url) => url.searchParams.get('as') === ADDR_B)
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(1400)
    // Focus stays where it was too.
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

    // Another page: top.
    await navigate(page, { to: '/no-such-page' })
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0)

    // Back: the position the page was left at.
    await page.goBack()
    await expect(pageHeading(page)).toHaveText('Design system')
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(1400)
  })
})

test.describe('a page that fails', () => {
  test('is contained by its error boundary, and "Try again" recovers', async ({ page }) => {
    await page.goto('/e2e/crash')
    await expect(page.getByRole('heading', { level: 1, name: 'This page could not be shown' })).toBeVisible()
    // The shell is intact around it.
    await expect(shell(page)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible()
    await page.getByText('Technical detail').click()
    await expect(page.getByText('Test page: thrown on purpose.')).toBeVisible()

    await page.evaluate(() => {
      ;(window as unknown as { __stellsecCrash: boolean }).__stellsecCrash = false
    })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Recovered' })).toBeVisible()
  })

  test('other pages keep working after a failure', async ({ page }) => {
    await page.goto('/e2e/crash')
    await expect(page.getByRole('heading', { level: 1, name: 'This page could not be shown' })).toBeVisible()
    await page.getByRole('link', { name: 'Go to Markets' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
    await expect(page).toHaveTitle('Markets · StellSec')
    await expect(page.getByRole('heading', { level: 1, name: 'This page could not be shown' })).toHaveCount(0)
  })

  test('the error page passes axe in both themes and fits a phone @both', async ({ page }) => {
    await page.goto('/e2e/crash')
    await expect(page.getByRole('heading', { level: 1, name: 'This page could not be shown' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)
  })
})

test.describe('an unknown address', () => {
  test('shows "Page not found" inside the shell, with a way out @both', async ({ page }) => {
    await page.goto('/no/such/page?x=1')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveTitle('Page not found · StellSec')
    await expect(shell(page)).toBeVisible()
    // The address is never echoed into the page.
    expect(await page.locator('main#main').innerText()).not.toContain('no/such')
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page)
    await page.getByRole('link', { name: 'Go to Markets' }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets')
  })

  test('the router pages use none of the banned words or taglines', async ({ page }) => {
    for (const path of ['/no-such-page', '/e2e/crash']) {
      await page.goto(path)
      await expect(pageHeading(page)).toBeVisible()
      const text = await page.locator('main#main').innerText()
      expect(findBannedWords(text, BANNED_WORDS), path).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), path).toEqual([])
    }
  })
})

test.describe('the stored theme', () => {
  test('is applied by index.html before the app starts', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('stellsec.settings.v1', JSON.stringify({ theme: 'dark', density: 'compact', pnl: 'mono' })))
    // Keep the app from starting: only the inline script of index.html has run.
    await page.route(/\/(src\/app\/main\.tsx|assets\/main-[^/]+\.js)/, (route) => route.abort())
    await page.goto('/markets')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(html).toHaveAttribute('data-density', 'compact')
    await expect(html).toHaveAttribute('data-pnl', 'mono')
  })

  test('a broken or foreign value is ignored', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('stellsec.settings.v1', '{"theme":"sepia","density":3'))
    await page.route(/\/(src\/app\/main\.tsx|assets\/main-[^/]+\.js)/, (route) => route.abort())
    await page.goto('/markets')
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull()
  })

  test('the browser chrome colour follows a forced theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('stellsec.settings.v1', JSON.stringify({ theme: 'dark' })))
    await page.goto('/design')
    await expect(pageHeading(page)).toBeVisible()
    const colours = await page.evaluate(() => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => meta.content.toLowerCase()))
    const painted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase())
    expect(colours).toEqual([painted, painted])
  })
})

test.describe('the design route', () => {
  test('mounts the component gallery and the chart kit inside the shell', async ({ page }) => {
    await page.goto('/design')
    await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Charts' })).toBeVisible()
    await expect(page.getByTestId('payoff-chart').first()).toBeAttached()
    await expect(shell(page)).toBeVisible()
  })
})

test.describe('the landing page', () => {
  test('does not fetch the shell, the wallet kit or the Stellar SDK', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => requested.push(new URL(request.url()).pathname))
    await page.goto('/')
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForLoadState('networkidle')
    const heavy = requested.filter((path) => /features\/shell\/|\/shell-[^/]+\.js|stellar-sdk|transaction_builder|stellar-wallets-kit|sorobanClient|SorobanProClient/.test(path))
    expect(heavy).toEqual([])
  })
})

test.describe('the shared helpers', () => {
  test('connect, change account without a reload, and move between sections @both', async ({ page }) => {
    await openApp(page, '/markets', { connect: true })
    await expect(walletButton(page)).toContainText(ADDR_A.slice(0, 4))
    // A marker on the window: it is lost if anything below reloads the document (and with it the mock chain).
    await page.evaluate(() => {
      ;(window as unknown as { __probe?: string }).__probe = 'same document'
    })

    await switchAccount(page, 'b')
    await expect(walletButton(page)).toContainText(ADDR_B.slice(0, 4))
    expect(new URL(page.url()).searchParams.get('as')).toBe(ADDR_B)

    // Top bar or tab bar, then one that sits behind "More" on a phone.
    await goTo(page, 'Portfolio')
    await goTo(page, 'Activity')
    await goTo(page, 'Reserves')
    expect(await currentPath(page)).toBe('/reserves')
    // The account follows from page to page.
    expect(new URL(page.url()).searchParams.get('as')).toBe(ADDR_B)
    await expect(walletButton(page)).toContainText(ADDR_B.slice(0, 4))

    await switchAccount(page, 'a')
    await expect(walletButton(page)).toContainText(ADDR_A.slice(0, 4))
    expect(new URL(page.url()).searchParams.get('as')).toBe(ADDR_A)
    expect(await currentPath(page)).toBe('/reserves')

    await disconnect(page)
    await expect(connectButton(page)).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __probe?: string }).__probe)).toBe('same document')
  })

  test('open a page as account B in one call', async ({ page }) => {
    await openApp(page, '/portfolio', { connect: 'b' })
    await expect(walletButton(page)).toContainText(ADDR_B.slice(0, 4))
  })

  test('open a page with a forced theme', async ({ page }) => {
    await openApp(page, '/reserves', { theme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
