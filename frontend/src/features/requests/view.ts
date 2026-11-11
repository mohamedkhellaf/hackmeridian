// What the table (from 1200 px) and the list (below it) both take, so the page can render either from one set of
// props, and the few rules both apply the same way.
import { URGENCY_15MIN_SECONDS } from '../../core/format'
import type { TokenBalance } from '../../core/stellar/tokens'
import { lockShortfall } from './board'
import type { RequestRow, RequestSort } from './board'

/** Under 48 hours the countdown of the wallet's own open request takes the warning tone and a clock. */
export const WARN_BELOW_MS = 48 * 3_600 * 1_000

export interface RequestsViewProps {
  rows: readonly RequestRow[]
  /** `board`: open requests a maker can fill. `mine`: the wallet's own, in every state. */
  variant: 'board' | 'mine'
  /** The request the ticket is showing. */
  selectedId: bigint | null
  /** The wallet's balances by token contract id, when known. Only feeds the "You hold" hint. */
  balances: Record<string, TokenBalance> | undefined
  /** Tokens the wallet holds none of: said once above the board, so their rows carry no hint. */
  emptyTokens: ReadonlySet<string>
  /** Unix seconds, stepped: decides the "may expire" line. */
  nowSec: number
  /** The order of the board. The table's Deadline and Premium headers set it; the list has a control above it. */
  sort?: RequestSort
  onSort?: (sort: RequestSort) => void
  /** Builds the explorer link of an account, or returns undefined where there is no page to link to. */
  explorerOf: (address: string) => string | undefined
  onSell: (row: RequestRow) => void
  onCancel: (row: RequestRow) => void
}

/** What the wallet is missing to lock the collateral of a request, when its balance is known, above zero and too low. */
export function shortfallOf(row: RequestRow, balances: Record<string, TokenBalance> | undefined, emptyTokens: ReadonlySet<string>): ReturnType<typeof lockShortfall> {
  const held = balances?.[row.lockToken.contractId]
  if (row.mine || !held || held.status !== 'ok' || emptyTokens.has(row.lockToken.contractId)) return null
  return lockShortfall(row, held.balance)
}

/** A balance that is known to be nothing: zero, or no account or trustline to hold the token. */
const holdsNone = (held: TokenBalance | undefined): boolean =>
  held !== undefined && ((held.status === 'ok' && held.balance === 0n) || held.status === 'unfunded' || held.status === 'no-trustline')

/** The collateral tokens of other wallets' requests that this wallet holds none of, by contract id, with their codes. */
export function emptyCollateral(rows: readonly RequestRow[], balances: Record<string, TokenBalance> | undefined): Map<string, string> {
  const out = new Map<string, string>()
  if (!balances) return out
  for (const row of rows) {
    if (row.mine) continue
    const id = row.lockToken.contractId
    if (!out.has(id) && holdsNone(balances[id])) out.set(id, row.lockToken.code)
  }
  return out
}

/** The warning tone of a countdown: only on the wallet's own open request, whose premium is about to need taking back. */
export const warnBelowOf = (row: RequestRow): number | undefined => (row.mine ? WARN_BELOW_MS : undefined)

/** A request of another wallet with under 15 minutes left: a fill signed now may land after the deadline. */
export const lapsing = (row: RequestRow, nowSec: number): boolean => {
  const left = row.deadlineSec - nowSec
  return !row.mine && row.state === 'open' && left > 0 && left <= URGENCY_15MIN_SECONDS
}
