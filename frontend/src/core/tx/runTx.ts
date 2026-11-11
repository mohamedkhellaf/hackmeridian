import type { Notice } from '../ui'

export type TxOutcome = { ok: true; hash: string; mock: boolean } | { ok: false; error: string }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Runs one transaction, then refreshes app state. The outcome is decided by the transaction alone: a failed
 * post-transaction read never turns a confirmed transaction into a failure (it is reported as a notice instead),
 * and never rejects, so a dialog awaiting the outcome cannot get stuck.
 */
export async function runTx(
  label: string,
  mock: boolean,
  fn: () => Promise<{ hash: string }>,
  hooks: { setNotice: (n: Notice | null) => void; refresh: () => Promise<unknown>; onSuccess?: () => void },
): Promise<TxOutcome> {
  hooks.setNotice(null)
  let outcome: TxOutcome
  try {
    const { hash } = await fn()
    outcome = { ok: true, hash, mock }
    hooks.setNotice({ kind: 'ok', text: label, hash, mock })
  } catch (e) {
    outcome = { ok: false, error: messageOf(e) }
    hooks.setNotice({ kind: 'err', text: outcome.error })
  }
  try {
    await hooks.refresh()
  } catch (e) {
    if (outcome.ok)
      hooks.setNotice({
        kind: 'err',
        text: `${label}: confirmed (tx ${outcome.hash.slice(0, 12)}…), but reloading data failed: ${messageOf(e)} Refresh the page to see the latest state.`,
      })
  }
  if (outcome.ok) hooks.onSuccess?.()
  return outcome
}
