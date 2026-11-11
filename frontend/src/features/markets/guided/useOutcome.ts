// The hypothetical figures of the guided terms, shared by the two outcome cards and the chart (Outcome.tsx).
import { useMemo, useState } from 'react'
import { formatNumber, formatUnits } from '../../../core/format'
import { guidedOutcome, guidedTermsOf } from '../../../core/payoff/strategies'
import type { GuidedIntent, GuidedOutcome } from '../../../core/payoff/strategies'
import type { TokenInfo } from '../../../core/options/types'
import { priceDomain } from '../../../viz'
import { INTENT_COPY } from './copy'
import type { OutcomeWords, Words } from './copy'
import { scenarioPrices } from './terms'

export interface OutcomeInput {
  intent: GuidedIntent
  /** The exact terms. They become display numbers here, once, for this hypothetical figure only. */
  qty: bigint
  strikeTotal: bigint
  /** The premium the figures use: the order's, the user's own, or an assumed one (labelled by the caller). */
  premium: bigint
  asset: TokenInfo
  quote: TokenInfo
  /** The same terms as formatted text. */
  words: Words
  /** The reference price with its source, or null: `{ perUnit, label: 'Demo price', text: '99.40' }`. */
  reference: { perUnit: bigint; label: string; text: string } | null
  /** Resets the price handle when the series changes. */
  seriesKey: string
}

export interface OutcomeView {
  input: OutcomeInput
  words: OutcomeWords
  at: (price: number) => GuidedOutcome
  prices: { low: number; mid: number; high: number }
  entry: number | null
  strike: number
  domain: readonly [number, number]
  points: { x: number; with: number; without: number }[]
  price: number
  setPrice: (price: number) => void
}

const EVEN = 0.005
export const num = (n: number) => formatNumber(n, { dp: 2 })

export function differenceText(intent: GuidedIntent, difference: number, q: string): { direction: 'gain' | 'loss' | null; text: string } {
  const copy = INTENT_COPY[intent]
  if (Math.abs(difference) < EVEN) return { direction: null, text: `0.00 ${q}, ${copy.sameAs}` }
  return difference > 0
    ? { direction: 'gain', text: `${formatNumber(difference, { dp: 2, sign: true })} ${q} ${copy.moreThan}` }
    : { direction: 'loss', text: `${formatNumber(difference, { dp: 2, sign: true })} ${q} ${copy.lessThan}` }
}

/**
 * The hypothetical figures of the guided terms, shared by the two cards under the note and the chart further
 * down: a card moves the chart's handle to its price. Null while there is no quantity or no premium (no payoff
 * figure is drawn without a premium).
 */
export function useOutcome(input: OutcomeInput | null): OutcomeView | null {
  const intent = input?.intent
  const qty = input?.qty
  const strikeTotal = input?.strikeTotal
  const premium = input?.premium
  const assetDecimals = input?.asset.decimals
  const quoteDecimals = input?.quote.decimals
  const referencePerUnit = input?.reference?.perUnit ?? null
  const model = useMemo(() => {
    if (intent === undefined || qty === undefined || strikeTotal === undefined || premium === undefined || assetDecimals === undefined || quoteDecimals === undefined) return null
    const terms = guidedTermsOf({ underlying: { decimals: assetDecimals }, quote: { decimals: quoteDecimals }, underlyingQty: qty, totalStrike: strikeTotal, totalPremium: premium }, referencePerUnit)
    const entry = terms.entryPrice ?? null
    const at = (price: number) => guidedOutcome(intent, terms, price)
    const base = at(entry ?? terms.strike)
    const prices = scenarioPrices(terms.strike, entry, base.breakeven)
    const domain = priceDomain({ center: prices.mid, range: 0.12, include: [terms.strike, base.breakeven, prices.low, prices.high] })
    const curve = guidedOutcome(intent, terms, prices.mid, { from: domain[0], to: domain[1], steps: 80 }).curve
    return { at, entry, strike: terms.strike, prices, domain, points: curve.map((p) => ({ x: p.s, with: p.withValue, without: p.withoutValue })) }
  }, [intent, qty, strikeTotal, premium, assetDecimals, quoteDecimals, referencePerUnit])

  const [picked, setPicked] = useState<{ key: string; price: number } | null>(null)
  if (!input || !model) return null
  const price = picked !== null && picked.key === input.seriesKey ? picked.price : model.prices.mid
  return {
    input,
    words: { ...input.words, premium: formatUnits(input.premium, input.quote.decimals), value: '' },
    at: model.at,
    prices: model.prices,
    entry: model.entry,
    strike: model.strike,
    domain: model.domain,
    points: model.points,
    price,
    setPrice: (next) => setPicked({ key: input.seriesKey, price: next }),
  }
}

