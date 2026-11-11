// Display text for Margin amounts. USDx has 7 decimals; quantities are whole lots. Everything truncates
// (core/format); `toChartNumber` is the only way an amount becomes a `number`, and only for a drawing.
import { NO_VALUE, formatExact, formatUnits, groupDigits } from '../../../core/format'
import { USDX_DECIMALS } from '../../../core/pro/types'

export const QUOTE = 'USDx'

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
