// What the table (768 px and up) and the list (phones) both take, so the page can render either from one set of props.
import type { TokenBalance } from '../../core/stellar/tokens'
import { lockShortfall } from './board'
import type { RequestRow } from './board'

/** Under 48 hours the countdown of a deadline takes the warning tone and a clock. */
export const WARN_BELOW_MS = 48 * 3_600 * 1_000

export interface RequestsViewProps {
  rows: readonly RequestRow[]
  /** `board`: open requests a seller can take. `mine`: the wallet's own, in every state. */
  variant: 'board' | 'mine'
  /** The request the ticket is showing. */
  selectedId: bigint | null
  /** The wallet's balances by token contract id, when known. Only feeds the "You hold" hint. */
  balances: Record<string, TokenBalance> | undefined
  /** Builds the explorer link of an account, or returns undefined where there is no page to link to. */
  explorerOf: (address: string) => string | undefined
  onSell: (row: RequestRow) => void
  onCancel: (row: RequestRow) => void
}

/** What the wallet is missing to lock the collateral of a request, when its balance is known and too low. */
export function shortfallOf(row: RequestRow, balances: Record<string, TokenBalance> | undefined): ReturnType<typeof lockShortfall> {
  const held = balances?.[row.lockToken.contractId]
  return row.mine || !held || held.status !== 'ok' ? null : lockShortfall(row, held.balance)
}
