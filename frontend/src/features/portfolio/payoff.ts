// The payoff figures of one position, prepared for the viz kit. Numbers here are for the charts only; every label
// is formatted from the exact integer terms.
//   - A holder (and a viewer, who sees the holder's side) gets the option leg, premium included, from
//     `legPnlOf` of core/payoff/leg (packages/payoff underneath). When this browser bought the option from its
//     holder, the original premium is not the holder's own cost: the leg is drawn without it.
//   - A maker gets what the guided page showed when it wrote the option: what it holds with the agreement and
//     without it, from `guidedOutcome` of core/payoff/strategies (earn-hold for a written call, earn-buy for a
//     written put). The collateral is part of that picture, so the rise given up is not drawn as a loss.
import { formatUnits } from '../../core/format'
import type { OptionOffer } from '../../core/options/types'
import { breakevenPerUnit, legNumbers, legPnlOf } from '../../core/payoff/leg'
import { guidedOutcome, guidedTermsOf, intentFor } from '../../core/payoff/strategies'
import type { GuidedIntent } from '../../core/payoff/strategies'
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
  /** Premium in the line, in quote units; 0 when it is left out. */
  premium: number
  /** Total profit or loss of the option leg at an underlying price, in quote units. */
  pnlAt: (price: number) => number
  /** What exercising pays at an underlying price, premium not counted, in quote units. */
  exerciseAt: (price: number) => number
}

export interface PositionPayoffOptions {
  /** Leave the premium out: the holder bought the option from a holder, at a price the chain does not record. */
  withoutPremium?: boolean
}

/**
 * The leg figure for an option seen by its holder (a viewer with no side sees the holder's). Null when the terms
 * cannot be drawn (a zero quantity or strike).
 */
export function positionPayoff(o: OptionOffer, reference: ReferencePrice | null, opts: PositionPayoffOptions = {}): PositionPayoff | null {
  const strikePerUnit = strikeUnits(o)
  if (strikePerUnit === null || strikePerUnit <= 0n) return null
  const q = o.quote
  const leg = opts.withoutPremium ? { ...o, totalPremium: 0n } : o
  try {
    const refUnits = priceOf(reference)
    const terms = guidedTermsOf(leg, refUnits)
    const numbers = legNumbers(leg)
    const bare = legNumbers({ ...o, totalPremium: 0n })
    const pnlAt = (price: number) => legPnlOf(numbers, o.kind, 'long', Math.max(price, 0))
    const exerciseAt = (price: number) => legPnlOf(bare, o.kind, 'long', Math.max(price, 0))
    const at = guidedOutcome(intentFor(o.kind, 'buy'), terms, terms.strike, { steps: 1 })
    const refPrice = refUnits === null ? null : (terms.entryPrice ?? null)
    // A fifth either side of the reference: wide enough for the strike and the breakeven, close enough to read them apart.
    const domain = priceDomain({ center: refPrice ?? terms.strike, range: 0.2, include: [terms.strike, at.breakeven] })

    // Breakeven per unit from the exact totals; a put whose premium is the whole strike has none to mark.
    const breakevenUnits = opts.withoutPremium ? null : positiveBreakeven(o)
    // What the leg is worth with the underlying at zero: the most a put pays its holder.
    const atZero = leg.totalStrike - leg.totalPremium
    const maxGain: PayoffExtreme | undefined = o.kind === 'put' ? (atZero > 0n ? { value: Math.abs(pnlAt(0)), label: formatUnits(atZero, q.decimals), at: 0 } : undefined) : { value: Infinity }
    const maxLoss: PayoffExtreme | undefined = opts.withoutPremium ? undefined : { value: terms.premiumTotal, label: formatUnits(o.totalPremium, q.decimals) }

    return {
      title: `Payoff at the deadline, long ${optionPhrase(o)}`,
      side: 'long',
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
      premium: terms.premiumTotal,
      pnlAt,
      exerciseAt,
    }
  } catch {
    return null
  }
}

export interface MakerPayoff {
  intent: Extract<GuidedIntent, 'earn-hold' | 'earn-buy'>
  title: string
  points: { x: number; with: number; without: number }[]
  domain: [number, number]
  /** The strike, labelled as the guided page labels it: "Sell at 25.00", "Buy at 9.80". */
  level: { value: number; label: string }
  reference?: PayoffReference
  defaultPrice: number
  unit: string
  asset: string
}

/** The maker's with-and-without figure: the guided intent that writes this kind of option. Null when it cannot be drawn. */
export function makerPayoff(o: OptionOffer, reference: ReferencePrice | null): MakerPayoff | null {
  const strikePerUnit = strikeUnits(o)
  if (strikePerUnit === null || strikePerUnit <= 0n) return null
  const q = o.quote
  const intent = intentFor(o.kind, 'write') as MakerPayoff['intent']
  try {
    const refUnits = priceOf(reference)
    const terms = guidedTermsOf(o, refUnits)
    const refPrice = refUnits === null ? null : (terms.entryPrice ?? null)
    const base = guidedOutcome(intent, terms, refPrice ?? terms.strike)
    const domain = priceDomain({ center: refPrice ?? terms.strike, range: 0.2, include: [terms.strike, base.breakeven] })
    const curve = guidedOutcome(intent, terms, refPrice ?? terms.strike, { from: domain[0], to: domain[1], steps: 80 }).curve
    const k = formatUnits(strikePerUnit, q.decimals)
    return {
      intent,
      title: o.kind === 'call' ? `What you hold at the deadline, with the call you wrote on ${o.underlying.code} and without it` : `What you hold at the deadline, with the put you wrote on ${o.underlying.code} and without it`,
      points: curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue })),
      domain,
      level: { value: terms.strike, label: o.kind === 'call' ? `Sell at ${k}` : `Buy at ${k}` },
      reference: reference && refUnits !== null && refPrice !== null ? { value: refPrice, label: `${reference.label} ${formatUnits(refUnits, q.decimals)}` } : undefined,
      defaultPrice: refPrice ?? terms.strike,
      unit: q.code,
      asset: o.underlying.code,
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

/** Whether an option still has a payoff to draw: an ended one shows what happened instead, in its header and lifecycle. */
export const drawsPayoff = (o: Pick<OptionOffer, 'state'>): boolean => o.state === 'offered' || o.state === 'active'
