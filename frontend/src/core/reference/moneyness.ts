// Moneyness and exercise value against a reference price, in exact bigint units.
//
// Every function takes a `ReferencePrice`, or a bare per-unit price (the user's own assumed price), or null. With
// no price the answer is `unknown` or null: nothing is guessed. Results are hints for the interface ("in the money
// at the reference price 10.00"); they never decide a transaction.

import { formatUnits } from '../format/amount'
import type { OptionKind } from '../options/types'
import type { ReferencePrice } from './types'

export type PriceInput = ReferencePrice | bigint | null | undefined

/** The usable per-unit price of an input: positive quote units, or null. */
export function priceOf(ref: PriceInput): bigint | null {
  const p = typeof ref === 'bigint' ? ref : (ref?.perUnit ?? null)
  return p !== null && p > 0n ? p : null
}

export type Moneyness = 'in' | 'at' | 'out' | 'unknown'

/**
 * Where a strike stands against the reference. A put is in the money when its strike is above the price, a call
 * when its strike is below. `band` widens "at the money" to strikes within that many quote units of the price
 * (default: exact equality).
 */
export function moneyness(kind: OptionKind, strikePerUnit: bigint, ref: PriceInput, band: bigint = 0n): Moneyness {
  const price = priceOf(ref)
  if (price === null) return 'unknown'
  const diff = strikePerUnit - price
  const abs = diff < 0n ? -diff : diff
  if (abs <= (band > 0n ? band : 0n)) return 'at'
  return (kind === 'put') === diff > 0n ? 'in' : 'out'
}

/**
 * What exercising one unit would be worth at the reference: `max(strike − price, 0)` for a put,
 * `max(price − strike, 0)` for a call. Null without a price.
 */
export function intrinsicPerUnit(kind: OptionKind, strikePerUnit: bigint, ref: PriceInput): bigint | null {
  const price = priceOf(ref)
  if (price === null) return null
  const v = kind === 'put' ? strikePerUnit - price : price - strikePerUnit
  return v > 0n ? v : 0n
}

/** The terms `exerciseValue` needs. `OptionOffer` and `Bid` satisfy it. */
export interface ExerciseTerms {
  kind: OptionKind
  underlying: { decimals: number }
  underlyingQty: bigint
  totalStrike: bigint
}

/**
 * What exercising the whole option now would be worth against not exercising, in quote units, signed.
 *
 * - Put: the strike received minus the value, at the reference, of the underlying delivered.
 * - Call: the value, at the reference, of the underlying received minus the strike paid.
 *
 * Positive means exercising beats holding at that price; negative means it would lose that much. The premium
 * already paid is not part of it. The difference is computed exactly and then truncated toward zero, so neither
 * a gain nor a loss is overstated. Null without a price.
 */
export function exerciseValue(option: ExerciseTerms, ref: PriceInput): bigint | null {
  const price = priceOf(ref)
  if (price === null) return null
  const scale = 10n ** BigInt(option.underlying.decimals)
  const numerator =
    option.kind === 'put' ? option.totalStrike * scale - option.underlyingQty * price : option.underlyingQty * price - option.totalStrike * scale
  return numerator / scale
}

/**
 * Moneyness of a whole option, exact even when its strike per unit is not a round amount (the totals are
 * compared, nothing is divided). `at` only on exact equality.
 */
export function optionMoneyness(option: ExerciseTerms, ref: PriceInput): Moneyness {
  const price = priceOf(ref)
  if (price === null) return 'unknown'
  const strikeSide = option.totalStrike * 10n ** BigInt(option.underlying.decimals)
  const priceSide = option.underlyingQty * price
  if (strikeSide === priceSide) return 'at'
  return (option.kind === 'put') === strikeSide > priceSide ? 'in' : 'out'
}

/**
 * How far the strike is from the reference, as a percentage of the reference: `+2.5` for a strike 2.5 % above,
 * `−4` for one 4 % below. A display number, truncated to two decimals; null without a price.
 */
export function distancePct(strikePerUnit: bigint, ref: PriceInput): number | null {
  const price = priceOf(ref)
  if (price === null) return null
  return Number(((strikePerUnit - price) * 10_000n) / price) / 100
}

export interface DescribeOptions {
  quoteCode: string
  quoteDecimals: number
  underlyingCode: string
  /** Fraction digits of the figure. Default 2; raise it for an asset priced in cents. */
  dp?: number
}

/**
 * The reference as one line with its source, for a caption or an accessible name:
 * `Testnet faucet price: 10.00 USDx per RWA. Fixed by the team's faucet. Not a market.`
 * Without a price: `No reference price. Set an assumed price to see what an option would pay.`
 */
export function describeReference(ref: ReferencePrice, o: DescribeOptions): string {
  const price = priceOf(ref)
  if (price === null) return `${ref.label}. ${ref.note}`
  return `${ref.label}: ${formatUnits(price, o.quoteDecimals, { dp: o.dp })} ${o.quoteCode} per ${o.underlyingCode}. ${ref.note}`
}
