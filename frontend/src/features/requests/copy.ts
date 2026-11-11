// Every string of the Requests page. Sentences are whole (never built from fragments); counts go through Intl.
// Vocabulary: "request" in headings and prose, "bid" in the action that sells to one, "deadline" for the expiry.
import { countOf, groupDigits } from '../../core/format'
import type { EscrowStatus, Figure, RequestRow, RequestSort } from './board'
import { money } from './board'

export const PAGE_TITLE = 'Requests'
/** The one line that says what a request is. */
export const PAGE_LEAD = "A request is a buyer's premium already escrowed in the contract, waiting for a seller."

export const POST_REQUEST = 'Post a request'
export const SELL_TO_BID = 'Sell to this bid'
export const CANCEL_REQUEST = 'Cancel request'
export const KEEP_REQUEST = 'Keep request'
export const VIEW_POSITION = 'View position'
export const CONNECT_WALLET = 'Connect wallet'
export const YOURS = 'Yours'

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
export const SORT_LABEL = 'Sort by'
export const SORT_OPTIONS: ReadonlyArray<{ value: RequestSort; label: string }> = [
  { value: 'deadline', label: 'Soonest deadline' },
  { value: 'premium', label: 'Highest premium per unit' },
]
export const CLEAR_FILTERS = 'Clear filters'

export const COL = {
  asset: 'Asset',
  kind: 'Kind',
  quantity: 'Quantity',
  strike: 'Strike',
  deadline: 'Deadline',
  premium: 'Premium escrowed',
  premiumMine: 'Premium',
  buyer: 'Buyer',
  lock: 'You lock',
  state: 'State',
  action: 'Action',
} as const

export const BOARD_CAPTION = 'Open requests: funded bids a seller can take now'
export const MINE_CAPTION = 'My requests, in every state'

export const perUnitOf = (row: Pick<RequestRow, 'premiumPerUnit' | 'assetCode'>): string => `${row.premiumPerUnit.text} per ${row.assetCode}`
export const strikePerUnitOf = (row: Pick<RequestRow, 'strike' | 'assetCode'>): string => `${money(row.strike)} per ${row.assetCode}`
/** The first line of a phone row: what is wanted. */
export const listTitle = (row: Pick<RequestRow, 'kindWord' | 'quantity'>): string => `${row.kindWord} on ${money(row.quantity)}`
export const strikeLine = (row: Pick<RequestRow, 'strike'>): string => `Strike ${money(row.strike)}`
export const youLock = (lock: Figure): string => `You lock ${money(lock)}`
export const youHold = (have: Figure): string => `You hold ${money(have)}`
export const serialText = (serial: string): string => `No. ${serial}`

/** Accessible names: the visible label first, then the data it acts on. */
export const sellLabel = (row: RequestRow): string => `${SELL_TO_BID}: ${row.terms}, you lock ${money(row.lock)}`
export const cancelLabel = (row: RequestRow): string => `${CANCEL_REQUEST} ${serialText(row.serial)}: ${row.terms}`
export const positionLabel = (row: RequestRow): string => `${VIEW_POSITION} of request ${serialText(row.serial)}: ${row.terms}`

/** One line under the state of the wallet's own request: where its premium is. */
export const ESCROW_LINE: Record<EscrowStatus, string> = {
  escrowed: 'Premium in the contract',
  stranded: 'Premium still in the contract. Cancel to take it back.',
  paid: 'Premium paid to the seller',
  refunded: 'Premium returned',
}

/** The line under the board: how many requests are listed and what they hold in the contract. */
export function boardSummary(shown: number, total: number, escrowed: string | null): string {
  const all = countOf(total, { one: 'open request', other: 'open requests' })
  if (shown === total) return escrowed === null ? `${all}.` : `${all}. ${escrowed} of premium is escrowed in the contract.`
  return escrowed === null ? `${shown} of ${all} shown.` : `${shown} of ${all} shown, with ${escrowed} of premium escrowed in the contract.`
}
export const openCount = (count: number): string => `${count} on the board`
export const holdingCount = (count: number): string => `${count} with premium in the contract`
export const SEE_RESERVES = 'See reserves'

export const EMPTY_BOARD = {
  title: 'No open requests.',
  hint: 'When no offer matches the terms you want, post a request: you name the strike, the deadline and the premium, and any seller can take it.',
}
export const EMPTY_FILTERED = {
  title: 'No open requests match these filters.',
  hint: 'Clear the filters to see every asset and kind.',
}
export const EMPTY_MINE = {
  title: 'You have not posted a request.',
  hint: 'A request names the option you want and escrows the premium you offer. A seller can take it until the deadline.',
}
export const GUEST_MINE = {
  title: 'Connect a wallet to see your requests.',
  hint: 'The board stays open without one. Posting and selling need a Testnet wallet.',
}
export const NO_REQUESTS_IN_CONTRACT = {
  title: 'This contract version has no requests.',
  hint: 'Requests need the Covered contract at version 1.5 or later.',
}

export const LOADING = 'Loading requests'
export const LOAD_ERROR_TITLE = 'Requests could not be read.'
export const LOAD_ERROR_FIX = 'Nothing was changed. Read the contract again.'
export const RETRY = 'Try again'
export const REFRESH_FAILED = 'Could not refresh. These are the requests from the last read.'
export const UNKNOWN_ASSET_FILTER = 'The asset in this link is not listed in the contract. Every asset is shown.'

// ---- choosing the asset of a new request
export const CHOOSER_TITLE = 'Post a request'
export const CHOOSER_LEAD = 'Choose the asset the option is on. You set the kind, strike, deadline and premium next.'
export const chooserOpenCount = (count: number): string => (count === 0 ? 'No open requests' : countOf(count, { one: 'open request', other: 'open requests' }))
export const NO_REFERENCE = 'No reference price'

// ---- cancelling
export const cancelTitle = (serial: string): string => `Cancel request ${serialText(serial)}`
export const CANCEL_TERMS = { request: 'Request', strike: 'Strike', deadline: 'Deadline', refund: 'Returned to your wallet' } as const
export const confirmedInLedger = (ledger: number): string => `confirmed in ledger ${groupDigits(String(ledger))}`
export const CANCEL_NOTE_OPEN = 'The contract returns the premium in the same transaction. Until a ledger confirms it, a seller can still take the request.'
export const CANCEL_NOTE_EXPIRED = 'The deadline has passed and nobody took it. The contract returns the premium in the same transaction.'
export const cancelDone = (premium: Figure): string => `Request cancelled. ${money(premium)} returned to your wallet.`
export const CANCELLING = 'Cancelling'
export const TX_BUSY_REASON = 'Another transaction is in progress. Wait for it to finish.'
export const DONE = 'Done'
export const CLOSE = 'Close'
export const CHECK_AGAIN = 'Check again'
export const TX_LABEL = 'Transaction'

// ---- how a request works (who acts and by when)
export const HOW_TITLE = 'How a request works'
export const HOW_STEPS = [
  {
    when: 'Now',
    who: 'The buyer',
    title: 'Names the terms and escrows the premium',
    text: 'Kind, quantity, strike, deadline and the premium offered. The premium moves into the contract at once.',
  },
  {
    when: 'Until the deadline',
    who: 'A seller',
    title: 'Locks the collateral and is paid',
    text: 'The full strike in USDx for a put, the asset itself for a call. The premium is paid in the same transaction and the buyer holds the option.',
  },
  {
    when: 'If nobody sells',
    who: 'The buyer',
    title: 'Cancels and takes the premium back',
    text: 'Before or after the deadline. The premium stays in the contract until the request is cancelled.',
  },
] as const
export const HOW_MORE = 'How options work'
