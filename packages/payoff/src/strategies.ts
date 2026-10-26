import { analyze } from './analyze.ts'
import { longPut, shortCall, shortPut } from './legs.ts'
import type { OptionLeg, StrategyPayoff } from './types.ts'

/** Holding `qty` units bought at `entryPrice` (per unit). */
export interface Holding {
  qty: number
  entryPrice: number
}

function asset(h: Holding, s: number): number {
  return h.qty * (s - h.entryPrice)
}

function checkHolding(h: Holding, leg: OptionLeg): void {
  if (!(h.qty > 0) || !(h.entryPrice > 0)) throw new RangeError('holding qty and entryPrice must be > 0')
  if (h.qty !== leg.qty) throw new RangeError('option qty must equal holding qty')
}

/** Own the asset and write a call against it. Capital = cost basis of the asset. */
export function coveredCall(h: Holding, call: OptionLeg): StrategyPayoff {
  checkHolding(h, call)
  return analyze((s) => asset(h, s) + shortCall(call, s).total, [call.strikeTotal / call.qty], h.qty * h.entryPrice)
}

/** Write a put and lock its full strike in cash. Capital = strikeTotal. */
export function cashSecuredPut(put: OptionLeg): StrategyPayoff {
  return analyze((s) => shortPut(put, s).total, [put.strikeTotal / put.qty], put.strikeTotal)
}

/** Own the asset and buy a put. Capital = cost basis plus the put premium. */
export function protectivePut(h: Holding, put: OptionLeg): StrategyPayoff {
  checkHolding(h, put)
  return analyze(
    (s) => asset(h, s) + longPut(put, s).total,
    [put.strikeTotal / put.qty],
    h.qty * h.entryPrice + put.premiumTotal,
  )
}

/** Own the asset, buy a put and write a call. Capital = cost basis plus the put premium (call premium not netted). */
export function collar(h: Holding, put: OptionLeg, call: OptionLeg): StrategyPayoff {
  checkHolding(h, put)
  checkHolding(h, call)
  return analyze(
    (s) => asset(h, s) + longPut(put, s).total + shortCall(call, s).total,
    [put.strikeTotal / put.qty, call.strikeTotal / call.qty],
    h.qty * h.entryPrice + put.premiumTotal,
  )
}
