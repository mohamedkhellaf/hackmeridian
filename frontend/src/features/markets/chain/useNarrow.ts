import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/** Below this width of its column the mirrored chain would clip, so calls and puts become two halves. */
export const NARROW_CHAIN_PX = 560

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
