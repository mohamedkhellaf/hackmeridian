import { formatAmount } from '../options/format'
import { USDX_DECIMALS } from './types'

export const DASH = '—'

/** USDx (7 decimals), at least 2 and at most 4 decimals; a dash when the value is unknown. */
export function usdx(v: bigint | null | undefined, maxFraction = 4): string {
  return v == null ? DASH : formatAmount(v, USDX_DECIMALS, maxFraction, 2)
}

export const lots = (v: bigint | null | undefined) => (v == null ? DASH : v.toLocaleString('en-US'))

/** Seconds as "2m 10s" / "1h 5m" / "3d 4h". */
export function duration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

export function when(unix: number): string {
  return new Date(unix * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
}
