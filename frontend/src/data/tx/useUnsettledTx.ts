// The wallet's transaction whose outcome is unknown and can still land: every screen that can start another one
// says so before the press (late finding errors-edge 1), with the same rule the runner enforces at the press
// (`unsettledEntry` in ./runner).
import { useMemo } from 'react'
import { formatUtcClock } from '../../core/format/time'
import { useNowSec } from '../clock'
import type { ActivityEntry, ActivityProduct } from './activityStore'
import { txUnsettledMessage } from './copy'
import { useActivity } from './useActivity'

export interface UnsettledTx {
  entry: ActivityEntry
  /** What it acts on (`option:12`, `bid:3`), or null for a new offer or request. */
  subject: string | null
  /** `13:45:12 UTC`. */
  sentAt: string
  /** Until when it can still be included: `13:46:12 UTC`. */
  until: string
  /** The sentence for a disabled action or a callout: "A transaction sent at ... Check it in Activity before you send another." */
  reason: string
  /** Looks it up again. */
  check: () => void
}

/**
 * The connected wallet's latest transaction (of `product`, Covered by default) whose outcome is unknown and whose
 * time bound has not passed, or null. While it is not null, another write of the same account is refused.
 */
export function useUnsettledTx(product: ActivityProduct = 'covered'): UnsettledTx | null {
  const activity = useActivity()
  const nowSec = useNowSec(5)
  const { entries, check } = activity
  return useMemo(() => {
    const open = entries.find((e) => e.product === product && e.phase === 'unknown' && e.hash !== null && e.maxTime !== null && e.maxTime > nowSec)
    if (!open || open.maxTime === null) return null
    const sentAt = formatUtcClock(Math.floor(open.startedAt / 1000))
    const until = formatUtcClock(open.maxTime)
    return { entry: open, subject: open.subject, sentAt, until, reason: txUnsettledMessage(sentAt, until), check: () => void check(open.id) }
  }, [entries, check, nowSec, product])
}
