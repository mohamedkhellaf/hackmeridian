import { useEffect, useState } from 'react'

/**
 * Which section of a long page the reader is in: the last one whose top has passed a line a quarter of the way
 * down the viewport. At the very bottom of the page the last section wins, since it may be too short to reach
 * that line. Returns the first id until something has scrolled.
 */
export function useActiveSection<T extends string>(ids: readonly T[]): [T, (id: T) => void] {
  const [active, setActive] = useState<T>(ids[0])

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const line = Math.max(96, window.innerHeight * 0.25)
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      const doc = document.documentElement
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) current = ids[ids.length - 1]
      setActive(current)
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ids])

  return [active, setActive]
}
