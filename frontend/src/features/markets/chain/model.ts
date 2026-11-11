// The chain view's own logic, pure: which column and series the URL selects, what each cell says, and where an
// arrow key goes. The grid itself (ladder, cells, book, "other" orders) comes from the data layer's `useMarket`
// and `useBook`; nothing here prices or ranks anything.
import type { AssetSearch } from '../../../app/search'
import { countOf, formatCountdown, formatExact, formatList, formatUnits, formatUtcDay, parseAmount } from '../../../core/format'
import { bookRowAction, cellKey } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import type { BookRow } from '../../../core/market/book'
import type { OptionKind } from '../../../core/options/types'
import { priceOf } from '../../../core/reference'
import type { ReferencePrice } from '../../../core/reference'
import { expiryDayKey } from '../../../core/series'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { COPY, KIND_WORD, MAKERS, OFFERS, REFERENCE_LABEL, REFERENCE_PHRASE, REFERENCE_TAG, REQUESTS } from './copy'
import { isMine } from './orders'

// ------------------------------------------------------------------------------------------- figures

/** A strike per unit as the chain prints it: every digit, at least two decimals (`100.00`, `24.75`). */
export const strikeText = (units: bigint, decimals: number): string => formatExact(units, decimals, { minDp: 2 })

/** The same strike for the `strike=` search param: no grouping, so it parses back exactly. */
export const strikeParam = (units: bigint, decimals: number): string => formatExact(units, decimals, { minDp: 2, group: false })

/** A premium per unit: two decimals, truncated; a non-zero amount below the tick reads `<0.01`. */
export const premiumText = (units: bigint, decimals: number): string => formatUnits(units, decimals)

/** `13 Nov` for an expiry (UTC day). */
export const expiryLabel = (expiry: number): string => formatUtcDay(expiry)

/** Time left for an expiry tab: the largest unit only (`2 d`, `5 h`, `12 min`). */
export function leftLabel(secondsLeft: number): string {
  return formatCountdown(secondsLeft).split(' ').slice(0, 2).join(' ')
}

/** `BOND 100.00 put, 13 Nov`: the heading of a series, with the strike as the chain prints it. */
export function seriesTitle(code: string, ref: Pick<SeriesRef, 'kind' | 'strikePerUnit' | 'expiry'>, quoteDecimals: number): string {
  return `${code} ${strikeText(ref.strikePerUnit, quoteDecimals)} ${ref.kind}, ${expiryLabel(ref.expiry)}`
}

/**
 * The line between the two sides of a series book: how far the best request sits under the best offer, per unit
 * (`0.03 between the best offer and the best request.`). Null unless both sides have a price.
 */
export function gapLine(bestOfferPerUnit: bigint | null, bestRequestPerUnit: bigint | null, quoteDecimals: number): string | null {
  if (bestOfferPerUnit === null || bestRequestPerUnit === null) return null
  const spread = bestOfferPerUnit - bestRequestPerUnit
  if (spread === 0n) return COPY.level
  return spread > 0n ? COPY.gap(formatUnits(spread, quoteDecimals)) : COPY.crossed(formatUnits(-spread, quoteDecimals))
}

// ------------------------------------------------------------------------------------------- reference

export interface ReferenceLine {
  /** The tag on the dashed rule: `Demo price 99.40`. */
  tag: string
  /** The two-word label alone (`Demo price`), under a strike the reference equals. */
  label: string
  /** `the demo price`, for sentences. */
  phrase: string
  /** The figure alone: `99.40`. */
  price: string
}

/** How the reference price reads in the chain, or null when there is none. */
export function referenceLine(reference: ReferencePrice, quoteDecimals: number): ReferenceLine | null {
  const perUnit = priceOf(reference)
  if (perUnit === null || reference.kind === 'none') return null
  const price = formatUnits(perUnit, quoteDecimals)
  return { tag: `${REFERENCE_TAG[reference.kind]} ${price}`, label: REFERENCE_LABEL[reference.kind], phrase: REFERENCE_PHRASE[reference.kind], price }
}

// ------------------------------------------------------------------------------------------- selection

export interface ChainSelection {
  /** The expiry column shown. Null only when no expiry is listed. */
  column: ExpiryColumn | null
  /** The series the URL names, or null. It may be off the grid (a strike or a date that is not listed). */
  ref: SeriesRef | null
  /** Its cell in the shown column, when it is a grid series of that column. */
  cell: GridCell | null
  /** The URL's date when the chain does not show it (passed, or no deadline): the day key, else null. */
  missing: string | null
}

/** The column a visitor lands on: the first listed date with a standard offer, else with a bid, else the first. */
export function defaultColumn(columns: readonly ExpiryColumn[]): ExpiryColumn | null {
  return columns.find((c) => c.offers > 0) ?? columns.find((c) => c.bids > 0) ?? columns[0] ?? null
}

/**
 * What `expiry`, `kind` and `strike` of the URL select. No date lands on the default column. A date that is not
 * listed but carries an order ("Other dates") still selects that exact series, so a link to it keeps working; the
 * chain then highlights nothing. A date that is neither (a deadline that has passed, a day that is no deadline)
 * selects nothing and is returned as `missing`: the page says so and shows the default column, never the same
 * strike on another date as if it were the series asked for.
 */
export function resolveSelection(view: MarketView, search: Pick<AssetSearch, 'expiry' | 'kind' | 'strike'>): ChainSelection {
  const listed = search.expiry ? view.columns.find((c) => c.day === search.expiry) : undefined
  const column = listed ?? defaultColumn(view.columns)
  const offDate = !listed && search.expiry ? view.otherExpiries.find((e) => expiryDayKey(e) === search.expiry) : undefined
  const missing = search.expiry && !listed && offDate === undefined ? search.expiry : null
  const none: ChainSelection = { column, ref: null, cell: null, missing }
  if (missing || !search.kind || !search.strike) return none
  const strikePerUnit = parseAmount(search.strike, view.quote.decimals)
  if (strikePerUnit === null || strikePerUnit <= 0n) return none
  const expiry = offDate ?? column?.expiry
  if (expiry === undefined) return none
  const ref: SeriesRef = { underlyingId: view.asset.contractId, expiry, kind: search.kind, strikePerUnit }
  return { column, ref, cell: offDate === undefined ? (view.cells.get(cellKey(ref)) ?? null) : null, missing: null }
}

/**
 * The line above the chain when the URL named a date it does not show: `The 13 Nov deadline has passed. Showing
 * 20 Nov.`, or `14 Nov is not a listed deadline. Showing 13 Nov.` Null for a day key that does not parse.
 */
export function missingDeadlineLine(day: string, shown: ExpiryColumn, nowSec: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 8) / 1000
  if (Number.isNaN(at)) return null
  const thisYear = new Date(nowSec * 1000).getUTCFullYear()
  const label = Number(m[1]) === thisYear ? expiryLabel(at) : `${expiryLabel(at)} ${m[1]}`
  return at <= nowSec ? COPY.deadlinePassed(label, expiryLabel(shown.expiry)) : COPY.notADeadline(label, expiryLabel(shown.expiry))
}

/** The search params that select a series. */
export function selectionSearch(ref: Pick<SeriesRef, 'kind' | 'strikePerUnit' | 'expiry'>, quoteDecimals: number): Pick<AssetSearch, 'kind' | 'strike' | 'expiry'> {
  return { kind: ref.kind, strike: strikeParam(ref.strikePerUnit, quoteDecimals), expiry: expiryDayKey(ref.expiry) }
}

// ------------------------------------------------------------------------------------------- cells

/** A cell with an offer; one with only a buyer's request; one with neither, which asks for a price. */
export type CellVariant = 'priced' | 'request-only' | 'empty'

export interface CellText {
  variant: CellVariant
  /** The best offer per unit (`0.21`), or null. */
  offer: string | null
  /** The size of that offer in the underlying (`1.00`), or null. */
  size: string | null
  /** The best request per unit, or null. */
  request: string | null
  /** The figure shown is the connected wallet's own order: it goes under the highlighter, with the word "yours". */
  ownOffer: boolean
  ownRequest: boolean
  /** Either figure is the wallet's own. */
  yours: boolean
  inTheMoney: boolean
  /** An empty cell offers "Ask for a price" (the contract has requests). */
  ask: boolean
  /**
   * The full accessible name: `Put at 10.00, best offer 0.36 for 1.00 FUND, 2 offers, 2 makers`. The button's
   * visible text (the best offer, else the best request, else "Ask for a price") is a run of words of it, so
   * what a voice user sees is what they can say; the size, the request beside an offer and "yours" are drawn
   * over the cell and said here, in the order they are drawn.
   */
  name: string
}

/** The row is the connected wallet's own order (its offer, listing or request). */
const ownRow = (row: BookRow | null, me: string | null): boolean => row !== null && me !== null && isMine(bookRowAction(row, me))

/**
 * How one cell reads, visibly and for a screen reader. `phrase` is the reference in words, or null without one.
 * `requests` is false on a contract without buyer requests: an empty cell then offers nothing. `me` is the
 * connected address: only a figure that is the wallet's own order is marked as its own (DESIGN.md: the
 * highlighter marks the user's own terms and nothing else).
 */
export function describeCell(cell: GridCell, quoteDecimals: number, phrase: string | null, requests: boolean = true, me: string | null = null): CellText {
  const strike = strikeText(cell.ref.strikePerUnit, quoteDecimals)
  const head = `${KIND_WORD[cell.ref.kind]} at ${strike}`
  const inTheMoney = cell.moneyness === 'in'
  const best = cell.empty ? null : cell.best
  const bestBid = cell.bids > 0 ? cell.bestBid : null
  const offer = best && cell.bestPerUnit !== null ? premiumText(cell.bestPerUnit, quoteDecimals) : null
  const size = best ? formatUnits(best.underlyingQty, best.underlying.decimals) : null
  const request = bestBid && cell.bestBidPerUnit !== null ? premiumText(cell.bestBidPerUnit, quoteDecimals) : null
  const ownOffer = offer !== null && ownRow(best, me)
  const ownRequest = request !== null && ownRow(bestBid, me)
  const yours = ownOffer || ownRequest

  const parts: string[] = []
  if (offer !== null && best) {
    parts.push(`best offer ${offer} for ${size} ${best.underlying.code}${best.source === 'resale' ? ', a resale listing' : ''}`)
    parts.push(cell.makers > 0 ? `${countOf(cell.offers, OFFERS)}, ${countOf(cell.makers, MAKERS)}` : countOf(cell.offers, OFFERS))
  } else if (request !== null) parts.push('no offer')
  if (request !== null) parts.push(`best request ${request}`, countOf(cell.bids, REQUESTS))
  if (yours) parts.push(`${COPY.yours}: ${ownOffer && ownRequest ? 'the best offer and the best request' : ownOffer ? 'the best offer' : 'the best request'}`)
  const ask = offer === null && request === null && requests
  if (offer === null && request === null) parts.push(requests ? 'no offer or request' : 'no offer')
  if (ask) parts.push(COPY.askPrice.toLowerCase())

  const tail: string[] = []
  if (phrase !== null && cell.moneyness === 'in') tail.push(`in the money at ${phrase}`)
  if (phrase !== null && cell.moneyness === 'at') tail.push(`at the money at ${phrase}`)
  const own: string[] = []
  if (cell.holding) own.push('you hold an option')
  if (cell.wrote) own.push('you wrote an option')
  if (cell.mine && !yours) own.push('you have an order')
  if (own.length) tail.push(`${formatList(own)} in this series`)

  const variant: CellVariant = offer !== null ? 'priced' : request !== null ? 'request-only' : 'empty'
  return { variant, offer, size, request, ownOffer, ownRequest, yours, inTheMoney, ask, name: [head, ...parts, ...tail].join(', ') }
}

/**
 * What pressing a cell opens from 1200 px, where the ticket is a column beside the chain: the best order the
 * wallet can take there (the cheapest offer or listing, else the highest request to fill), or null when the
 * wallet can take neither (its own order is the best, or the cell is empty).
 */
export function takeableOf(cell: GridCell, me: string | null): BookRow | null {
  const takes = (row: BookRow | null): row is BookRow => {
    if (!row) return false
    const kind = bookRowAction(row, me).kind
    return kind === 'buy' || kind === 'buy-resale' || kind === 'fill'
  }
  if (!cell.empty && takes(cell.best)) return cell.best
  if (cell.bids > 0 && takes(cell.bestBid)) return cell.bestBid
  return null
}

// ------------------------------------------------------------------------------------------- keyboard

export type Move = 'up' | 'down' | 'left' | 'right' | 'row-start' | 'row-end' | 'top' | 'bottom' | 'first' | 'last'

/** The move a key asks for in the chain, or null for a key the chain does not handle. */
export function moveForKey(key: string, ctrl: boolean): Move | null {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    case 'Home':
      return ctrl ? 'first' : 'row-start'
    case 'End':
      return ctrl ? 'last' : 'row-end'
    case 'PageUp':
      return 'top'
    case 'PageDown':
      return 'bottom'
    default:
      return null
  }
}

export interface CellPosition {
  row: number
  side: OptionKind
}

/**
 * Where focus goes from `from`. `sides` are the halves on screen, left to right: both on a wide chain, one on a
 * phone. Movement stops at the edges (no wrapping), as in a spreadsheet.
 */
export function nextPosition(from: CellPosition, move: Move, rowCount: number, sides: readonly OptionKind[]): CellPosition {
  if (rowCount <= 0 || sides.length === 0) return from
  const lastRow = rowCount - 1
  const clamp = (row: number) => Math.min(lastRow, Math.max(0, row))
  const at = Math.max(0, sides.indexOf(from.side))
  const side = (i: number) => sides[Math.min(sides.length - 1, Math.max(0, i))]
  switch (move) {
    case 'up':
      return { row: clamp(from.row - 1), side: side(at) }
    case 'down':
      return { row: clamp(from.row + 1), side: side(at) }
    case 'left':
      return { row: clamp(from.row), side: side(at - 1) }
    case 'right':
      return { row: clamp(from.row), side: side(at + 1) }
    case 'row-start':
      return { row: clamp(from.row), side: side(0) }
    case 'row-end':
      return { row: clamp(from.row), side: side(sides.length - 1) }
    case 'top':
      return { row: 0, side: side(at) }
    case 'bottom':
      return { row: lastRow, side: side(at) }
    case 'first':
      return { row: 0, side: side(0) }
    case 'last':
      return { row: lastRow, side: side(sides.length - 1) }
  }
}

/**
 * The cell that takes the chain's single tab stop before the user has moved in it: the selected one, else the
 * first row at or above the reference price (the middle of the ladder), on the first half shown.
 */
export function homePosition(view: Pick<MarketView, 'referenceRule'>, rowCount: number, sides: readonly OptionKind[], selected: CellPosition | null): CellPosition {
  if (selected && sides.includes(selected.side) && selected.row < rowCount) return selected
  const row = view.referenceRule ? Math.min(Math.max(0, rowCount - 1), view.referenceRule.below) : 0
  return { row, side: sides[0] ?? 'call' }
}
