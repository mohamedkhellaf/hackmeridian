// Adapter between on-chain offers (exact bigint units) and the pure payoff maths in packages/payoff.
// All numbers here are display-only and hypothetical (no oracle, no market price). No pricing logic lives in the UI:
// the P&L itself always comes from the package's longCall / longPut.
import { longCall, longPut, toNumber } from '../../../packages/payoff/src/index.ts'
import type { OptionLeg } from '../../../packages/payoff/src/index.ts'
import type { OptionOffer } from '../options/types'

export interface RiskLines {
  /** Strike per unit of underlying, in quote units. */
  strike: number
  premium: number
  premiumPerUnit: number
  breakeven: number
  /** The buyer can lose at most the premium. */
  maxLoss: number
  /** null = unlimited (call). */
  maxGain: number | null
  /** Total P&L at the assumed price, premium included. */
  pnlAtAssumed: number
}

/** Offer -> package leg (totals, display numbers). */
export function legOf(o: OptionOffer): OptionLeg {
  return {
    qty: toNumber(o.underlyingQty, o.underlying.decimals),
    strikeTotal: toNumber(o.totalStrike, o.quote.decimals),
    premiumTotal: toNumber(o.totalPremium, o.quote.decimals),
  }
}

export const strikeOf = (leg: OptionLeg): number => leg.strikeTotal / leg.qty

/** Buyer P&L at expiry for the underlying price `s` (per unit). */
export function buyerPnl(o: OptionOffer, s: number): number {
  const leg = legOf(o)
  return (o.kind === 'put' ? longPut(leg, s) : longCall(leg, s)).total
}

export function riskLines(o: OptionOffer, assumed: number): RiskLines {
  const leg = legOf(o)
  const k = strikeOf(leg)
  const perUnit = leg.premiumTotal / leg.qty
  return {
    strike: k,
    premium: leg.premiumTotal,
    premiumPerUnit: perUnit,
    breakeven: o.kind === 'put' ? k - perUnit : k + perUnit,
    maxLoss: leg.premiumTotal,
    maxGain: o.kind === 'put' ? buyerPnl(o, 0) : null,
    pnlAtAssumed: buyerPnl(o, assumed),
  }
}

export interface ChartModel {
  from: number
  to: number
  points: { s: number; pnl: number }[]
  minPnl: number
  maxPnl: number
}

/** Curve over [0.6K, 1.4K], widened to include the assumed price; kinks (strike, breakeven) are sampled exactly. */
export function chartModel(o: OptionOffer, assumed: number, steps = 80): ChartModel {
  const r = riskLines(o, assumed)
  const from = Math.min(r.strike * 0.6, assumed * 0.95)
  const to = Math.max(r.strike * 1.4, assumed * 1.05)
  const xs = new Set<number>([r.strike])
  if (r.breakeven > from && r.breakeven < to) xs.add(r.breakeven)
  for (let i = 0; i <= steps; i++) xs.add(from + ((to - from) * i) / steps)
  const points = [...xs].sort((a, b) => a - b).map((s) => ({ s, pnl: buyerPnl(o, s) }))
  const pnls = points.map((p) => p.pnl)
  return { from, to, points, minPnl: Math.min(...pnls, 0), maxPnl: Math.max(...pnls, 0) }
}

/** Display number: grouped, 2 to 4 decimals. */
export function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function fmtSigned(n: number): string {
  const v = Math.abs(n) < 5e-5 ? 0 : n
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${fmtNum(Math.abs(v))}`
}
