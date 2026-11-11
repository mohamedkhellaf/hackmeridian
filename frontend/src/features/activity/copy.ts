// Every sentence of the Activity page. The words for a transaction's state come from the data layer
// (`TX_PHASE_LABEL`, `describeTx`), so the ticket, a toast and this list say the same thing. The words for an
// unknown outcome are the ticket's own (features/ticket `signHelp`), so the instruction reads the same in both.
import { countOf } from '../../core/format'

export const PAGE_TITLE = 'Activity'
/** The one place the page says where the list lives. */
export const PAGE_DESCRIPTION = 'Transactions started from this browser with the connected wallet, newest first. Another browser or device shows none of them.'
export const PAGE_DESCRIPTION_GUEST = 'Transactions started from this browser, newest first. Another browser or device shows none of them.'

/** Where the full record is (live builds only: a mock account has no explorer page). */
export const EXPLORER_RECORD = 'The explorer has the full record of the account.'
export const EXPLORER_LINK = 'View the account on the explorer'

export const TABLE_CAPTION = 'Transactions from this browser'
export const COLUMNS = { what: 'Transaction', state: 'State', time: 'Time, UTC', hash: 'Hash', about: 'Where it shows', action: 'Action' } as const
/** `and yours (UTC+1)`: the viewer's zone, said once in the time column's header. */
export const yourZone = (zone: string): string => `and yours (${zone})`

/** Only a Margin row says which contract it went to: everything else is Covered. */
export const MARGIN_PRODUCT = 'Margin contract'

/** The heading of the rows whose outcome is not final yet, listed before the finished ones. */
export const OPEN_GROUP = 'Waiting for an outcome'

export const NO_HASH_SHORT = 'No hash'
export const NO_HASH_YET = 'Not sent yet'

export const CHECK_AGAIN = 'Check again'
export const CLEAR_FINISHED = 'Clear finished'
export const UNDO = 'Undo'

/** The count line above the list: `6 transactions. 1 in progress. 1 with an unknown outcome.` */
export function countLine(total: number, inFlight: number, unknown: number): string {
  const parts = [countOf(total, { one: 'transaction', other: 'transactions' })]
  if (inFlight > 0) parts.push(`${inFlight} in progress`)
  if (unknown > 0) parts.push(`${unknown} with an unknown outcome`)
  return `${parts.join('. ')}.`
}

/** `Position 12` */
export const positionLabel = (id: string): string => `Position ${id}`
/** `Request 3` */
export const requestLabel = (id: string): string => `Request ${id}`
export const YOUR_OFFERS = 'Your offers'
export const YOUR_REQUESTS = 'Your requests'
export const YOUR_WRITTEN = 'Your written options'
export const MARGIN_LINK = 'Margin'
export const ISSUER_LINK = 'Issuer console'

/** After the state word of a confirmed row: `ledger 58,331,204`. */
export const ledgerLine = (ledger: string): string => `ledger ${ledger}`

/** An unknown outcome, in the ticket's words. `until` is the end of the validity window: `14:37:47 UTC`. */
export const unknownNote = (until: string | null): string =>
  until
    ? `The transaction was sent and no ledger has included it yet. It can still go through until ${until}. Do not send another one before that: check again first.`
    : 'The transaction was sent and no ledger has included it yet. It can still go through. Do not send another one: check again first.'

/** What a look that found nothing says, on the row: `Checked at 14:22:05 UTC: not included yet.` */
export const checkedNote = (time: string): string => `Checked at ${time}: not included yet.`

export const GUEST_TITLE = 'Connect a wallet to see its transactions.'
export const CONNECT = 'Connect wallet'

export const EMPTY_TITLE = 'No transactions yet.'
/** After Clear finished took the last rows away: "yet" would be untrue. */
export const EMPTY_CLEARED = 'No transactions listed.'
export const EMPTY_ACTION = 'Go to markets'

/** Announced after the finished entries are cleared. */
export const cleared = (count: number): string => (count === 1 ? 'One finished transaction removed from the list.' : `${count} finished transactions removed from the list.`)
/** The line that stays in the toolbar after a clear, before its Undo: `3 finished transactions removed.` */
export const clearedLine = (count: number): string => (count === 1 ? 'One finished transaction removed.' : `${count} finished transactions removed.`)
/** Announced after Undo. */
export const restored = (count: number): string => (count === 1 ? 'One transaction is back in the list.' : `${count} transactions are back in the list.`)
