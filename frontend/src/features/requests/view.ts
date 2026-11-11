// What the table (from 1200 px) and the list (below it) both take, so the page can render either from one set of
// props. The rules a row follows (the warning tone, the 15-minute line) live with the row model in
// core/requests/rows, shared with the asset page's Requests tab.
import type { TokenBalance } from '../../core/stellar/tokens'
import type { RequestRow, RequestSort } from './board'

export { WARN_BELOW_MS, lapsing, warnBelowOf } from '../../core/requests/rows'

export interface RequestsViewProps {
  rows: readonly RequestRow[]
  /** `board`: open requests a maker can fill. `mine`: the wallet's own, in every state. */
  variant: 'board' | 'mine'
  /** The request the ticket is showing. */
  selectedId: bigint | null
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
