/**
 * Pure presentation helpers used by the components here. No amounts are parsed or computed: figures arrive as
 * strings already formatted by the caller from exact integers.
 */

const NBSP = '\u00a0' // a figure and its unit never part at a line end
const ELLIPSIS = '\u2026'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type DateInput = Date | number | string

export function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** `2026-11-13T08:00:00Z`, for the `datetime` attribute. Seconds precision. */
export function toIsoUtc(value: DateInput): string {
  return `${toDate(value).toISOString().slice(0, 19)}Z`
}

export type UtcFormat = 'full' | 'table' | 'date'

/**
 * The canonical time form: `13 Nov 2026, 08:00 UTC`.
 * `table` is `13 Nov 08:00` (the column header carries the zone); `date` is `13 Nov 2026`.
 */
export function formatUtcDateTime(value: DateInput, format: UtcFormat = 'full'): string {
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  if (format === 'date') return `${day} ${month} ${year}`
  if (format === 'table') return `${day} ${month} ${time}`
  return `${day} ${month} ${year}, ${time} UTC`
}

/**
 * The secondary line: `09:00 your time (UTC+1)`, with the local date in front when it differs from the UTC date.
 * `timeZone` is for tests; by default the viewer's zone is used.
 */
export function formatLocalTime(value: DateInput, timeZone?: string): string {
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  // "GMT+1" reads "UTC+1", "GMT-10" reads "UTC−10" with the true minus; a zero offset is plain "UTC".
  const offset = get('timeZoneName').replace('GMT', 'UTC').replace(/^UTC[+-]0(?::00)?$/, 'UTC').replace('-', '\u2212')
  const localDay = `${get('day')} ${get('month')}`
  const utcDay = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  const time = `${get('hour')}:${get('minute')}`
  return `${localDay === utcDay ? '' : `${localDay}, `}${time} your time (${offset})`
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

export function countdownParts(msLeft: number): CountdownParts {
  const total = Math.max(0, Math.floor(msLeft / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: msLeft <= 0,
  }
}

/**
 * `2 d 4 h`, `5 h 12 min`, `12 min`, `<1 min`: the rule of core/format's `formatCountdown`, so a deadline reads the
 * same everywhere. Two units at most, a zero second unit is dropped (`2 d`, `3 h`), hours go from ten days up
 * (`45 d`). Time left is truncated, never rounded up.
 */
export function formatCountdown(msLeft: number): string {
  const { days, hours, minutes } = countdownParts(msLeft)
  const u = (n: number, unit: string) => `${n}${NBSP}${unit}`
  if (days >= 10) return u(days, 'd')
  if (days > 0) return hours > 0 ? `${u(days, 'd')} ${u(hours, 'h')}` : u(days, 'd')
  if (hours > 0) return minutes > 0 ? `${u(hours, 'h')} ${u(minutes, 'min')}` : u(hours, 'h')
  if (minutes > 0) return u(minutes, 'min')
  return `<1${NBSP}min`
}

const plural = new Intl.PluralRules('en')
const UNIT_WORDS = {
  day: { one: 'day', other: 'days' },
  hour: { one: 'hour', other: 'hours' },
  minute: { one: 'minute', other: 'minutes' },
  second: { one: 'second', other: 'seconds' },
} as const

function words(n: number, unit: keyof typeof UNIT_WORDS): string {
  return `${n} ${UNIT_WORDS[unit][plural.select(n) === 'one' ? 'one' : 'other']}`
}

/** The same value in words for screen readers: "2 days 4 hours", "less than a minute". */
export function formatCountdownWords(msLeft: number): string {
  const { days, hours, minutes } = countdownParts(msLeft)
  if (days >= 10) return words(days, 'day')
  if (days > 0) return hours > 0 ? `${words(days, 'day')} ${words(hours, 'hour')}` : words(days, 'day')
  if (hours > 0) return minutes > 0 ? `${words(hours, 'hour')} ${words(minutes, 'minute')}` : words(hours, 'hour')
  if (minutes > 0) return words(minutes, 'minute')
  return 'less than a minute'
}

/** How often a countdown needs to repaint: every second under an hour, every minute above. */
export function countdownTickMs(msLeft: number): number {
  return msLeft < 3_600_000 ? 1000 : 60_000
}

export type AddressLength = 'short' | 'medium' | 'full'

/** `GBE6…3ZEG` in tables (4+4), `GBE6AB…XY3ZEG` on decision surfaces (6+6), the whole string where it is typed or pasted. */
export function shortenAddress(value: string, length: AddressLength = 'short'): string {
  if (length === 'full') return value
  const keep = length === 'medium' ? 6 : 4
  if (value.length <= keep * 2 + 1) return value
  return `${value.slice(0, keep)}${ELLIPSIS}${value.slice(-keep)}`
}

/** `1c3bb34c…9f7a` (8+4). */
export function shortenHash(hash: string): string {
  if (hash.length <= 13) return hash
  return `${hash.slice(0, 8)}${ELLIPSIS}${hash.slice(-4)}`
}

/** The full string in groups of four, for places where an address is checked character by character. */
export function groupAddress(value: string): string[] {
  const groups: string[] = []
  for (let i = 0; i < value.length; i += 4) groups.push(value.slice(i, i + 4))
  return groups
}

/**
 * Keeps a typed or pasted amount a plain decimal string: digits and one point. No sign, no exponent, at most
 * `decimals` fraction digits. It never converts to a number.
 *
 * Separators. The interface is English, so a point is the decimal point and a comma groups thousands:
 * "1,000" is 1000 and "1,234,567" is 1234567, as the app prints them. A single comma that cannot be grouping
 * (not followed by exactly three digits, or after a zero: "1,5", "0,500") is read as the decimal point, so a
 * comma typed out of habit does not multiply the amount. When both kinds appear, the last one is the decimal
 * point and the other is grouping ("1,234.56" and "1.234,56" are both 1234.56). A second point is ignored.
 */
/** "1,000": a non-zero integer part, then the comma, then exactly three digits and nothing more. */
function commaGroupsThousands(raw: string): boolean {
  const digits = raw.replace(/[^0-9,]/g, '')
  const [int = '', frac = ''] = digits.split(',')
  return /[1-9]/.test(int) && /^\d{3}$/.test(frac)
}

/** True when a pasted or typed amount carries an exponent ("1e3"): the field refuses it rather than guess. */
export function hasExponent(raw: string): boolean {
  return /\d\s*[eE]\s*[-+]?\s*\d/.test(raw)
}

export function sanitizeDecimalInput(raw: string, decimals?: number): string {
  const commas = raw.split(',').length - 1
  const points = raw.split('.').length - 1
  let decimalMark: ',' | '.' | null = null
  if (commas > 0 && points > 0) decimalMark = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.'
  else if (points > 0) decimalMark = '.'
  else if (commas === 1 && !commaGroupsThousands(raw)) decimalMark = ','

  let out = ''
  let seenPoint = false
  let fraction = 0
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (seenPoint) {
        if (decimals !== undefined && fraction >= decimals) continue
        fraction += 1
      }
      out += ch
    } else if (ch === decimalMark && !seenPoint) {
      // An asset without fraction digits: what follows the decimal mark is dropped, not appended.
      if (decimals === 0) break
      seenPoint = true
      out += '.'
    }
  }
  if (out.startsWith('.')) out = `0${out}`
  // "007" is "7"; "0", "0." and "0.5" stay as typed.
  const leading = /^0+(?=\d)/.exec(out)
  if (leading) out = out.slice(leading[0].length)
  return out
}
