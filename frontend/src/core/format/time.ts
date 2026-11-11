// Display text for instants and deadlines (brief section 6.3 and D17).
//
// The canonical form is UTC, `13 Nov 2026, 08:00 UTC`; local time is secondary. Expiry is decided by ledger close
// time on chain, so every countdown here is an estimate from the wall clock and floors (it never shows more time
// than is left).

import { NO_VALUE } from './amount'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const pad2 = (n: number) => String(n).padStart(2, '0')

function utc(ts: number): Date | null {
  if (!Number.isFinite(ts)) return null
  const d = new Date(ts * 1000)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `13 Nov 2026, 08:00 UTC` for unix seconds. The canonical form of every deadline. */
export function formatUtc(ts: number): string {
  const d = utc(ts)
  return d ? `${formatUtcDate(ts)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC` : NO_VALUE
}

/** `13 Nov 2026` (UTC day). */
export function formatUtcDate(ts: number): string {
  const d = utc(ts)
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : NO_VALUE
}

/** `13 Nov` (UTC day), for expiry tabs and chips where the year is clear from context. */
export function formatUtcDay(ts: number): string {
  const d = utc(ts)
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : NO_VALUE
}

/** `08:00 UTC`. */
export function formatUtcTime(ts: number): string {
  const d = utc(ts)
  return d ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC` : NO_VALUE
}

/** `2026-11-13T08:00:00Z`, the value for `<time dateTime>`. Empty when the timestamp is not a real instant. */
export function isoUtc(ts: number): string {
  const d = utc(ts)
  return d ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : ''
}

/**
 * Local time in the same shape, with the zone's short name: `13 Nov 2026, 09:00 CET`. `timeZone` is an IANA
 * name and defaults to the browser's zone; it is a parameter so tests and server rendering are deterministic.
 */
export function formatLocal(ts: number, timeZone?: string): string {
  const d = utc(ts)
  if (!d) return NO_VALUE
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).formatToParts(d)
  } catch {
    return formatUtc(ts) // unknown zone name: fall back to the canonical form, which is always true
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const month = MONTHS[Number(get('month')) - 1] ?? ''
  const zone = get('timeZoneName')
  return `${Number(get('day'))} ${month} ${get('year')}, ${get('hour')}:${get('minute')}${zone ? ` ${zone}` : ''}`
}

/** Whole seconds from `nowSec` to `expiryTs`. Negative once the deadline has passed. */
export function secondsUntil(expiryTs: number, nowSec: number): number {
  return Math.floor(expiryTs - nowSec)
}

/**
 * Time left as `2 d 4 h`, `3 h 12 min`, `8 min`, `<1 min`; `expired` at zero or below.
 * Floors every unit, drops a zero second unit (`2 d`, `3 h`) and drops hours from ten days up (`45 d`).
 */
export function formatCountdown(secondsLeft: number): string {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return 'expired'
  const s = Math.floor(secondsLeft)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3_600)
  const m = Math.floor((s % 3_600) / 60)
  if (d >= 10) return `${d} d`
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  return m > 0 ? `${m} min` : '<1 min'
}

/** How close a deadline is (brief D17): 48 h and 2 h reminders, and the last 15 minutes where signing may not land. */
export type DeadlineUrgency = 'far' | 'within48h' | 'within2h' | 'within15min' | 'past'

export const URGENCY_48H_SECONDS = 48 * 3_600
export const URGENCY_2H_SECONDS = 2 * 3_600
export const URGENCY_15MIN_SECONDS = 15 * 60

/** Thresholds are inclusive: exactly 48 h left is already `within48h`. Zero or less is `past`. */
export function deadlineUrgency(secondsLeft: number): DeadlineUrgency {
  if (!(secondsLeft > 0)) return 'past'
  if (secondsLeft <= URGENCY_15MIN_SECONDS) return 'within15min'
  if (secondsLeft <= URGENCY_2H_SECONDS) return 'within2h'
  if (secondsLeft <= URGENCY_48H_SECONDS) return 'within48h'
  return 'far'
}
