// The market of one asset as the asset page shows it: the standard grid of core/series laid over the orders the
// contract holds. Pure functions; the hooks in ../derived.ts only feed them query data.
//
// What is "standard" is an app convention (brief D11). Only standard orders price a chain cell, so a dust lot or
// an off-grid strike posted by a stranger can never move a cell, add a row or add an expiry tab. Everything else
// stays buyable from `other`, with the reason it is there.
import { assetPath, findReferenceAsset, referenceAssets, similarCodeFlag, tierOf } from '../../core/assets'
import type { AssetNetwork, AssetTier, SimilarCodeFlag } from '../../core/assets'
import { allRows, bookRowAction, cellKey, chainCells, prefillForRef, prefillsOf, seriesBook, seriesRefOf } from '../../core/market/selection'
import type { BookRowAction, CellSummary, MarketInputs, Prefill, SeriesRef } from '../../core/market/selection'
import { sortBook } from '../../core/market/book'
import type { BookRow } from '../../core/market/book'
import type { Ask, OptionKind, OptionOffer, TokenInfo } from '../../core/options/types'
import { moneyness, priceOf } from '../../core/reference'
import type { Moneyness, ReferencePrice } from '../../core/reference'
import type { Bid } from '../../core/requests/types'
import { LADDER_ROWS, NON_STANDARD_REASONS, classifyOffer, expiryCycle, expiryDayKey, chainExpiries, strikeLadder, strikesOf } from '../../core/series'
import type { NonStandardReason } from '../../core/series'
import { premiumUnits } from '../../core/units'

/** What the contract holds, as the queries return it. */
export interface MarketSource {
  /** Every option, in every state. */
  options: OptionOffer[]
  /** Resale asks; null when the contract has no resale or the read is not in yet. */
  asks: Ask[] | null
  /** Buyer requests; null when the contract has no bids or the read is not in yet. */
  bids: Bid[] | null
  /** Connected address, or null. */
  me: string | null
  nowSec: number
  /**
   * Whether the contract has requests and resale at all. Set by the hooks, which know a read that is still
   * running (support not known yet, counted as supported) from one that answered "none" (`null`). Without them
   * the answer is read from `bids` and `asks`.
   */
  bidsOn?: boolean
  resaleOn?: boolean
}

export interface GridCell {
  ref: SeriesRef
  /** `cellKey(ref)`: stable React key and lookup key. */
  key: string
  /** Cheapest standard offer or listing of the series, whoever posted it. Null when the cell is empty. */
  best: BookRow | null
  /** Its premium per whole unit of underlying, in quote units, floored. */
  bestPerUnit: bigint | null
  /** Highest standard bid of the series. */
  bestBid: BookRow | null
  bestBidPerUnit: bigint | null
  /** Distinct makers with an open standard offer. */
  makers: number
  /** Standard offers and listings; standard bids. */
  offers: number
  bids: number
  /** The connected wallet has an open offer, listing or bid here; holds a live option here; wrote one. */
  mine: boolean
  holding: boolean
  wrote: boolean
  /** Where the strike stands at the reference price; `unknown` without one. */
  moneyness: Moneyness
  /** No standard offer or listing: the cell offers "Request". */
  empty: boolean
}

export interface GridRow {
  strikePerUnit: bigint
  call: GridCell
  put: GridCell
}

export interface ExpiryColumn {
  /** Unix seconds: a listed Friday 08:00 UTC. */
  expiry: number
  /** UTC day key (`2026-11-13`), the value of the `expiry=` search param. */
  day: string
  cycle: 'weekly' | 'monthly' | null
  secondsLeft: number
  /** One row per ladder strike, ascending. */
  rows: GridRow[]
  /** Standard offers and listings, and standard bids, at this expiry. */
  offers: number
  bids: number
}

export interface OtherOrder {
  row: BookRow
  /** The first rule of the standard grid the order does not meet. */
  reason: NonStandardReason
  perUnit: bigint | null
  /** What the connected wallet can do with it (buy, fill, cancel its own). */
  action: BookRowAction
}

export interface MarketSummary {
  /** Open maker offers on the asset, standard or not. */
  offers: number
  listings: number
  bids: number
  /** Distinct makers with an open offer. */
  makers: number
  /** Soonest expiry among open offers, or null. */
  nearestExpiry: number | null
  /** Cheapest standard maker offer per unit, per kind. */
  lowestPut: BookRow | null
  lowestPutPerUnit: bigint | null
  lowestCall: BookRow | null
  lowestCallPerUnit: bigint | null
}

export interface MarketView {
  asset: TokenInfo
  quote: TokenInfo
  reference: ReferencePrice
  /** Listed expiries, ascending. */
  expiries: number[]
  /** Standard strikes per unit in quote units, ascending. */
  ladder: bigint[]
  /** One column per listed expiry. */
  columns: ExpiryColumn[]
  /** Every grid cell by `cellKey`. */
  cells: Map<string, GridCell>
  /**
   * Where the dashed reference rule goes in the ascending ladder: `below` strikes are under the reference, and
   * `at` is the index of a strike equal to it (else null). Null without a reference price.
   */
  referenceRule: { below: number; at: number | null } | null
  /** Orders that are off the grid or otherwise not standard: still buyable, listed with the reason. */
  other: OtherOrder[]
  otherCounts: Record<NonStandardReason, number>
  /** Expiries of `other` orders that are not listed dates ("Other dates"), ascending. */
  otherExpiries: number[]
  /** Every open, unexpired bid on the asset (standard or not), highest premium per unit first. */
  bids: BookRow[]
  /**
   * Whether the contract has requests (funded bids, from v1.5) and resale listings (from v1.4). `bids` is empty
   * both for "no bids" and for "no bid support": these two flags tell them apart, so a view on an older contract
   * can leave out the bid side, "Post a bid here" and the "Request" of an empty cell.
   */
  bidsOn: boolean
  resaleOn: boolean
  summary: MarketSummary
}

const isOpenOffer = (o: OptionOffer, nowSec: number) => o.state === 'offered' && o.expiry > nowSec

/** The inputs core/market expects, limited to offers that can still be bought. */
export function marketInputs(src: MarketSource): MarketInputs {
  return { offers: src.options.filter((o) => isOpenOffer(o, src.nowSec)), options: src.options, asks: src.asks, bids: src.bids, me: src.me, nowSec: src.nowSec }
}

/** Every order on one asset: open offers, live listings, open bids. */
export function assetRows(input: MarketInputs, underlyingId: string): BookRow[] {
  return allRows(input).filter((r) => r.underlying.contractId === underlyingId)
}

/** Strike rows of the grid: the app-wide constant of core/series, re-exported for the callers of this layer. */
export { LADDER_ROWS }

/** The strike ladder of an asset: around the reference price, or from the strikes that exist when there is none. */
export function ladderFor(reference: ReferencePrice, quoteDecimals: number, rows: readonly BookRow[]): bigint[] {
  return strikeLadder(priceOf(reference), quoteDecimals, LADDER_ROWS, { existing: strikesOf(rows) })
}

const emptyCounts = (): Record<NonStandardReason, number> => Object.fromEntries(NON_STANDARD_REASONS.map((r) => [r, 0])) as Record<NonStandardReason, number>

function gridCell(ref: SeriesRef, summary: CellSummary | undefined, reference: ReferencePrice): GridCell {
  const best = summary?.best ?? null
  const bestBid = summary?.bestBid ?? null
  return {
    ref,
    key: cellKey(ref),
    best,
    bestPerUnit: best ? premiumUnits(best) : null,
    bestBid,
    bestBidPerUnit: bestBid ? premiumUnits(bestBid) : null,
    makers: summary?.makers ?? 0,
    offers: summary?.offers ?? 0,
    bids: summary?.bids ?? 0,
    mine: summary?.mine ?? false,
    holding: summary?.holding ?? false,
    wrote: summary?.wrote ?? false,
    moneyness: moneyness(ref.kind, ref.strikePerUnit, reference),
    empty: best === null,
  }
}

const cheaper = (a: BookRow, b: BookRow | null): boolean => {
  if (!b) return true
  // a.premium / a.qty < b.premium / b.qty, exactly.
  return a.totalPremium * b.underlyingQty < b.totalPremium * a.underlyingQty
}

/**
 * Builds the market view of one asset. `quote` is the contract's quote token; `reference` the asset's reference
 * price (core/reference), which centres the ladder and gives each cell its moneyness.
 */
export function buildMarket(src: MarketSource, asset: TokenInfo, quote: TokenInfo, reference: ReferencePrice): MarketView {
  const input = marketInputs(src)
  const rows = assetRows(input, asset.contractId)
  // The listed deadlines, and a closing one (less than an hour away) whose orders keep their tab until it passes.
  const expiries = chainExpiries(src.nowSec)
  const ladder = ladderFor(reference, quote.decimals, rows)

  const standardKeys = new Set<string>()
  const other: OtherOrder[] = []
  const otherCounts = emptyCounts()
  for (const row of rows) {
    const c = classifyOffer(row, ladder, expiries)
    if (c.standard) standardKeys.add(row.key)
    else {
      other.push({ row, reason: c.reason, perUnit: premiumUnits(row), action: bookRowAction(row, src.me) })
      otherCounts[c.reason]++
    }
  }
  // Offers before bids, then soonest expiry, then cheapest.
  other.sort((a, b) => Number(a.row.source === 'bid') - Number(b.row.source === 'bid') || a.row.expiry - b.row.expiry || (cheaper(a.row, b.row) ? -1 : cheaper(b.row, a.row) ? 1 : 0))

  const standard: MarketInputs = {
    ...input,
    offers: input.offers.filter((o) => standardKeys.has(`o${o.id}`)),
    asks: input.asks ? input.asks.filter((a) => standardKeys.has(`r${a.id}`)) : null,
    bids: input.bids ? input.bids.filter((b) => standardKeys.has(`b${b.id}`)) : null,
  }
  const summaries = chainCells(standard, asset.contractId)

  const cells = new Map<string, GridCell>()
  const columns: ExpiryColumn[] = expiries.map((expiry) => {
    let offers = 0
    let bids = 0
    const gridRows: GridRow[] = ladder.map((strikePerUnit) => {
      const cellFor = (kind: OptionKind): GridCell => {
        const ref: SeriesRef = { underlyingId: asset.contractId, expiry, kind, strikePerUnit }
        const cell = gridCell(ref, summaries.get(cellKey(ref)), reference)
        cells.set(cell.key, cell)
        offers += cell.offers
        bids += cell.bids
        return cell
      }
      return { strikePerUnit, call: cellFor('call'), put: cellFor('put') }
    })
    return { expiry, day: expiryDayKey(expiry), cycle: expiryCycle(expiry), secondsLeft: expiry - src.nowSec, rows: gridRows, offers, bids }
  })

  const price = priceOf(reference)
  const at = price === null ? -1 : ladder.indexOf(price)
  const referenceRule = price === null ? null : { below: ladder.filter((k) => k < price).length, at: at >= 0 ? at : null }

  const makerRows = rows.filter((r) => r.source === 'maker')
  let lowestPut: BookRow | null = null
  let lowestCall: BookRow | null = null
  for (const r of makerRows) {
    if (!standardKeys.has(r.key)) continue
    if (r.kind === 'put' && cheaper(r, lowestPut)) lowestPut = r
    if (r.kind === 'call' && cheaper(r, lowestCall)) lowestCall = r
  }
  const summary: MarketSummary = {
    offers: makerRows.length,
    listings: rows.filter((r) => r.source === 'resale').length,
    bids: rows.filter((r) => r.source === 'bid').length,
    makers: new Set(makerRows.map((r) => r.counterparty)).size,
    nearestExpiry: makerRows.reduce<number | null>((min, r) => (min === null || r.expiry < min ? r.expiry : min), null),
    lowestPut,
    lowestPutPerUnit: lowestPut ? premiumUnits(lowestPut) : null,
    lowestCall,
    lowestCallPerUnit: lowestCall ? premiumUnits(lowestCall) : null,
  }

  return {
    asset,
    quote,
    reference,
    expiries,
    ladder,
    columns,
    cells,
    referenceRule,
    other,
    otherCounts,
    otherExpiries: [...new Set(other.map((o) => o.row.expiry).filter((e) => !expiries.includes(e)))].sort((a, b) => a - b),
    bids: sortBook(rows).bids,
    bidsOn: src.bidsOn ?? src.bids !== null,
    resaleOn: src.resaleOn ?? src.asks !== null,
    summary,
  }
}

// ------------------------------------------------------------------------------------------- one series

export interface BookEntry {
  row: BookRow
  /** Premium per whole unit of underlying, in quote units, floored. */
  perUnit: bigint | null
  /** What the connected wallet can do with this row. A guest gets the same buy and fill actions. */
  action: BookRowAction
  /** Posted by the connected wallet. */
  mine: boolean
  /** Why the order is not standard, or null. A non-standard order never is the "best" of a grid series. */
  reason: NonStandardReason | null
}

export interface BookView {
  ref: SeriesRef
  /** The series is a cell of the standard grid (listed expiry, ladder strike). */
  onGrid: boolean
  /** Bids, highest premium per unit first. */
  bids: BookEntry[]
  /** Maker offers and resale listings, lowest premium per unit first. */
  offers: BookEntry[]
  /** Cheapest offer or listing the wallet can take. On a grid series, standard orders come first. */
  bestOffer: BookRow | null
  /** Highest bid the wallet can fill. */
  bestBid: BookRow | null
  /** Form values for the ticket: `buy` to post a bid next to the best offer, `sell` to write next to the best bid. */
  prefill: { buy: Prefill; sell: Prefill }
  empty: boolean
}

const TAKE: ReadonlySet<BookRowAction['kind']> = new Set<BookRowAction['kind']>(['buy', 'buy-resale', 'fill'])

/** The two-sided book of one exact series. `ladder` and `expiries` are the asset's grid (`MarketView`). */
export function buildBook(src: MarketSource, ref: SeriesRef, quote: TokenInfo, ladder: readonly bigint[], expiries: readonly number[]): BookView {
  const book = seriesBook(marketInputs(src), ref)
  const onGrid = ladder.includes(ref.strikePerUnit) && expiries.includes(ref.expiry)
  const entry = (row: BookRow): BookEntry => {
    const c = classifyOffer(row, ladder, expiries)
    return { row, perUnit: premiumUnits(row), action: bookRowAction(row, src.me), mine: src.me !== null && row.counterparty === src.me, reason: c.standard ? null : c.reason }
  }
  const bids = book.bids.map(entry)
  const offers = book.offers.map(entry)
  const pick = (list: BookEntry[]): BookRow | null => {
    const takeable = list.filter((e) => TAKE.has(e.action.kind))
    return ((onGrid ? takeable.find((e) => e.reason === null) : undefined) ?? takeable[0])?.row ?? null
  }
  const bestOffer = pick(offers)
  const bestBid = pick(bids)
  const empty = bids.length === 0 && offers.length === 0
  const blank = prefillForRef(ref, quote.decimals)
  return {
    ref,
    onGrid,
    bids,
    offers,
    bestOffer,
    bestBid,
    prefill: empty ? { buy: blank, sell: blank } : prefillsOf({ sample: book.sample, bestOffer: bestOffer ?? undefined, bestBid: bestBid ?? undefined }),
    empty,
  }
}

/** The series of an order or a position, or null when its strike per unit is not an exact amount. */
export const seriesOf = seriesRefOf

// ------------------------------------------------------------------------------------------- markets index

export interface MarketIndexRow {
  asset: TokenInfo
  /** `Reference`, `Domain-linked` or `No domain link`: a word in a column, never a badge. */
  tier: AssetTier
  /** In the app's reference list (shown by default on the Markets index). */
  isReference: boolean
  /** `Fund share`, `Bond`, `Equity` for a reference asset, else null. */
  typeLabel: string | null
  /** `/markets/bond`, `/markets/CODE-ISSUER` or `/markets/C...`. */
  path: string
  /** Set when a non-reference asset's code resembles a reference code or the quote token. */
  similar: SimilarCodeFlag | null
  reference: ReferencePrice
  summary: MarketSummary
  /** Orders that are not standard (a count; they open from the asset page). */
  otherOrders: number
}

/** One row per listed asset for the Markets index: reference assets first (in list order), then the others by code. */
export function buildMarketIndex(
  src: MarketSource,
  assets: readonly TokenInfo[],
  quote: TokenInfo,
  network: AssetNetwork,
  referenceOf: (asset: TokenInfo) => ReferencePrice,
): MarketIndexRow[] {
  const order = new Map(referenceAssets(network).map((a, i) => [a.contractId, i]))
  const rows = assets.map((asset): MarketIndexRow => {
    const reference = referenceOf(asset)
    const market = buildMarket(src, asset, quote, reference)
    const listed = findReferenceAsset(asset.contractId)
    return {
      asset,
      tier: tierOf(asset),
      isReference: order.has(asset.contractId),
      typeLabel: listed?.typeLabel ?? null,
      path: assetPath(asset),
      similar: similarCodeFlag(asset, network),
      reference,
      summary: market.summary,
      otherOrders: market.other.length,
    }
  })
  const rank = (r: MarketIndexRow) => order.get(r.asset.contractId) ?? Number.MAX_SAFE_INTEGER
  return rows.sort((a, b) => rank(a) - rank(b) || (a.asset.code < b.asset.code ? -1 : a.asset.code > b.asset.code ? 1 : a.asset.contractId < b.asset.contractId ? -1 : 1))
}
