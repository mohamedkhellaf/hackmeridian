import { createContext, useContext } from 'react'
import type { FixtureProClient } from './FixtureProClient'
import type { CallResult, Party, ProClient, ProModel } from './types'

export interface Outcome {
  label: string
  ok: boolean
  /** Plain message for a refusal, or a short confirmation. */
  text: string
  code: number | null
  name: string | null
  note: string | null
}

export interface ProCtxValue {
  client: ProClient
  /** Present while running on fixtures. */
  sim: FixtureProClient | null
  model: ProModel
  me: Party
  setMe: (p: Party) => void
  outcome: Outcome | null
  clearOutcome: () => void
  /** Runs a client call and records its outcome for the result banner. */
  run: <T>(label: string, call: Promise<CallResult<T>>, okText?: string) => Promise<CallResult<T>>
}

export const ProCtx = createContext<ProCtxValue | null>(null)

export function usePro(): ProCtxValue {
  const c = useContext(ProCtx)
  if (!c) throw new Error('usePro outside ProProvider')
  return c
}
