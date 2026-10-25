// Shared financial data contract (AGENTS.md, "Interfaces to lock at kickoff" #2).
// Token amounts are exact integer units (bigint). Never use `number` for amounts
// that get signed or sent on-chain.

export type OptionKind = 'put' | 'call'

export type OptionState = 'offered' | 'active' | 'exercised' | 'expired' | 'cancelled'

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
