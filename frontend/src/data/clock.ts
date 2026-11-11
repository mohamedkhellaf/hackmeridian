// A shared clock for derived data (deadlines, "expired" filters, urgency). One timer for the whole app, running
// only while something reads it. `useNowSec(step)` re-renders its caller once per step, not once per second.
//
// Deadlines are decided by ledger close time, not by this device. When the latest ledger read shows the device
// clock off by more than `LEDGER_OFFSET_MIN_MS`, every "now" of the data layer (and every kit `Countdown`, through
// the `ClockProvider` the data provider mounts) is corrected by that offset. Below the threshold the offset is
// left at zero: the latest ledger closed up to one ledger (about 5 s) before it was read, so a smaller gap says
// nothing about the device. Mock data has no ledger: the offset stays zero.
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

/** A gap between ledger and device below this is the age of the ledger, not a wrong device clock. */
export const LEDGER_OFFSET_MIN_MS = 15_000
/** A gap above this is a broken reading (a ledger far in the past), never applied. */
export const LEDGER_OFFSET_MAX_MS = 24 * 3_600_000

let offsetMs = 0
const offsetListeners = new Set<() => void>()

/**
 * Records the close time of the latest ledger (unix seconds) read at `readAtMs` (device clock). Called by the
 * ledger query. Returns the offset now in force.
 */
export function noteLedgerTime(closeTimeSec: number | null, readAtMs: number = Date.now()): number {
  if (closeTimeSec === null || !Number.isFinite(closeTimeSec)) return offsetMs
  const gap = closeTimeSec * 1000 - readAtMs
  const next = Math.abs(gap) >= LEDGER_OFFSET_MIN_MS && Math.abs(gap) <= LEDGER_OFFSET_MAX_MS ? gap : 0
  if (next !== offsetMs) {
    offsetMs = next
    for (const l of offsetListeners) l()
  }
  return offsetMs
}

/** The ledger-minus-device offset in milliseconds (0 on mock data, before the first read, or within the threshold). */
export const ledgerOffsetMs = (): number => offsetMs

/** For tests: back to no offset. */
export function resetLedgerOffset(): void {
  noteLedgerTime(null)
  if (offsetMs !== 0) {
    offsetMs = 0
    for (const l of offsetListeners) l()
  }
}

function subscribeOffset(listener: () => void): () => void {
  offsetListeners.add(listener)
  return () => offsetListeners.delete(listener)
}

/** The ledger offset, re-rendering when a ledger read changes it. Feeds the kit's `ClockProvider`. */
export function useLedgerOffsetMs(): number {
  return useSyncExternalStore(subscribeOffset, ledgerOffsetMs, ledgerOffsetMs)
}

/** Unix seconds rounded down to a multiple of `stepSec`, on ledger time (the device clock plus the offset). */
export const steppedNow = (stepSec: number, ms: number = Date.now() + offsetMs): number => {
  const step = Math.max(1, Math.floor(stepSec))
  return Math.floor(ms / 1000 / step) * step
}

/**
 * The current time in unix seconds, rounded down to `stepSec` (default 10 s), on ledger time. Derived hooks use
 * it as "now". Pass 1 for a live countdown.
 */
export function useNowSec(stepSec: number = 10): number {
  return useSyncExternalStore(
    subscribe,
    () => steppedNow(stepSec),
    () => steppedNow(stepSec),
  )
}

/** The current time in epoch milliseconds on ledger time, stepped to `stepSec` (default 1 s): a `Countdown`'s `now`. */
export function useLedgerNowMs(stepSec: number = 1): number {
  return useNowSec(stepSec) * 1000
}
