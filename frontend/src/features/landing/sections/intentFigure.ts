// The three small figures of "Three things you can do": one recorded option each, seen from one side.
// The values come from core/payoff/strategies; this file only samples them for the chart.
import { formatUnits } from '../../../core/format'
import { guidedOutcome, guidedTermsOf } from '../../../core/payoff/strategies'
import type { GuidedIntent, UnitTerms } from '../../../core/payoff/strategies'
import { strikeUnits } from '../../../core/units'
import { priceDomain } from '../../../viz'

export interface IntentFigure {
  points: { x: number; with: number; without: number }[]
  domain: [number, number]
  strike: number
  /** Strike per unit, exact, as text. */
  strikeText: string
}

/** What the user would hold at the deadline with and without the option, across prices around the strike. */
export function intentFigure(intent: GuidedIntent, option: UnitTerms): IntentFigure {
  const terms = guidedTermsOf(option)
  const at = guidedOutcome(intent, terms, terms.strike)
  const domain = priceDomain({ center: terms.strike, include: [at.breakeven] })
  const curve = guidedOutcome(intent, terms, terms.strike, { from: domain[0], to: domain[1], steps: 1 }).curve
  return {
    points: curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue })),
    domain,
    strike: terms.strike,
    strikeText: formatUnits(strikeUnits(option) ?? 0n, option.quote.decimals),
  }
}
