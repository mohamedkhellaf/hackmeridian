// When an action of the portfolio waits, and why. An earlier transaction of the wallet whose outcome is unknown and
// can still land (`useUnsettledTx`) stands in place of the action of what it acts on, and makes every other action
// wait with its sentence as the reason; the runner would refuse a new one anyway.
import type { UnsettledTx } from '../../data'
import { BUSY_REASON } from './copy'

/** The unsettled transaction when it acts on `subject` (`option:12`, `bid:3`), else null. */
export const unsettledOn = (unsettled: UnsettledTx | null | undefined, subject: string): UnsettledTx | null =>
  unsettled && unsettled.subject === subject ? unsettled : null

/**
 * Whether an action button waits, and why: an earlier transaction of the wallet has an unknown outcome, or another
 * one is in flight. `working` is this button's own transaction, which keeps it enabled (it shows its spinner).
 */
export function waitReason(busy: boolean, working: boolean, unsettled: UnsettledTx | null | undefined): { disabled: boolean; reason: string } {
  if (unsettled) return { disabled: true, reason: unsettled.reason }
  return { disabled: busy && !working, reason: BUSY_REASON }
}
