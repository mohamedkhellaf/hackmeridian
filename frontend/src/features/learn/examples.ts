// The worked examples of the Learn page: one example lot of 5.00 BOND seen through the four intents.
//
// The terms are exact integer units (7 decimals) and are formatted as such. Everything that depends on a price
// (breakeven, the most you can lose or gain, the three scenarios, the curves) comes from core/payoff/strategies,
// is a display number, and is shown beside a figure captioned with the required payoff sentence
// (core/disclosures PAYOFF_CAPTION). Nothing here is an offer, a quote or an amount that is ever signed.

import { formatMoney, formatNumber, formatUnits, formatUtc, NBSP, noBreak, URGENCY_48H_SECONDS } from '../../core/format'
import type { UnitToken } from '../../core/format'
import { requiredCollateral } from '../../core/options/types'
import type { OptionKind, TokenInfo } from '../../core/options/types'
import { guidedOutcome, guidedTermsOf, intentInfo } from '../../core/payoff/strategies'
import type { GuidedIntent, GuidedTerms } from '../../core/payoff/strategies'
import { standardExpiries } from '../../core/series'
import { premiumUnits, strikeUnits } from '../../core/units'

/** Labels only: the example never reaches a chain, so these ids are not contract ids. */
export const EXAMPLE_ASSET: TokenInfo = { contractId: 'EXAMPLE_BOND', code: 'BOND', decimals: 7 }
export const EXAMPLE_QUOTE: TokenInfo = { contractId: 'EXAMPLE_USDX', code: 'USDx', decimals: 7 }

const UNIT = 10_000_000n
const cents = (n: number): bigint => (BigInt(n) * UNIT) / 100n

/** The price per unit the examples start from, in quote units: 10.00 USDx. */
export const EXAMPLE_START_PER_UNIT = cents(1000)

/** The three prices each example is read at. */
export const SCENARIO_PRICES = [8, 10, 12] as const

/** Price range of every example chart. */
export const EXAMPLE_DOMAIN: readonly [number, number] = [6, 14]

export interface ExampleTerms {
  intent: GuidedIntent
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint
}

const QTY = cents(500)

const terms = (intent: GuidedIntent, strikeTotalCents: number, premiumCents: number): ExampleTerms => ({
  intent,
  kind: intentInfo(intent).optionKind,
  underlying: EXAMPLE_ASSET,
  quote: EXAMPLE_QUOTE,
  underlyingQty: QTY,
  totalStrike: cents(strikeTotalCents),
  totalPremium: cents(premiumCents),
})

/**
 * One lot, four ways: 5.00 BOND with BOND starting at 10.00 USDx.
 *
 *   floor      put bought at 10.00      premium 1.80 (0.36 per BOND)
 *   earn-hold  call written at 10.50    premium 0.95 (0.19 per BOND)
 *   earn-buy   put written at 9.50      premium 1.20 (0.24 per BOND)
 *   lock-buy   call bought at 10.00     premium 1.90 (0.38 per BOND)
 */
export const EXAMPLE_TERMS: readonly ExampleTerms[] = [
  terms('floor', 5000, 180),
  terms('earn-hold', 5250, 95),
  terms('earn-buy', 4750, 120),
  terms('lock-buy', 5000, 190),
]

/** The put the lifecycle section follows: the first example. */
export const LIFECYCLE_TERMS: ExampleTerms = EXAMPLE_TERMS[0]

export interface Scenario {
  id: string
  /** Price per unit at the deadline. */
  price: number
  priceText: string
  /** What the user would hold with the option, in quote units. */
  withValue: number
  withText: string
  withoutText: string
  /** With minus without. */
  difference: number
  /** Signed, with the true minus sign: `+8.20`. Zero has no sign. */
  differenceText: string
  /** True when the option is in the money at this price, so its holder would exercise. */
  exercised: boolean
  /** Value of the whole quantity of the asset at this price, in quote units. */
  assetValueText: string
}

export interface ChartPoint {
  s: number
  withValue: number
  withoutValue: number
  /** With minus without: the payoff of the option itself, premium included. */
  payoff: number
}

export interface WorkedExample {
  terms: ExampleTerms
  intent: GuidedIntent
  /** The name of the intent in the interface. */
  name: string
  side: 'buy' | 'write'
  starts: 'asset' | 'cash'
  assetCode: string
  quoteCode: string
  /** Exact terms, formatted from integer units. */
  qtyText: string
  strikeTotalText: string
  strikePerUnitText: string
  premiumText: string
  premiumPerUnitText: string
  /** What the maker locks: the whole strike for a put, the whole quantity for a call. */
  collateralText: string
  startText: string
  /** Display numbers for the charts. */
  numbers: GuidedTerms
  strike: number
  start: number
  /** Hypothetical figures from core/payoff/strategies. */
  breakeven: number
  breakevenText: string
  maxLoss: number
  maxLossText: string
  /** Null when there is no cap. */
  maxGain: number | null
  maxGainText: string | null
  scenarios: Scenario[]
  /** The curve over `EXAMPLE_DOMAIN`, with the strike and the breakeven sampled exactly. */
  curve: ChartPoint[]
  domain: readonly [number, number]
}

// In a sentence a figure never parts from its unit: `1.80 USDx` with a no-break space.
const money = (units: bigint, token: UnitToken) => formatMoney(units, token, { separator: NBSP })
const perUnitText = (units: bigint | null, decimals: number) => (units === null ? '' : formatUnits(units, decimals))

/** Builds the view of one example. Pure: the same terms always give the same text. */
export function workedExample(t: ExampleTerms): WorkedExample {
  const info = intentInfo(t.intent)
  const numbers = guidedTermsOf(t, EXAMPLE_START_PER_UNIT)
  const start = numbers.entryPrice ?? numbers.strike
  const at = (price: number) => guidedOutcome(t.intent, numbers, price, { from: EXAMPLE_DOMAIN[0], to: EXAMPLE_DOMAIN[1], steps: 40 })
  const base = at(start)
  const collateral = requiredCollateral(t)
  return {
    terms: t,
    intent: t.intent,
    name: info.name,
    side: info.side,
    starts: info.starts,
    assetCode: t.underlying.code,
    quoteCode: t.quote.code,
    qtyText: money(t.underlyingQty, t.underlying),
    strikeTotalText: money(t.totalStrike, t.quote),
    strikePerUnitText: perUnitText(strikeUnits(t), t.quote.decimals),
    premiumText: money(t.totalPremium, t.quote),
    premiumPerUnitText: perUnitText(premiumUnits(t), t.quote.decimals),
    collateralText: money(collateral.amount, collateral.token),
    startText: formatUnits(EXAMPLE_START_PER_UNIT, t.quote.decimals),
    numbers,
    strike: numbers.strike,
    start,
    breakeven: base.breakeven,
    breakevenText: formatNumber(base.breakeven),
    maxLoss: base.maxLoss,
    maxLossText: formatNumber(base.maxLoss),
    maxGain: base.maxGain,
    maxGainText: base.maxGain === null ? null : formatNumber(base.maxGain),
    scenarios: SCENARIO_PRICES.map((price) => {
      const o = at(price)
      return {
        id: `${t.intent}-${price}`,
        price,
        priceText: formatNumber(price),
        withValue: o.withValue,
        withText: formatNumber(o.withValue),
        withoutText: formatNumber(o.withoutValue),
        difference: o.difference,
        differenceText: formatNumber(o.difference, { sign: true }),
        exercised: o.exercised,
        // Quantity times price: the value of the lot itself at this price, for the sentence of the scenario.
        assetValueText: formatNumber(numbers.qty * price),
      }
    }),
    curve: base.curve.map((p) => ({ s: p.s, withValue: p.withValue, withoutValue: p.withoutValue, payoff: p.withValue - p.withoutValue })),
    domain: EXAMPLE_DOMAIN,
  }
}

/** The four examples, main intents first. */
export const workedExamples = (): WorkedExample[] => EXAMPLE_TERMS.map(workedExample)

/** The canonical UTC text of a deadline, kept on one line: `20 Nov 2026, 08:00 UTC`. */
export const deadlineText = (ts: number): string => noBreak(formatUtc(ts))

/**
 * The deadline printed in the examples: the first standard expiry (a Friday, 08:00 UTC) that is at least 48 hours
 * away, so the page never shows a deadline that has passed or is about to.
 */
export function exampleDeadline(nowSec: number): number {
  const listed = standardExpiries(nowSec)
  return listed.find((ts) => ts - nowSec >= URGENCY_48H_SECONDS) ?? listed[listed.length - 1]
}
