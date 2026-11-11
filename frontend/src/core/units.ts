// Exact integer-unit helpers shared by every core module: one copy of "amount with its code", "per unit of
// underlying" and the cross-multiplied comparisons. Token amounts are bigint from chain to screen; nothing here
// rounds up (bigint division floors) and nothing uses `number`.
import { NBSP, formatExact, formatUnits } from './format/amount'

/** The minimum a token needs to be formatted with its unit. `TokenInfo` satisfies it. */
export interface UnitToken {
  decimals: number
  code: string
}

/**
 * `5.00 FUND`, figure and code joined by a no-break space (ruling F7): two decimals, grouped, truncated, `<0.01` for a non-zero dust amount (core/format `formatUnits`, the
 * one rule for amounts on screen). Exact digits belong in the Amount popover: use `amtExact` only for a figure the
 * user must act on to the last unit, such as a shortfall.
 */
export const amt = (units: bigint, t: UnitToken): string => `${formatUnits(units, t.decimals)}${NBSP}${t.code}`

/** `470.0055 USDx`: every digit, at least two decimals. For a shortfall, which truncation would understate. */
export const amtExact = (units: bigint, t: UnitToken): string => `${formatExact(units, t.decimals)}${NBSP}${t.code}`

/** Decimal string without grouping or padding (`12.5`), for prefilling an input. Round-trips through `parseAmount`. */
export function plainAmount(units: bigint, decimals: number): string {
  const neg = units < 0n
  const v = neg ? -units : units
  const d = 10n ** BigInt(decimals)
  const frac = decimals > 0 ? (v % d).toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  return `${neg ? '-' : ''}${v / d}${frac ? `.${frac}` : ''}`
}

/** What a per-unit figure needs: a total in quote units for `underlyingQty` units of an underlying. */
export interface Sized {
  underlyingQty: bigint
  underlying: { decimals: number }
}

/**
 * A quote-token total per one whole unit of underlying, in quote units, floored. Null when the quantity is zero.
 * Display and grouping only: settlement always uses the totals.
 */
export function perUnit(total: bigint, o: Sized): bigint | null {
  if (o.underlyingQty <= 0n) return null
  return (total * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty
}

/** Strike per unit of underlying, in quote units, floored. */
export const strikeUnits = (o: Sized & { totalStrike: bigint }): bigint | null => perUnit(o.totalStrike, o)

/** Premium per unit of underlying, in quote units, floored. */
export const premiumUnits = (o: Sized & { totalPremium: bigint }): bigint | null => perUnit(o.totalPremium, o)

/** Per-unit figure as display text (`0.36`, truncated to two decimals), or an en dash when the quantity is zero. */
export function perUnitText(total: bigint, o: Sized, quoteDecimals: number): string {
  const v = perUnit(total, o)
  return v === null ? '–' : formatUnits(v, quoteDecimals)
}

const sign = (l: bigint, r: bigint): number => (l < r ? -1 : l > r ? 1 : 0)

/** Compares `aTotal / aQty` with `bTotal / bQty` exactly, by cross-multiplying (quantities must be positive). */
export function compareRatio(aTotal: bigint, aQty: bigint, bTotal: bigint, bQty: bigint): number {
  return sign(aTotal * bQty, bTotal * aQty)
}

/** Cheaper premium per unit of underlying first. Exact. */
export function byPremiumPerUnit(a: { totalPremium: bigint; underlyingQty: bigint }, b: { totalPremium: bigint; underlyingQty: bigint }): number {
  return compareRatio(a.totalPremium, a.underlyingQty, b.totalPremium, b.underlyingQty)
}

/** Lower strike per unit of underlying first. Exact. */
export function byStrikePerUnit(a: { totalStrike: bigint; underlyingQty: bigint }, b: { totalStrike: bigint; underlyingQty: bigint }): number {
  return compareRatio(a.totalStrike, a.underlyingQty, b.totalStrike, b.underlyingQty)
}

/** Ascending order for bigint ids. */
export const byId = (a: { id: bigint }, b: { id: bigint }): number => sign(a.id, b.id)

/** How much is missing to reach `need`, floored at zero. */
export const shortBy = (have: bigint, need: bigint): bigint => (need > have ? need - have : 0n)
