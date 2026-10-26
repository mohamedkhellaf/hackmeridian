import type { LegPayoff, OptionLeg } from './types.ts'

function check(leg: OptionLeg): number {
  if (!(leg.qty > 0)) throw new RangeError('qty must be > 0')
  if (!(leg.strikeTotal > 0)) throw new RangeError('strikeTotal must be > 0')
  if (!(leg.premiumTotal >= 0)) throw new RangeError('premiumTotal must be >= 0')
  return leg.strikeTotal / leg.qty
}

function result(total: number, qty: number): LegPayoff {
  return { label: 'hypothetical', perUnit: total / qty, total }
}

/** Buyer of a call: right to buy at the strike, paid the premium. */
export function longCall(leg: OptionLeg, spot: number): LegPayoff {
  const k = check(leg)
  return result(leg.qty * Math.max(spot - k, 0) - leg.premiumTotal, leg.qty)
}

/** Writer of a call: received the premium, owes the underlying at the strike. */
export function shortCall(leg: OptionLeg, spot: number): LegPayoff {
  const k = check(leg)
  return result(leg.premiumTotal - leg.qty * Math.max(spot - k, 0), leg.qty)
}

/** Buyer of a put: right to sell at the strike, paid the premium. */
export function longPut(leg: OptionLeg, spot: number): LegPayoff {
  const k = check(leg)
  return result(leg.qty * Math.max(k - spot, 0) - leg.premiumTotal, leg.qty)
}

/** Writer of a put: received the premium, owes the strike in cash. */
export function shortPut(leg: OptionLeg, spot: number): LegPayoff {
  const k = check(leg)
  return result(leg.premiumTotal - leg.qty * Math.max(k - spot, 0), leg.qty)
}
