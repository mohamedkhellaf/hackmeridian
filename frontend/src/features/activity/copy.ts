// Every sentence of the Activity page. The words for a transaction's state and what each state means come from
// the data layer (`TX_PHASE_LABEL`, `describeTx`), so the ticket, a toast and this list say the same thing.
import { countOf } from '../../core/format'

export const PAGE_TITLE = 'Activity'
export const PAGE_DESCRIPTION = 'The transactions you started from this browser with the connected wallet, newest first.'
export const PAGE_DESCRIPTION_GUEST = 'The transactions you start from this browser, per wallet, newest first.'

/** The line that says where this list lives. Always on the page. */
export const LOCAL_ONLY = 'This list is kept in this browser only. Another browser or device shows none of it, and clearing site data erases it.'
/** Where the full record is. */
export const EXPLORER_RECORD = 'The explorer has the full record of the account.'
export const EXPLORER_LINK = 'View the account on the explorer'
/** Mock builds: nothing is stored, because a reload starts the mock market again. */
export const MOCK_NOTE = 'On mock data the list empties when the page is reloaded, and a hash has no explorer page.'

export const TABLE_CAPTION = 'Transactions from this browser'
export const COLUMNS = { what: 'Transaction', state: 'State', started: 'Started', hash: 'Hash', about: 'Position or request', action: 'Action' } as const

export const PRODUCT_LABEL = { covered: 'Covered contract', margin: 'Margin contract' } as const

export const NO_HASH_SHORT = 'No hash'
export const NO_HASH_YET = 'Not sent yet'

export const CHECK_AGAIN = 'Check again'
export const CLEAR_FINISHED = 'Clear finished'

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

/** `Bought, in ledger 58,331,204.` */
export const confirmedIn = (done: string, ledger: string): string => `${done}, in ledger ${ledger}.`
export const confirmedPlain = (done: string): string => `${done}.`

export const GUEST_TITLE = 'Connect a wallet to see its transactions.'
export const GUEST_HINT = 'Each wallet address has its own list in this browser.'
export const CONNECT = 'Connect wallet'

export const EMPTY_TITLE = 'No transactions from this browser yet.'
export const EMPTY_HINT = 'A transaction is listed here from the moment you start it.'
export const EMPTY_ACTION = 'Go to markets'

export const UNKNOWN_TITLE = (count: number): string => (count === 1 ? 'One transaction has an unknown outcome' : `${count} transactions have an unknown outcome`)
export const UNKNOWN_TEXT = 'It was sent and can still be included. Check it again before you send the same thing a second time.'
export const UNKNOWN_TEXT_MANY = 'They were sent and can still be included. Check them again before you send the same thing a second time.'

/** Announced after the finished entries are cleared. */
export const cleared = (count: number): string => (count === 1 ? 'One finished transaction removed from the list.' : `${count} finished transactions removed from the list.`)
