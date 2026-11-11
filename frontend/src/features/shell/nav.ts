// The navigation model of the app shell: which sections exist, where each one lives in the chrome, and which
// section a path belongs to. Pure data and functions (no React), so the rules are unit-tested in nav.test.ts.
// The route manifest itself is src/app/router.tsx; this file only names the top-level destinations.
import { plural } from '../../core/format'

export type SectionId = 'markets' | 'portfolio' | 'requests' | 'reserves' | 'learn' | 'margin' | 'issuer' | 'activity' | 'design'

/** The top-level paths the shell links to. Each one is a route of src/app/router.tsx. */
export type AppPath = '/markets' | '/portfolio' | '/requests' | '/reserves' | '/learn' | '/margin' | '/issuer' | '/activity' | '/design'

export interface NavEntry {
  id: SectionId
  to: AppPath
  /** One word in the bars; the phone top bar shows it as the page title. */
  label: string
}

export const SECTIONS: Readonly<Record<SectionId, NavEntry>> = {
  markets: { id: 'markets', to: '/markets', label: 'Markets' },
  portfolio: { id: 'portfolio', to: '/portfolio', label: 'Portfolio' },
  requests: { id: 'requests', to: '/requests', label: 'Requests' },
  reserves: { id: 'reserves', to: '/reserves', label: 'Reserves' },
  learn: { id: 'learn', to: '/learn', label: 'Learn' },
  margin: { id: 'margin', to: '/margin', label: 'Margin' },
  issuer: { id: 'issuer', to: '/issuer', label: 'Issuer' },
  activity: { id: 'activity', to: '/activity', label: 'Activity' },
  design: { id: 'design', to: '/design', label: 'Design system' },
}

/** Left side of the desktop top bar, and the first four tabs on phones. */
export const PRIMARY_NAV: readonly NavEntry[] = [SECTIONS.markets, SECTIONS.portfolio, SECTIONS.requests, SECTIONS.reserves]

/** Right side of the desktop top bar. Margin exists only in a build with VITE_ENABLE_PRO=1. */
export function secondaryNav(marginEnabled: boolean): NavEntry[] {
  return marginEnabled ? [SECTIONS.learn, SECTIONS.margin] : [SECTIONS.learn]
}

/** Behind "More": the fifth tab on phones and the overflow menu between 768 and 1199 px. */
export function moreNav(marginEnabled: boolean): NavEntry[] {
  return [...secondaryNav(marginEnabled), SECTIONS.issuer, SECTIONS.activity]
}

/** Footer links, in the order of the brief. The repository link is added by the footer itself. */
export const FOOTER_NAV: readonly NavEntry[] = [SECTIONS.learn, SECTIONS.reserves, SECTIONS.issuer, SECTIONS.design]

/** The section a path belongs to: `/markets/bond` is Markets, `/margin/vault` is Margin. Null outside the app. */
export function sectionOf(pathname: string): SectionId | null {
  const first = pathname.split('/').find((part) => part !== '')
  if (first === undefined) return null
  return Object.prototype.hasOwnProperty.call(SECTIONS, first) ? (first as SectionId) : null
}

/** What the phone top bar shows as the page title. */
export function sectionTitle(pathname: string): string {
  const id = sectionOf(pathname)
  return id ? SECTIONS[id].label : 'StellSec'
}

/** True when `pathname` is inside one of `entries` (the More tab is current on Learn, Margin, Issuer, Activity). */
export function containsSection(entries: readonly NavEntry[], pathname: string): boolean {
  const id = sectionOf(pathname)
  return id !== null && entries.some((entry) => entry.id === id)
}

/** The sentence a screen reader hears after "Portfolio": `2 actions waiting`. */
export function actionsWaitingLabel(count: number): string {
  return `${count} ${plural(count, { one: 'action waiting', other: 'actions waiting' })}`
}

/**
 * Where an arrow key moves inside the More list: Down and Up wrap, Home and End jump. Null for any other key.
 * `index` is the focused item, or -1 when focus is not on an item yet.
 */
export function nextMenuIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowUp':
      return index <= 0 ? count - 1 : index - 1
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
