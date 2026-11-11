import type { OptionOffer } from '../options/types'
import { byPremiumPerUnit, byStrikePerUnit } from '../units'

// The compact countdown and expiry moved to core/time (`compactCountdown`, `formatExpiryShort`) and the premium
// ordering to core/units (`byPremiumPerUnit`).

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Same series: same underlying, quote, kind, expiry and strike per unit. Competing makers quote the same series. */
export function sameSeries(a: OptionOffer, b: OptionOffer): boolean {
  return (
    a.underlying.contractId === b.underlying.contractId &&
    a.quote.contractId === b.quote.contractId &&
    a.kind === b.kind &&
    a.expiry === b.expiry &&
    byStrikePerUnit(a, b) === 0
  )
}

// Market table order: expiry, strike per unit, asset, kind, then cheapest premium per unit, so the offers of one
// series (competing makers) sit next to each other. Returns a new array.
export function sortOffers(offers: OptionOffer[]): OptionOffer[] {
  return [...offers].sort(
    (a, b) =>
      a.expiry - b.expiry ||
      byStrikePerUnit(a, b) ||
      byText(a.underlying.code, b.underlying.code) ||
      byText(a.underlying.contractId, b.underlying.contractId) ||
      byText(a.quote.contractId, b.quote.contractId) ||
      byText(a.kind, b.kind) ||
      byPremiumPerUnit(a, b),
  )
}

export type KindFilter = 'all' | 'put' | 'call'

// Asset/kind filters. `asset` is an underlying token code or 'all'.
export function filterOffers(offers: OptionOffer[], asset: string, kind: KindFilter): OptionOffer[] {
  return offers.filter((o) => (asset === 'all' || o.underlying.code === asset) && (kind === 'all' || o.kind === kind))
}
