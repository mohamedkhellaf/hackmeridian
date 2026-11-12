// What the payoff figure of a ticket needs, built from exact terms. The curve itself always comes from
// packages/payoff through core/payoff/leg (longPut, longCall, shortPut, shortCall); the labels printed on the
// figure are formatted from the exact integers, never from the floats that position them. Everything here is
// hypothetical by construction.
import { formatUnits } from '../../core/format'
import { legNumbers, legPnlOf, toNumber } from '../../core/payoff/leg'
import type { Money } from '../../core/options/types'
import type { ReferencePrice } from '../../core/reference'
import { priceDomain, samplePiecewise } from '../../viz'
import type { PayoffExtreme, PayoffLabels, PayoffReference, Point, PriceMark } from '../../viz'
import { breakevenPerUnit, mostYouCanGain, mostYouCanLose, premiumPerUnit, strikePerUnit } from './terms'
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
  /** Arrow-key step of the handle: a two-hundredth of the range, in whole cents. */
  step: number
  /** Profit and loss of the whole lot at a price per unit, premium included. */
  pnl: (price: number) => number
  /**
   * A written call locks the underlying, so its falling side is what it gives up, not a loss: the chart's words for
   * that side, and the description read in place of the generated one (which would say "unlimited").
   */
  labels?: Partial<PayoffLabels>
  description?: string
}

export { legNumbers }

/** An extreme of the figure: a capped amount with its exact label, or an open side. */
function extreme(money: Money | null, at?: number): PayoffExtreme {
  if (money === null) return { value: Number.POSITIVE_INFINITY }
  const e: PayoffExtreme = { value: toNumber(money.amount, money.token.decimals), label: formatUnits(money.amount, money.token.decimals) }
  if (at !== undefined) e.at = at
  return e
}

/**
 * Half the width of the price axis, from the option itself: wide enough for four premiums per unit (so the loss
 * area has a height), three times the distance from the reference to the strike, and two per cent of the strike.
 * A fixed share of the price would squeeze the strike, the breakeven and the reference onto a few pixels.
 */
export function halfWidth(strike: number, premiumPerUnitNumber: number, reference: number | null): number {
  return Math.max(4 * premiumPerUnitNumber, reference === null ? 0 : 3 * Math.abs(reference - strike), 0.02 * strike)
}

/**
 * The payoff figure of `leg` seen from `side`. Null when the terms cannot be drawn (a zero quantity or strike).
 * `reference` is the asset's reference price; without one the figure is centred on the strike.
 */
export function payoffModel(leg: Leg, side: Side, reference: ReferencePrice | null): PayoffModel | null {
  const k = strikePerUnit(leg)
  const be = breakevenPerUnit(leg)
  const p = premiumPerUnit(leg)
  if (leg.underlyingQty <= 0n || leg.totalStrike <= 0n || leg.totalPremium < 0n || k === null || be === null || p === null) return null
  const numbers = legNumbers(leg)
  const pnl = (price: number): number => legPnlOf(numbers, leg.kind, side, price)
  const qd = leg.quote.decimals
  const strike = numbers.strikeTotal / numbers.qty
  const breakeven = toNumber(be, qd)
  const ref = reference?.perUnit != null && reference.perUnit > 0n ? reference.perUnit : null
  const refNumber = ref === null ? null : toNumber(ref, qd)
  const center = refNumber ?? strike
  const half = halfWidth(strike, toNumber(p, qd), refNumber)
  const domain = priceDomain({ center, range: half / center, include: [strike, breakeven, ...(refNumber === null ? [] : [refNumber])] })
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
    step: Math.max(0.01, Math.round(((domain[1] - domain[0]) / 200) * 100) / 100),
    pnl,
  }
  if (ref !== null && refNumber !== null && reference) model.reference = { value: refNumber, label: `${reference.label} ${formatUnits(ref, qd)}` }
  if (side === 'short' && leg.kind === 'call') {
    const strikeLabel = formatUnits(k, qd)
    model.labels = { maxLoss: 'Gives up the rise above', unlimited: strikeLabel }
    model.description = [
      `Strike ${strikeLabel}`,
      `Breakeven ${formatUnits(be, qd)}`,
      `Most you can gain ${formatUnits(leg.totalPremium, qd)} ${leg.quote.code}`,
      `Gives up the rise above ${strikeLabel}`,
      ...(model.reference ? [model.reference.label] : []),
    ].join('. ')
  }
  return model
}
