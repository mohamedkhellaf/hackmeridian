import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Below this width of its column the mirrored chain takes its phone layout (each half's size under its figure):
 * four halves of figure and size, the strike, and the word "yours" at the edge of a side need about 680 px.
 */
export const NARROW_CHAIN_PX = 680

/** Below this width the book of a series (six fixed columns) becomes a list. */
export const NARROW_BOOK_PX = 640

/** Below this width an order table that carries its series ("Your orders", "Other offers") becomes a list. */
export const NARROW_SERIES_PX = 760

/**
 * True while the element is narrower than `below`. Measured before the first paint, so the phone layout never
 * flashes the wide table. The layout depends on the width of the column the chain sits in, not on the window.
 */
export function useNarrow(ref: RefObject<HTMLElement | null>, below: number = NARROW_CHAIN_PX): boolean {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setNarrow(el.getBoundingClientRect().width < below)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, below])
  return narrow
}
