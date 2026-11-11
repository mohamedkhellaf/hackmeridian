// Shared financial data contract (AGENTS.md, "Interfaces to lock at kickoff" #2).
// Token amounts are exact integer units (bigint). Never use `number` for amounts
// that get signed or sent on-chain.

export type OptionKind = 'put' | 'call'

// Mapping from the on-chain State (docs/contract-abi.md, see abi.ts `stateFromAbi`):
//   Offered / Active, now < expiry  -> 'offered' / 'active'
//   Offered / Active, now >= expiry -> 'expired'   (derived: collateral still locked, writer can reclaim)
//   Expired (writer reclaimed)      -> 'reclaimed' (terminal)
//   Exercised                       -> 'exercised' (writer's proceeds wait in the contract: claim_delivery)
//   Settled                         -> 'settled'   (terminal)
//   Cancelled                       -> 'cancelled' (terminal)
export type OptionState = 'offered' | 'active' | 'exercised' | 'settled' | 'expired' | 'reclaimed' | 'cancelled'

export interface TokenInfo {
  contractId: string // SAC contract ID
  code: string
  decimals: number
}

export interface OptionOffer {
  id: bigint
  kind: OptionKind
  underlying: TokenInfo
  quote: TokenInfo
  underlyingQty: bigint // total underlying units
  totalStrike: bigint // total quote units paid/received on exercise
  totalPremium: bigint // total quote units paid by the buyer
  expiry: number // unix seconds
  writer: string
  holder: string | null
  state: OptionState
}

// Resale ask (contract v1.4): the current holder of an Active option offers it for `askTotal` quote units.
// The price is set by the holder; it is not a market quote.
export interface Ask {
  id: bigint
  holder: string
  askTotal: bigint
}

export interface TxResult {
  hash: string
}

// Assets the deployed contract allowlists (immutable constructor in the MVP).
export interface SupportedAssets {
  quote: TokenInfo
  underlyings: TokenInfo[]
}

export interface NewOffer {
  kind: OptionKind
  underlying: TokenInfo
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint
  expiry: number
}

// Collateral held by the contract for one token, split by offer state.
export interface CollateralLine {
  token: TokenInfo
  offered: bigint // backing open offers
  active: bigint // backing sold options
  pendingReclaim: bigint // backing expired options the writer hasn't reclaimed
  unclaimed: bigint // exercised options' proceeds the writer hasn't claimed yet (claim_delivery)
}

// Reserved (open_collateral) vs actually held (SAC balance of the contract) for one token.
// held < reserved means the issuer clawed back from the contract.
export interface CollateralHealth {
  token: TokenInfo
  reserved: bigint
  held: bigint
}

// Contract limits (docs/contract-abi.md sections 7 and 12). The tenor cap and per-writer cap exist from v1.3;
// the form enforces the tenor on every contract version since a longer offer is never sensible.
export const MAX_TENOR_SECONDS = 63_072_000 // 2 years
export const MAX_OPEN_PER_WRITER = 50

// Puts lock the total strike in the quote token; covered calls lock the underlying.
export function requiredCollateral(o: Pick<OptionOffer, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>) {
  return o.kind === 'put' ? { token: o.quote, amount: o.totalStrike } : { token: o.underlying, amount: o.underlyingQty }
}
