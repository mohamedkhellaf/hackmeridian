import { formatAmount } from '../options/format'
import { compactCountdown, formatDuration, formatUtcShort } from '../time'
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
export const duration = formatDuration

/** Fixture time without the zone, `29 Oct 2026 06:04`, for a column whose header says UTC. */
export const whenShort = formatUtcShort

/** Fixture time as `29 Oct 2026 06:04 UTC`. */
export const when = (unix: number) => `${whenShort(unix)} UTC`

/** Time left on the fixture clock, `2d 23h` (same format as the market tables). */
export const countdown = (expiry: number, now: number) => compactCountdown(expiry, now * 1000)
