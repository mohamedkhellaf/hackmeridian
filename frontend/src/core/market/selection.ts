// What the asset page shows for a given set of orders and a given selection. Pure: this is the series selection
// and the form prefill that used to live inside the Markets view. Inputs are the lists the data layer already has
// (open offers, all options, asks, bids) plus what the user picked (from the URL).
//
// Two views of the same orders:
//   - `chainCells` and `seriesBook` address a series by its exact terms (asset contract id, expiry, kind, strike
//     per unit in quote units). The standard grid of core/series is laid over them: for each grid cell, look up
//     `cells.get(cellKey(ref))`. Orders whose strike per unit is not an exact amount have no cell; they belong
//     in "Other offers".
//   - `selectMarket` is the order-driven view the old page had: assets, expiry days and series that have orders,
//     with a sensible default at each level. It needs no reference price and no grid.
import type { Ask, OptionKind, OptionOffer, TokenInfo } from '../options/types'
import type { Bid } from '../requests/types'
import { resaleRows } from '../resale/resale'
import { expiryDay } from '../time'
import { byPremiumPerUnit, perUnit, plainAmount } from '../units'
import { asSample, bookRows, sortBook } from './book'
import type { BookRow } from './book'
import { buildChain, defaultSeries, seriesOffers } from './chain'
import type { ChainRow } from './chain'

export interface MarketInputs {
  /** Open (state `offered`) offers. */
  offers: OptionOffer[]
  /** All options: resale asks are joined against them, and positions are read from them. */
  options: OptionOffer[]
  /** Resale asks; null when the contract has no resale. */
  asks: Ask[] | null
  /** Buyer bids; null when the contract has no bids. */
  bids: Bid[] | null
  /** Connected address, or null. Own rows are never offered as the "best" to trade against. */
  me: string | null
  nowSec: number
}

/** Every order as a book row: open offers, live resale listings and open, unexpired bids. */
export function allRows(input: MarketInputs): BookRow[] {
  return bookRows(input.offers, resaleRows(input.options, input.asks, input.nowSec), input.bids, input.nowSec)
}

// ------------------------------------------------------------------------------------------- exact series

/** A series by its exact terms. `strikePerUnit` is in quote units for one whole unit of underlying. */
export interface SeriesRef {
  /** Underlying SAC contract id: the asset's identity (two assets can share a code). */
  underlyingId: string
  /** Expiry, unix seconds. */
  expiry: number
  kind: OptionKind
  strikePerUnit: bigint
}

type Terms = { kind: OptionKind; underlying: { contractId: string; decimals: number }; underlyingQty: bigint; totalStrike: bigint; expiry: number }

/** The series of an offer, bid, listing or position; null when its strike per unit is not an exact amount. */
export function seriesRefOf(o: Terms): SeriesRef | null {
  if (o.underlyingQty <= 0n) return null
  const scaled = o.totalStrike * 10n ** BigInt(o.underlying.decimals)
  if (scaled % o.underlyingQty !== 0n) return null
  return { underlyingId: o.underlying.contractId, expiry: o.expiry, kind: o.kind, strikePerUnit: scaled / o.underlyingQty }
}

/** Map key of a series within one asset: `expiry:kind:strikePerUnit`. */
export const cellKey = (ref: Pick<SeriesRef, 'expiry' | 'kind' | 'strikePerUnit'>): string => `${ref.expiry}:${ref.kind}:${ref.strikePerUnit}`

export const sameSeriesRef = (a: SeriesRef, b: SeriesRef): boolean => a.underlyingId === b.underlyingId && cellKey(a) === cellKey(b)

const canTake = (r: BookRow, me: string | null) => r.counterparty !== me && !(r.offer && r.offer.writer === me)

export interface CellSummary {
  ref: SeriesRef
  /** Cheapest offer or listing of the series (premium per unit), whoever posted it. */
  best: BookRow | undefined
  /** Highest bid of the series. */
  bestBid: BookRow | undefined
  /** Distinct makers with an open offer (resale sellers are not makers). */
  makers: number
  /** Offers and resale listings; bids. */
  offers: number
  bids: number
  /** The connected wallet has an open offer, a listing or a bid in this series. */
  mine: boolean
  /** The connected wallet holds, or wrote, a live option of this series. */
  holding: boolean
  wrote: boolean
}

/**
 * One summary per series of an asset that has an order or a position of the connected wallet, keyed by `cellKey`.
 * A chain cell with no entry is empty ("Request").
 */
export function chainCells(input: MarketInputs, underlyingId: string): Map<string, CellSummary> {
  const groups = new Map<string, { ref: SeriesRef; rows: BookRow[] }>()
  const group = (ref: SeriesRef) => {
    const k = cellKey(ref)
    let g = groups.get(k)
    if (!g) groups.set(k, (g = { ref, rows: [] }))
    return g
  }
  for (const r of allRows(input)) {
    if (r.underlying.contractId !== underlyingId) continue
    const ref = seriesRefOf(r)
    if (ref) group(ref).rows.push(r)
  }
  const cells = new Map<string, CellSummary>()
  const cell = (ref: SeriesRef): CellSummary => {
    const k = cellKey(ref)
    let c = cells.get(k)
    if (!c) cells.set(k, (c = { ref, best: undefined, bestBid: undefined, makers: 0, offers: 0, bids: 0, mine: false, holding: false, wrote: false }))
    return c
  }
  for (const { ref, rows } of groups.values()) {
    const { bids, offers } = sortBook(rows)
    const c = cell(ref)
    c.best = offers[0]
    c.bestBid = bids[0]
    c.makers = new Set(offers.filter((r) => r.source === 'maker').map((r) => r.counterparty)).size
    c.offers = offers.length
    c.bids = bids.length
    c.mine = input.me !== null && rows.some((r) => r.counterparty === input.me)
  }
  if (input.me)
    for (const o of input.options) {
      if (o.underlying.contractId !== underlyingId || o.state !== 'active' || o.expiry <= input.nowSec) continue
      if (o.holder !== input.me && o.writer !== input.me) continue
      const ref = seriesRefOf(o)
      if (!ref) continue
      const c = cell(ref)
      if (o.holder === input.me) c.holding = true
      if (o.writer === input.me) c.wrote = true
    }
  return cells
}

export interface SeriesBook {
  /** Bids highest premium per unit first; offers and listings lowest first. */
  bids: BookRow[]
  offers: BookRow[]
  /** Cheapest offer or listing the wallet can take (not its own offer, listing or written option). */
  bestOffer: BookRow | undefined
  /** Highest bid the wallet can fill (not its own). */
  bestBid: BookRow | undefined
  /** Any row of the series, for its terms. Undefined when the series has no order. */
  sample: BookRow | undefined
}

function bookOf(rows: BookRow[], me: string | null): SeriesBook {
  const { bids, offers } = sortBook(rows)
  return { bids, offers, bestOffer: offers.find((r) => canTake(r, me)), bestBid: bids.find((r) => r.counterparty !== me), sample: offers[0] ?? bids[0] }
}

/** The two-sided book of one exact series. Empty arrays when nothing is posted on it. */
export function seriesBook(input: MarketInputs, ref: SeriesRef): SeriesBook {
  const rows = allRows(input).filter((r) => {
    const x = seriesRefOf(r)
    return x !== null && sameSeriesRef(x, ref)
  })
  return bookOf(rows, input.me)
}

/** The cheapest open maker offer across all series of an asset per kind, for the Markets index ("lowest put premium per unit"). */
export function lowestPremiums(offers: OptionOffer[], underlyingId: string): { put: OptionOffer | null; call: OptionOffer | null; nearestExpiry: number | null; count: number } {
  const out = { put: null as OptionOffer | null, call: null as OptionOffer | null, nearestExpiry: null as number | null, count: 0 }
  for (const o of offers) {
    if (o.underlying.contractId !== underlyingId || o.state !== 'offered' || o.underlyingQty <= 0n) continue
    out.count++
    if (out.nearestExpiry === null || o.expiry < out.nearestExpiry) out.nearestExpiry = o.expiry
    const best = out[o.kind]
    if (!best || byPremiumPerUnit(o, best) < 0) out[o.kind] = o
  }
  return out
}

// ------------------------------------------------------------------------------------------- order-driven view

/** What the user picked. Every field is optional: anything missing or unknown falls back to a default. */
export interface MarketPick {
  /** Underlying contract id (preferred) or code. */
  asset?: string | null
  /** Expiry day, UTC (`2026-11-13`). */
  day?: string | null
  /** Series key, `put:10.00` or `call:12.00` (kind and strike per unit as the chain shows it). */
  series?: string | null
}

export interface MarketSelection {
  /** Underlyings that have any order, sorted by code then contract id. */
  assets: TokenInfo[]
  /** The asset shown: the pick when it has orders, else the asset with the most offers. Null when there is nothing. */
  asset: TokenInfo | null
  /** Expiry days (UTC) of that asset, soonest first. */
  days: string[]
  day: string
  /** Chain rows of that asset and day built from every order (offers, resale listings, bids). Highest strike first. */
  rows: ChainRow[]
  /** The same rows built from offers and resale listings only: what a chain cell prices. Keyed by strike. */
  offerRowsByStrike: Map<string, ChainRow>
  /** The series shown: the pick when it exists, else the one with the most makers. Null when the column is empty. */
  series: string | null
  kind: OptionKind | null
  /** Strike per unit as text (`10.00`), the row key. */
  strike: string | null
  book: SeriesBook
  /** Open offers in total, and every order (offers, listings, open bids). */
  offerCount: number
  orderCount: number
  /** Quote code of the column, or '' when the column mixes quote tokens (then every cell needs its own unit). */
  quoteCode: string
  /** The contract supports bids (v1.5). */
  bidsOn: boolean
}

export const seriesKeyOf = (kind: OptionKind, strike: string): string => `${kind}:${strike}`

export function parseSeriesKey(key: string | null | undefined): { kind: OptionKind; strike: string } | null {
  const m = /^(put|call):(.+)$/.exec(key ?? '')
  return m ? { kind: m[1] as OptionKind, strike: m[2] } : null
}

/** A bid-only cell: the series has bids but no offer or listing to price it. */
export function isBidOnly(sel: Pick<MarketSelection, 'rows' | 'offerRowsByStrike'>, strike: string, kind: OptionKind): boolean {
  const all = sel.rows.find((r) => r.strike === strike)?.[kind]
  return !!all && !sel.offerRowsByStrike.get(strike)?.[kind]
}

const byCode = (a: TokenInfo, b: TokenInfo) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0)

export function selectMarket(input: MarketInputs, pick: MarketPick = {}): MarketSelection {
  const entries = allRows(input).map((r) => ({ r, s: asSample(r) }))
  const rowOf = new Map(entries.map((e) => [e.s, e.r]))
  const offerEntries = entries.filter((e) => e.r.source !== 'bid')

  // Assets are told apart by contract id, never by code: a look-alike asset gets its own chain.
  const byId = new Map<string, TokenInfo>()
  for (const e of entries) if (!byId.has(e.s.underlying.contractId)) byId.set(e.s.underlying.contractId, e.s.underlying)
  const assets = [...byId.values()].sort(byCode)
  const countFor = (id: string) => (offerEntries.length ? offerEntries : entries).filter((e) => e.s.underlying.contractId === id).length
  const busiest = [...assets].sort((a, b) => countFor(b.contractId) - countFor(a.contractId))[0] ?? null
  const asset = (pick.asset && (byId.get(pick.asset) ?? assets.find((t) => t.code === pick.asset))) || busiest

  const ofAsset = (list: typeof entries) => (asset ? list.filter((e) => e.s.underlying.contractId === asset.contractId).map((e) => e.s) : [])
  const samples = ofAsset(entries)
  const offerSamples = ofAsset(offerEntries)
  const days = [...new Set(samples.map((o) => expiryDay(o.expiry)))].sort()
  const day = pick.day && days.includes(pick.day) ? pick.day : (days[0] ?? '')
  const inDay = (list: OptionOffer[]) => list.filter((o) => expiryDay(o.expiry) === day)
  const column = inDay(samples)
  const rows = buildChain(column)
  const offerRowsByStrike = new Map(buildChain(inDay(offerSamples)).map((r) => [r.strike, r]))

  const wanted = parseSeriesKey(pick.series)
  const exists = wanted !== null && rows.some((r) => r.strike === wanted.strike)
  const series = exists ? pick.series! : (defaultSeries([...offerRowsByStrike.values()]) ?? defaultSeries(rows))
  const parsed = parseSeriesKey(series)

  const quotes = new Set(column.map((o) => o.quote.code))
  return {
    assets,
    asset,
    days,
    day,
    rows,
    offerRowsByStrike,
    series,
    kind: parsed?.kind ?? null,
    strike: parsed?.strike ?? null,
    book: bookOf(series ? seriesOffers(column, series).map((x) => rowOf.get(x)!) : [], input.me),
    offerCount: input.offers.length,
    orderCount: entries.length,
    quoteCode: quotes.size === 1 ? [...quotes][0] : '',
    bidsOn: input.bids !== null,
  }
}

// ------------------------------------------------------------------------------------------- prefill

/** Form values for a write-offer or post-bid form, as input text. An empty object means "no series". */
export type Prefill = Partial<{ kind: OptionKind; underlyingId: string; qty: string; strike: string; premium: string; expiryMs: number }>

/**
 * Form values for writing an offer or posting a bid on a series: the series' kind, asset, strike and expiry,
 * with the quantity and the premium of the row to match or beat (`best`), or of any row of the series.
 */
export function prefillFor(sample: BookRow | undefined, best?: BookRow): Prefill {
  if (!sample) return {}
  const from = best ?? sample
  const strike = perUnit(sample.totalStrike, sample)
  return {
    kind: sample.kind,
    underlyingId: sample.underlying.contractId,
    qty: plainAmount(from.underlyingQty, sample.underlying.decimals),
    strike: strike === null ? '' : plainAmount(strike, sample.quote.decimals),
    premium: plainAmount(from.totalPremium, sample.quote.decimals),
    expiryMs: sample.expiry * 1000,
  }
}

/** Prefill for the Buy side (post a bid next to the best offer) and the Sell side (post an offer next to the best bid). */
export function prefillsOf(book: Pick<SeriesBook, 'sample' | 'bestOffer' | 'bestBid'>): { buy: Prefill; sell: Prefill } {
  return { buy: prefillFor(book.sample, book.bestOffer), sell: prefillFor(book.sample, book.bestBid) }
}

/** Prefill for an empty series (a grid cell with no order): the terms only; quantity and premium are left to the user. */
export function prefillForRef(ref: SeriesRef, quoteDecimals: number): Prefill {
  return { kind: ref.kind, underlyingId: ref.underlyingId, strike: plainAmount(ref.strikePerUnit, quoteDecimals), expiryMs: ref.expiry * 1000 }
}

// ------------------------------------------------------------------------------------------- row actions

/** What a book row lets the connected wallet do. One place for the "own row" and "self trade" rules of the book. */
export type BookRowAction =
  | { kind: 'buy' } // a maker offer the wallet can buy
  | { kind: 'buy-resale' } // a holder's listing the wallet can buy
  | { kind: 'fill' } // a bid the wallet can fill
  | { kind: 'cancel-offer' } // the wallet's own open offer
  | { kind: 'cancel-bid' } // the wallet's own bid
  | { kind: 'none'; note: 'Yours' | 'Written by you' }

/** `me` may be null: a guest sees the same buy and fill actions and is asked to connect when using them. */
export function bookRowAction(r: BookRow, me: string | null): BookRowAction {
  if (r.source === 'bid') return me !== null && r.bid?.buyer === me ? { kind: 'cancel-bid' } : { kind: 'fill' }
  if (r.source === 'resale') {
    if (me !== null && r.ask?.holder === me) return { kind: 'none', note: 'Yours' }
    // The contract refuses a writer buying back their own option (SelfTrade, 111).
    if (me !== null && r.offer?.writer === me) return { kind: 'none', note: 'Written by you' }
    return { kind: 'buy-resale' }
  }
  return me !== null && r.offer?.writer === me ? { kind: 'cancel-offer' } : { kind: 'buy' }
}
