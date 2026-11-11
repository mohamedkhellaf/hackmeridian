/**
 * What happens around a navigation, outside React: the document title, where focus goes, and which scroll
 * position belongs to which history entry. Installed once on the router by `router.tsx`.
 *
 * - Title: taken from the route's `staticData.title` on every resolved location.
 * - Focus: after a navigation that changed the path, focus moves to the page's `h1` (the ui kit's PageHeader
 *   makes it focusable by script). Not on the first load, and not when only the search or the hash changed.
 * - Scroll: a new page starts at the top, back and forward restore the position, and a navigation that changes
 *   only the search params (opening the ticket, picking a strike) leaves the page where it is.
 */
import type { AnyRouter, ParsedLocation } from '@tanstack/react-router'

export const SITE_NAME = 'StellSec'
export const LANDING_TITLE = 'StellSec: options on tokenized assets, on Stellar'

/** `Markets · StellSec`; the landing has a title of its own. */
export function documentTitle(page: string | undefined): string {
  return page ? `${page} · ${SITE_NAME}` : LANDING_TITLE
}

export const NOT_FOUND_TITLE = 'Page not found'

/** The slice of a route match that the title needs. */
export interface TitleMatch {
  staticData?: { title?: string | ((params: Record<string, string>) => string) }
  params?: unknown
  status?: string
  /** Set by the router on the match that renders the not-found page when no route matched the path. */
  _notFound?: boolean
}

/** The title for a resolved set of matches: the leaf route's own, or "Page not found" when no route matched. */
export function titleOfMatches(matches: readonly TitleMatch[]): string {
  if (matches.some((match) => match._notFound === true || match.status === 'notFound')) return documentTitle(NOT_FOUND_TITLE)
  const leaf = matches[matches.length - 1]
  const title = leaf?.staticData?.title
  return documentTitle(typeof title === 'function' ? title((leaf?.params ?? {}) as Record<string, string>) : title)
}

/**
 * `/markets/$asset`: `BOND · Markets`. The segment is a slug (shown in capitals), `CODE-ISSUER` (the code) or a
 * contract id, which is never spelled out in a tab title. Anything else is "Asset": the title never echoes an
 * arbitrary segment.
 */
export function assetTitle(params: Record<string, string>): string {
  const raw = params.asset ?? ''
  const code = /^([A-Za-z0-9]{1,12})-G[A-Z2-7]{55}$/.exec(raw)?.[1] ?? raw
  const isId = /^C[A-Z0-9_]{20,}$/.test(raw)
  return `${!isId && /^[A-Za-z0-9-]{2,24}$/.test(code) ? code.toUpperCase() : 'Asset'} · Markets`
}

/** `/portfolio/$id`: `Position 12 · Portfolio`; an id that is not a number is not echoed. */
export function positionTitle(params: Record<string, string>): string {
  return /^\d{1,20}$/.test(params.id ?? '') ? `Position ${params.id} · Portfolio` : 'Position · Portfolio'
}

// --- Scroll keys ------------------------------------------------------------------------------------------

const historyKey = (location: ParsedLocation): string => location.state.__TSR_key ?? location.href

/**
 * History entry key -> the scroll key it shares. Entries of the same path reached one from another (a search
 * param changed) share one key, so the router restores the position it has just saved: the page does not move.
 */
const sharedScrollKey = new Map<string, string>()

export function scrollKeyOf(location: ParsedLocation): string {
  const key = historyKey(location)
  return sharedScrollKey.get(key) ?? key
}

/** Records which scroll key a new history entry uses. Exported for the unit test. */
export function linkScrollKey(from: Pick<ParsedLocation, 'pathname' | 'state' | 'href'> | undefined, to: Pick<ParsedLocation, 'pathname' | 'state' | 'href'>): void {
  const toKey = historyKey(to as ParsedLocation)
  if (sharedScrollKey.has(toKey)) return
  const samePage = from !== undefined && from.pathname === to.pathname
  sharedScrollKey.set(toKey, samePage ? scrollKeyOf(from as ParsedLocation) : toKey)
  // The map only needs the entries a user can still travel back to in practice.
  if (sharedScrollKey.size > 400) {
    const oldest = sharedScrollKey.keys().next().value
    if (oldest !== undefined) sharedScrollKey.delete(oldest)
  }
}

// --- Focus -------------------------------------------------------------------------------------------------

/** The heading a page wants focused: the first `h1` inside the main landmark, else the first `h1`. */
function pageHeading(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')
}

let focusAttempt = 0

/**
 * Moves focus to the page heading once it exists. A lazy page may render a frame or two after the route resolves.
 * Also used by the error page after a "Try again" that worked.
 */
export function focusPageHeading(): void {
  const attempt = ++focusAttempt
  const started = performance.now()
  const tryFocus = () => {
    if (attempt !== focusAttempt) return
    const heading = pageHeading()
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
      return
    }
    if (performance.now() - started < 2000) requestAnimationFrame(tryFocus)
  }
  tryFocus()
}

// --- Installation ------------------------------------------------------------------------------------------

export function installNavigationEffects(router: AnyRouter): void {
  if (typeof document === 'undefined') return

  // Before the router snapshots and restores scroll positions for this navigation.
  router.subscribe('onBeforeLoad', (event) => {
    linkScrollKey(event.fromLocation, event.toLocation)
  })

  router.subscribe('onResolved', () => {
    document.title = titleOfMatches(router.state.matches)
  })

  router.subscribe('onRendered', (event) => {
    // `fromLocation` is missing on the first load: the document starts at the top, with the skip link first.
    if (!event.fromLocation || !event.pathChanged) return
    // A link to a section of another page: the browser scrolls to it; leave focus to follow the hash target.
    if (event.toLocation.hash) return
    focusPageHeading()
  })
}
