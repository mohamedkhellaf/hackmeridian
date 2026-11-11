// Display text for instants and deadlines (brief section 6.3 and D17).
//
// The canonical form is UTC, `13 Nov 2026, 08:00 UTC`; local time is secondary. Expiry is decided by ledger close
// time on chain, so every countdown here is an estimate from the wall clock and floors (it never shows more time
// than is left).
//
// A date, a time or a duration never breaks inside (ruling F7): every space within `13 Nov 2026`, `08:00 UTC` and
// `3 h 12 min` is a no-break space (U+00A0). The only place a line may break is after the comma of the full form.

import { NBSP, NO_VALUE } from './amount'

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
  return d ? `${formatUtcDate(ts)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}${NBSP}UTC` : NO_VALUE
}

/** `13 Nov 2026` (UTC day). */
export function formatUtcDate(ts: number): string {
  const d = utc(ts)
  return d ? `${d.getUTCDate()}${NBSP}${MONTHS[d.getUTCMonth()]}${NBSP}${d.getUTCFullYear()}` : NO_VALUE
}

/** `13 Nov` (UTC day), for expiry tabs and chips where the year is clear from context. */
export function formatUtcDay(ts: number): string {
  const d = utc(ts)
  return d ? `${d.getUTCDate()}${NBSP}${MONTHS[d.getUTCMonth()]}` : NO_VALUE
}

/** `08:00 UTC`. */
export function formatUtcTime(ts: number): string {
  const d = utc(ts)
  return d ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}${NBSP}UTC` : NO_VALUE
}

/** `13:45:12 UTC`, to the second: when a read was made or until when a transaction can still be included. */
export function formatUtcClock(ts: number): string {
  const d = utc(ts)
  return d ? `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}${NBSP}UTC` : NO_VALUE
}

/**
 * A short zone name as the product writes it: an offset from UTC is `UTC+1`, `UTC\u221210` (true minus), never
 * `GMT-10`; a named zone (`CET`, `BST`) stays as the browser gives it.
 */
export function zoneLabel(name: string): string {
  const m = /^(?:GMT|UTC)(?:([+-\u2212])(\d{1,2})(?::?(\d{2}))?)?$/.exec(name.trim())
  if (!m) return name
  if (!m[1]) return 'UTC'
  const sign = m[1] === '+' ? '+' : '\u2212'
  return `UTC${sign}${Number(m[2])}${m[3] && m[3] !== '00' ? `:${m[3]}` : ''}`
}

/** `2026-11-13T08:00:00Z`, the value for `<time dateTime>`. Empty when the timestamp is not a real instant. */
export function isoUtc(ts: number): string {
  const d = utc(ts)
  return d ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : ''
}

/**
 * Local time in the same shape, with the zone's short name: `13 Nov 2026, 09:00 CET`, `19 Nov 2026, 22:00
 * UTC\u221210` (an offset is written from UTC with a true minus, `zoneLabel`). `timeZone` is an IANA
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
  const zone = zoneLabel(get('timeZoneName'))
  return `${Number(get('day'))}${NBSP}${month}${NBSP}${get('year')}, ${get('hour')}:${get('minute')}${zone ? `${NBSP}${zone}` : ''}`
}

/** Whole seconds from `nowSec` to `expiryTs`. Negative once the deadline has passed. */
export function secondsUntil(expiryTs: number, nowSec: number): number {
  return Math.floor(expiryTs - nowSec)
}

/**
 * Time left as `2 d 4 h`, `3 h 12 min`, `8 min`, `<1 min`; `expired` at zero or below. Every space is a no-break
 * space, so a duration stays on one line (ruling F7).
 * Floors every unit, drops a zero second unit (`2 d`, `3 h`) and drops hours from ten days up (`45 d`).
 */
export function formatCountdown(secondsLeft: number): string {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return 'expired'
  const s = Math.floor(secondsLeft)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3_600)
  const m = Math.floor((s % 3_600) / 60)
  return countdownWords(d, h, m).replaceAll(' ', NBSP)
}

function countdownWords(d: number, h: number, m: number): string {
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
