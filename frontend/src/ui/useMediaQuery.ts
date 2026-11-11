import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept current. For the few places where the markup itself differs by width
 * (a table that becomes a list on phones, a ticket that is a rail or a drawer); layout alone belongs in CSS.
 * Without a window (tests, a first render on a server) it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}

/** The two breakpoints of the system, as media queries. */
export const PHONE_QUERY = '(max-width: 767.98px)'
export const WIDE_QUERY = '(min-width: 1200px)'

/** True under the 768 px breakpoint: tables become lists, dialogs become sheets, the ticket is a page. */
export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY)

/** True from the 1200 px breakpoint: the ticket rail sits beside the page. */
export const useIsWide = (): boolean => useMediaQuery(WIDE_QUERY)
