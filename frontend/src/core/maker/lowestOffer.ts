import { strikePerUnit } from '../options/format'
import type { NewOffer, OptionOffer, TokenInfo } from '../options/types'
import { expiryDay } from '../time'
import { byPremiumPerUnit, perUnitText } from '../units'
import type { Sized } from '../units'

/**
 * Cheapest open offer (premium per unit of underlying) in the same series as the draft: same underlying, kind,
 * strike per unit and expiry day. The day is the UTC day from core/time `expiryDay`, the same key the chain
 * groups by, so the form and the chain always agree on what "this series" is. Null when there is none.
 */
export function lowestOpenInSeries(offers: OptionOffer[], draft: NewOffer, quote: TokenInfo): OptionOffer | null {
  const draftStrike = strikePerUnit({ ...draft, quote } as OptionOffer)
  const day = expiryDay(draft.expiry)
  let best: OptionOffer | null = null
  for (const o of offers) {
    if (o.state !== 'offered') continue
    if (o.underlying.contractId !== draft.underlying.contractId || o.quote.contractId !== quote.contractId) continue
    if (o.kind !== draft.kind || strikePerUnit(o) !== draftStrike) continue
    if (expiryDay(o.expiry) !== day) continue
    if (!best || byPremiumPerUnit(o, best) < 0) best = o
  }
  return best
}

/** A series named by its terms, before any quantity exists. */
export interface SeriesTermsRef {
  underlying: TokenInfo
  kind: NewOffer['kind']
  /** Strike for one whole unit of underlying, in quote units. */
  strikePerUnit: bigint
  /** Unix seconds; the series is the UTC day. */
  expiry: number
}

/**
 * The cheapest open offer of a series named by its terms: what a form shows before a quantity is typed.
 * The same rule as `lowestOpenInSeries` (a one-unit draft at that strike stands for the series).
 */
export function lowestOpenInSeriesOf(offers: OptionOffer[], series: SeriesTermsRef, quote: TokenInfo): OptionOffer | null {
  const oneUnit = 10n ** BigInt(series.underlying.decimals)
  return lowestOpenInSeries(offers, { kind: series.kind, underlying: series.underlying, underlyingQty: oneUnit, totalStrike: series.strikePerUnit, totalPremium: 0n, expiry: series.expiry }, quote)
}

/** Premium per unit of underlying as display text, e.g. "0.40". */
export function premiumPerUnitText(o: Sized & { totalPremium: bigint }, quoteDecimals: number): string {
  return perUnitText(o.totalPremium, o, quoteDecimals)
}
