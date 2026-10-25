import type { OptionOffer } from '../options/types'
import { strikePerUnit } from '../options/format'

export interface Series {
  key: string
  offers: OptionOffer[] // sorted best (cheapest per unit of underlying) first
}

// Cheaper premium per unit of underlying first. Cross-multiplied so it stays exact in bigint.
export function byPremiumPerUnit(a: OptionOffer, b: OptionOffer): number {
  const l = a.totalPremium * b.underlyingQty
  const r = b.totalPremium * a.underlyingQty
  return l < r ? -1 : l > r ? 1 : 0
}

// Group by underlying + kind + strike per unit + expiry date; only the offers passed in.
export function groupSeries(offers: OptionOffer[]): Series[] {
  const map = new Map<string, OptionOffer[]>()
  for (const o of offers) {
    const day = new Date(o.expiry * 1000).toISOString().slice(0, 10)
    const key = [o.underlying.contractId, o.quote.contractId, o.kind, strikePerUnit(o), day].join('|')
    const list = map.get(key)
    if (list) list.push(o)
    else map.set(key, [o])
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, offers: [...list].sort(byPremiumPerUnit) }))
    .sort((a, b) => a.offers[0].expiry - b.offers[0].expiry)
}
