// Pure selectors of the Requests board: which requests are shown, in what order, and how each row reads.
// No React. Amounts stay exact integer units until they are formatted here; nothing is computed with floats.
import type { TokenInfo } from '../../core/options/types'
import type { Bid, BidState } from '../../core/requests/types'
import { byId, compareRatio } from '../../core/units'

export type RequestSort = 'premium' | 'deadline'
export type KindFilter = 'put' | 'call'

/** The order the board opens in: the request that lapses first comes first. */
export const DEFAULT_SORT: RequestSort = 'deadline'

export interface BoardFilter {
  /** Underlying contract id, or null for every asset. */
  assetId: string | null
  kind: KindFilter | null
  sort: RequestSort
}

/** Requests a seller can take now: state open and the deadline still ahead. */
export const openRequests = (bids: readonly Bid[], nowSec: number): Bid[] => bids.filter((b) => b.state === 'open' && b.expiry > nowSec)

export const filterRequests = (bids: readonly Bid[], filter: Pick<BoardFilter, 'assetId' | 'kind'>): Bid[] =>
  bids.filter((b) => (filter.assetId === null || b.underlying.contractId === filter.assetId) && (filter.kind === null || b.kind === filter.kind))

const scale = (b: Bid): bigint => b.totalPremium * 10n ** BigInt(b.underlying.decimals)

/** Higher premium per whole unit of underlying first. Exact: cross-multiplied, never divided. */
export const byPremiumPerUnitDesc = (a: Bid, b: Bid): number => compareRatio(scale(b), b.underlyingQty, scale(a), a.underlyingQty)

/**
 * `deadline`: soonest deadline first, then the higher premium per unit. `premium`: highest premium per unit
 * first, then the sooner deadline. The id breaks every remaining tie, so the order never flickers between reads.
 */
export function sortRequests(bids: readonly Bid[], sort: RequestSort): Bid[] {
  const byDeadline = (a: Bid, b: Bid) => a.expiry - b.expiry
  return [...bids].sort((a, b) => (sort === 'premium' ? byPremiumPerUnitDesc(a, b) || byDeadline(a, b) : byDeadline(a, b) || byPremiumPerUnitDesc(a, b)) || byId(a, b))
}

export const boardRequests = (bids: readonly Bid[], filter: BoardFilter, nowSec: number): Bid[] => sortRequests(filterRequests(openRequests(bids, nowSec), filter), filter.sort)

/**
 * The state of each request at `nowSec`. The contract's own state is read at the last poll; an open request whose
 * deadline has passed since then is already expired (its premium waits in the contract), so the page does not
 * keep offering to cancel an open request that can no longer be filled.
 */
export const asOf = (bids: readonly Bid[], nowSec: number): Bid[] => bids.map((b) => (b.state === 'open' && b.expiry <= nowSec ? { ...b, state: 'expired' } : b))

/** The order of "My requests": the one that asks for an action (expired, premium still in the contract) first. */
const MINE_RANK: Record<BidState, number> = { expired: 0, open: 1, filled: 2, cancelled: 3, pruned: 3 }

/**
 * Every request the wallet ever posted: expired ones whose premium waits in the contract first, then open ones by
 * deadline, then filled, then closed. Newest first inside the finished groups.
 */
export function myRequests(bids: readonly Bid[], me: string | null): Bid[] {
  if (!me) return []
  return bids
    .filter((b) => b.buyer === me)
    .sort((a, b) => MINE_RANK[a.state] - MINE_RANK[b.state] || (MINE_RANK[a.state] < 2 ? a.expiry - b.expiry || byId(a, b) : byId(b, a)))
}

/** The wallet's requests whose premium is still in the contract (open, or expired and not cancelled yet). */
export { holdsEscrow } from '../../core/requests/rows'

/** Closed for good: cancelled, or expired and refunded by a prune. Hidden from "My requests" until asked for. */
export const isClosed = (b: Bid): boolean => b.state === 'cancelled' || b.state === 'pruned'

export interface BoardTotals {
  count: number
  /** Sum of the escrowed premiums, in quote units. Null when the list is empty (no quote token to name). */
  escrowed: bigint | null
  quote: TokenInfo | null
}

/** What the listed requests add up to. Every request of one contract is in the same quote token. */
export function boardTotals(bids: readonly Bid[]): BoardTotals {
  if (bids.length === 0) return { count: 0, escrowed: null, quote: null }
  return { count: bids.length, escrowed: bids.reduce((sum, b) => sum + b.totalPremium, 0n), quote: bids[0].quote }
}

/** The contract's bid id as printed on a row: unpadded, `No. 3` (ruling F1). */
import { serialOf } from '../../core/format/option'
export { serialOf }

// The row view model (terms, figures, state and escrow words) lives in core/requests/rows, shared with the asset
// page's Requests tab and Portfolio. These names are the board's own for it.
export { ESCROW_STATUS, STATE_NAME, figureText as money, lockShortfall, requestRow as toRow, requestRows as toRows } from '../../core/requests/rows'
export type { EscrowStatus, Figure, RequestRow, RowReference } from '../../core/requests/rows'

/** Parses a bid id from the URL. Null for anything that is not a plain non-negative integer. */
export function parseBidId(raw: string | undefined): bigint | null {
  if (raw === undefined || !/^\d{1,10}$/.test(raw)) return null
  return BigInt(raw)
}
