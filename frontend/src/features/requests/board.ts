// Pure selectors of the Requests board: which requests are shown, in what order, and how each row reads.
// No React. Amounts stay exact integer units until they are formatted here; nothing is computed with floats.
import { findReferenceAsset } from '../../core/assets'
import { formatExact, formatUnits, formatUtc } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import { fillCollateral } from '../../core/requests/requests'
import type { Bid, BidState } from '../../core/requests/types'
import { byId, compareRatio, perUnit, shortBy } from '../../core/units'

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

const MINE_RANK: Record<BidState, number> = { open: 0, expired: 1, filled: 2, cancelled: 3, pruned: 3 }

/**
 * Every request the wallet ever posted: the ones that still hold its premium first (open by deadline, then
 * expired), then filled, then closed. Newest first inside the finished groups.
 */
export function myRequests(bids: readonly Bid[], me: string | null): Bid[] {
  if (!me) return []
  return bids
    .filter((b) => b.buyer === me)
    .sort((a, b) => MINE_RANK[a.state] - MINE_RANK[b.state] || (MINE_RANK[a.state] < 2 ? a.expiry - b.expiry || byId(a, b) : byId(b, a)))
}

/** The wallet's requests whose premium is still in the contract (open, or expired and not cancelled yet). */
export const holdsEscrow = (b: Bid): boolean => b.state === 'open' || b.state === 'expired'

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

/** The contract's bid id as printed on a note: six digits. */
export const serialOf = (id: bigint): string => id.toString().padStart(6, '0')

export interface Figure {
  /** Two decimals, grouped, truncated. */
  text: string
  /** Every digit, for the exact-value popover. */
  exact: string
  code: string
}

const figure = (units: bigint, token: { decimals: number; code: string }): Figure => ({
  text: formatUnits(units, token.decimals),
  exact: formatExact(units, token.decimals),
  code: token.code,
})

export const money = (f: Figure): string => `${f.text} ${f.code}`

/** What the money of a request is doing, by state. */
export type EscrowStatus = 'escrowed' | 'stranded' | 'paid' | 'refunded'

const ESCROW_STATUS: Record<BidState, EscrowStatus> = { open: 'escrowed', expired: 'stranded', filled: 'paid', cancelled: 'refunded', pruned: 'refunded' }

/** The contract's own state name for the tag. A pruned request is `Expired` on chain. */
export const STATE_NAME: Record<BidState, string> = { open: 'Open', expired: 'Expired', filled: 'Filled', cancelled: 'Cancelled', pruned: 'Expired' }

export interface RequestRow {
  bid: Bid
  key: string
  serial: string
  assetCode: string
  /** `Bond`, `Fund share`, `Equity` for a reference asset; null otherwise. */
  typeLabel: string | null
  kind: 'put' | 'call'
  kindWord: 'Put' | 'Call'
  /** The request is for a long option: the buyer will hold it. */
  glyph: 'long-put' | 'long-call'
  quantity: Figure
  /** Quote units for one whole unit of underlying, truncated. */
  strike: Figure
  strikeTotal: Figure
  premium: Figure
  premiumPerUnit: Figure
  /** What a seller locks to take it: the total strike for a put, the underlying for a call. */
  lock: Figure
  lockToken: TokenInfo
  lockUnits: bigint
  deadlineSec: number
  /** `13 Nov 2026, 08:00 UTC`. */
  deadlineText: string
  state: BidState
  stateName: string
  escrow: EscrowStatus
  mine: boolean
  /** Set once the request was filled. */
  optionId: bigint | null
  /** Every term in one phrase, for accessible names: "put on 5.00 FUND at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 2.00 USDx". */
  terms: string
}

export function toRow(bid: Bid, me: string | null): RequestRow {
  const zero = { decimals: bid.quote.decimals, code: bid.quote.code }
  const strike = figure(perUnit(bid.totalStrike, bid) ?? 0n, zero)
  const premiumPerUnit = figure(perUnit(bid.totalPremium, bid) ?? 0n, zero)
  const quantity = figure(bid.underlyingQty, bid.underlying)
  const premium = figure(bid.totalPremium, bid.quote)
  const collateral = fillCollateral(bid)
  const deadlineText = formatUtc(bid.expiry)
  const reference = findReferenceAsset(bid.underlying.contractId)
  return {
    bid,
    key: bid.id.toString(),
    serial: serialOf(bid.id),
    assetCode: bid.underlying.code,
    typeLabel: reference?.typeLabel ?? null,
    kind: bid.kind,
    kindWord: bid.kind === 'put' ? 'Put' : 'Call',
    glyph: bid.kind === 'put' ? 'long-put' : 'long-call',
    quantity,
    strike,
    strikeTotal: figure(bid.totalStrike, bid.quote),
    premium,
    premiumPerUnit,
    lock: figure(collateral.amount, collateral.token),
    lockToken: collateral.token,
    lockUnits: collateral.amount,
    deadlineSec: bid.expiry,
    deadlineText,
    state: bid.state,
    stateName: STATE_NAME[bid.state],
    escrow: ESCROW_STATUS[bid.state],
    mine: me !== null && bid.buyer === me,
    optionId: bid.optionId,
    terms: `${bid.kind} on ${money(quantity)} at ${money(strike)}, until ${deadlineText}, premium ${money(premium)}`,
  }
}

export const toRows = (bids: readonly Bid[], me: string | null): RequestRow[] => bids.map((b) => toRow(b, me))

/**
 * How much of the collateral the wallet is missing, or null when it has enough or the balance is not known.
 * Only a hint on the row: the ticket runs the full checks before anything is signed.
 */
export function lockShortfall(row: Pick<RequestRow, 'lockUnits' | 'lockToken'>, balance: bigint | null | undefined): { have: Figure; missing: Figure } | null {
  if (balance === null || balance === undefined) return null
  const missing = shortBy(balance, row.lockUnits)
  return missing > 0n ? { have: figure(balance, row.lockToken), missing: figure(missing, row.lockToken) } : null
}

/** Parses a bid id from the URL. Null for anything that is not a plain non-negative integer. */
export function parseBidId(raw: string | undefined): bigint | null {
  if (raw === undefined || !/^\d{1,10}$/.test(raw)) return null
  return BigInt(raw)
}
