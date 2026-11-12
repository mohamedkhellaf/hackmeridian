// The figure of the hero widget: what a holding is worth at the deadline with a put and without one.
//
// No payoff maths here. The values come from core/payoff/strategies (`setFloor`, which calls `protectivePut` of
// packages/payoff); this file only prepares them for the chart and turns them into text. Everything derived from
// an assumed price is a display `number` and is labelled an estimate; the terms themselves are exact `bigint`
// units formatted with core/format (truncated, never rounded up).
import { formatNumber, formatUnits } from '../../../core/format'
import { guidedTermsOf, setFloor } from '../../../core/payoff/strategies'
import type { GuidedTerms } from '../../../core/payoff/strategies'
import { premiumUnits, strikeUnits } from '../../../core/units'
import { niceStep, priceDomain, snapToStep } from '../../../viz'

/** The exact terms of the put the widget shows: an open offer, a resale listing or the recorded option. */
export interface FloorTerms {
  underlying: { code: string; decimals: number }
  quote: { code: string; decimals: number }
  underlyingQty: bigint
  totalStrike: bigint
  /** What the buyer pays: the maker's premium, or the reselling holder's ask. */
  totalPremium: bigint
  /** Unix seconds. */
  expiry: number
}

export interface FloorFigure {
  /** Display numbers for the chart. Never converted back into an amount. */
  numbers: GuidedTerms
  strike: number
  domain: [number, number]
  /** One arrow key on the price handle; `largeStep` is Page Up and Page Down. */
  step: number
  largeStep: number
  /** Where the handle starts: a fifth under the floor, so the figure opens on the case the put is bought for. */
  startPrice: number
  points: { x: number; with: number; without: number }[]
  /** Exact figures as text, from the `bigint` terms. */
  text: {
    qty: string
    strike: string
    premium: string
    premiumPerUnit: string
    collateral: string
  }
}

/**
 * The chart model of a put held against `terms.underlyingQty` of the asset. `referencePerUnit` (quote units for
 * one unit, or null) only widens the axis so the reference price stays in view.
 */
export function floorFigure(terms: FloorTerms, referencePerUnit: bigint | null = null): FloorFigure {
  const numbers = guidedTermsOf(terms)
  const strike = numbers.strike
  const perUnit = numbers.premiumTotal / numbers.qty
  const reference = referencePerUnit !== null && referencePerUnit > 0n ? Number(referencePerUnit) / 10 ** terms.quote.decimals : null
  const domain = priceDomain({ center: strike, include: [Math.max(strike - perUnit, 0), ...(reference === null ? [] : [reference])] })
  const step = niceStep(domain[1] - domain[0], 80) || strike / 100
  const startPrice = Math.max(domain[0], snapToStep(strike * 0.8, step))
  const curve = setFloor(numbers, startPrice, { from: domain[0], to: domain[1], steps: 1 }).curve
  const q = terms.quote.decimals
  return {
    numbers,
    strike,
    domain,
    step,
    largeStep: step * 10,
    startPrice,
    points: curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue })),
    text: {
      qty: formatUnits(terms.underlyingQty, terms.underlying.decimals),
      strike: formatUnits(strikeUnits(terms) ?? 0n, q),
      premium: formatUnits(terms.totalPremium, q),
      premiumPerUnit: formatUnits(premiumUnits(terms) ?? 0n, q),
      collateral: formatUnits(terms.totalStrike, q),
    },
  }
}

export interface FloorOutcome {
  price: number
  priceText: string
  withText: string
  withoutText: string
  /** The gap between the two as a magnitude, with `direction` saying which way it goes. */
  differenceText: string
  direction: 'more' | 'less' | 'same'
  /** True when the put is in the money at this price, so its holder would exercise. */
  exercised: boolean
}

const DP = 2

/** What the holder would have at an assumed price, with the put and without it. A hypothetical, for display. */
export function floorOutcome(figure: FloorFigure, price: number): FloorOutcome {
  const at = Math.min(figure.domain[1], Math.max(figure.domain[0], price))
  const o = setFloor(figure.numbers, at, { from: figure.domain[0], to: figure.domain[1], steps: 1 })
  const rounded = Number(o.difference.toFixed(DP))
  return {
    price: at,
    priceText: formatNumber(at, { dp: DP }),
    withText: formatNumber(o.withValue, { dp: DP }),
    withoutText: formatNumber(o.withoutValue, { dp: DP }),
    differenceText: formatNumber(Math.abs(o.difference), { dp: DP }),
    direction: rounded > 0 ? 'more' : rounded < 0 ? 'less' : 'same',
    exercised: o.exercised,
  }
}
