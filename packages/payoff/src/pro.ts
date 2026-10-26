import type { Hypothetical } from './types.ts'

export interface ProPayout {
  label: Hypothetical
  /** qty * max(S_T - K, 0): what the holder is owed at settlement. */
  due: number
  /** min(due, writerMargin + vault): what is actually paid. */
  paid: number
  /** due - paid: shortfall borne by the holder. */
  deficit: number
}

/** Cash payout of a Pro (cash-settled call) position when only margin and vault can pay it. */
export function proHolderPayout(qty: number, K: number, S_T: number, writerMargin: number, vault: number): ProPayout {
  if (!(qty > 0) || !(K > 0)) throw new RangeError('qty and K must be > 0')
  if (writerMargin < 0 || vault < 0) throw new RangeError('writerMargin and vault must be >= 0')
  const due = qty * Math.max(S_T - K, 0)
  const paid = Math.min(due, writerMargin + vault)
  return { label: 'hypothetical', due, paid, deficit: due - paid }
}

/** Highest settlement price the holder is still paid in full: K + (margin + vault) / qty. */
export function guaranteedCoverPrice(qty: number, K: number, margin: number, vault: number): number {
  if (!(qty > 0)) throw new RangeError('qty must be > 0')
  return K + (margin + vault) / qty
}
