// Adapters from the four guided intents (brief D10) to the payoff maths in packages/payoff.
//
// Everything here is a JavaScript `number`, for charts and outcome cards only: an illustration of a payoff at
// expiry, never an amount that is signed or sent. Exact amounts stay `bigint` in the ticket; convert once with
// `guidedTermsOf`. Show every figure from this module under the caption "Hypothetical payoff at the deadline. Not a quote."
//
// Each intent is one option leg seen from the user's side:
//
//   floor      Set a floor                 hold the asset, buy a put    protectivePut
//   earn-hold  Earn on what you hold       hold the asset, write a call coveredCall
//   earn-buy   Earn while waiting to buy   set cash aside, write a put  cashSecuredPut
//   lock-buy   Lock a buy price            set cash aside, buy a call   longCall
//
// "With" and "without" are the value at expiry of what the user would hold, in quote units, with and without the
// option, for an underlying price S (the engraved with-and-without chart):
//
//   floor      without = qty x S                 with = qty x max(S, K) - premium
//   earn-hold  without = qty x S                 with = qty x min(S, K) + premium
//   earn-buy   without = qty x K (the cash)      with = qty x min(S, K) + premium
//   lock-buy   without = qty x K (the cash)      with = qty x K + qty x max(S - K, 0) - premium
//
// The profit and loss itself always comes from the package (protectivePut, coveredCall, cashSecuredPut, longCall);
// this file only adds back the starting value so the result reads as "what you would hold".

import { cashSecuredPut, coveredCall, longCall, protectivePut, toNumber } from '../../../../packages/payoff/src/index.ts'
import type { Hypothetical, OptionLeg } from '../../../../packages/payoff/src/index.ts'
import type { OptionKind } from '../options/types'

export type GuidedIntent = 'floor' | 'earn-hold' | 'earn-buy' | 'lock-buy'

export interface IntentInfo {
  id: GuidedIntent
  /** The name of the intent in the interface (brief D10). */
  name: string
  optionKind: OptionKind
  /** `buy`: the user pays the premium. `write`: the user is paid the premium and locks collateral. */
  side: 'buy' | 'write'
  /** What the user starts with: the asset itself, or the quote token set aside for the strike. */
  starts: 'asset' | 'cash'
  /** The three main intents come first; `lock-buy` is secondary. */
  main: boolean
}

/** The four intents, main ones first, in display order. */
export const GUIDED_INTENTS: readonly IntentInfo[] = [
  { id: 'floor', name: 'Set a floor', optionKind: 'put', side: 'buy', starts: 'asset', main: true },
  { id: 'earn-hold', name: 'Earn on what you hold', optionKind: 'call', side: 'write', starts: 'asset', main: true },
  { id: 'earn-buy', name: 'Earn while waiting to buy', optionKind: 'put', side: 'write', starts: 'cash', main: true },
  { id: 'lock-buy', name: 'Lock a buy price', optionKind: 'call', side: 'buy', starts: 'cash', main: false },
]

export function intentInfo(intent: GuidedIntent): IntentInfo {
  const info = GUIDED_INTENTS.find((i) => i.id === intent)
  if (!info) throw new RangeError(`unknown intent: ${String(intent)}`)
  return info
}

/** The intent for an option kind and a side of the trade. */
export function intentFor(optionKind: OptionKind, side: 'buy' | 'write'): GuidedIntent {
  return GUIDED_INTENTS.find((i) => i.optionKind === optionKind && i.side === side)!.id
}

/** The terms of one guided position, as display numbers. */
export interface GuidedTerms {
  /** Units of underlying. */
  qty: number
  /** Strike per unit, in quote units. */
  strike: number
  /** Premium for the whole quantity, in quote units. */
  premiumTotal: number
  /**
   * The price per unit that "most you can lose" and "most you can gain" are measured from, for the two intents
   * that start from the asset: the reference price or the user's assumed price. Defaults to the strike.
   */
  entryPrice?: number
}

export interface GuidedPoint {
  /** Underlying price per unit at expiry. */
  s: number
  /** Value of what the user would hold with the option. */
  withValue: number
  /** Value of what the user would hold without it. */
  withoutValue: number
}

export interface GuidedOutcome extends GuidedPoint {
  label: Hypothetical
  intent: GuidedIntent
  /** `withValue - withoutValue` at `s`: positive when the option left the user better off. */
  difference: number
  /** True when the option is in the money at `s`, so its holder would exercise. */
  exercised: boolean
  /**
   * What the lot of the asset is worth at `s` (`qty x s`), whoever ends up holding it. For the two intents that
   * start from cash `withoutValue` is the cash, not this, so a sentence that prices the asset reads it here.
   */
  assetValue: number
  /** Premium per unit. */
  premiumPerUnit: number
  /**
   * The price at which "with" equals "without": strike minus premium per unit for the two put intents, strike
   * plus premium per unit for the two call intents. Never below zero.
   */
  breakeven: number
  /**
   * The most the user can lose, as a positive number, over every price from zero up.
   * floor: the fall from `entryPrice` to the strike (if any) plus the premium. earn-hold: the asset falling to
   * zero from `entryPrice`, less the premium. earn-buy: buying at the strike an asset that falls to zero, less
   * the premium. lock-buy: the premium.
   */
  maxLoss: number
  /**
   * The most the user can gain, or null when there is no cap (floor and lock-buy keep the whole rise).
   * earn-hold: the rise from `entryPrice` to the strike plus the premium. earn-buy: the premium.
   */
  maxGain: number | null
  /** The lowest "with" value over every price from zero up. */
  floorValue: number
  /** The highest "with" value, or null when there is no cap. */
  capValue: number | null
  /** Sampled curve for the chart, ascending in `s`, with the strike and the breakeven sampled exactly. */
  curve: GuidedPoint[]
}

export interface CurveOptions {
  /** Lowest price on the chart. Default: half the strike, lowered to include `price` and the entry price. */
  from?: number
  /** Highest price on the chart. Default: one and a half times the strike, raised the same way. */
  to?: number
  /** Number of even steps between `from` and `to`. Default 60. */
  steps?: number
}

interface Model {
  breakeven: number
  maxLoss: number
  maxGain: number | null
  withAt: (s: number) => number
  withoutAt: (s: number) => number
}

function check(t: GuidedTerms): { leg: OptionLeg; entry: number } {
  if (!(t.qty > 0) || !Number.isFinite(t.qty)) throw new RangeError('qty must be a positive number')
  if (!(t.strike > 0) || !Number.isFinite(t.strike)) throw new RangeError('strike must be a positive number')
  if (!(t.premiumTotal >= 0) || !Number.isFinite(t.premiumTotal)) throw new RangeError('premiumTotal must be zero or more')
  const entry = t.entryPrice ?? t.strike
  if (!(entry > 0) || !Number.isFinite(entry)) throw new RangeError('entryPrice must be a positive number')
  return { leg: { qty: t.qty, strikeTotal: t.strike * t.qty, premiumTotal: t.premiumTotal }, entry }
}

const finite = (n: number): number | null => (Number.isFinite(n) ? n : null)

function model(intent: GuidedIntent, t: GuidedTerms): Model {
  const { leg, entry } = check(t)
  const perUnit = t.premiumTotal / t.qty
  const cash = t.qty * t.strike
  switch (intent) {
    case 'floor': {
      const p = protectivePut({ qty: t.qty, entryPrice: entry }, leg)
      return {
        breakeven: Math.max(t.strike - perUnit, 0),
        maxLoss: p.maxLoss,
        maxGain: finite(p.maxGain),
        withAt: (s) => t.qty * entry + p.pnl(s),
        withoutAt: (s) => t.qty * s,
      }
    }
    case 'earn-hold': {
      const p = coveredCall({ qty: t.qty, entryPrice: entry }, leg)
      return {
        breakeven: t.strike + perUnit,
        maxLoss: p.maxLoss,
        maxGain: finite(p.maxGain),
        withAt: (s) => t.qty * entry + p.pnl(s),
        withoutAt: (s) => t.qty * s,
      }
    }
    case 'earn-buy': {
      const p = cashSecuredPut(leg)
      return {
        breakeven: Math.max(t.strike - perUnit, 0),
        maxLoss: p.maxLoss,
        maxGain: finite(p.maxGain),
        withAt: (s) => cash + p.pnl(s),
        withoutAt: () => cash,
      }
    }
    case 'lock-buy':
      return {
        breakeven: t.strike + perUnit,
        maxLoss: Math.max(0, -longCall(leg, 0).total),
        maxGain: null,
        withAt: (s) => cash + longCall(leg, s).total,
        withoutAt: () => cash,
      }
    default:
      throw new RangeError(`unknown intent: ${String(intent)}`)
  }
}

function sample(m: Model, t: GuidedTerms, price: number, o: CurveOptions): GuidedPoint[] {
  const entry = t.entryPrice ?? t.strike
  const from = Math.max(0, o.from ?? Math.min(t.strike * 0.5, price * 0.9, entry * 0.9))
  const to = Math.max(o.to ?? Math.max(t.strike * 1.5, price * 1.1, entry * 1.1), from)
  const steps = o.steps ?? 60
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError('steps must be a positive integer')
  const xs = new Set<number>()
  for (let i = 0; i <= steps; i++) xs.add(from + ((to - from) * i) / steps)
  for (const kink of [t.strike, m.breakeven]) if (kink >= from && kink <= to) xs.add(kink)
  return [...xs].sort((a, b) => a - b).map((s) => ({ s, withValue: m.withAt(s), withoutValue: m.withoutAt(s) }))
}

/**
 * The outcome of a guided intent at an underlying price `price` (per unit, at expiry): what the user would hold
 * with and without the option, the breakeven, the most they can lose and gain, and a sampled curve.
 * Throws a RangeError on terms that are not positive numbers or a negative price.
 */
export function guidedOutcome(intent: GuidedIntent, terms: GuidedTerms, price: number, curve: CurveOptions = {}): GuidedOutcome {
  if (!(price >= 0) || !Number.isFinite(price)) throw new RangeError('price must be zero or more')
  const m = model(intent, terms)
  const info = intentInfo(intent)
  const withValue = m.withAt(price)
  const withoutValue = m.withoutAt(price)
  // "With" is piecewise linear with one kink at the strike, so over [0, inf) its extremes sit at 0, at the strike
  // or at infinity; the package's maxGain says whether it is capped.
  const ends = [m.withAt(0), m.withAt(terms.strike)]
  return {
    label: 'hypothetical',
    intent,
    s: price,
    withValue,
    withoutValue,
    difference: withValue - withoutValue,
    exercised: info.optionKind === 'put' ? price < terms.strike : price > terms.strike,
    assetValue: terms.qty * price,
    premiumPerUnit: terms.premiumTotal / terms.qty,
    breakeven: m.breakeven,
    maxLoss: m.maxLoss,
    maxGain: m.maxGain,
    floorValue: Math.min(...ends),
    capValue: m.maxGain === null ? null : Math.max(...ends),
    curve: sample(m, terms, price, curve),
  }
}

/** Set a floor: hold `qty`, buy a put at `strike`. */
export const setFloor = (terms: GuidedTerms, price: number, curve?: CurveOptions) => guidedOutcome('floor', terms, price, curve)
/** Earn on what you hold: hold `qty`, write a call at `strike`. */
export const earnOnHolding = (terms: GuidedTerms, price: number, curve?: CurveOptions) => guidedOutcome('earn-hold', terms, price, curve)
/** Earn while waiting to buy: set `qty x strike` aside, write a put at `strike`. */
export const earnWhileWaiting = (terms: GuidedTerms, price: number, curve?: CurveOptions) => guidedOutcome('earn-buy', terms, price, curve)
/** Lock a buy price: set `qty x strike` aside, buy a call at `strike`. */
export const lockBuyPrice = (terms: GuidedTerms, price: number, curve?: CurveOptions) => guidedOutcome('lock-buy', terms, price, curve)

/** Exact on-chain terms, as an offer, a bid or a draft carries them. */
export interface UnitTerms {
  underlying: { decimals: number }
  quote: { decimals: number }
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint
}

/**
 * Exact terms as display numbers for this module. `entryPerUnit` is a per-unit price in quote units (a reference
 * price or the user's assumed price). The result is for charts only: never convert it back into an amount.
 */
export function guidedTermsOf(o: UnitTerms, entryPerUnit?: bigint | null): GuidedTerms {
  const qty = toNumber(o.underlyingQty, o.underlying.decimals)
  const terms: GuidedTerms = {
    qty,
    strike: toNumber(o.totalStrike, o.quote.decimals) / qty,
    premiumTotal: toNumber(o.totalPremium, o.quote.decimals),
  }
  if (entryPerUnit !== undefined && entryPerUnit !== null && entryPerUnit > 0n) terms.entryPrice = toNumber(entryPerUnit, o.quote.decimals)
  return terms
}
