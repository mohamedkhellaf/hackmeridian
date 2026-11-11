import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CallResult } from '../../../core/pro/types'
import { usePro } from '../../../data'
import type { ProCall } from '../../../data'
import { useWallet } from '../../../wallet'
import { MarginUiCtx } from './marginUi'
import type { MarginUi, ResultView } from './marginUi'

/** Wraps the Margin screens: one way to run a call, one place where its result is shown. */
export function MarginUiProvider({ children }: { children: ReactNode }) {
  const { run, simulated, me } = usePro()
  const wallet = useWallet()
  const [result, setResult] = useState<ResultView | null>(null)
  const resultRef = useRef<HTMLElement | null>(null)

  // Focus goes to the result region when a call starts: progress shows there, and the button that was pressed
  // is disabled while the call runs. A confirmation that went ahead does not return focus to its opener (the
  // kit's `finalFocus={false}`), but it keeps focus until its exit has ended, so the move is tried on the next
  // frame and once more after the exit, and stops as soon as it has landed. When the call ends, focus is only
  // brought back if it was lost; it is never taken from where the user has gone.
  const focusResult = useCallback((force: boolean): boolean => {
    const region = resultRef.current
    const active = document.activeElement
    if (!region) return true
    if (active && region.contains(active)) return true
    if (active instanceof HTMLElement && active.closest('[role="dialog"], [role="alertdialog"]')) return false
    if (!force && active && active !== document.body) return true
    region.focus()
    return true
  }, [])
  const sendFocus = useCallback(
    (force: boolean) => {
      let landed = false
      const attempt = () => {
        if (!landed) landed = focusResult(force)
      }
      requestAnimationFrame(attempt)
      window.setTimeout(attempt, 280)
    },
    [focusResult],
  )

  const act = useCallback(
    async <T,>(what: { label: string; done: string }, call: ProCall<T>, describe?: (value: T) => ResultView): Promise<CallResult<T>> => {
      setResult(null)
      sendFocus(true)
      const out = await run(what.label, call, what.done)
      setResult(out.ok && describe ? describe(out.value) : null)
      sendFocus(false)
      return out
    },
    [run, sendFocus],
  )

  const connect = wallet.connect
  const value = useMemo<MarginUi>(
    () => ({ act, result, resultRef, canAct: simulated || me !== '', connect: () => void connect() }),
    [act, result, simulated, me, connect],
  )
  return <MarginUiCtx.Provider value={value}>{children}</MarginUiCtx.Provider>
}
