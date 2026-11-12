/**
 * The landing page (`/`): a public document with one working widget. The suite checks the first paint (the H1
 * is text and the largest paint, no chain client and no wallet code before the browser is idle), the widget
 * (recorded example first, then the best open offer of the mock book; the price handle by keyboard), the links
 * into the app, the wording, both themes with axe, and the phone layout.
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, COPYRIGHT_NOTICE, MARGIN_BANNED_WORDS, PAYOFF_CAPTION, findBannedWords, legalNotice } from '../src/core/disclosures'
import { CLOSING, HERO, INTENTS, LIMITS, NAV, PROOF, WIDGET } from '../src/features/landing/copy'
import { PHONE, bodyText, countVisible, currentPath, expectAnnounced, expectNoAxeViolations, expectNoHorizontalOverflow, openApp, pageHeading } from './helpers'

const LIVE_CHUNK = '**/features/landing/live/LiveBook.tsx*'
/** Anything that would mean a chain client, the mock chain, the wallet kit or a network read was started. */
const HEAVY = /stellar-sdk|stellar_stellar-sdk|wallets-kit|mockClient|mockSeed|sorobanClient|soroban-testnet\.stellar\.org|horizon-testnet\.stellar\.org/

const widget = (page: Page) => page.getByTestId('hero-widget')
const slider = (page: Page) => widget(page).getByRole('slider')
/** The hero's own "Open the markets": the closing at the foot of the page carries the same label. */
const heroPrimary = (page: Page) => page.getByRole('region', { name: HERO.h1 }).getByRole('link', { name: HERO.primary, exact: true })
const withFigure = (page: Page) => page.getByTestId('hero-with')
const withoutFigure = (page: Page) => page.getByTestId('hero-without')

/** Opens the landing and waits until the widget shows an open offer of the mock book. */
async function openLanding(page: Page): Promise<void> {
  await openApp(page, '/')
  await expect(widget(page)).toHaveAttribute('data-state', 'open')
}

/** How many times `text` is painted at a readable size (a visually hidden copy for screen readers is not counted). */
const countPainted = (page: Page, text: string): Promise<number> =>
  page.evaluate((needle) => {
    let n = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement
      if (!el || !(node.textContent ?? '').includes(needle)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden') n++
    }
    return n
  }, text)

test.describe('Landing', () => {
  test('has its own layout: the headline, a title of its own, no app shell', async ({ page }) => {
    await openApp(page, '/')
    await expect(pageHeading(page)).toHaveText(HERO.h1)
    await expect(pageHeading(page)).toHaveText('Set the lowest price you would sell at.')
    // No highlighter in the headline: the marker is for a term the visitor set.
    await expect(pageHeading(page).locator('mark')).toHaveCount(0)
    await expect(page).toHaveTitle(/^StellSec/)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('footer.shell-footer')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: NAV.label })).toBeVisible()
    // The navigation is the three anchors of the page and one way into the app.
    await expect(page.getByRole('navigation', { name: NAV.label }).getByRole('link')).toHaveText([NAV.lifecycle, NAV.proof, NAV.limits])
    // A mock build has no status line: its one "Mock data" label is on the example it describes.
    await expect(page.getByTestId('status-network')).toHaveCount(0)

    // Headings never skip a level.
    const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((els) => els.map((el) => Number(el.tagName[1])))
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1)
  })

  test('the headline is the largest paint', async ({ page }) => {
    await openApp(page, '/')
    const largest = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries() as Array<PerformanceEntry & { element?: Element | null }>
            resolve(entries[entries.length - 1]?.element?.tagName ?? 'none')
          }).observe({ type: 'largest-contentful-paint', buffered: true })
        }),
    )
    expect(largest).toBe('H1')
  })

  test('paints a recorded example first and reads the book only once the browser is idle', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    // Hold the lazy chunk: everything requested before it is asked for is the page's critical path.
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(LIVE_CHUNK, async (route) => {
      await held
      await route.continue()
    })

    await openApp(page, '/')
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')
    await expect(page.getByTestId('hero-aside')).toHaveText(WIDGET.recordedAside)
    await expect(widget(page)).toContainText(/No\.\s8\b/)
    await expect(widget(page).getByRole('heading', { level: 2 })).toHaveText('Long put, EQTY')
    await expect(page.getByTestId('hero-meta')).toHaveText('This option covered 5.00 EQTY for 1.00 USDx (0.20 per unit), paid once to the maker.')
    await expect(page.getByTestId('hero-source')).toHaveText('Exercised at ledger 5,390,522. The maker had locked 50.00 USDx in the contract.')
    // The recorded put: 5.00 EQTY, floor 10.00, premium 1.00. At 8.00 that is 49.00 with the put and 40.00 without.
    // Each figure is an Amount: its spoken text comes first, then the figure and its unit as drawn.
    await expect(withFigure(page)).toHaveText(/^49\.00\sUSDx/)
    await expect(withoutFigure(page)).toHaveText(/^40\.00\sUSDx/)

    // The page asks for the lazy chunk by itself, after load and idle. Nothing heavy came before it.
    await expect.poll(() => requests.some((url) => url.includes('/landing/live/LiveBook'))).toBe(true)
    expect(requests.filter((url) => HEAVY.test(url))).toEqual([])

    release()
    await expect(widget(page)).toHaveAttribute('data-state', 'open')
    // "Mock data" is said once on the page, on the note it describes; the source line ends at what is locked.
    await expect(page.getByTestId('hero-aside')).toHaveText(WIDGET.openAsideMock)
    expect(await countPainted(page, 'Mock data')).toBe(1)
    await expect(widget(page)).toContainText(/Offer No\.\s\d+/)
    // A figure and its unit are joined by a no-break space: the patterns below say \s there.
    await expect(page.getByTestId('hero-source')).toHaveText(/^Maker\s*\S+ locked [\d,.]+\sUSDx\.$/)
    await expect(page.getByTestId('hero-meta')).toHaveText(/^This offer covers [\d,.]+\sRWA for [\d,.]+\sUSDx \([\d,.]+ per unit\), paid once to the maker\.$/)
    await expectAnnounced(page, WIDGET.announceOpen)
    // Only now was the (mock) chain client loaded.
    expect(requests.some((url) => /mockClient/.test(url))).toBe(true)
  })

  test('keeps the recorded example and offers to try again when the book cannot be read', async ({ page }) => {
    await page.route(LIVE_CHUNK, (route) => route.abort())
    await openApp(page, '/')
    await expect(page.getByTestId('hero-source')).toHaveText(WIDGET.error)
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')
    await page.unroute(LIVE_CHUNK)
    await widget(page).getByRole('button', { name: WIDGET.retry }).click()
    await page.mouse.move(0, 0)
    await expect(widget(page)).toHaveAttribute('data-state', 'open')
  })

  test('the example does not change under a visitor working in the note', async ({ page }) => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(LIVE_CHUNK, async (route) => {
      await held
      await route.continue()
    })
    await openApp(page, '/')
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')

    // The visitor takes the price handle of the recorded example and moves it.
    const handle = slider(page)
    await handle.focus()
    await page.keyboard.press('PageUp')
    const price = await handle.getAttribute('aria-valuenow')
    release()
    // The book is read, but the open offer waits while focus is in the note: nothing moves, nothing is lost.
    await expect(widget(page)).toHaveAttribute('data-held', 'true')
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')
    await expect(handle).toBeFocused()
    await expect(handle).toHaveAttribute('aria-valuenow', price ?? '')

    // Leaving the note lets it show the open offer, without the "print" of a confirmed trade.
    await heroPrimary(page).focus()
    await expect(widget(page)).toHaveAttribute('data-state', 'open')
    await expect(widget(page)).not.toHaveAttribute('data-held', /.*/)
    await expect(widget(page).locator('article')).not.toHaveAttribute('data-printing', /.*/)
  })

  test('the price handle works with the keyboard and moves both outcome figures', async ({ page }) => {
    await openLanding(page)
    const handle = slider(page)
    await handle.focus()
    await expect(handle).toBeFocused()
    const before = { price: await handle.getAttribute('aria-valuenow'), with: await withFigure(page).innerText(), without: await withoutFigure(page).innerText() }

    // One step down: below the floor the put holds its value, the holding without it falls.
    await page.keyboard.press('ArrowLeft')
    await expect(handle).not.toHaveAttribute('aria-valuenow', before.price ?? '')
    expect(await withFigure(page).innerText()).toBe(before.with)
    expect(await withoutFigure(page).innerText()).not.toBe(before.without)

    // To the top of the range: above the floor both figures rise, and the put has only cost its premium.
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', (await handle.getAttribute('aria-valuemax')) ?? '')
    expect(await withFigure(page).innerText()).not.toBe(before.with)
    await expect(widget(page)).toContainText('less with the put')
    await expect(handle).toHaveAttribute('aria-valuetext', /With the put [\d,.]+\sUSDx\. Without [\d,.]+\sUSDx\./)

    // Page Up and Page Down move ten steps; Home goes to the bottom of the range.
    await page.keyboard.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', (await handle.getAttribute('aria-valuemin')) ?? '')
    await expect(widget(page)).toContainText('more with the put')
  })

  test('the three inputs change the offer the note shows', async ({ page }) => {
    await openLanding(page)
    const terms = widget(page).getByRole('group', { name: WIDGET.termsLabel })
    const asset = terms.getByLabel(WIDGET.hold, { exact: true })
    const floor = terms.getByLabel(WIDGET.floor, { exact: true })
    const until = terms.getByLabel(WIDGET.until, { exact: true })
    await expect(widget(page).getByRole('heading', { level: 2 })).toHaveText('Long put, RWA')
    // "Asset" picks the asset, and shows its code; the lot is said in the line under the terms.
    await expect(asset.locator('..')).toContainText('RWA')
    await expect(page.getByTestId('hero-meta')).toContainText(/covers [\d,.]+\sRWA/)
    // Each floor and each deadline says which lot it would show.
    await expect(floor.locator('option').first()).toHaveText(/, for [\d,.]+\sRWA$/)
    await expect(until.locator('option').first()).toHaveText(/, for [\d,.]+\sRWA$/)
    const serial = () => widget(page).locator('p', { hasText: /Offer No\./ }).first().innerText()
    const first = await serial()

    // The visitor moves the price; another floor of the same deadline is another offer, and the price stays.
    const handle = slider(page)
    await handle.focus()
    await page.keyboard.press('PageUp')
    const price = await handle.getAttribute('aria-valuenow')
    const floors = await floor.locator('option').evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value))
    expect(floors.length).toBeGreaterThan(1)
    const current = await floor.inputValue()
    await floor.selectOption(floors.find((value) => value !== current) ?? current)
    await expect.poll(serial).not.toBe(first)
    await expect(handle).toHaveAttribute('aria-valuenow', price ?? '')

    // Another deadline keeps a floor that is on offer there, or says which one it moved to.
    const deadlines = await until.locator('option').evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value))
    expect(deadlines.length).toBeGreaterThan(1)
    await until.selectOption(deadlines[deadlines.length - 1])
    await expect(until).toHaveValue(deadlines[deadlines.length - 1])

    // Another asset starts from that asset's own default terms.
    await asset.selectOption({ label: 'BOND, bond' })
    await expect(widget(page).getByRole('heading', { level: 2 })).toHaveText('Long put, BOND')
    await expect(page.getByTestId('hero-meta')).toHaveText(/^This offer covers [\d,.]+\sBOND for [\d,.]+\sUSDx \([\d,.]+ per unit\), paid once to the maker\.$/)
  })

  test('"Open this offer" opens the asset page with the ticket on that offer', async ({ page }) => {
    await openLanding(page)
    const id = Number(((await widget(page).innerText()).match(/Offer No\.\s(\d+)/) ?? [])[1])
    await widget(page).getByRole('link', { name: WIDGET.open }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/markets/rwa')
    const url = new URL(page.url())
    expect(url.searchParams.get('side')).toBe('buy')
    expect(url.searchParams.get('offer')).toBe(String(id))
  })

  test('"Open the markets" and "Open app" lead into the app', async ({ page }) => {
    await openLanding(page)
    await heroPrimary(page).click()
    // With an open offer in the note, the guided flow opens on the same asset and terms.
    await expect(page).toHaveURL((url) => url.pathname === '/markets/rwa')
    const guided = new URL(page.url()).searchParams
    expect(guided.get('mode')).toBe('guided')
    expect(guided.get('intent')).toBe('floor')
    expect(guided.get('kind')).toBe('put')
    expect(guided.get('strike')).toMatch(/^\d+(\.\d+)?$/)
    expect(guided.get('expiry')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await page.goBack()
    await expect(pageHeading(page)).toHaveText('Set the lowest price you would sell at.')
    await page.getByRole('link', { name: NAV.openApp }).click()
    expect(await currentPath(page)).toBe('/markets')
    await expect(page.locator('footer.shell-footer')).toBeVisible()
  })

  test('before an offer is read, "Open the markets" opens Markets on the floor intent', async ({ page }) => {
    await page.route(LIVE_CHUNK, () => {})
    await openApp(page, '/')
    await heroPrimary(page).click()
    expect(await currentPath(page)).toBe('/markets?intent=floor')
  })

  test('the navigation jumps to the sections of the page', async ({ page }) => {
    await openLanding(page)
    const nav = page.getByRole('navigation', { name: NAV.label })
    for (const [label, id, heading] of [
      [NAV.lifecycle, 'how-it-works', 'How it works'],
      [NAV.proof, 'proof', 'Proof'],
      [NAV.limits, 'limits', 'Limits'],
    ] as const) {
      await nav.getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`#${id}$`))
      const h2 = page.getByRole('heading', { level: 2, name: heading, exact: true })
      await expect(h2).toBeInViewport()
      // The bar stays on screen and the heading lands below it, not under it.
      const bar = await page.getByRole('banner').boundingBox()
      await expect(page.getByRole('banner')).toBeInViewport()
      expect((await h2.boundingBox())?.y ?? 0).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0))
    }
  })

  test('the sections are there, in order, with the Limits list', async ({ page }) => {
    await openLanding(page)
    // No eyebrow above the headline: the headline is the first text of the hero.
    const heroText = await page.locator('#hero-heading').evaluate((h1) => (h1.parentElement?.firstElementChild === h1 ? 'h1 first' : 'something above the h1'))
    expect(heroText).toBe('h1 first')
    // The closing has no heading of its own: the last section heading is Limits.
    const sections = await page.locator('main h2').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()))
    expect(sections).toEqual(['Long put, RWA', 'What you can do', 'What is different', 'How it works', 'Proof', 'Margin', 'Limits'])

    // The three intents, named as everywhere else in the app. Each name is the link into Markets on that intent.
    const intents = page.locator('#what-you-can-do')
    for (const [name, intent] of [
      ['Set a floor', 'floor'],
      ['Get paid to sell higher', 'earn-hold'],
      ['Get paid to buy lower', 'earn-buy'],
    ] as const) {
      await expect(intents.getByRole('heading', { level: 3, name: new RegExp(`^${name}`) })).toBeVisible()
      await expect(intents.getByRole('heading', { level: 3, name: new RegExp(`^${name}`) })).toHaveText(name)
      await expect(intents.getByRole('link', { name: `${name}${INTENTS.linkContext}`, exact: true })).toHaveAttribute('href', `/markets?intent=${intent}`)
    }
    await expect(intents.getByRole('link')).toHaveCount(3)
    await expect(intents).not.toContainText('Choose an asset')

    // Five rows. Each title names who acts; there is no "Who acts" column. The deadline row is the other branch of
    // the exercise: it carries "or".
    const steps = page.getByRole('list', { name: /steps of an option/ }).getByRole('listitem')
    await expect(steps).toHaveCount(5)
    await expect(page.locator('#how-it-works')).not.toContainText('Who acts')
    await expect(steps.nth(2).getByRole('heading', { level: 3 })).toHaveText('Step 3: The holder exercises')
    await expect(steps.nth(3).getByRole('heading', { level: 3 })).toHaveText('Step 3, or: The deadline passes')
    await expect(steps.nth(4).getByRole('heading', { level: 3 })).toHaveText('Step 4: The maker collects')
    // One transaction link per step, nothing under it; no state tags.
    await expect(page.locator('#how-it-works')).not.toContainText('Fee ')
    await expect(page.locator('#how-it-works')).not.toContainText('State after')

    // Limits: one ruled list of sentences, no table and no column heads.
    const limits = page.getByTestId('limits-list')
    await expect(limits).toBeVisible()
    await expect(page.locator('#limits table, #limits th')).toHaveCount(0)
    await expect(limits.getByRole('listitem')).toHaveText(LIMITS.items.map((item) => item.text))
    await expect(page.locator('#limits')).not.toContainText('What exists')

    // Proof: eight claims, one piece of evidence each.
    const proof = page.getByRole('table', { name: PROOF.tableCaption })
    await expect(proof).toBeVisible()
    await expect(proof.getByRole('row')).toHaveCount(9)
    // No stat row under the hero, no questions, no ornament: each figure has one home.
    await expect(page.locator('#questions')).toHaveCount(0)
    expect(await countPainted(page, '0.0079873')).toBe(1)
    expect(await countPainted(page, 'Decorative')).toBe(0)
  })

  test('wording: no banned word, no tagline, the payoff caption on every figure, the legal footer', async ({ page }) => {
    await openLanding(page)
    const text = await bodyText(page)
    expect(findBannedWords(text, BANNED_WORDS)).toEqual([])
    expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
    expect(findBannedWords(text, BANNED_PRICE_TERMS)).toEqual([])
    // No em dashes, arrows or exclamation marks in copy.
    expect(text.match(/[—→←⇒!]/g) ?? []).toEqual([])
    // Margin has its own block and its own wording.
    const margin = await page.getByTestId('margin-block').innerText()
    expect(findBannedWords(margin, MARGIN_BANNED_WORDS)).toEqual([])
    expect(margin).toContain('Payouts can be reduced; any deficit is shown.')
    expect(findBannedWords(text, ['fully collateralized', 'fully collateralised'])).toEqual([])

    // Four payoff figures (the widget and the three intents), each with the required caption for a screen reader;
    // on screen it is printed under the widget's figure and once under the row of three.
    const captions = page.locator('figure > figcaption', { hasText: PAYOFF_CAPTION })
    await expect(captions).toHaveCount(4)
    expect(await countPainted(page, PAYOFF_CAPTION)).toBe(2)
    await expect(page.locator('figcaption', { hasText: /Fig\. \d/ })).toHaveCount(0)

    // A mock build names no network: the status line that names it is on a chain build only.
    expect(await countPainted(page, 'Testnet')).toBe(0)

    // The footer is the app's legal footer: the copyright line and the notice of this build (a mock build here),
    // once each.
    const footer = page.getByRole('contentinfo')
    await expect(footer).toContainText(COPYRIGHT_NOTICE)
    await expect(footer).toContainText(legalNotice(true))
    expect(await countVisible(page, legalNotice(true))).toBe(1)
    // A conventional footer: two link groups (and the contract on a contract build, never on mock data), no section
    // index, no gallery, no crawler file.
    await expect(footer.getByRole('button', { name: 'Copy contract id' })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Design system' })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'llms.txt' })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Learn', exact: true })).toBeVisible()
  })

  test('the closing line links "a few test tokens" to the steps for getting them', async ({ page }) => {
    await openLanding(page)
    const closing = page.getByTestId('landing-closing')
    await expect(closing.getByRole('heading')).toHaveCount(0)
    await expect(closing.getByRole('link', { name: CLOSING.bodyLink })).toHaveAttribute('href', '/markets?funds=1')
    await expect(closing.getByRole('link', { name: CLOSING.primary })).toHaveAttribute('href', '/markets')
  })

  test('is accessible in both themes, with the recorded example and with an open offer', async ({ page }) => {
    await page.route(LIVE_CHUNK, () => {})
    await openApp(page, '/')
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')
    await expectNoAxeViolations(page)

    await page.unroute(LIVE_CHUNK)
    await page.reload()
    await expect(widget(page)).toHaveAttribute('data-state', 'open')
    await expectNoAxeViolations(page)
  })

  test('every control is reachable with the keyboard, in reading order, with a visible focus ring', async ({ page }) => {
    await openLanding(page)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#landing-main')).toBeFocused()

    // From the main landmark: the two hero actions, then the three inputs, then the price handle.
    await page.keyboard.press('Tab')
    await expect(heroPrimary(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: new RegExp(`^${HERO.secondary}`) })).toBeFocused()
    for (const label of [WIDGET.hold, WIDGET.floor, WIDGET.until]) {
      await page.keyboard.press('Tab')
      const field = widget(page).getByLabel(label, { exact: true })
      await expect(field).toBeFocused()
      // The select itself is invisible: the ring is drawn on the typeset term around it.
      const ring = await field.evaluate((el) => getComputedStyle(el.parentElement as Element).boxShadow)
      expect(ring).not.toBe('none')
    }
    await page.keyboard.press('Tab')
    await expect(slider(page)).toBeFocused()
  })
})

// The phone project (390 x 844, touch) runs the describes tagged @phone.
test.describe('Landing on a phone @phone', () => {

  test('fits 390 px: no sideways scroll, 44 px targets, no label collisions in the chart', async ({ page }) => {
    await openLanding(page)
    await expectNoHorizontalOverflow(page)
    await expect(pageHeading(page)).toBeInViewport()
    // The section links are one row under the bar; the way into the app stays in the bar.
    const nav = page.getByRole('navigation', { name: NAV.label })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link')).toHaveText([NAV.lifecycle, NAV.proof, NAV.limits])
    await expect(page.getByRole('link', { name: NAV.openApp })).toBeVisible()

    // Targets a finger has to hit: the bar, the section links, the actions, the three inputs.
    const targets = [
      page.getByRole('link', { name: NAV.openApp }),
      nav.getByRole('link', { name: NAV.lifecycle }),
      nav.getByRole('link', { name: NAV.limits }),
      heroPrimary(page),
      widget(page).getByLabel(WIDGET.hold, { exact: true }),
      widget(page).getByLabel(WIDGET.floor, { exact: true }),
      widget(page).getByLabel(WIDGET.until, { exact: true }),
      widget(page).getByRole('link', { name: WIDGET.open }),
      page.locator('#what-you-can-do').getByRole('link').first(),
    ]
    for (const target of targets) {
      const box = await target.boundingBox()
      expect(box?.height ?? 0, await target.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44)
    }

    // No two labels of a chart overlap, in the widget and in the three small figures.
    const charts = page.getByTestId('with-without-chart')
    await expect(charts).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      const chart = charts.nth(i)
      await chart.scrollIntoViewIfNeeded()
      const overlaps = await chart.evaluate((svg) => {
        const boxes = [...svg.querySelectorAll('text')].map((t) => ({ text: t.textContent ?? '', r: t.getBoundingClientRect() })).filter((b) => b.r.width > 0)
        const hits: string[] = []
        for (let a = 0; a < boxes.length; a++) {
          for (let b = a + 1; b < boxes.length; b++) {
            const x = Math.min(boxes[a].r.right, boxes[b].r.right) - Math.max(boxes[a].r.left, boxes[b].r.left)
            const y = Math.min(boxes[a].r.bottom, boxes[b].r.bottom) - Math.max(boxes[a].r.top, boxes[b].r.top)
            if (x > 1 && y > 1) hits.push(`"${boxes[a].text}" and "${boxes[b].text}"`)
          }
        }
        return hits
      })
      expect(overlaps, `chart ${i + 1}`).toEqual([])
      // The price flag of the widget stays inside its plot.
      const plot = await chart.boundingBox()
      expect(plot?.width ?? 0).toBeLessThanOrEqual(PHONE.width)
    }

    // The handle is a slider here too, and a tap on the plot moves it.
    const handle = slider(page)
    await handle.scrollIntoViewIfNeeded()
    const before = await handle.getAttribute('aria-valuenow')
    const plot = await charts.first().boundingBox()
    if (!plot) throw new Error('no plot')
    await page.touchscreen.tap(plot.x + plot.width * 0.8, plot.y + plot.height * 0.5)
    await expect(handle).not.toHaveAttribute('aria-valuenow', before ?? '')
    await expectNoHorizontalOverflow(page)

    // Far down the page, "Open app" is still in the bar.
    await page.getByRole('heading', { level: 2, name: 'Limits', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('link', { name: NAV.openApp })).toBeInViewport()
  })

  test('is accessible on a phone in both themes', async ({ page }) => {
    await openLanding(page)
    await expectNoAxeViolations(page)
  })

  test('the headline is the largest paint on a phone too, and sets on two lines', async ({ page }) => {
    await openApp(page, '/')
    const largest = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries() as Array<PerformanceEntry & { element?: Element | null }>
            resolve(entries[entries.length - 1]?.element?.tagName ?? 'none')
          }).observe({ type: 'largest-contentful-paint', buffered: true })
        }),
    )
    expect(largest).toBe('H1')
    const lines = await pageHeading(page).evaluate((el) => Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)))
    expect(lines).toBe(2)
  })
})

test.describe('Landing on a small phone @phone', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('fits 360 px without sideways scroll, with the recorded example and with an open offer', async ({ page }) => {
    await page.route(LIVE_CHUNK, () => {})
    await openApp(page, '/')
    await expect(widget(page)).toHaveAttribute('data-state', 'recorded')
    await expectNoHorizontalOverflow(page)
    await page.unroute(LIVE_CHUNK)
    await page.reload()
    await expect(widget(page)).toHaveAttribute('data-state', 'open')
    await expectNoHorizontalOverflow(page)
  })
})
