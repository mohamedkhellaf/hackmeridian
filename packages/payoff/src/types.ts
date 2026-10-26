/** Every result here is an illustrative expiry payoff, not an executable price. */
export type Hypothetical = 'hypothetical'

export interface LegPayoff {
  label: Hypothetical
  /** P&L per unit of underlying, premium included. */
  perUnit: number
  /** P&L for the whole lot (`qty` units), premium included. */
  total: number
}

/**
 * One option leg, in the same shape as the contract: `strikeTotal` and `premiumTotal`
 * are totals for `qty` units, in display quote units (convert with `toNumber`).
 */
export interface OptionLeg {
  qty: number
  strikeTotal: number
  premiumTotal: number
}

export interface PayoffPoint {
  s: number
  pnl: number
}

export interface CurveRange {
  from: number
  to: number
  steps?: number
}

export interface StrategyPayoff {
  label: Hypothetical
  /** Total P&L at expiry for underlying price `s` (per-unit price). */
  pnl: (s: number) => number
  /** Underlying prices at which P&L crosses zero. */
  breakevens: number[]
  /** Best total P&L over s >= 0 (`Infinity` if unbounded). */
  maxGain: number
  /** Worst total loss as a positive number over s >= 0 (`Infinity` if unbounded). */
  maxLoss: number
  /** Gross capital tied up (collateral or cost basis); premiums received are not netted. */
  capitalLocked: number
  /** Sampled curve over `range`. */
  curve: (range: CurveRange) => PayoffPoint[]
}
