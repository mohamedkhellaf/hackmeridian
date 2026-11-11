// What the payoff figure of a ticket needs, built from exact terms. The curve itself always comes from
// packages/payoff through core/payoff/leg (longPut, longCall, shortPut, shortCall); the labels printed on the
// figure are formatted from the exact integers, never from the floats that position them. Everything here is
// hypothetical by construction.
import { formatUnits } from '../../core/format'
import { legNumbers, legPnlOf, toNumber } from '../../core/payoff/leg'
import type { Money } from '../../core/options/types'
import type { ReferencePrice } from '../../core/reference'
import { priceDomain, samplePiecewise } from '../../viz'
import type { PayoffExtreme, PayoffReference, Point, PriceMark } from '../../viz'
import { breakevenPerUnit, mostYouCanGain, mostYouCanLose, strikePerUnit } from './terms'
import type { Leg, Side } from './terms'

export interface PayoffModel {
  points: Point[]
  domain: [number, number]
  strike: PriceMark
  breakevens: PriceMark[]
  maxGain: PayoffExtreme
  maxLoss: PayoffExtreme
  /** Present only when the asset has a reference price. Its label carries the source. */
  reference?: PayoffReference
  /** Where the handle starts: the reference price, else the strike. */
  defaultPrice: number
  /** Profit and loss of the whole lot at a price per unit, premium included. */
  pnl: (price: number) => number
}

export { legNumbers }

/** An extreme of the figure: a capped amount with its exact label, or an unlimited side. */
function extreme(money: Money | null, at?: number): PayoffExtreme {
  if (money === null) return { value: Number.POSITIVE_INFINITY }
  const e: PayoffExtreme = { value: toNumber(money.amount, money.token.decimals), label: formatUnits(money.amount, money.token.decimals) }
  if (at !== undefined) e.at = at
  return e
}

/**
 * The payoff figure of `leg` seen from `side`. Null when the terms cannot be drawn (a zero quantity or strike).
 * `reference` is the asset's reference price; without one the figure is centred on the strike.
 */
export function payoffModel(leg: Leg, side: Side, reference: ReferencePrice | null): PayoffModel | null {
  const k = strikePerUnit(leg)
  const be = breakevenPerUnit(leg)
  if (leg.underlyingQty <= 0n || leg.totalStrike <= 0n || leg.totalPremium < 0n || k === null || be === null) return null
  const numbers = legNumbers(leg)
  const pnl = (price: number): number => legPnlOf(numbers, leg.kind, side, price)
  const qd = leg.quote.decimals
  const strike = numbers.strikeTotal / numbers.qty
  const breakeven = toNumber(be, qd)
  const ref = reference?.perUnit != null && reference.perUnit > 0n ? reference.perUnit : null
  const refNumber = ref === null ? null : toNumber(ref, qd)
  const domain = priceDomain({ center: refNumber ?? strike, include: [strike, breakeven] })
  // The capped extreme of a put sits at a price of zero; of a call side, anywhere past the strike.
  const atZero = leg.kind === 'put' ? 0 : undefined
  const model: PayoffModel = {
    points: samplePiecewise(pnl, domain, [strike]),
    domain,
    strike: { value: strike, label: formatUnits(k, qd) },
    breakevens: [{ value: breakeven, label: formatUnits(be, qd) }],
    maxGain: extreme(mostYouCanGain(leg, side), side === 'long' ? atZero : undefined),
    maxLoss: extreme(mostYouCanLose(leg, side), side === 'short' ? atZero : undefined),
    defaultPrice: refNumber ?? strike,
    pnl,
  }
  if (ref !== null && refNumber !== null && reference) model.reference = { value: refNumber, label: `${reference.label} ${formatUnits(ref, qd)}` }
  return model
}
