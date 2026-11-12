import type { OptionOffer } from '../options/types'
import { strikePerUnit } from '../options/format'
import { expiryDay } from '../time'
import { byId, byPremiumPerUnit, byStrikePerUnit, perUnitText } from '../units'

// Pure helpers behind the option chain. Everything is derived from open offers; nothing is priced here.
// The expiry day is the UTC day (core/time `expiryDay`), the same key `lowestOpenInSeries` uses.

export interface ChainSide {
  /** Cheapest premium per unit first, so offers[0] is the best quote. */
  offers: OptionOffer[]
  best: OptionOffer
  /** Distinct makers quoting this series. */
  makers: number
}

export interface ChainRow {
  /** Strike per unit, formatted ("10.00"); also the row key. */
  strike: string
  call?: ChainSide
  put?: ChainSide
}

/** Underlying codes that have open offers, sorted. */
export function assetCodes(offers: OptionOffer[]): string[] {
  return [...new Set(offers.map((o) => o.underlying.code))].sort()
}

/** The asset with the most open offers (ties: alphabetical), so the page opens on the busiest book. */
export function defaultAsset(offers: OptionOffer[]): string {
  const count = (c: string) => offers.filter((o) => o.underlying.code === c).length
  return [...assetCodes(offers)].sort((a, b) => count(b) - count(a))[0] ?? ''
}

/** Expiry days (UTC) with open offers for an asset, soonest first. */
export function expiryDays(offers: OptionOffer[], asset: string): string[] {
  return [...new Set(offers.filter((o) => o.underlying.code === asset).map((o) => expiryDay(o.expiry)))].sort()
}

/** Offers of one asset and expiry day (UTC). */
export function inColumn(offers: OptionOffer[], asset: string, day: string): OptionOffer[] {
  return offers.filter((o) => o.underlying.code === asset && expiryDay(o.expiry) === day)
}

/** Key of a series within a chain column: kind and strike per unit. */
export function seriesKey(o: OptionOffer): string {
  return `${o.kind}:${strikePerUnit(o)}`
}

/** Best quote first. Returns a new array. */
export function rankOffers(offers: OptionOffer[]): OptionOffer[] {
  return [...offers].sort((a, b) => byPremiumPerUnit(a, b) || byId(a, b))
}

function side(offers: OptionOffer[]): ChainSide {
  const ranked = rankOffers(offers)
  return { offers: ranked, best: ranked[0], makers: new Set(ranked.map((o) => o.writer)).size }
}

/** Rows of the chain for the offers already narrowed to one asset and expiry day. Highest strike first (exact order). */
export function buildChain(column: OptionOffer[]): ChainRow[] {
  const groups = new Map<string, { sample: OptionOffer; call: OptionOffer[]; put: OptionOffer[] }>()
  for (const o of column) {
    const k = strikePerUnit(o)
    const g = groups.get(k) ?? { sample: o, call: [], put: [] }
    g[o.kind].push(o)
    groups.set(k, g)
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => byStrikePerUnit(b.sample, a.sample))
    .map(([strike, g]) => ({
      strike,
      call: g.call.length ? side(g.call) : undefined,
      put: g.put.length ? side(g.put) : undefined,
    }))
}

/** The offers of one series, best first. */
export function seriesOffers(column: OptionOffer[], key: string): OptionOffer[] {
  return rankOffers(column.filter((o) => seriesKey(o) === key))
}

/** Series with the most competing makers (ties: first in chain order). Opens the page on a populated list. */
export function defaultSeries(rows: ChainRow[]): string | null {
  let best: { key: string; makers: number } | null = null
  for (const r of rows)
    for (const kind of ['put', 'call'] as const) {
      const s = r[kind]
      if (s && (!best || s.makers > best.makers)) best = { key: `${kind}:${r.strike}`, makers: s.makers }
    }
  return best?.key ?? null
}

/** Premium per one unit of underlying, display only. */
export function premiumUnit(o: OptionOffer): string {
  return perUnitText(o.totalPremium, o, o.quote.decimals)
}
