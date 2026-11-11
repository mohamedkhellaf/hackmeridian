// Every string of the Requests page. Sentences are whole (never built from fragments); counts go through Intl.
// Vocabulary (DESIGN.md, rulings R7 and E7): "request" everywhere a user reads, never "bid"; "deadline" for the
// instant; a maker fills a request ("seller" is only a holder reselling); the buyer posted it.
import { countOf, formatList, groupDigits } from '../../core/format'
import type { Figure, RequestRow, RequestSort } from './board'
import { money } from './board'

export const PAGE_TITLE = 'Requests'
/** The one line that says what a request is. */
export const PAGE_LEAD = "A request is a buyer's premium already escrowed in the contract, waiting for a maker."

export const POST_REQUEST = 'Post a request'
export const FILL_REQUEST = 'Fill request'
export const CANCEL_REQUEST = 'Cancel request'
export const KEEP_REQUEST = 'Keep request'
export const VIEW_POSITION = 'View position'
export const CONNECT_WALLET = 'Connect wallet'
export const YOURS = 'Yours'
/** The action on the wallet's own expired request: the premium is still in the contract until it is cancelled. */
export const takeBack = (premium: Figure): string => `Take back ${money(premium)}`

export const TAB_BOARD = 'Open requests'
export const TAB_MINE = 'My requests'
export const TABS_LABEL = 'Requests'

export const FILTER_ASSET = 'Asset'
export const FILTER_ASSET_ALL = 'All assets'
export const FILTER_KIND = 'Kind'
export const KIND_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'put', label: 'Put' },
  { value: 'call', label: 'Call' },
] as const
export const FILTERS_LABEL = 'Filter and sort the requests'
export const SORT_LABEL = 'Sort by'
/** The visible word of the order menu on phones; its accessible name adds the order chosen. */
export const SORT_SHORT = 'Sort'
export const sortMenuLabel = (current: string): string => `${SORT_LABEL}: ${current}`
export const SORT_OPTIONS: ReadonlyArray<{ value: RequestSort; label: string }> = [
  { value: 'deadline', label: 'Soonest deadline' },
  { value: 'premium', label: 'Highest premium per unit' },
]
export const CLEAR_FILTERS = 'Clear filters'
export const SHOW_CLOSED = 'Show closed'

export const COL = {
  asset: 'Asset',
  kind: 'Kind',
  quantity: 'Quantity',
  strike: 'Strike',
  deadline: 'Deadline',
  premium: 'Premium per unit',
  buyer: 'Buyer',
  lock: 'You lock',
  state: 'State',
  action: 'Action',
} as const

/** Read before the total premium of a list row, which has no column header. */
export const PREMIUM_TOTAL = 'Premium in total'

export const BOARD_CAPTION = 'Open requests a maker can fill now'
export const MINE_CAPTION = 'My requests'

export const perUnitOf = (row: Pick<RequestRow, 'premiumPerUnit' | 'assetCode'>): string => `${row.premiumPerUnit.text} per ${row.assetCode}`
export const inTotal = (row: Pick<RequestRow, 'premium'>): string => `${money(row.premium)} in total`
export const strikePerUnitOf = (row: Pick<RequestRow, 'strike' | 'assetCode'>): string => `${money(row.strike)} per ${row.assetCode}`
/** The reference price under a strike, with its two-word source label and nothing more ("Demo price 10.20"). */
export const referenceLine = (row: Pick<RequestRow, 'reference'>): string | null => (row.reference ? `${row.reference.label} ${row.reference.text}` : null)
/** The first line of a phone row: what is wanted. */
export const listTitle = (row: Pick<RequestRow, 'kindWord' | 'quantity'>): string => `${row.kindWord} on ${money(row.quantity)}`
export const strikeLine = (row: Pick<RequestRow, 'strike'>): string => `Strike ${money(row.strike)}`
export const youLock = (lock: Figure): string => `You lock ${money(lock)}`
export const youHold = (have: Figure): string => `You hold ${money(have)}`
export const serialText = (serial: string): string => `No. ${serial}`

/** Accessible names: the visible label first, then the data it acts on. */
export const fillLabel = (row: RequestRow): string => `${FILL_REQUEST}: ${row.terms}, you lock ${money(row.lock)}`
export const cancelLabel = (row: RequestRow): string => `${CANCEL_REQUEST} ${serialText(row.serial)}: ${row.terms}`
export const takeBackLabel = (row: RequestRow): string => `${takeBack(row.premium)} from request ${serialText(row.serial)}: ${row.terms}`
export const positionLabel = (row: RequestRow): string => `${VIEW_POSITION} of request ${serialText(row.serial)}: ${row.terms}`

/** Under the state of an expired request of the wallet: the one fact the tag cannot say. */
export const STRANDED_LINE = 'Premium still in the contract'
export const RETURNED_LINE = 'Premium returned'
/** Under a deadline less than 15 minutes away (brief D17): a fill signed now may land after it. */
export const LAPSE_LINE = 'A fill may land too late'
export const NOT_FOR_OWN = 'Not for your own request'
export const NO_ACTION = 'No action'
export const shortBy = (missing: Figure): string => `, ${money(missing)} short`

/** The line under the board: how many requests are listed and what they hold in the contract. */
export function boardSummary(shown: number, total: number, escrowed: string | null): string {
  const all = countOf(total, { one: 'open request', other: 'open requests' })
  if (shown === total) return escrowed === null ? `${all}.` : `${all}. ${escrowed} of premium is escrowed in the contract.`
  return escrowed === null ? `${shown} of ${all} shown.` : `${shown} of ${all} shown, with ${escrowed} of premium escrowed in the contract.`
}
export const SEE_RESERVES = 'See reserves'
/** The page size of the board and the button that shows the next page. */
export const PAGE_SIZE = 25
export const showMore = (count: number): string => `Show ${count} more`

/** Once above the board when the wallet holds none of a token some requests would lock. */
export const noFunds = (codes: readonly string[]): string => `Your wallet holds no ${formatList(codes, 'disjunction')}.`
export const GET_TEST_FUNDS = 'Get test funds'

export const EMPTY_BOARD = 'No open requests.'
export const EMPTY_FILTERED = 'No open requests match these filters.'
export const EMPTY_MINE = 'You have not posted a request.'
export const EMPTY_MINE_OPEN = 'You have no open requests.'
export const GUEST_MINE = 'Connect a wallet to see your requests.'
export const NO_REQUESTS_IN_CONTRACT = 'Requests need the Covered contract at version 1.5 or later.'

export const LOADING = 'Loading requests'
export const LOAD_ERROR_TITLE = 'Requests could not be read.'
export const RETRY = 'Try again'
/** Above the board when a refresh fails: the rows are from the last good read, at this time. */
export const refreshFailed = (readAt: string): string => `Could not refresh. These requests were read at ${readAt}.`
export const UNKNOWN_ASSET_FILTER = 'The asset in this link is not listed in the contract. Every asset is shown.'

// ---- choosing the asset of a new request
export const CHOOSER_TITLE = 'Post a request'
export const CHOOSER_LEAD = 'Choose the asset the option is on.'
export const CHOOSER_LOADING = 'Loading the assets'
export const CHOOSER_ERROR = 'The assets could not be read.'

// ---- cancelling
export const cancelTitle = (serial: string): string => `Cancel request ${serialText(serial)}`
export const takeBackTitle = (serial: string): string => `Take back the premium of request ${serialText(serial)}`
export const CANCELLED_TITLE = 'Request cancelled'
export const CANCEL_TERMS = { request: 'Request', strike: 'Strike', deadline: 'Deadline', refund: 'Returned to your wallet' } as const
export const confirmedInLedger = (ledger: number): string => `confirmed in ledger ${groupDigits(String(ledger))}`
export const CANCEL_NOTE_OPEN = 'The contract returns the premium in the same transaction. Until a ledger confirms it, a maker can still fill the request.'
export const CANCEL_NOTE_EXPIRED = 'Nobody filled it before the deadline. The contract returns the premium in the same transaction.'
export const CANCELLING = 'Cancelling'
export const TAKING_BACK = 'Taking back'
export const TX_BUSY_REASON = 'Another transaction is in progress. Wait for it to finish.'
export const DONE = 'Done'
export const CLOSE = 'Close'
export const CHECK_AGAIN = 'Check again'
export const TX_LABEL = 'Transaction'
