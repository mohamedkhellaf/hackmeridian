import type { NewOffer, OptionKind, TokenInfo } from '../options/types'

// Buyer requests (contract v1.5 bids). A request is a funded bid: the buyer escrows `totalPremium` in the contract
// at a price the buyer set. A maker fills it by locking the collateral; the option then becomes Active with the
// buyer as holder. It is not a market quote.

// Mapping from the on-chain BidState (see abi.ts `bidStateFromAbi`):
//   Open, now < expiry  -> 'open'
//   Open, now >= expiry -> 'expired' (derived: premium still escrowed, a prune refunds it)
//   Filled              -> 'filled'
//   Cancelled           -> 'cancelled'
//   Expired (pruned)    -> 'pruned'
export type BidState = 'open' | 'expired' | 'filled' | 'cancelled' | 'pruned'

export interface Bid {
  id: bigint
  buyer: string
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint // escrowed by the buyer, paid to the maker on fill
  expiry: number // unix seconds
  state: BidState
  optionId: bigint | null // set once filled
}

// Same terms as an offer; the premium is what the buyer offers to pay.
export type NewBid = NewOffer

export const MAX_OPEN_BIDS_PER_BUYER = 50
