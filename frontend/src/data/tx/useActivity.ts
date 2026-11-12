// The Activity list of a wallet, for the Activity page and the wallet menu.
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { TxState } from '../../core/tx/machine'
import { useOptionsClient } from '../useOptionsClient'
import { canCheckEntry, isOpenEntry } from './activityStore'
import type { ActivityEntry } from './activityStore'
import { checkEntry, signingSince, stopWaiting } from './runner'
import { useRunnerDeps } from './useTx'

export interface ActivityView {
  /** Newest first. Transactions made from this browser as this address; mock and fixture ones last until a reload. */
  entries: readonly ActivityEntry[]
  /** Entries in flight (checking, signing, submitting, pending). */
  inFlight: number
  /** Entries whose outcome is unknown: each can be checked again, never re-sent. */
  unknown: number
  /** Looks an unknown entry up again. Resolves with its state after the look, or null when it cannot be checked. */
  check: (id: string) => Promise<TxState | null>
  /** Takes one entry off the list. */
  remove: (id: string) => void
  /** Takes every settled entry off the list. In-flight and unknown entries stay. */
  clearSettled: () => void
  /** Puts entries taken off the list back (Undo): `const gone = entries.filter(...); clearSettled(); restore(gone)`. */
  restore: (entries: readonly ActivityEntry[]) => void
  /** Epoch ms since which this page's run of the entry waits for a signature, or null (finding 42). */
  signingSince: (id: string) => number | null
  /** Stops waiting for a wallet that does not answer; nothing was signed, so the entry goes. */
  stopWaiting: (id: string) => boolean
}

/** The Activity list of `address` (default: the connected wallet; a guest sees the guest list). */
export function useActivity(address?: string | null): ActivityView {
  const deps = useRunnerDeps()
  const { me } = useOptionsClient()
  const who = address === undefined ? me : address
  const { activity } = deps
  const read = useCallback(() => activity.list(who), [activity, who])
  const entries = useSyncExternalStore(activity.subscribe, read, read)
  const check = useCallback(
    async (id: string) => {
      const e = activity.get(who, id)
      if (!e || !canCheckEntry(e)) return null
      return checkEntry(deps, { address: who, product: e.product, action: e.action, label: e.label, detail: e.detail, done: e.done, subject: e.subject, mock: e.mock }, id)
    },
    [deps, activity, who],
  )
  const remove = useCallback((id: string) => activity.remove(who, id), [activity, who])
  const clearSettled = useCallback(() => activity.clearSettled(who), [activity, who])
  const restore = useCallback((back: readonly ActivityEntry[]) => activity.restore(who, back), [activity, who])
  return useMemo(
    () => ({
      entries,
      inFlight: entries.filter((e) => isOpenEntry(e) && e.phase !== 'unknown').length,
      unknown: entries.filter((e) => e.phase === 'unknown').length,
      check,
      remove,
      clearSettled,
      restore,
      signingSince,
      stopWaiting,
    }),
    [entries, check, remove, clearSettled, restore],
  )
}
