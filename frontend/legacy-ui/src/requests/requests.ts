import { formatAmount, formatDisplay } from '../options/format'
import { requiredCollateral } from '../options/types'
import type { TokenInfo } from '../options/types'
import type { Bid, BidState } from './types'

// Pure helpers for the Requests UI (contract v1.5 bids). Display only: settlement uses exact units.

export const amt = (units: bigint, t: Pick<TokenInfo, 'decimals' | 'code'>) => `${formatDisplay(units, t.decimals)} ${t.code}`

/** A quote-token total per one unit of underlying, 2 decimals, truncated. */
export function perUnit(total: bigint, b: Pick<Bid, 'underlyingQty' | 'underlying' | 'quote'>): string {
  if (b.underlyingQty === 0n) return '–'
  const scaled = (total * 10n ** BigInt(b.underlying.decimals)) / b.underlyingQty
  return formatAmount(scaled, b.quote.decimals, 2, Math.min(2, b.quote.decimals))
}

/** What a maker locks to fill: PUT -> total strike in the quote token; CALL -> the underlying quantity. */
export const fillCollateral = (b: Bid) => requiredCollateral(b)

export const STATUS_LABEL: Record<BidState, string> = {
  open: 'Open',
  expired: 'Expired',
  filled: 'Filled',
  cancelled: 'Cancelled',
  pruned: 'Expired, refunded',
}

/** Requests shown on Markets: open ones first (soonest expiry first), then expired-but-unrefunded and filled. */
export function marketBids(bids: Bid[]): Bid[] {
  const rank: Record<BidState, number> = { open: 0, expired: 1, filled: 2, cancelled: 3, pruned: 3 }
  return bids
    .filter((b) => rank[b.state] < 3)
    .sort((a, b) => rank[a.state] - rank[b.state] || a.expiry - b.expiry || (a.id < b.id ? -1 : 1))
}

/** The wallet's requests that still hold its escrowed premium (open, or expired and not yet refunded). */
export const myOpenBids = (bids: Bid[], me: string | null): Bid[] =>
  me ? bids.filter((b) => b.buyer === me && (b.state === 'open' || b.state === 'expired')) : []

/** Why the connected wallet cannot fill this request, or null if it can try. */
export function fillBlockReason(b: Bid, me: string | null, nowSec: number): string | null {
  if (!me) return 'Connect a wallet to fill'
  if (b.buyer === me) return 'This is your own request'
  if (b.state !== 'open' || b.expiry <= nowSec) return 'This request is no longer open'
  return null
}
