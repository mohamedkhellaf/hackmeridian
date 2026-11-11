import { formatCountdown } from '../market/series'
import { formatAmount } from '../options/format'
import { USDX_DECIMALS } from './types'

/** Shown where the source has no value. */
export const DASH = '–'

/** USDx amount, fixed 2 decimals like the rest of the app; a dash when the value is unknown. */
export function usdx(v: bigint | null | undefined): string {
  return v == null ? DASH : formatAmount(v, USDX_DECIMALS, 2, 2)
}

/** Per-lot price (mark), fixed 4 decimals so a column lines up. */
export function perLot(v: bigint | null | undefined): string {
  return v == null ? DASH : formatAmount(v, USDX_DECIMALS, 4, 4)
}

/** Exact USDx value, for a tooltip next to a rounded amount. */
export const exact = (v: bigint | null | undefined) => (v == null ? undefined : `${formatAmount(v, USDX_DECIMALS, USDX_DECIMALS, 2)} USDx`)

export const lots = (v: bigint | null | undefined) => (v == null ? DASH : v.toLocaleString('en-US'))

/** Seconds as "2m 10s" / "1h 5m" / "3d 4h". */
export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Fixture time without the zone, `29 Oct 2026 06:04`, for a column whose header says UTC. */
export function whenShort(unix: number): string {
  const d = new Date(unix * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Fixture time as `29 Oct 2026 06:04 UTC`. */
export const when = (unix: number) => `${whenShort(unix)} UTC`

/** Time left on the fixture clock, `2d 23h` (same format as the market tables). */
export const countdown = (expiry: number, now: number) => formatCountdown(expiry, now * 1000)
