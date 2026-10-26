import type { CollateralLine, OptionKind, OptionOffer, OptionState, TokenInfo } from './types'
import { requiredCollateral } from './types'

// Pure mapping/conversion helpers between the on-chain ABI (docs/contract-abi.md) and the
// frontend model. No network access, so everything here is unit-testable.

export type AbiOptionType = { tag: 'Put' | 'Call'; values: void }
export type AbiStateTag = 'Offered' | 'Active' | 'Exercised' | 'Settled' | 'Expired' | 'Cancelled'
export type AbiState = { tag: AbiStateTag; values: void }

// OptionData as the generated TS bindings return it (i128/u64 -> bigint, u32 -> number).
export interface AbiOptionData {
  id: number
  underlying: string
  quote: string
  option_type: AbiOptionType
  qty: bigint
  strike_total: bigint
  premium_total: bigint
  expiry: bigint
  writer: string
  holder: string | null | undefined // the SDK decodes Option::None as null at runtime
  state: AbiState
}

export interface AbiConfig {
  quote: string
  underlyings: string[]
}

export const kindFromAbi = (t: AbiOptionType): OptionKind => (t.tag === 'Put' ? 'put' : 'call')
export const kindToAbi = (k: OptionKind): AbiOptionType => ({ tag: k === 'put' ? 'Put' : 'Call', values: undefined })

// See the mapping table in types.ts. `nowSec` is unix seconds; expired means now >= expiry.
export function stateFromAbi(tag: AbiStateTag, expiry: number, nowSec: number): OptionState {
  switch (tag) {
    case 'Offered':
      return nowSec >= expiry ? 'expired' : 'offered'
    case 'Active':
      return nowSec >= expiry ? 'expired' : 'active'
    case 'Exercised':
      return 'exercised'
    case 'Settled':
      return 'settled'
    case 'Expired':
      return 'reclaimed'
    case 'Cancelled':
      return 'cancelled'
  }
}

export const idToU32 = (id: bigint): number => {
  if (id < 0n || id > 0xffffffffn) throw new Error('Option id out of range')
  return Number(id)
}

export function expiryToU64(expiry: number): bigint {
  if (!Number.isInteger(expiry) || expiry < 0) throw new Error('Invalid expiry')
  return BigInt(expiry)
}

export function expiryFromU64(expiry: bigint): number {
  if (expiry > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Expiry out of range')
  return Number(expiry)
}

export function assertI128(v: bigint): bigint {
  if (v < -(1n << 127n) || v >= 1n << 127n) throw new Error('Amount does not fit in i128')
  return v
}

// Tokens are looked up by SAC contract id; an option referencing an unknown token is a contract/config mismatch.
export function optionFromAbi(raw: AbiOptionData, tokens: Map<string, TokenInfo>, nowSec: number): OptionOffer {
  const underlying = tokens.get(raw.underlying)
  const quote = tokens.get(raw.quote)
  if (!underlying || !quote) throw new Error(`Option ${raw.id} uses an unknown token`)
  const expiry = expiryFromU64(raw.expiry)
  return {
    id: BigInt(raw.id),
    kind: kindFromAbi(raw.option_type),
    underlying,
    quote,
    underlyingQty: raw.qty,
    totalStrike: raw.strike_total,
    totalPremium: raw.premium_total,
    expiry,
    writer: raw.writer,
    holder: raw.holder ?? null,
    state: stateFromAbi(raw.state.tag, expiry, nowSec),
  }
}

// What the writer receives from claim_delivery (ABI section 2): PUT -> underlying qty, CALL -> quote strike.
export function deliveryAmount(o: Pick<OptionOffer, 'kind' | 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>) {
  return o.kind === 'put' ? { token: o.underlying, amount: o.underlyingQty } : { token: o.quote, amount: o.totalStrike }
}

// Per-token split of what the contract must hold, derived from the option list.
// The four columns sum to the contract's open_collateral(token).
export function collateralLines(options: OptionOffer[]): CollateralLine[] {
  const lines = new Map<string, CollateralLine>()
  const line = (token: TokenInfo) => {
    let l = lines.get(token.contractId)
    if (!l) lines.set(token.contractId, (l = { token, offered: 0n, active: 0n, pendingReclaim: 0n, unclaimed: 0n }))
    return l
  }
  for (const o of options) {
    if (o.state === 'offered' || o.state === 'active' || o.state === 'expired') {
      const { token, amount } = requiredCollateral(o)
      const l = line(token)
      if (o.state === 'offered') l.offered += amount
      else if (o.state === 'active') l.active += amount
      else l.pendingReclaim += amount
    } else if (o.state === 'exercised') {
      const { token, amount } = deliveryAmount(o)
      line(token).unclaimed += amount
    }
  }
  return [...lines.values()]
}

export const reservedOf = (l: CollateralLine) => l.offered + l.active + l.pendingReclaim + l.unclaimed
