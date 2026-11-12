import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { FixtureProClient } from '../../core/pro/FixtureProClient'
import type { SorobanProClient } from '../../core/pro/SorobanProClient'
import { proReceipt } from '../../core/pro/tx'
import type { CallResult, Party, ProClient } from '../../core/pro/types'
import { isWorking } from '../../core/tx/machine'
import { useTx } from '../tx/useTx'
import { ProCtx, notStarted, outcomeOf } from './proCtx'
import type { Outcome, ProCall, ProCtxValue } from './proCtx'
import { useProClient } from './useProClient'
import type { ProClientState } from './useProClient'

export interface ProProviderProps {
  client: ProClient
  /** The fixture client while simulated, else null. */
  sim: FixtureProClient | null
  /** The live client on chain, else null. */
  live?: SorobanProClient | null
  /** The account acted as at first: a fixture party, or the wallet address. Remount (`key={me}`) when it changes. */
  defaultMe: Party
  children: ReactNode
}

/**
 * Margin state for the screens under it: the client, its model, the acting account, and `run`, which sends
 * every call through the shared transaction layer (stages, Activity, announcements) and keeps the result banner.
 */
export function ProProvider({ client, sim, live = null, defaultMe, children }: ProProviderProps) {
  const subscribe = useMemo(() => client.subscribe.bind(client), [client])
  const getModel = useCallback(() => client.getModel(), [client])
  const model = useSyncExternalStore(subscribe, getModel, getModel)
  const [me, setMe] = useState<Party>(defaultMe)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const simulated = sim !== null
  // Fixtures need no wallet and send nothing; on chain the wallet address is the account.
  const tx = useTx({ product: 'margin', address: me || null, mock: simulated, needsWallet: !simulated })
  const runTx = tx.run

  const run = useCallback(
    async <T,>(label: string, call: ProCall<T>, okText = 'Done.'): Promise<CallResult<T>> => {
      const started = typeof call === 'function' ? null : call
      let seen: CallResult<T> | null = null
      const done = await runTx({ label, action: 'margin', done: okText.replace(/\.$/, '') }, (opts) =>
        proReceipt(
          (started ?? (call as (o: typeof opts) => Promise<CallResult<T>>)(opts)).then((r) => {
            seen = r
            return r
          }),
        ),
      )
      // The layer refused to start it (another call in flight, no wallet). A call that was already running
      // still has an outcome of its own; one that was never started reports the refusal.
      const result: CallResult<T> = seen ?? (started ? await started : notStarted<T>(done.state.error ?? 'The transaction failed.'))
      setOutcome(outcomeOf(label, result, okText))
      return result
    },
    [runTx],
  )

  const clearOutcome = useCallback(() => setOutcome(null), [])
  const value = useMemo<ProCtxValue>(
    () => ({ client, sim, live, simulated, model, me, setMe, outcome, clearOutcome, run, tx: tx.state, busy: isWorking(tx.state), canCheckAgain: tx.canCheckAgain, checkAgain: tx.checkAgain }),
    [client, sim, live, simulated, model, me, outcome, clearOutcome, run, tx.state, tx.canCheckAgain, tx.checkAgain],
  )
  return <ProCtx.Provider value={value}>{children}</ProCtx.Provider>
}

export interface ProLoaderProps {
  children: ReactNode
  /** Shown while the Margin client loads (the fixture file or the live client). */
  loading?: ReactNode
  /** Shown when it could not be loaded. */
  error?: (message: string, retry: () => void) => ReactNode
  /** Rendered above the screens with the client state (live read failures, the wallet prompt). */
  status?: (state: ProClientState) => ReactNode
}

/**
 * Loads the Margin client for this build (fixtures or the live contract, both lazily) and provides it.
 * The Margin route renders `<ProLoader>` around its screens; everything under it can call `usePro()`.
 */
export function ProLoader({ children, loading = null, error, status }: ProLoaderProps) {
  const state = useProClient()
  if (!state.handle) return <>{state.error !== null && error ? error(state.error, state.retry) : loading}</>
  const { client, sim, live } = state.handle
  return (
    <ProProvider key={state.me} client={client} sim={sim} live={live} defaultMe={state.me}>
      {status?.(state)}
      {children}
    </ProProvider>
  )
}
