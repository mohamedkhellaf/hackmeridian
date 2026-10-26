import { formatAmount } from '../options/format'
import type { CollateralHealth, CollateralLine, OptionOffer, TokenInfo } from '../options/types'

// Pure helpers for the Reserves page. Amounts are exact bigint token units.

export type BackingStatus = 'backed' | 'short' | 'unknown'

export interface Backing {
  status: BackingStatus
  owed: bigint
  held: bigint | null // null when the on-chain balance could not be read
  shortfall: bigint
  /** Held / owed in tenths of a percent, rounded DOWN (never shows 100.0% while short). null when nothing is owed. */
  tenthsPct: number | null
  /** Bar fill 0..100. */
  fill: number
}

export function lineTotal(l: Pick<CollateralLine, 'offered' | 'active' | 'pendingReclaim' | 'unclaimed'>): bigint {
  return l.offered + l.active + l.pendingReclaim + l.unclaimed
}

export function shortfall(held: bigint, reserved: bigint): bigint {
  return reserved > held ? reserved - held : 0n
}

export function ratioTenths(held: bigint, reserved: bigint): number | null {
  if (reserved <= 0n) return null
  return Number((held * 1000n) / reserved)
}

export function formatTenths(t: number): string {
  return `${(t / 10).toFixed(1)}%`
}

export function backingFor(line: CollateralLine, health?: CollateralHealth): Backing {
  if (!health) {
    return { status: 'unknown', owed: lineTotal(line), held: null, shortfall: 0n, tenthsPct: null, fill: 0 }
  }
  const owed = health.reserved
  const held = health.held
  const tenthsPct = ratioTenths(held, owed)
  const short = shortfall(held, owed)
  return {
    status: short > 0n ? 'short' : 'backed',
    owed,
    held,
    shortfall: short,
    tenthsPct,
    fill: tenthsPct === null ? 100 : Math.min(100, tenthsPct / 10),
  }
}

// Fixed 2 decimals for reserves rows (1,080.00).
export function formatFixed(units: bigint, decimals: number): string {
  return formatAmount(units, decimals, 2, 2)
}

export function stellarExpertContract(id: string): string {
  return `https://stellar.expert/explorer/testnet/contract/${id}`
}

/** Tokens whose pooled balance is below what the contract owes (issuer clawback). Empty when health is unknown. */
export function shortTokens(health: CollateralHealth[]): TokenInfo[] {
  return health.filter((h) => h.held < h.reserved).map((h) => h.token)
}

/** Short tokens that touch this option (its underlying or its quote token). */
export function shortfallFor(o: Pick<OptionOffer, 'underlying' | 'quote'>, health: CollateralHealth[]): TokenInfo[] {
  const ids = new Set([o.underlying.contractId, o.quote.contractId])
  return shortTokens(health).filter((t) => ids.has(t.contractId))
}
