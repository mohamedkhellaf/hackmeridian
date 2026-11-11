// A shared clock for derived data (deadlines, "expired" filters, urgency). One timer for the whole app, running
// only while something reads it. `useNowSec(step)` re-renders its caller once per step, not once per second.
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  timer ??= setInterval(() => {
    for (const l of listeners) l()
  }, 1_000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Unix seconds rounded down to a multiple of `stepSec`. */
export const steppedNow = (stepSec: number, ms: number = Date.now()): number => {
  const step = Math.max(1, Math.floor(stepSec))
  return Math.floor(ms / 1000 / step) * step
}

/**
 * The current time in unix seconds, rounded down to `stepSec` (default 10 s). Derived hooks use it as "now":
 * the chain decides expiry by ledger close time, so a few seconds of lag here never decides anything.
 * Pass 1 for a live countdown.
 */
export function useNowSec(stepSec: number = 10): number {
  return useSyncExternalStore(
    subscribe,
    () => steppedNow(stepSec),
    () => steppedNow(stepSec),
  )
}
