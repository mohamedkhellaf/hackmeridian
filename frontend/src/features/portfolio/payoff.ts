// The payoff figure of one position, prepared for the viz kit. The profit and loss is the option leg alone,
// premium included, as its holder or its writer has it: `legPnlOf` of core/payoff/leg (packages/payoff
// underneath). Numbers here are for the chart only; every label is formatted from the exact integer terms.
import { formatUnits } from '../../core/format'
import type { OptionOffer } from '../../core/options/types'
import { breakevenPerUnit, legNumbers, legPnlOf } from '../../core/payoff/leg'
import { guidedOutcome, guidedTermsOf, intentFor } from '../../core/payoff/strategies'
import type { Role } from '../../core/portfolio/positions'
import { priceOf } from '../../core/reference'
import type { ReferencePrice } from '../../core/reference'
import { strikeUnits } from '../../core/units'
import { priceDomain, samplePiecewise } from '../../viz'
import type { PayoffExtreme, PayoffReference, PriceMark } from '../../viz'
import { optionPhrase } from './model'

export interface PositionPayoff {
  /** Accessible name of the drawing. */
  title: string
  side: 'long' | 'short'
  points: { x: number; y: number }[]
  domain: [number, number]
  strike: PriceMark
  breakevens: PriceMark[]
  reference?: PayoffReference
  maxGain?: PayoffExtreme
  maxLoss?: PayoffExtreme
  /** Where the assumed-price handle starts: the reference price, else the strike. */
  defaultPrice: number
  unit: string
  asset: string
  /** Total profit or loss of the option leg at an underlying price, in quote units. */
  pnlAt: (price: number) => number
}

/**
 * The figure for an option seen from `role` (a viewer with no side sees the holder's). Null when the terms cannot
 * be drawn (a zero quantity or strike).
 */
export function positionPayoff(o: OptionOffer, role: Role | null, reference: ReferencePrice | null): PositionPayoff | null {
  const side = role === 'writer' ? 'short' : 'long'
  const intent = intentFor(o.kind, side === 'long' ? 'buy' : 'write')
  const strikePerUnit = strikeUnits(o)
  if (strikePerUnit === null || strikePerUnit <= 0n) return null
  const q = o.quote
  try {
    const refUnits = priceOf(reference)
    const terms = guidedTermsOf(o, refUnits)
    const numbers = legNumbers(o)
    const pnlAt = (price: number) => legPnlOf(numbers, o.kind, side, Math.max(price, 0))
    const at = guidedOutcome(intent, terms, terms.strike, { steps: 1 })
    const refPrice = refUnits === null ? null : (terms.entryPrice ?? null)
    // A fifth either side of the reference: wide enough for the strike and the breakeven, close enough to read them apart.
    const domain = priceDomain({ center: refPrice ?? terms.strike, range: 0.2, include: [terms.strike, at.breakeven] })

    // Breakeven per unit from the exact totals; a put whose premium is the whole strike has none to mark.
    const breakevenUnits = positiveBreakeven(o)
    const premiumLabel = formatUnits(o.totalPremium, q.decimals)
    // What the leg is worth with the underlying at zero: the most a put pays its holder and costs its writer.
    const atZero = o.totalStrike - o.totalPremium
    const atZeroExtreme: PayoffExtreme | undefined = atZero > 0n ? { value: Math.abs(pnlAt(0)), label: formatUnits(atZero, q.decimals), at: 0 } : undefined
    const premiumExtreme: PayoffExtreme = { value: terms.premiumTotal, label: premiumLabel }

    let maxGain: PayoffExtreme | undefined
    let maxLoss: PayoffExtreme | undefined
    if (side === 'long') {
      maxLoss = premiumExtreme
      maxGain = o.kind === 'put' ? atZeroExtreme : { value: Infinity }
    } else {
      maxGain = premiumExtreme
      // A written call has no largest loss as a leg, but the writer locked the underlying it would deliver: the
      // note under the figure says what is given up instead of printing "unlimited".
      maxLoss = o.kind === 'put' ? atZeroExtreme : undefined
    }

    return {
      title: `Payoff at expiry, ${side} ${optionPhrase(o)}`,
      side,
      points: samplePiecewise(pnlAt, domain, [terms.strike]),
      domain,
      strike: { value: terms.strike, label: formatUnits(strikePerUnit, q.decimals) },
      breakevens: breakevenUnits === null ? [] : [{ value: at.breakeven, label: formatUnits(breakevenUnits, q.decimals) }],
      reference: reference && refUnits !== null && refPrice !== null ? { value: refPrice, label: `${reference.label} ${formatUnits(refUnits, q.decimals)}` } : undefined,
      maxGain,
      maxLoss,
      defaultPrice: refPrice ?? terms.strike,
      unit: q.code,
      asset: o.underlying.code,
      pnlAt,
    }
  } catch {
    return null
  }
}

/** The exact breakeven per unit (core/payoff/leg), or null when it is not above zero. */
function positiveBreakeven(o: OptionOffer): bigint | null {
  const units = breakevenPerUnit(o)
  return units !== null && units > 0n ? units : null
}

/** The breakeven per unit as text for the contract note, from the exact totals. Null when it is not positive. */
export function breakevenText(o: OptionOffer): string | null {
  const units = positiveBreakeven(o)
  return units === null ? null : formatUnits(units, o.quote.decimals)
}
