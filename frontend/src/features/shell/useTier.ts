// Which of the three shell layouts the viewport gets, and whether the bar is wide enough for the ledger number.
// The page breakpoints of the design system are 768 and 1200 px; the bar has one more, 900 px, where the
// wordmark returns and every section fits in one line. The CSS uses the same numbers, so what is rendered and how
// it is laid out always agree.
import { useSyncExternalStore } from 'react'

/** `phone` below 768 px, `tablet` from 768 to 899 px (sections past the main four sit under More), `desktop` from 900 px. */
export type Tier = 'phone' | 'tablet' | 'desktop'

export const PHONE_QUERY = '(max-width: 767.98px)'
export const DESKTOP_QUERY = '(min-width: 900px)'
/** From here the network indicator has room for the ledger number. */
export const WIDE_QUERY = '(min-width: 1200px)'

/** The tier for two media query answers. Exported for the unit test. */
export function tierOf(isPhone: boolean, isDesktop: boolean): Tier {
  if (isPhone) return 'phone'
  return isDesktop ? 'desktop' : 'tablet'
}

const canMatch = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function readTier(): Tier {
  if (!canMatch()) return 'desktop'
  return tierOf(window.matchMedia(PHONE_QUERY).matches, window.matchMedia(DESKTOP_QUERY).matches)
}

const readWide = (): boolean => !canMatch() || window.matchMedia(WIDE_QUERY).matches

function subscribe(onChange: () => void): () => void {
  if (!canMatch()) return () => {}
  const lists = [window.matchMedia(PHONE_QUERY), window.matchMedia(DESKTOP_QUERY), window.matchMedia(WIDE_QUERY)]
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

/** The current tier, kept in step with the viewport. */
export function useTier(): Tier {
  return useSyncExternalStore(subscribe, readTier, () => 'desktop' as Tier)
}

/** True from 1200 px. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, readWide, () => true)
}
