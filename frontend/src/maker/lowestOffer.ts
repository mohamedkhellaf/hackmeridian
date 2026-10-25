import { formatAmount, strikePerUnit } from '../options/format'
import type { NewOffer, OptionOffer, TokenInfo } from '../options/types'

const utcDay = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10)

type Sized = { totalPremium: bigint; underlyingQty: bigint; underlying: TokenInfo }

function perUnit(o: Sized): bigint {
  return (o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty
}

/**
 * Cheapest open offer (premium per unit of underlying) in the same series as the draft: same underlying, kind,
 * strike per unit and expiry day (the grouping Markets uses). Null when there is none.
 */
export function lowestOpenInSeries(offers: OptionOffer[], draft: NewOffer, quote: TokenInfo): OptionOffer | null {
  const draftStrike = strikePerUnit({ ...draft, quote } as OptionOffer)
  let best: OptionOffer | null = null
  for (const o of offers) {
    if (o.state !== 'offered') continue
    if (o.underlying.contractId !== draft.underlying.contractId || o.quote.contractId !== quote.contractId) continue
    if (o.kind !== draft.kind || strikePerUnit(o) !== draftStrike) continue
    if (utcDay(o.expiry) !== utcDay(draft.expiry)) continue
    if (!best || perUnit(o) < perUnit(best)) best = o
  }
  return best
}

/** Premium per unit of underlying as display text, e.g. "0.40". */
export function premiumPerUnitText(o: Sized, quoteDecimals: number): string {
  const s = formatAmount(perUnit(o), quoteDecimals, Math.min(quoteDecimals, 4))
  const [w, f = ''] = s.split('.')
  return `${w}.${f.padEnd(2, '0')}`
}
