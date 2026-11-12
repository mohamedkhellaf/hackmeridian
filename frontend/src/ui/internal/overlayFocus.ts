import type { RefObject } from 'react'

/** Where focus goes when a dialog, drawer or sheet opens. */
export type InitialFocus =
  /** The title (default). Reading starts at the top, nothing destructive is armed, no keyboard pops up on phones. */
  | 'title'
  /** The first field or button of the body. For forms. */
  | 'first-control'
  /** A specific element, for example the Cancel button of a destructive confirmation. */
  | RefObject<HTMLElement | null>

const TABBABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** Translates the policy into what Base UI's `initialFocus` expects. Elements are found by id when the overlay opens. */
export function resolveInitialFocus(
  policy: InitialFocus,
  titleId: string,
  bodyId: string,
): RefObject<HTMLElement | null> | (() => HTMLElement | null) {
  if (policy === 'title') return () => document.getElementById(titleId)
  if (policy === 'first-control') {
    return () =>
      document.getElementById(bodyId)?.querySelector<HTMLElement>(TABBABLE) ?? document.getElementById(titleId)
  }
  return policy
}
