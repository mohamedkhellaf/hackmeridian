// The chain view's own logic, pure: which column and series the URL selects, what each cell says, and where an
// arrow key goes. The grid itself (ladder, cells, book, "other" orders) comes from the data layer's `useMarket`
// and `useBook`; nothing here prices or ranks anything.
import type { AssetSearch } from '../../../app/search'
import { countOf, formatCountdown, formatExact, formatList, formatUnits, formatUtcDay, parseAmount } from '../../../core/format'
import { cellKey } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import type { OptionKind } from '../../../core/options/types'
import { priceOf } from '../../../core/reference'
import type { ReferencePrice } from '../../../core/reference'
import { expiryDayKey, plainDecimal } from '../../../core/series'
import type { ExpiryColumn, GridCell, MarketView } from '../../../data'
import { BIDS, COPY, KIND_WORD, LISTINGS, MAKERS, REFERENCE_PHRASE, REFERENCE_TAG } from './copy'

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

/** `BOND 100 put, 13 Nov`: the heading of a series. */
export function seriesTitle(code: string, ref: Pick<SeriesRef, 'kind' | 'strikePerUnit' | 'expiry'>, quoteDecimals: number): string {
  return `${code} ${plainDecimal(ref.strikePerUnit, quoteDecimals)} ${ref.kind}, ${expiryLabel(ref.expiry)}`
}

// ------------------------------------------------------------------------------------------- reference

export interface ReferenceLine {
  /** The tag on the dashed rule: `Demo price 99.40`. */
  tag: string
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
  return { tag: `${REFERENCE_TAG[reference.kind]} ${price}`, phrase: REFERENCE_PHRASE[reference.kind], price }
}

// ------------------------------------------------------------------------------------------- selection

export interface ChainSelection {
  /** The expiry column shown. Null only when no expiry is listed. */
  column: ExpiryColumn | null
  /** The series the URL names, or null. It may be off the grid (a strike or a date that is not listed). */
  ref: SeriesRef | null
  /** Its cell in the shown column, when it is a grid series of that column. */
  cell: GridCell | null
}

/** The column a visitor lands on: the first listed date with a standard offer, else with a bid, else the first. */
export function defaultColumn(columns: readonly ExpiryColumn[]): ExpiryColumn | null {
  return columns.find((c) => c.offers > 0) ?? columns.find((c) => c.bids > 0) ?? columns[0] ?? null
}

/**
 * What `expiry`, `kind` and `strike` of the URL select. An unknown or missing date falls back to the default
 * column. A date that is not listed but carries an order ("Other dates") still selects that exact series, so a
 * link to it keeps working; the chain then highlights nothing.
 */
export function resolveSelection(view: MarketView, search: Pick<AssetSearch, 'expiry' | 'kind' | 'strike'>): ChainSelection {
  const listed = search.expiry ? view.columns.find((c) => c.day === search.expiry) : undefined
  const column = listed ?? defaultColumn(view.columns)
  if (!search.kind || !search.strike) return { column, ref: null, cell: null }
  const strikePerUnit = parseAmount(search.strike, view.quote.decimals)
  if (strikePerUnit === null || strikePerUnit <= 0n) return { column, ref: null, cell: null }
  const offDate = !listed && search.expiry ? view.otherExpiries.find((e) => expiryDayKey(e) === search.expiry) : undefined
  const expiry = offDate ?? column?.expiry
  if (expiry === undefined) return { column, ref: null, cell: null }
  const ref: SeriesRef = { underlyingId: view.asset.contractId, expiry, kind: search.kind, strikePerUnit }
  return { column, ref, cell: offDate === undefined ? (view.cells.get(cellKey(ref)) ?? null) : null }
}

/** The search params that select a series. */
export function selectionSearch(ref: Pick<SeriesRef, 'kind' | 'strikePerUnit' | 'expiry'>, quoteDecimals: number): Pick<AssetSearch, 'kind' | 'strike' | 'expiry'> {
  return { kind: ref.kind, strike: strikeParam(ref.strikePerUnit, quoteDecimals), expiry: expiryDayKey(ref.expiry) }
}

// ------------------------------------------------------------------------------------------- cells

export type CellVariant = 'priced' | 'bid-only' | 'empty'

export interface CellText {
  variant: CellVariant
  /** The figure of the cell: the best premium per unit, or the highest bid for a bid-only cell. */
  figure: string | null
  /** `2 makers`, `1 resale listing`, `1 bid` or `No offer`. */
  count: string
  /** The wallet holds, wrote or has an order in this series: the figure goes under the highlighter. */
  yours: boolean
  inTheMoney: boolean
  /** An empty cell offers "Request" (the contract has requests). */
  request: boolean
  /**
   * The full accessible name: `Put at 10.00, best premium 0.36, 2 makers`. The visible text of a cell (figure,
   * count and "yours"; "No offer" and "Request") appears in it in the same order, so what a voice user sees is
   * what they can say.
   */
  name: string
}

/**
 * How one cell reads, visibly and for a screen reader. `phrase` is the reference in words, or null without one.
 * `requests` is false on a contract without buyer requests: an empty cell then offers nothing.
 */
export function describeCell(cell: GridCell, quoteDecimals: number, phrase: string | null, requests: boolean = true): CellText {
  const strike = strikeText(cell.ref.strikePerUnit, quoteDecimals)
  const yours = cell.mine || cell.holding || cell.wrote
  const inTheMoney = cell.moneyness === 'in'
  const head = `${KIND_WORD[cell.ref.kind]} at ${strike}`
  // "yours" is printed right after the count, so it is read right after it.
  const mark = yours ? `, ${COPY.yours}` : ''
  const tail: string[] = []
  if (phrase !== null && cell.moneyness === 'in') tail.push(`in the money at ${phrase}`)
  if (phrase !== null && cell.moneyness === 'at') tail.push(`at the money at ${phrase}`)
  const own: string[] = []
  if (cell.holding) own.push('you hold an option')
  if (cell.wrote) own.push('you wrote an option')
  if (cell.mine) own.push('you have an order')
  if (own.length) tail.push(`${formatList(own)} in this series`)
  const join = (parts: string[]) => [head, ...parts, ...tail].join(', ')

  if (!cell.empty && cell.bestPerUnit !== null) {
    const figure = premiumText(cell.bestPerUnit, quoteDecimals)
    const count = cell.makers > 0 ? countOf(cell.makers, MAKERS) : countOf(cell.offers, LISTINGS)
    return { variant: 'priced', figure, count, yours, inTheMoney, request: false, name: join([`best premium ${figure}`, `${count}${mark}`]) }
  }
  if (cell.bids > 0 && cell.bestBidPerUnit !== null) {
    const figure = premiumText(cell.bestBidPerUnit, quoteDecimals)
    const count = countOf(cell.bids, BIDS)
    return { variant: 'bid-only', figure, count, yours, inTheMoney, request: false, name: join(['no offer', `highest bid ${figure}`, `${count}${mark}`]) }
  }
  return { variant: 'empty', figure: null, count: COPY.noOffer, yours, inTheMoney, request: requests, name: join(requests ? [`no offer${mark}`, 'request a price'] : [`no offer${mark}`]) }
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
