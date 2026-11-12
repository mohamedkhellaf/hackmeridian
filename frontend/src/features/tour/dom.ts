// The only file of the tour that asks the document: where an anchor is, whether something else is open over the
// page, and how a control is brought into view. Everything here is read at the moment it is called.
import { GUIDE_ANCHOR_ATTRIBUTE, GUIDE_RETURN_ATTRIBUTE } from '../../core/guide'
import type { GuideAnchor } from '../../core/guide'

/** Rendered and not hidden: `display`, `visibility` and `content-visibility` of the element and its ancestors. */
export function isRendered(element: Element): boolean {
  if (!element.isConnected) return false
  if (typeof element.checkVisibility === 'function') return element.checkVisibility({ visibilityProperty: true })
  return element.getClientRects().length > 0
}

/**
 * The element that carries an anchor name and is on screen now. A name can sit on two elements (the top bar's
 * navigation and the phone tab bar; "Connect wallet" and the wallet menu button): only one of them is rendered.
 */
export function findAnchor(name: GuideAnchor): Element | null {
  for (const element of document.querySelectorAll(`[${GUIDE_ANCHOR_ATTRIBUTE}="${name}"]`)) if (isRendered(element)) return element
  return null
}

/** Wholly inside the viewport. */
export function inViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
}

const OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/**
 * A menu, dialog, drawer, sheet or list box is open. The kit portals every one of them to the end of `body`,
 * outside the app's root, so a list that is part of a page is not counted. One that is closing still counts
 * until it has left the document. The guide's own note is not an overlay.
 */
export function overlayOpen(): boolean {
  const root = document.getElementById('root')
  for (const element of document.querySelectorAll(OVERLAYS)) {
    if (root?.contains(element) || element.closest('[data-coachmark]')) continue
    if (isRendered(element)) return true
  }
  return false
}

const prefersReducedMotion = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Sits in a fixed bar (the phone tab bar): it is on screen wherever the page is scrolled. */
function isFixed(element: Element): boolean {
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === 'fixed') return true
  }
  return false
}

/** The gap kept above a group taller than the screen: the mark around it, and a little air. */
const TALL_MARGIN_PX = 20

/**
 * Brings a control into view: centred, or for a group that takes most of the screen, with its start near the top.
 * Smooth, unless the visitor asked for reduced motion: an explicit `smooth` from a script overrides the
 * stylesheet's rule, so the preference is asked here.
 */
export function reveal(target: Element): void {
  if (isFixed(target)) return
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
  const rect = target.getBoundingClientRect()
  if (rect.height > window.innerHeight * 0.6) window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - TALL_MARGIN_PX), behavior })
  else target.scrollIntoView({ block: 'center', inline: 'nearest', behavior })
}

function focusable(element: HTMLElement): boolean {
  return element.matches('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]')
}

/**
 * Puts focus back when a guide ends: on the element that had it before, if it is still on the page; else on the
 * line the welcome leaves behind; else on the page heading. Never on `body`.
 */
export function restoreFocus(previous: Element | null): void {
  const candidates = [previous, document.querySelector(`[${GUIDE_RETURN_ATTRIBUTE}]`), document.querySelector('main h1'), document.querySelector('h1')]
  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement) || candidate === document.body || !isRendered(candidate)) continue
    if (!focusable(candidate)) candidate.setAttribute('tabindex', '-1')
    candidate.focus()
    if (document.activeElement === candidate) return
  }
}
