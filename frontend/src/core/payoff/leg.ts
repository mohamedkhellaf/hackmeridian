// One option seen from one side of the trade: its exact figures and its payoff.
//
// The exact part prices nothing: it rearranges the contract's own totals (strike plus or minus premium, per unit
// of underlying, truncated) in integer units. The payoff part is the adapter to packages/payoff for a single leg,
// long or short; its numbers are for a drawing, never for a figure that is printed or signed. `leg.test.ts`
// checks that the exact figures and the package's floats agree.
import { longCall, longPut, shortCall, shortPut, toNumber } from '../../../../packages/payoff/src/index.ts'
import type { OptionLeg } from '../../../../packages/payoff/src/index.ts'
import type { Money, OptionKind, TokenInfo } from '../options/types'
import { perUnit } from '../units'

export { toNumber }
export type { OptionLeg }

/** The terms an offer, a bid, a resale listing, a position and a draft all have. An `OptionOffer` is one. */
export interface Leg {
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  /** What the long side pays the short side: the premium, or the resale price. */
  totalPremium: bigint
  /** Unix seconds. */
  expiry: number
}

/** `long` holds the option (buy, bid, resale buy, list). `short` wrote it (write, fill). */
export type Side = 'long' | 'short'

const floorZero = (v: bigint): bigint => (v < 0n ? 0n : v)

/** Strike for one whole unit of underlying, in quote units, truncated. Null for a zero quantity. */
export const strikePerUnit = (leg: Pick<Leg, 'underlying' | 'underlyingQty' | 'totalStrike'>): bigint | null => perUnit(leg.totalStrike, leg)

/** Premium for one whole unit of underlying, in quote units, truncated. */
export const premiumPerUnit = (leg: Pick<Leg, 'underlying' | 'underlyingQty' | 'totalPremium'>): bigint | null => perUnit(leg.totalPremium, leg)

/**
 * The price at expiry at which the option pays back exactly its premium: strike minus premium per unit for a
 * put (never below zero), strike plus premium per unit for a call. The same price for both sides. Truncated.
 */
export function breakevenPerUnit(leg: Pick<Leg, 'kind' | 'underlying' | 'underlyingQty' | 'totalStrike' | 'totalPremium'>): bigint | null {
  const total = leg.kind === 'put' ? floorZero(leg.totalStrike - leg.totalPremium) : leg.totalStrike + leg.totalPremium
  return perUnit(total, leg)
}

/**
 * The most this side can lose on the option itself, or null when there is no cap.
 * Long: the premium. Short put: the strike paid for an asset worth nothing, less the premium.
 * Short call: no cap (every rise above the strike is given up), so null.
 */
export function mostYouCanLose(leg: Pick<Leg, 'kind' | 'quote' | 'totalStrike' | 'totalPremium'>, side: Side): Money | null {
  if (side === 'long') return { token: leg.quote, amount: leg.totalPremium }
  if (leg.kind === 'put') return { token: leg.quote, amount: floorZero(leg.totalStrike - leg.totalPremium) }
  return null
}

/**
 * The most this side can gain on the option itself, or null when there is no cap.
 * Short: the premium. Long put: the strike for an asset worth nothing, less the premium. Long call: no cap.
 */
export function mostYouCanGain(leg: Pick<Leg, 'kind' | 'quote' | 'totalStrike' | 'totalPremium'>, side: Side): Money | null {
  if (side === 'short') return { token: leg.quote, amount: leg.totalPremium }
  if (leg.kind === 'put') return { token: leg.quote, amount: floorZero(leg.totalStrike - leg.totalPremium) }
  return null
}

/** What the holder hands over on exercise: the underlying for a put, the strike for a call. */
export function exerciseGives(leg: Pick<Leg, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>): Money {
  return leg.kind === 'put' ? { token: leg.underlying, amount: leg.underlyingQty } : { token: leg.quote, amount: leg.totalStrike }
}

/** What the holder receives on exercise: the strike for a put, the underlying for a call. */
export function exerciseReceives(leg: Pick<Leg, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>): Money {
  return leg.kind === 'put' ? { token: leg.quote, amount: leg.totalStrike } : { token: leg.underlying, amount: leg.underlyingQty }
}

// ---------------------------------------------------------------------------------------------- payoff (display numbers)

/** Exact terms as the display numbers packages/payoff takes. For a figure only. */
export function legNumbers(leg: Pick<Leg, 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike' | 'totalPremium'>): OptionLeg {
  return {
    qty: toNumber(leg.underlyingQty, leg.underlying.decimals),
    strikeTotal: toNumber(leg.totalStrike, leg.quote.decimals),
    premiumTotal: toNumber(leg.totalPremium, leg.quote.decimals),
  }
}

const PNL = {
  long: { put: longPut, call: longCall },
  short: { put: shortPut, call: shortCall },
} as const

/** Profit and loss at expiry of the whole lot, premium included, at a price per unit of underlying. Hypothetical. */
export function legPnlOf(numbers: OptionLeg, kind: OptionKind, side: Side, price: number): number {
  return PNL[side][kind](numbers, price).total
}

/** The same from exact terms. For many prices, convert once with `legNumbers` and call `legPnlOf`. */
export function legPnl(leg: Pick<Leg, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike' | 'totalPremium'>, side: Side, price: number): number {
  return legPnlOf(legNumbers(leg), leg.kind, side, price)
}
