import { createContext, useContext } from 'react'
import type { FixtureProClient } from '../../core/pro/FixtureProClient'
import type { SorobanProClient } from '../../core/pro/SorobanProClient'
import { proFailureText } from '../../core/pro/tx'
import type { CallResult, Party, ProClient, ProModel } from '../../core/pro/types'
import type { TxState } from '../../core/tx/machine'
import type { TxOptions } from '../../core/tx/types'

/** The result of the last Margin call, for the result banner. */
export interface Outcome {
  label: string
  ok: boolean
  /** Plain message for a refusal, or a short confirmation. */
  text: string
  /** Contract error code (201 to 226) of a refusal, else null. */
  code: number | null
  /** Contract error name of a refusal (`LiquidateFirst`), else null. Shown as `Name (code)`. */
  name: string | null
  /** Fixtures: which scripted step was replayed. */
  note: string | null
}

/** A Margin call: one already started (the old form), or a function that takes `{ onStage }` and starts it. */
export type ProCall<T> = Promise<CallResult<T>> | ((opts: TxOptions) => Promise<CallResult<T>>)

export interface ProCtxValue {
  client: ProClient
  /** Present while running on fixtures: scenario, step and party controls of the "Simulation" card. */
  sim: FixtureProClient | null
  /** Present on the live contract: `getStatus()`, `refresh()`. */
  live: SorobanProClient | null
  /** True on fixtures: every Margin screen says "simulated, not on-chain". */
  simulated: boolean
  model: ProModel
  /** The account acted as: a fixture party while simulated, the wallet address on chain ('' when not connected). */
  me: Party
  setMe: (p: Party) => void
  outcome: Outcome | null
  clearOutcome: () => void
  /**
   * Runs a client call and records its outcome for the result banner. Pass a function to get the staged states
   * in `tx` while it runs: `run('Deposit', (opts) => client.deposit(me, amount, opts), 'Deposited.')`. A promise
   * that is already running (the old form) is accepted too. Resolves with the call's own `CallResult`.
   */
  run: <T>(label: string, call: ProCall<T>, okText?: string) => Promise<CallResult<T>>
  /** The staged state of the running or last call, from the same machine as Covered. */
  tx: TxState
  /** A call is in flight. */
  busy: boolean
}

export const ProCtx = createContext<ProCtxValue | null>(null)

export function usePro(): ProCtxValue {
  const c = useContext(ProCtx)
  if (!c) throw new Error('usePro outside ProProvider')
  return c
}

/** A call result as the banner shows it. The mapping the Margin screens have always used. */
export function outcomeOf<T>(label: string, r: CallResult<T>, okText: string): Outcome {
  if (r.ok) return { label, ok: true, text: okText, code: null, name: null, note: r.note ?? null }
  return {
    label,
    ok: false,
    // code 0: no scripted step (fixtures); code < 0: not a contract refusal (wallet, network), the note says why.
    text: proFailureText(r),
    code: r.code <= 0 ? null : r.code,
    name: r.code < 0 ? null : r.name,
    note: r.code < 0 ? null : (r.note ?? null),
  }
}

/** The result of a call the transaction layer refused to start (another one is in flight, or no wallet). */
export function notStarted<T>(message: string): CallResult<T> {
  return { ok: false, code: -1, name: '', note: message, kind: 'refused' }
}
