/**
 * Shared helpers of the end-to-end suite. One spec per area (`e2e/<area>.spec.ts`); every spec starts from
 * `openApp` and uses these helpers for what the shell owns (wallet, navigation, theme, notices).
 *
 * The suite runs on the mock chain (no contract id in the build) with the test wallet (`VITE_E2E=1`). The mock
 * chain lives in the page's memory: a full page load starts a fresh demo market, so a test that needs its own
 * earlier writes must move with links and `goTo`, never with a second `page.goto`.
 *
 * Accessible names the helpers rely on (the app shell keeps them):
 * - the button "Connect wallet", and the button whose name starts with "Wallet menu" once connected;
 * - "Disconnect" inside the wallet menu;
 * - section links by their one-word label inside a `navigation` landmark, and the "More" button for the rest;
 * - the toast region "Notices" and the two live regions of the ui kit.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { DEMO_WALLETS } from '../src/core/options/demoAccounts'

// --- Accounts ----------------------------------------------------------------------------------------------

/** The two identities of the test wallet. Both have seeded positions in the mock market. A is the default. */
export const ADDR_A = DEMO_WALLETS.a
export const ADDR_B = DEMO_WALLETS.b
export type Account = 'a' | 'b'
const addressOf = (account: Account | string): string => (account === 'a' ? ADDR_A : account === 'b' ? ADDR_B : account)

// --- Routes ------------------------------------------------------------------------------------------------

/** Every route of a default E2E build with its `document.title` page name and its `h1`. */
export interface RouteInfo {
  path: string
  /** The page part of the title: "Markets" in "Markets · StellSec". Empty for the landing page. */
  title: string
  /** False for the landing page, which has its own layout and no app shell. */
  shell: boolean
}

export const APP_ROUTES: readonly RouteInfo[] = [
  { path: '/markets', title: 'Markets', shell: true },
  { path: '/markets/bond', title: 'BOND · Markets', shell: true },
  { path: '/portfolio', title: 'Portfolio', shell: true },
  { path: '/requests', title: 'Requests', shell: true },
  { path: '/reserves', title: 'Reserves', shell: true },
  { path: '/activity', title: 'Activity', shell: true },
  { path: '/issuer', title: 'Issuer', shell: true },
  { path: '/learn', title: 'Learn', shell: true },
  { path: '/design', title: 'Design system', shell: true },
]

/** Mounted only when the build sets VITE_ENABLE_PRO=1 (the Playwright web server does). */
export const MARGIN_ROUTES: readonly RouteInfo[] = [
  { path: '/margin', title: 'Account · Margin', shell: true },
  { path: '/margin/trade', title: 'Trade · Margin', shell: true },
  { path: '/margin/positions', title: 'Positions · Margin', shell: true },
  { path: '/margin/liquidations', title: 'Liquidations · Margin', shell: true },
  { path: '/margin/vault', title: 'Vault · Margin', shell: true },
]

export const LANDING_ROUTE: RouteInfo = { path: '/', title: '', shell: false }
export const ALL_ROUTES: readonly RouteInfo[] = [LANDING_ROUTE, ...APP_ROUTES, ...MARGIN_ROUTES]

export const SITE_NAME = 'StellSec'
/** `Markets · StellSec`; the landing page has a title of its own that starts with the product name. */
export const titleOf = (route: RouteInfo): string | RegExp => (route.title ? `${route.title} · ${SITE_NAME}` : new RegExp(`^${SITE_NAME}`))

// --- Opening the app ---------------------------------------------------------------------------------------

export interface OpenOptions {
  /** Connect the test wallet once the page is up: `true` or 'a' for the default account, 'b' or an address for another. */
  connect?: boolean | Account | string
  /** Force a theme before the first paint (default: the emulated system scheme, light). */
  theme?: Theme
}

/**
 * Keeps Vite's error overlay out of the page. On a dev server that other people are editing against, a file
 * saved half-written puts a full-screen overlay over every open page for a moment: it would swallow clicks and
 * show up in an axe scan. A page whose own code is broken still fails its test, by missing content.
 * `openApp` calls this; a spec that uses `page.goto` directly can call it in a `beforeEach`.
 */
export async function quietDevOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const remove = () => {
      for (const overlay of document.querySelectorAll('vite-error-overlay')) overlay.remove()
    }
    // The script runs before the document has a root element: observe the document itself.
    new MutationObserver(remove).observe(document, { childList: true, subtree: true })
  })
}

/** The first heading of the page: the app shell puts it inside `main`; the landing page has its own. */
export const pageHeading = (page: Page): Locator => page.locator('h1').first()

/**
 * Loads `path` and waits for the page heading. This is a full page load: the mock chain starts fresh.
 * `openApp(page)` opens Markets; `openApp(page, '/portfolio', { connect: 'b' })` opens Portfolio as account B.
 */
export async function openApp(page: Page, path = '/markets', options: OpenOptions = {}): Promise<void> {
  const { connect: who = false, theme } = options
  await quietDevOverlay(page)
  if (theme) await forceTheme(page, theme)
  const url = new URL(path, 'http://app.invalid')
  if (typeof who === 'string' && who !== 'a') url.searchParams.set('as', addressOf(who))
  await page.goto(url.pathname + url.search + url.hash)
  await expect(pageHeading(page)).toBeVisible()
  if (who) await connect(page)
}

// --- Wallet ------------------------------------------------------------------------------------------------

export const connectButton = (page: Page): Locator => page.getByRole('button', { name: 'Connect wallet' }).filter({ visible: true }).first()
export const walletButton = (page: Page): Locator => page.getByRole('button', { name: /^Wallet menu/ }).filter({ visible: true }).first()

/**
 * Connects the test wallet: account A, or the address in `?as=` when the URL carries one.
 * On a deep link that opens a dialog as soon as a wallet is there (`/portfolio/0?do=exercise`), the page behind
 * the dialog is inert and the wallet button leaves the accessibility tree: pass `{ expectMenu: false }` and the
 * helper only waits for the button to exist.
 */
export async function connect(page: Page, options: { expectMenu?: boolean } = {}): Promise<void> {
  await connectButton(page).click()
  if (options.expectMenu === false) await expect(page.locator('button', { hasText: 'Wallet menu' }).first()).toBeAttached()
  else await expect(walletButton(page)).toBeVisible()
}

/** Disconnect lives in the wallet menu. */
export async function disconnect(page: Page): Promise<void> {
  await walletButton(page).click()
  await page.getByRole('menuitem', { name: 'Disconnect' }).click()
  await expect(connectButton(page)).toBeVisible()
}

/**
 * Becomes another account without reloading (a reload would reset the mock chain): disconnects if needed, sets
 * `?as=<address>` through the router, which then keeps it from page to page, and connects again. Going back to
 * account A sets its address too; `currentPath` leaves the param out when a test compares URLs.
 */
export async function switchAccount(page: Page, account: Account | string): Promise<void> {
  if (await walletButton(page).isVisible()) await disconnect(page)
  await page.evaluate(async (as) => {
    const hook = (window as unknown as { __stellsec?: { setAccount(address: string): Promise<void> } }).__stellsec
    if (!hook) throw new Error('The E2E hook is missing: the app was not built with VITE_E2E=1.')
    await hook.setAccount(as)
  }, addressOf(account))
  await connect(page)
}

// --- Staging the mock chain --------------------------------------------------------------------------------

/**
 * The app's own instances, exposed by `src/app/main.tsx` in a test build (`window.__stellsec`). They are the
 * ones the page reads and writes through, also on a long-lived dev server where a plain `import()` of a source
 * module can return a second copy.
 */
interface AppHook {
  router: { navigate(to: { href: string }): Promise<void> }
  failNext(kind: TxOutcome | null): Promise<void>
  failNextRead(method?: MockRead, times?: number): Promise<void>
  clawBack(tokenContractId: string, units: string): Promise<void>
  activityStore: {
    begin(entry: Record<string, unknown>): { id: string }
    apply(address: string, id: string, state: Record<string, unknown>): void
  }
}

/** How a transaction can stop short of "confirmed" (core/tx/errors `TxErrorKind`). */
export type TxOutcome = 'refused' | 'declined' | 'failed' | 'expired' | 'unknown'
export type MockRead = 'listOptions' | 'listBids' | 'listAsks'

const NO_HOOK = 'The E2E hook is missing: the app was not built with VITE_E2E=1, or this page is not the app (a harness page has no hook).'

/**
 * Goes to an address through the app's own router: no page load, so the mock chain keeps what was staged or
 * traded. For a move a user would make, prefer `goTo` or a click on a link.
 */
export async function routeTo(page: Page, href: string): Promise<void> {
  await page.evaluate(
    async ({ href, missing }) => {
      const hook = (window as unknown as { __stellsec?: AppHook }).__stellsec
      if (!hook) throw new Error(missing)
      await hook.router.navigate({ href })
    },
    { href, missing: NO_HOOK },
  )
}

/** Tells the mock client how its next transaction ends; `null` clears the switch. */
export async function failNextTx(page: Page, kind: TxOutcome | null): Promise<void> {
  await page.evaluate(
    async ({ kind, missing }) => {
      const hook = (window as unknown as { __stellsec?: AppHook }).__stellsec
      if (!hook) throw new Error(missing)
      await hook.failNext(kind)
    },
    { kind, missing: NO_HOOK },
  )
}

/**
 * Makes the next `times` calls of a list read reject, as an unreachable RPC would; reads then work again.
 * Without `method`, each of the three list reads fails `times` times. `times = 0` clears the switch.
 */
export async function failNextRead(page: Page, method?: MockRead, times = 1): Promise<void> {
  await page.evaluate(
    async ({ method, times, missing }) => {
      const hook = (window as unknown as { __stellsec?: AppHook }).__stellsec
      if (!hook) throw new Error(missing)
      await hook.failNextRead(method, times)
    },
    { method, times, missing: NO_HOOK },
  )
}

/** Lowers the mock contract's own balance of a token by `units`: what an issuer clawback does to the reserves. */
export async function clawBack(page: Page, tokenContractId: string, units: bigint): Promise<void> {
  await page.evaluate(
    async ({ tokenContractId, units, missing }) => {
      const hook = (window as unknown as { __stellsec?: AppHook }).__stellsec
      if (!hook) throw new Error(missing)
      await hook.clawBack(tokenContractId, units)
    },
    { tokenContractId, units: units.toString(), missing: NO_HOOK },
  )
}

// --- Navigation --------------------------------------------------------------------------------------------

export type NavName = 'Markets' | 'Portfolio' | 'Requests' | 'Reserves' | 'Learn' | 'Margin' | 'Issuer' | 'Activity'

const NAV_PATH: Record<NavName, string> = {
  Markets: '/markets',
  Portfolio: '/portfolio',
  Requests: '/requests',
  Reserves: '/reserves',
  Learn: '/learn',
  Margin: '/margin',
  Issuer: '/issuer',
  Activity: '/activity',
}

/** The label as a whole word. Portfolio may carry a count before or after it ("1 action waiting Portfolio"), Margin a tag. */
const named = (name: NavName): RegExp => new RegExp(`(^|\\s)${name}(\\s|$)`)

/** A section link that is on screen now, in the top bar, the phone tab bar or the footer. */
function navLink(page: Page, name: NavName): Locator {
  return page.getByRole('navigation').getByRole('link', { name: named(name) }).filter({ visible: true }).first()
}

/**
 * Goes to a section the way a user does at this width: by its link in the top bar, the tab bar or the footer;
 * through "More" when the section sits there (phones and tablets); and for Activity on a desktop, through the
 * wallet menu, which needs a connected wallet. Waits for the URL and the new page heading.
 */
export async function goTo(page: Page, name: NavName): Promise<void> {
  const direct = navLink(page, name)
  const more = page.getByRole('button', { name: /^More\b/ }).filter({ visible: true }).first()
  if (await direct.isVisible()) {
    await direct.click()
  } else if (await more.isVisible()) {
    await more.click()
    await page.getByRole('menuitem', { name: named(name) }).click()
  } else if (name === 'Activity' && (await walletButton(page).isVisible())) {
    await walletButton(page).click()
    await page.getByRole('menuitem', { name: named(name) }).click()
  } else {
    throw new Error(`No link to ${name} on screen at this width.${name === 'Activity' ? ' On a desktop it is in the wallet menu: connect first.' : ''}`)
  }
  await expect(page).toHaveURL((url) => url.pathname === NAV_PATH[name])
  await expect(pageHeading(page)).toBeVisible()
}

/** The path and query of the page, without the origin and without the test wallet's `as` param. */
export async function currentPath(page: Page): Promise<string> {
  const url = new URL(page.url())
  url.searchParams.delete('as')
  return url.pathname + url.search + url.hash
}

// --- Theme -------------------------------------------------------------------------------------------------

export type Theme = 'light' | 'dark'
export const THEMES: readonly Theme[] = ['light', 'dark']

/**
 * Paints the page in `theme` now, both ways the tokens can be switched: the system scheme and the attribute on
 * <html>. It does not touch the stored setting (use the settings menu to test that).
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
}

/** Stores a theme choice before the app boots, as the settings menu would have. Call before `page.goto`. */
export async function forceTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
  await page.addInitScript((t) => {
    try {
      const key = 'stellsec.settings.v1'
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>
      localStorage.setItem(key, JSON.stringify({ ...stored, theme: t }))
    } catch {
      // No storage in this context: the emulated system scheme still applies.
    }
  }, theme)
}

/** The theme actually painted: the attribute when forced, else the system scheme. */
export async function paintedTheme(page: Page): Promise<Theme> {
  return page.evaluate(() => {
    const forced = document.documentElement.getAttribute('data-theme')
    if (forced === 'light' || forced === 'dark') return forced
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
}

// --- Accessibility -----------------------------------------------------------------------------------------

export interface AxeOptions {
  /** Themes to scan in. Default: both. */
  themes?: readonly Theme[]
  /** Limit the scan to this part of the page (a CSS selector), for example an open dialog. */
  include?: string
  /** More selectors to leave out, on top of Base UI's focus guards. */
  exclude?: readonly string[]
  /** Rule ids to switch off, with a reason in a comment at the call site. */
  disableRules?: readonly string[]
}

/**
 * Scans the page with axe (all default rules) in light and in dark and fails with a readable list.
 * Base UI's focus sentinels (`[data-base-ui-focus-guard]`) are left out: they are hidden on purpose while a menu
 * or a select is open, and axe reports them as `aria-hidden-focus`.
 * While a menu or a select list is open, the best-practice rule `region` is switched off: the popup is portalled
 * to the end of `<body>`, outside every landmark, by design (a dialog is exempt from the rule; a menu is not).
 */
export async function expectNoAxeViolations(page: Page, options: AxeOptions = {}): Promise<void> {
  const { themes = THEMES, include, exclude = [], disableRules = [] } = options
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  const scheme = await page.evaluate(() => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  const problems: string[] = []
  for (const theme of themes) {
    await setTheme(page, theme)
    // Colour contrast is measured on the painted frame: let fonts and the theme switch settle first. Controls
    // and links carry a short colour transition (cut to almost nothing under reduced motion, but still a
    // transition): the styles are flushed here, so it starts now and not inside the scan, where its first frame
    // would still read the other theme's ink on this theme's ground. Then every transition is waited for.
    await page.evaluate(async () => {
      await document.fonts.ready
      void getComputedStyle(document.body).color
      void document.documentElement.offsetHeight
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const transitions = document.getAnimations().filter((animation) => animation instanceof CSSTransition)
      await Promise.all(transitions.map((transition) => transition.finished.catch(() => undefined)))
    })
    let builder = new AxeBuilder({ page }).exclude('[data-base-ui-focus-guard]').exclude('vite-error-overlay')
    if (include) builder = builder.include(include)
    for (const selector of exclude) builder = builder.exclude(selector)
    const popupOpen = (await page.locator('[role="menu"], [role="listbox"]').filter({ visible: true }).count()) > 0
    const off = popupOpen ? [...new Set([...disableRules, 'region'])] : [...disableRules]
    if (off.length) builder = builder.disableRules(off)
    const { violations } = await builder.analyze()
    for (const violation of violations) {
      const nodes = violation.nodes
        .slice(0, 4)
        .map((node) => `      ${node.target.join(' ')}\n        ${(node.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 240)}`)
        .join('\n')
      problems.push(`  [${theme}] ${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}, ${violation.nodes.length} node(s)\n${nodes}`)
    }
  }
  // Leave the page as it was found.
  await page.emulateMedia({ colorScheme: scheme })
  await page.evaluate((value) => {
    if (value === null) document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', value)
  }, before)
  expect(problems, `axe violations on ${new URL(page.url()).pathname}:\n${problems.join('\n')}`).toEqual([])
}

/**
 * The page must not scroll sideways. On failure the message names the widest offenders. Elements inside a
 * scroll container of their own (a table wrap) are not counted: only the document's width matters.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const report = await page.evaluate(() => {
    const doc = document.documentElement
    const viewport = doc.clientWidth
    const overflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - viewport
    if (overflow <= 0) return { overflow: 0, offenders: [] as string[] }
    const scrolls = (el: Element | null): boolean => {
      for (let node = el; node && node !== doc; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && node !== document.body) return true
        if (style.position === 'fixed') return false
      }
      return false
    }
    const offenders: { right: number; text: string }[] = []
    for (const el of document.body.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.right <= viewport + 0.5) continue
      if (scrolls(el.parentElement)) continue
      const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (typeof el.className === 'string' && el.className ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}` : '')
      offenders.push({ right: Math.round(rect.right), text: `${name} (right edge ${Math.round(rect.right)} px)` })
    }
    offenders.sort((a, b) => b.right - a.right)
    return { overflow, offenders: offenders.slice(0, 6).map((o) => o.text) }
  })
  expect(report.overflow, `The page is ${report.overflow} px wider than the viewport. Widest elements:\n  ${report.offenders.join('\n  ')}`).toBe(0)
}

// --- Notices -----------------------------------------------------------------------------------------------

/** The toasts on screen. `toasts(page).filter({ hasText: 'Offer cancelled' })` for one of them. */
export const toasts = (page: Page): Locator => page.getByRole('region', { name: 'Notices' }).getByRole('listitem')

/** Waits for a toast that contains `text`. */
export async function expectToast(page: Page, text: string | RegExp): Promise<Locator> {
  const toast = toasts(page).filter({ hasText: text }).first()
  await expect(toast).toBeVisible()
  return toast
}

/** The two permanent live regions. Their text is the last announcement; it clears itself after a moment. */
export const politeRegion = (page: Page): Locator => page.locator('[data-live-region="polite"]')
export const assertiveRegion = (page: Page): Locator => page.locator('[data-live-region="assertive"]')

/** Waits for a screen-reader announcement that contains `text`. */
export async function expectAnnounced(page: Page, text: string | RegExp, politeness: 'polite' | 'assertive' = 'polite'): Promise<void> {
  await expect(politeness === 'polite' ? politeRegion(page) : assertiveRegion(page)).toContainText(text)
}

// --- Text --------------------------------------------------------------------------------------------------

/** The visible text of the whole document (dialogs and menus are portalled into body, so they are included). */
export const bodyText = (page: Page): Promise<string> => page.locator('body').innerText()

/** How many times `text` occurs in the visible text of the document. */
export async function countVisible(page: Page, text: string): Promise<number> {
  return (await bodyText(page)).split(text).length - 1
}

// --- Screenshots -------------------------------------------------------------------------------------------

export const DESKTOP = { width: 1440, height: 900 } as const
export const PHONE = { width: 390, height: 844 } as const

/** True in the 390 x 844 project (or any viewport narrower than the 768 px breakpoint). */
export const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? DESKTOP.width) < 768
