import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * The rendered width of a chart container, so 1 SVG unit is 1 CSS pixel and labels keep their size on phones.
 * Measured before the first paint and again whenever the container is resized.
 */
export function useChartWidth<T extends HTMLElement = HTMLDivElement>(fallback = 480, min = 160): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = Math.floor(el.clientWidth)
      if (w > 0) setWidth(Math.max(min, w))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [min])
  return [ref, width]
}
