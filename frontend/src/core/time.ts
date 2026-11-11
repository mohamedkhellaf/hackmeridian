// Clock and calendar helpers shared by every core module: one copy of nowSec, MONTHS, the expiry day key and the
// compact countdown. The display formats of the new UI (`13 Nov 2026, 08:00 UTC`, `2 d 4 h`, deadline urgency)
// live in core/format; the functions here keep the compact forms the Margin tables and the ported logic use.
// As in core/format (ruling F7), a duration or a date never breaks inside: its spaces are no-break spaces.

export const SECONDS_PER_DAY = 86_400

/** Wall clock in ms. A function so callers can stub it and components can call it without tripping purity lint. */
export const nowMs = (): number => Date.now()

/** Wall clock in unix seconds (the unit of every expiry). Ledger close time decides expiry on chain, not this. */
export const nowSec = (): number => Math.floor(Date.now() / 1000)

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const pad2 = (n: number) => String(n).padStart(2, '0')

/** U+00A0: the space inside a date, a time or a duration, so it never breaks across lines (ruling F7). */
const NBSP = '\u00A0'

/**
 * UTC calendar day of an expiry, `2026-10-29`. This is the one grouping key for expiries: the chain columns,
 * the "lowest offer in this series" lookup and the `expiry=YYYY-MM-DD` search param all use it, so two users in
 * different time zones see the same series.
 */
export function expiryDay(expiryUnix: number): string {
  return new Date(expiryUnix * 1000).toISOString().slice(0, 10)
}

/** `29 Oct` for a day key (`2026-10-29`). */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d}${NBSP}${MONTHS[m - 1]}`
}

/**
 * Time left until `expiryUnix` in the compact table form: `3d 0h`, `5h 12m`, `12m`, or `expired`. Never shows
 * `0m` while open. `atMs` is injectable for tests. Not the same function as `formatCountdown(secondsLeft)` in
 * core/format (`2 d 4 h`), which is the form for new screens.
 */
export function compactCountdown(expiryUnix: number, atMs: number = Date.now()): string {
  const secs = Math.floor(expiryUnix - atMs / 1000)
  if (secs <= 0) return 'expired'
  const d = Math.floor(secs / SECONDS_PER_DAY)
  const h = Math.floor((secs % SECONDS_PER_DAY) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d${NBSP}${h}h`
  if (h > 0) return `${h}h${NBSP}${m}m`
  return `${Math.max(m, 1)}m`
}

/** Elapsed or remaining seconds as `40s`, `2m 10s`, `1h 5m`, `3d 4h`. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m${NBSP}${s % 60}s`
  if (s < SECONDS_PER_DAY) return `${Math.floor(s / 3600)}h${NBSP}${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / SECONDS_PER_DAY)}d${NBSP}${Math.floor((s % SECONDS_PER_DAY) / 3600)}h`
}

/** Compact local expiry for tables, `29 Oct 06:04`; the year is added when it is not the current one. */
export function formatExpiryShort(expiryUnix: number, atMs: number = Date.now()): string {
  const d = new Date(expiryUnix * 1000)
  const year = d.getFullYear() !== new Date(atMs).getFullYear() ? `${NBSP}${d.getFullYear()}` : ''
  return `${d.getDate()}${NBSP}${MONTHS[d.getMonth()]}${year} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** UTC time without the zone, `29 Oct 2026 06:04`, for a column whose header says UTC. */
export function formatUtcShort(unix: number): string {
  const d = new Date(unix * 1000)
  return `${d.getUTCDate()}${NBSP}${MONTHS[d.getUTCMonth()]}${NBSP}${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

/** Value for `<input type="datetime-local">`: local time without a zone, `YYYY-MM-DDTHH:mm`. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Unix seconds for a `datetime-local` value (read as local time), or null when it does not parse. */
export function fromLocalInput(text: string): number | null {
  const ms = new Date(text).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}
