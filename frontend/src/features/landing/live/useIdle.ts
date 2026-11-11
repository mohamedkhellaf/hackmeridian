import { useEffect, useState } from 'react'

/**
 * False for the first paint, true once the page has loaded and the browser has been idle (or 2.5 s have passed).
 * The landing uses it to start reading the book only after the hero has painted.
 */
export function useIdle(): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let handle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = () => setIdle(true)
    const arm = () => {
      if (typeof window.requestIdleCallback === 'function') handle = window.requestIdleCallback(done, { timeout: 2500 })
      else timer = setTimeout(done, 600)
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.removeEventListener('load', arm)
      if (handle !== undefined) window.cancelIdleCallback(handle)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])
  return idle
}
