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

/** What every order view takes. */
export interface OrdersProps {
  /** Names the table or list: "Offers on BOND 100 put, 13 Nov". */
  label: string
  lines: readonly OrderLine[]
  /** `bids` changes the heading of the total: a bid's premium is already escrowed. */
  side: 'offers' | 'bids' | 'mixed'
  /** Rows carry their own series, deadline and the reason they are off the grid ("Other offers"). */
  showSeries?: boolean
  /** `row.key` of the best order the wallet can take, marked "Best". */
  bestKey?: string | null
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

/**
 * What a row needs said next to it: the rule it does not meet (unless the table has a column for that), a
 * premium at or above the total strike, and a reserve shortfall on one of its tokens.
 */
export function notesOf(line: OrderLine, health: readonly CollateralHealth[] | undefined, withReason: boolean): string[] {
  const notes: string[] = []
  if (withReason && line.reason) notes.push(`${REASON_LABEL[line.reason]}.`)
  if (line.row.source === 'maker' && implausibleTerms(line.row)) notes.push(COPY.checkTerms)
  if (line.row.offer && line.row.source === 'maker' && health) for (const t of shortfallFor(line.row.offer, [...health])) notes.push(COPY.shortfall(t.code))
  return notes
}
