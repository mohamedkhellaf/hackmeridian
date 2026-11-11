// What the order tables and lists share: the row type, whose row it is, and the notes a row carries.
import { formatUnits } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import type { BookRowAction } from '../../../core/market/selection'
import { implausibleTerms } from '../../../core/options/feasibility'
import type { CollateralHealth } from '../../../core/options/types'
import { shortfallFor } from '../../../core/reserves/reserves'
import type { NonStandardReason } from '../../../core/series'
import { COPY, REASON_LABEL } from './copy'

/** A row of an order table: `BookEntry` and `OtherOrder` of the data layer both fit. */
export interface OrderLine {
  row: BookRow
  /** Premium per whole unit of underlying, in quote units, floored. */
  perUnit: bigint | null
  /** What the connected wallet can do with the row. */
  action: BookRowAction
  /** Why the order is not standard, or null. */
  reason: NonStandardReason | null
}

/** One group of rows of an order table: the offers of a book, its requests, or every row of "Other offers". */
export interface OrderSection {
  key: string
  /** The group's heading row ("Offers 2"); none for a table of one group. */
  title?: string
  /** Names the group where it is a list of its own (phones): "Offers on BOND 100.00 put, 13 Nov". */
  label?: string
  lines: readonly OrderLine[]
  /** Row keys at the best price of the group, each marked "Best" (ties included). */
  best?: ReadonlySet<string>
  /** Said in one muted row when the group has no line ("No requests on this series."). */
  empty?: string
}

/** What every order view takes. */
export interface OrdersProps {
  /** Names the table or list: "Book of BOND 100.00 put, 13 Nov". */
  label: string
  sections: readonly OrderSection[]
  /** A line between the first and the second group: the gap between the best offer and the best request. */
  gap?: string | null
  /** Rows carry their own series, deadline and the reason they are off the grid ("Other offers"). */
  showSeries?: boolean
  /** With `showSeries`: a column for the reason a row is off the grid (default true). */
  showReason?: boolean
  /** With `showSeries`: the series of a row is a control that selects it in the chain. */
  onSelect?: (row: BookRow) => void
  /** The reason every row shares (an off-grid series): said once above the book, not on each row. */
  sharedReason?: NonStandardReason | null
  /** `row.key` of the order the open ticket is about. */
  ticketKey?: string | null
  health: readonly CollateralHealth[] | undefined
  /** Counterparties link to the explorer on Testnet; mock addresses have no page. */
  explorer: boolean
  /** A transaction is in flight somewhere on the page: actions that would start another are held back. */
  busy: boolean
  onTake: (row: BookRow) => void
  onCancel: (row: BookRow) => void
}

/** The row was posted by the connected wallet. */
export const isMine = (action: BookRowAction): boolean => action.kind === 'cancel-offer' || action.kind === 'cancel-bid' || (action.kind === 'none' && action.note === 'Yours')

/** The words of a row for the accessible name of its action: `put on 5.00 BOND`. */
export function termsOf(row: BookRow): string {
  return `${row.kind} on ${formatUnits(row.underlyingQty, row.underlying.decimals)} ${row.underlying.code}`
}

/** The order's number as the ticket prints it: `000047`, the id of the offer, listing or request. */
export function orderNumber(row: BookRow): string {
  const id = row.bid?.id ?? row.offer?.id ?? null
  return id === null ? '' : id.toString().padStart(6, '0')
}

export interface RowNotes {
  /** What needs care before taking the row: terms that cannot pay back, a reserve shortfall. Drawn with the warning mark. */
  warnings: string[]
  /** Why the row is off the standard grid, as plain words (a classification, not a hazard), or null. */
  reason: string | null
}

/**
 * What a row needs said next to it: a premium at or above the total strike and a reserve shortfall on one of its
 * tokens (warnings), and the rule of the grid it does not meet unless the table has a column for that or every
 * row of the table shares it.
 */
export function notesOf(line: OrderLine, health: readonly CollateralHealth[] | undefined, withReason: boolean, sharedReason: NonStandardReason | null = null): RowNotes {
  const warnings: string[] = []
  if (line.row.source === 'maker' && implausibleTerms(line.row)) warnings.push(COPY.checkTerms)
  if (line.row.offer && line.row.source === 'maker' && health) for (const t of shortfallFor(line.row.offer, [...health])) warnings.push(COPY.shortfall(t.code))
  const reason = withReason && line.reason && line.reason !== sharedReason ? `${REASON_LABEL[line.reason]}.` : null
  return { warnings, reason }
}

/** Row keys at the best per-unit premium of a group, when the group has more than one row. */
export function bestKeys(lines: readonly OrderLine[], best: BookRow | null): ReadonlySet<string> {
  if (!best || lines.length < 2) return new Set()
  const price = lines.find((l) => l.row.key === best.key)?.perUnit ?? null
  if (price === null) return new Set()
  return new Set(lines.filter((l) => l.perUnit === price).map((l) => l.row.key))
}
