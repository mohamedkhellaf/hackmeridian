import { expiryFromU64, kindFromAbi } from '../options/abi'
import type { AbiOptionType } from '../options/abi'
import type { TokenInfo } from '../options/types'
import type { Bid, BidState } from './types'

// v1.5 `enum BidState { Open, Filled, Cancelled, Expired }` as the SDK decodes it.
export type AbiBidStateTag = 'Open' | 'Filled' | 'Cancelled' | 'Expired'

// v1.5 `struct Bid` as the SDK decodes it (i128/u64 -> bigint, u32 -> number, Option<u32> -> number | null/undefined).
export interface AbiBid {
  id: number
  buyer: string
  kind: AbiOptionType
  underlying: string
  quote: string
  qty: bigint
  strike_total: bigint
  premium_total: bigint
  expiry: bigint
  state: { tag: AbiBidStateTag; values: void }
  option_id: number | null | undefined
}

export function bidStateFromAbi(tag: AbiBidStateTag, expiry: number, nowSec: number): BidState {
  switch (tag) {
    case 'Open':
      return nowSec >= expiry ? 'expired' : 'open'
    case 'Filled':
      return 'filled'
    case 'Cancelled':
      return 'cancelled'
    case 'Expired':
      return 'pruned'
  }
}

export function bidFromAbi(raw: AbiBid, tokens: Map<string, TokenInfo>, nowSec: number): Bid {
  const underlying = tokens.get(raw.underlying)
  const quote = tokens.get(raw.quote)
  if (!underlying || !quote) throw new Error(`Request ${raw.id} uses an unknown token`)
  const expiry = expiryFromU64(raw.expiry)
  return {
    id: BigInt(raw.id),
    buyer: raw.buyer,
    kind: kindFromAbi(raw.kind),
    underlying,
    quote,
    underlyingQty: raw.qty,
    totalStrike: raw.strike_total,
    totalPremium: raw.premium_total,
    expiry,
    state: bidStateFromAbi(raw.state.tag, expiry, nowSec),
    optionId: raw.option_id === null || raw.option_id === undefined ? null : BigInt(raw.option_id),
  }
}
