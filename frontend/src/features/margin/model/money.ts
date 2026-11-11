// Display text for Margin amounts. USDx has 7 decimals; quantities are whole lots. Everything truncates
// (core/format); `toChartNumber` is the only way an amount becomes a `number`, and only for a drawing.
import { NO_VALUE, formatExact, formatUnits, groupDigits } from '../../../core/format'
import { USDX_DECIMALS } from '../../../core/pro/types'

export const QUOTE = 'USDx'

/** Between a figure and its unit in running text: the two never break apart. */
export const NBSP = '\u00a0'

/** A figure and its unit for a sentence, an accessible name or a label: `20,437.84 USDx`, unbreakable. */
export function withUnit(figure: string, unit: string = QUOTE): string {
  return `${figure}${NBSP}${unit}`
}

/** `23,507.59`, or a dash when the source has no value. */
export function usdx(v: bigint | null | undefined): string {
  return v == null ? NO_VALUE : formatUnits(v, USDX_DECIMALS)
}

/** Every digit: `23,507.5984`. For the exact-value popover and for figures a user must act on. */
export function usdxExact(v: bigint): string {
  return formatExact(v, USDX_DECIMALS)
}

/** A per-lot price at 4 decimals, so a column of marks lines up. */
export function perLot(v: bigint | null | undefined): string {
  return v == null ? NO_VALUE : formatUnits(v, USDX_DECIMALS, { dp: 4 })
}

/** The lowest per-lot price at 4 decimals that is not under `v`: a minimum stated at 4 decimals rounds up. */
export function perLotAtLeast(v: bigint): string {
  const step = 10n ** BigInt(USDX_DECIMALS - 4)
  const up = v % step === 0n ? v : (v / step + 1n) * step
  return formatUnits(up, USDX_DECIMALS, { dp: 4 })
}

/** Whole lots, grouped: `1,000`. */
export function lots(v: bigint | null | undefined): string {
  return v == null ? NO_VALUE : groupDigits(v.toString())
}

/** An amount as typed into a field: no grouping, every digit, at least no trailing point. */
export function usdxInput(v: bigint): string {
  return formatExact(v, USDX_DECIMALS, { minDp: 0, group: false })
}

/** For drawings only (health bar, waterfall). Never for a figure that is printed or signed. */
export { toChartNumber } from '../../../core/pro/coverage'

/**
 * A share in basis points as a percentage: `1000` is `10 %`, `250` is `2.5 %`. Exact: 1 bp is 0.01 %, so two
 * decimals hold every value; trailing zeros are dropped.
 */
export function bpsPercent(bps: number): string {
  const b = Math.max(0, Math.trunc(bps))
  const whole = Math.floor(b / 100)
  const frac = (b % 100).toString().padStart(2, '0').replace(/0+$/, '')
  return `${whole}${frac ? `.${frac}` : ''}${NBSP}%`
}
