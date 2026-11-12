// What a long Margin call pays and costs, from the contract's own figures: the quantity in lots (1 lot is one
// unit of the underlying), the strike and the publisher price per lot, and the premium, all in exact USDx units.
// The contract pays `qty x max(S - K, 0)` (AGENTS.md, StellSec Pro). Integer arithmetic, truncating; no margin
// maths here: who pays it, and how much of it, is the contract's and the payout waterfall's business.

/** `qty x max(spot - strike, 0)`: what an exercise at `spot` is due, before any deficit. */
export function callPayout(qty: bigint, spot: bigint, strike: bigint): bigint {
  return spot > strike ? qty * (spot - strike) : 0n
}

/** The settlement price at which the payout equals the premium paid: strike plus the premium per lot, truncated. */
export function breakevenPerLot(strike: bigint, premium: bigint, qty: bigint): bigint | null {
  return qty > 0n ? strike + premium / qty : null
}
