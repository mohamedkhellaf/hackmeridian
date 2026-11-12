import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { ProCall } from '../../../data'
import type { CallResult, ReplayedStep } from '../../../core/pro/types'

/** One line of what a call returned: the takeover price, what a claim paid, the deficit. */
export interface ResultFact {
  label: string
  /** An exact USDx amount, or text. */
  value: bigint | string
  /** A shortfall, debt or deficit above zero. */
  loss?: boolean
  /** A second figure of the same thing (the time left under a deadline). */
  hint?: string
}

/** Who paid a holder, from the amounts a settle or claim call returned. Drawn as the payout waterfall. */
export interface ResultSplit {
  /** "Owed 30,000.00 USDx" is built from it. */
  due: bigint
  /** In payment order. A `deficit` part is what nobody paid: hatched. */
  parts: { id: string; label: string; value: bigint; kind?: 'deficit' }[]
}

/** What the result region shows after a call that went through: a receipt. */
export interface ResultView {
  facts: ResultFact[]
  split?: ResultSplit
  /** The way on: the screen where what the call made can be followed. */
  next?: { label: string; to: string }
}

export interface MarginUi {
  /**
   * Runs a Margin call through the shared transaction layer, keeps what it returned for the result region and
   * moves focus there. `describe` turns the call's value into the receipt shown under the confirmation. On
   * fixtures it also gets the replayed step: a receipt takes its amounts from the step's arguments, never from
   * what a form held.
   */
  act: <T>(what: { label: string; done: string }, call: ProCall<T>, describe?: (value: T, step: ReplayedStep | null) => ResultView) => Promise<CallResult<T>>
  /** What the last call returned, when it has more to say than "done". */
  result: ResultView | null
  /** The result region: focus is sent here when a call starts and when it ends. */
  resultRef: RefObject<HTMLElement | null>
  /** False on the Testnet contract without a wallet: writes are replaced by "Connect wallet". */
  canAct: boolean
  connect: () => void
}

export const MarginUiCtx = createContext<MarginUi | null>(null)

export function useMarginUi(): MarginUi {
  const value = useContext(MarginUiCtx)
  if (!value) throw new Error('useMarginUi outside MarginUiProvider')
  return value
}
