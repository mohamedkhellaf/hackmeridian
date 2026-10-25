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

// "in 3d 0h", "in 5h 12m", "in 12m", "expired". Pure; `nowMs` is injectable for tests.
export function formatCountdown(expiryUnix: number, nowMs: number = Date.now()): string {
  const secs = Math.floor(expiryUnix - nowMs / 1000)
  if (secs <= 0) return 'expired'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `in ${d}d ${h}h`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${Math.max(m, 1)}m`
}

export type KindFilter = 'all' | 'put' | 'call'

// Asset/kind filters. `asset` is an underlying token code or 'all'.
export function filterOffers(offers: OptionOffer[], asset: string, kind: KindFilter): OptionOffer[] {
  return offers.filter((o) => (asset === 'all' || o.underlying.code === asset) && (kind === 'all' || o.kind === kind))
}
