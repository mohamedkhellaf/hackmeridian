// The chain view's own logic, pure: which column and series the URL selects, what each cell says, and where an
// arrow key goes. The grid itself (ladder, cells, book, "other" orders) comes from the data layer's `useMarket`
// and `useBook`; nothing here prices or ranks anything.
import type { AssetSearch } from '../../../app/search'
import { NBSP, countOf, formatCountdown, formatExact, formatList, formatUnits, formatUtcDay, parseAmount } from '../../../core/format'
import { bookRowAction, cellKey } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import type { BookRow } from '../../../core/market/book'
import type { OptionKind } from '../../../core/options/types'
import { priceOf } from '../../../core/reference'
import type { ReferencePrice } from '../../../core/reference'
import { expiryDayKey } from '../../../core/series'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { COPY, MAKERS, OFFERS, REFERENCE_LABEL, REFERENCE_PHRASE, REFERENCE_TAG, REQUESTS } from './copy'
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

/** Time left for an expiry tab: the largest unit only (`2 d`, `5 h`, `12 min`), never broken inside. */
export function leftLabel(secondsLeft: number): string {
  return formatCountdown(secondsLeft).split(/[ \u00a0]/).slice(0, 2).join(NBSP)
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
  const label = Number(m[1]) === thisYear ? expiryLabel(at) : `${expiryLabel(at)}${NBSP}${m[1]}`
  return at <= nowSec ? COPY.deadlinePassed(label, expiryLabel(shown.expiry)) : COPY.notADeadline(label, expiryLabel(shown.expiry))
}

/** The search params that select a series. */
export function selectionSearch(ref: Pick<SeriesRef, 'kind' | 'strikePerUnit' | 'expiry'>, quoteDecimals: number): Pick<AssetSearch, 'kind' | 'strike' | 'expiry'> {
  return { kind: ref.kind, strike: strikeParam(ref.strikePerUnit, quoteDecimals), expiry: expiryDayKey(ref.expiry) }
}

// ------------------------------------------------------------------------------------------- cells

/** The two halves of a chain cell (ruling F3): the best offer next to the strike, the best request further out. */
export type Half = 'offer' | 'request'

/**
 * What pressing a half does: open the ticket on that order (`take`), open the request form or the write form on
 * the series (`post`, `write`), or select the series so its book is listed under the chain (`select`).
 */
export type HalfAction = { kind: 'take'; row: BookRow } | { kind: 'post' } | { kind: 'write' } | { kind: 'select' }

/** What a half's action depends on besides the cell. */
export interface HalfContext {
  /** The reference in words (`the demo price`), or null without one. */
  phrase: string | null
  /** The contract has buyer requests; without them a cell has no request half. */
  bidsOn: boolean
  /** The connected address: only its own orders are marked. */
  me: string | null
  /** The ticket is a column beside the chain (from 1200 px): a press on a price opens it on that order. */
  wide: boolean
  /** A write or request form is open and follows the selection. */
  form: 'write' | 'bid' | null
}

export interface HalfText {
  half: Half
  /** The best premium per unit on this half (`0.55`), or null when the half is empty. */
  figure: string | null
  /** The size of that order in the underlying (`1.00`), or null. */
  size: string | null
  /** The figure is the connected wallet's own order: it goes under the highlighter. */
  own: boolean
  action: HalfAction
  /** What an empty half shows on hover and focus, the action a press performs (`Post a request`); else null. */
  hint: string | null
  /**
   * The full accessible name, a sentence: `Offer 0.55 at 98.00, put, 13 Nov, for 1.00 BOND, 2 offers, 2 makers.
   * Buy.`, or for an empty half `No offer at 102.00, call, 13 Nov. Post a request.` (ruling F2). The visible
   * figure comes first, so what a voice user sees is what they can say.
   */
  name: string
}

export interface CellText {
  offer: HalfText
  /** Null on a contract without requests. */
  request: HalfText | null
  /** Either figure is the wallet's own: the cell carries the word "yours". */
  yours: boolean
  inTheMoney: boolean
}

/** The row is the connected wallet's own order (its offer, listing or request). */
const ownRow = (row: BookRow | null, me: string | null): boolean => row !== null && me !== null && isMine(bookRowAction(row, me))

/** The order a half shows: the best offer of the series, or its best request; null when that half is empty. */
export function halfRow(cell: GridCell, half: Half): BookRow | null {
  if (half === 'offer') return cell.empty || cell.bestPerUnit === null ? null : cell.best
  return cell.bids > 0 && cell.bestBidPerUnit !== null ? cell.bestBid : null
}

/** The action of one half: a form that is open follows the selection; an empty half opens a form; a price opens its ticket from 1200 px. */
export function halfAction(row: BookRow | null, ctx: Pick<HalfContext, 'bidsOn' | 'me' | 'wide' | 'form'>): HalfAction {
  if (ctx.form === 'write') return { kind: 'write' }
  if (ctx.form === 'bid') return { kind: 'post' }
  if (row === null) return ctx.bidsOn ? { kind: 'post' } : { kind: 'write' }
  if (!ctx.wide) return { kind: 'select' }
  const kind = bookRowAction(row, ctx.me).kind
  return kind === 'buy' || kind === 'buy-resale' || kind === 'fill' ? { kind: 'take', row } : { kind: 'select' }
}

/** The words of an action at the end of a name, and on an empty half. */
const ACTION_WORDS: Record<Exclude<HalfAction['kind'], 'select'>, (row: BookRow | null) => string> = {
  take: (row) => (row?.source === 'bid' ? COPY.fillRequest : COPY.buy),
  post: () => COPY.bidHere,
  write: () => COPY.writeHere,
}

/**
 * How one cell reads, visibly and for a screen reader: its offer half and its request half, each with its own
 * figure, size, name and action. Only a figure that is the wallet's own order is marked as its own (DESIGN.md:
 * the highlighter marks the user's own terms and nothing else).
 */
export function describeCell(cell: GridCell, quoteDecimals: number, ctx: HalfContext): CellText {
  const strike = strikeText(cell.ref.strikePerUnit, quoteDecimals)
  const at = `at ${strike}, ${cell.ref.kind}, ${expiryLabel(cell.ref.expiry)}`
  const inTheMoney = cell.moneyness === 'in'

  // Said on both halves: where the strike stands, and what the wallet has in the series besides the figure shown.
  const tail = (yours: boolean): string[] => {
    const t: string[] = []
    if (ctx.phrase !== null && cell.moneyness === 'in') t.push(`in the money at ${ctx.phrase}`)
    if (ctx.phrase !== null && cell.moneyness === 'at') t.push(`at the money at ${ctx.phrase}`)
    const own: string[] = []
    if (cell.holding) own.push('you hold an option')
    if (cell.wrote) own.push('you wrote an option')
    if (cell.mine && !yours) own.push('you have an order')
    if (own.length) t.push(`${formatList(own)} in this series`)
    return t
  }

  const best = halfRow(cell, 'offer')
  const bestBid = halfRow(cell, 'request')
  const ownOffer = ownRow(best, ctx.me)
  const ownRequest = ownRow(bestBid, ctx.me)
  const yours = ownOffer || ownRequest

  const half = (side: Half, row: BookRow | null, perUnit: bigint | null, own: boolean, counts: string[]): HalfText => {
    const action = halfAction(row, ctx)
    const word = action.kind === 'select' ? null : ACTION_WORDS[action.kind](row)
    const priced = row !== null && perUnit !== null ? row : null
    const figure = priced && perUnit !== null ? premiumText(perUnit, quoteDecimals) : null
    const size = priced ? formatUnits(priced.underlyingQty, priced.underlying.decimals) : null
    const noun = side === 'offer' ? 'offer' : 'request'
    const words = priced
      ? [`${own ? `Your ${noun}` : side === 'offer' ? 'Offer' : 'Request'} ${figure} ${at}`, `for ${size} ${priced.underlying.code}${priced.source === 'resale' ? ', a resale listing' : ''}`, ...counts]
      : [`No ${noun} ${at}`]
    const name = `${[...words, ...tail(yours)].join(', ')}.${word ? ` ${word}.` : ''}`
    return { half: side, figure, size, own, action, hint: priced ? null : word, name }
  }

  const offerCounts = best ? [cell.makers > 0 ? `${countOf(cell.offers, OFFERS)}, ${countOf(cell.makers, MAKERS)}` : countOf(cell.offers, OFFERS)] : []
  const offer = half('offer', best, cell.bestPerUnit, ownOffer, offerCounts)
  const request = ctx.bidsOn ? half('request', bestBid, cell.bestBidPerUnit, ownRequest, bestBid ? [countOf(cell.bids, REQUESTS)] : []) : null
  return { offer, request, yours, inTheMoney }
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

/** A column of buttons in the chain, left to right: the halves of the call side, then those of the put side. */
export type ChainColumn = 'call-request' | 'call-offer' | 'put-offer' | 'put-request'

export const columnOf = (kind: OptionKind, half: Half): ChainColumn => `${kind}-${half}`

/** The columns on screen: four halves, or the two offer halves on a contract without requests. */
export const chainColumns = (bidsOn: boolean): readonly ChainColumn[] => (bidsOn ? ['call-request', 'call-offer', 'put-offer', 'put-request'] : ['call-offer', 'put-offer'])

export interface CellPosition {
  row: number
  col: ChainColumn
}

/**
 * Where focus goes from `from`. `cols` are the halves on screen, left to right. Movement stops at the edges (no
 * wrapping), as in a spreadsheet.
 */
export function nextPosition(from: CellPosition, move: Move, rowCount: number, cols: readonly ChainColumn[]): CellPosition {
  if (rowCount <= 0 || cols.length === 0) return from
  const lastRow = rowCount - 1
  const clamp = (row: number) => Math.min(lastRow, Math.max(0, row))
  const at = Math.max(0, cols.indexOf(from.col))
  const col = (i: number) => cols[Math.min(cols.length - 1, Math.max(0, i))]
  switch (move) {
    case 'up':
      return { row: clamp(from.row - 1), col: col(at) }
    case 'down':
      return { row: clamp(from.row + 1), col: col(at) }
    case 'left':
      return { row: clamp(from.row), col: col(at - 1) }
    case 'right':
      return { row: clamp(from.row), col: col(at + 1) }
    case 'row-start':
      return { row: clamp(from.row), col: col(0) }
    case 'row-end':
      return { row: clamp(from.row), col: col(cols.length - 1) }
    case 'top':
      return { row: 0, col: col(at) }
    case 'bottom':
      return { row: lastRow, col: col(at) }
    case 'first':
      return { row: 0, col: col(0) }
    case 'last':
      return { row: lastRow, col: col(cols.length - 1) }
  }
}

/**
 * The half that takes the chain's single tab stop before the user has moved in it: the selected one, else the
 * call offer (next to the strike) on the first row at or above the reference price (the middle of the ladder).
 */
export function homePosition(view: Pick<MarketView, 'referenceRule'>, rowCount: number, cols: readonly ChainColumn[], selected: CellPosition | null): CellPosition {
  if (selected && cols.includes(selected.col) && selected.row < rowCount) return selected
  const row = view.referenceRule ? Math.min(Math.max(0, rowCount - 1), view.referenceRule.below) : 0
  return { row, col: cols.includes('call-offer') ? 'call-offer' : (cols[0] ?? 'call-offer') }
}
