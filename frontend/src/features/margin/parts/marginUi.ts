import { createContext, useContext } from 'react'
import type { RefObject } from 'react'
import type { ProCall } from '../../../data'
import type { CallResult } from '../../../core/pro/types'

/** One line of what a call returned: the takeover price, what a claim paid, the deficit. */
export interface ResultFact {
  label: string
  /** An exact USDx amount, or text. */
  value: bigint | string
  /** A shortfall, debt or deficit above zero. */
  loss?: boolean
}

export interface MarginUi {
  /**
   * Runs a Margin call through the shared transaction layer, keeps what it returned for the result region and
   * moves focus there. `describe` turns the call's value into the lines shown under the confirmation.
   */
  act: <T>(what: { label: string; done: string }, call: ProCall<T>, describe?: (value: T) => ResultFact[]) => Promise<CallResult<T>>
  /** What the last call returned, when it has more to say than "done". */
  facts: ResultFact[] | null
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
