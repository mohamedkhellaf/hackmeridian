// Shared financial data contract (AGENTS.md, "Interfaces to lock at kickoff" #2).
// Token amounts are exact integer units (bigint). Never use `number` for amounts
// that get signed or sent on-chain.

export type OptionKind = 'put' | 'call'

// 'expired' = past expiry, collateral still in the contract; 'reclaimed' = writer took it back.
export type OptionState = 'offered' | 'active' | 'exercised' | 'expired' | 'reclaimed' | 'cancelled'

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
}

// Puts lock the total strike in the quote token; covered calls lock the underlying.
export function requiredCollateral(o: Pick<OptionOffer, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>) {
  return o.kind === 'put' ? { token: o.quote, amount: o.totalStrike } : { token: o.underlying, amount: o.underlyingQty }
}
