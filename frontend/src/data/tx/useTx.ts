// The one transaction hook, for Covered and Margin. A component gets the staged state for its Sign step and a
// `run` that never rejects; the Activity list, the cache invalidation and the announcements happen in the runner.
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { OptionsClient } from '../../core/options/client'
import { TX_IDLE, canCheckAgain, canStart, isWorking, reduce } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import type { TxCheck, TxOptions, TxReceipt } from '../../core/tx/types'
import { announce } from '../../ui/announce'
import { toast } from '../../ui/toastStore'
import { keys } from '../keys'
import { useOptionsClient } from '../useOptionsClient'
import { activityStore, entryState } from './activityStore'
import type { ActivityProduct } from './activityStore'
import { TX_NOT_CONNECTED } from './copy'
import { flights } from './flights'
import { keysAfterMargin, keysToInvalidate, subjectIds } from './invalidation'
import { STOP_WAITING_AFTER_MS, checkEntry, refusedState, runTransaction, signingSince, stopWaiting } from './runner'
import type { RunnerDeps, TxMeta, TxRun } from './runner'

/** Looks a hash up on the RPC directly (Margin has no `checkTx` of its own). The SDK loads on demand. */
async function checkOnRpc(hash: string, maxTime: number | null): Promise<TxCheck> {
  const [{ checkTransaction }, { server }] = await Promise.all([import('../../core/stellar/signer'), import('../../core/stellar/rpc')])
  const r = await checkTransaction(server, hash, maxTime)
  if (r.status === 'confirmed') return { status: 'confirmed', ledger: r.ledger }
  if (r.status === 'failed') return { status: 'failed', message: r.message }
  return { status: r.status }
}

/** The runner wired to this app's cache, client, Activity store and live regions. */
export function makeRunnerDeps(queryClient: QueryClient, getClient: () => Promise<OptionsClient>): RunnerDeps {
  return {
    activity: activityStore,
    flights,
    onSettled(meta) {
      const stale = meta.product === 'margin' ? keysAfterMargin(keys) : keysToInvalidate(keys, meta.action, subjectIds(meta.subject))
      // Not awaited: the outcome of the transaction never depends on the reads that follow it.
      for (const queryKey of stale) void queryClient.invalidateQueries({ queryKey })
    },
    checkTx: async (meta, hash, maxTime) => (meta.product === 'covered' ? (await getClient()).checkTx(hash, maxTime) : meta.mock ? { status: 'unknown' } : checkOnRpc(hash, maxTime)),
    announce,
    notify: (n) => void toast({ title: n.title, description: n.description, tone: n.tone }),
  }
}

/** The runner dependencies of the app, stable for the lifetime of the providers. */
export function useRunnerDeps(): RunnerDeps {
  const queryClient = useQueryClient()
  const { getClient } = useOptionsClient()
  return useMemo(() => makeRunnerDeps(queryClient, getClient), [queryClient, getClient])
}

export interface UseTxOptions {
  /** `covered` (default) or `margin`. Decides what a confirmation invalidates and how a hash is looked up. */
  product?: ActivityProduct
  /** The account the transactions are made as. Default: the connected wallet. Margin passes its party. */
  address?: string | null
  /** Mock client or fixtures. Default: the Covered client's mode. */
  mock?: boolean
  /** Set false when the caller announces the phases itself. Default true. */
  announce?: boolean
  /** Set false for a product that needs no wallet (Margin fixtures). Default true: a write without a wallet is refused. */
  needsWallet?: boolean
  /**
   * Whether the screen that shows this transaction's progress is open (a dialog that stays mounted while closed
   * passes its `open`). A run that ends while it is closed, or after the owner unmounted, is told in a toast
   * (finding 41). Default true.
   */
  open?: boolean
}

/** What a transaction is, for Activity, the announcements and the invalidation. A bare string is the label. */
export interface TxDescription {
  label: string
  /** The terms behind the label, for the second line of its Activity entry. */
  detail?: string | null
  /** Machine name (`buy`, `exercise`, `deposit`...). Default `other`, which invalidates every Covered read. */
  action?: string
  /** Past-tense word for a confirmed outcome. */
  done?: string
  /** `option:<id>` or `bid:<id>` (see `optionSubject`, `bidSubject`), or any string for Margin. */
  subject?: string | null
}

export interface TxController {
  /** The staged state: idle, checking, signing, submitting, pending, then confirmed, failed, unknown, expired or declined. */
  state: TxState
  /**
   * Runs a client write: `run('Buy put on 5.00 BOND', (opts) => client.buy(id, me, opts))`. Never rejects.
   * Refused without sending when no wallet is connected, when the wallet is on another network, when another
   * transaction is in flight, or while this controller's last transaction is still unknown.
   */
  run: <T extends TxReceipt>(what: string | TxDescription, write: (opts: Required<TxOptions>) => Promise<T>, created?: (result: T) => string | null) => Promise<TxRun<T>>
  /** Looks an unknown outcome up again. Resolves with the state after the look. */
  checkAgain: () => Promise<TxState>
  /** Back to idle. Ignored while in flight or unknown. */
  reset: () => void
  /** In flight: checking, signing, submitting or pending. */
  working: boolean
  /** A new transaction may be started from this controller. */
  canStart: boolean
  /** The outcome is unknown and can be looked up. */
  canCheckAgain: boolean
  /** What the running or last transaction acts on. */
  subject: string | null
  /** Its Activity entry, once it reached the network. */
  entryId: string | null
  /**
   * Epoch ms since which the running transaction waits for the wallet's signature, or null. From
   * `STOP_WAITING_AFTER_MS` after it, a screen offers "Stop waiting" (review finding 42).
   */
  signingSince: number | null
  /** Stops waiting for a wallet that does not answer: the run ends declined, nothing was signed or sent. */
  stopWaiting: () => boolean
}

export { STOP_WAITING_AFTER_MS }

interface Local {
  state: TxState
  entryId: string | null
  subject: string | null
  address: string | null
}

const START: Local = { state: TX_IDLE, entryId: null, subject: null, address: null }

export function useTx(options: UseTxOptions = {}): TxController {
  const deps = useRunnerDeps()
  const { me, isMock, wrongNetwork } = useOptionsClient()
  const product = options.product ?? 'covered'
  const address = options.address === undefined ? me : options.address
  const mock = options.mock ?? isMock
  const speak = options.announce ?? true
  const needsWallet = options.needsWallet ?? true
  // A wallet on another network would sign for that network: the transaction could only fail. Refuse it first.
  const networkBlock = needsWallet && !mock ? wrongNetwork : null

  const [local, setLocal] = useState<Local>(START)
  // The Activity entry of the run in progress (the local entryId is set only once a run ends): state for the
  // render, a ref for the callback.
  const runningEntry = useRef<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  // Whether the screen that owns this controller is still mounted: a run that ends after it closed is told in a toast.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const shown = useRef(options.open ?? true)
  useEffect(() => {
    shown.current = options.open ?? true
  }, [options.open])
  const isMounted = useCallback(() => mounted.current && shown.current, [])
  // The latest values, for callbacks that outlive a render (a run in progress, a timer).
  const latest = useRef<{ local: Local; meta: TxMeta | null }>({ local: START, meta: null })
  const update = useCallback((patch: Partial<Local>) => {
    latest.current.local = { ...latest.current.local, ...patch }
    setLocal(latest.current.local)
  }, [])

  // After a run ended unknown, its Activity entry can be resolved from elsewhere (the Activity page, the timer).
  const watching = local.state.phase === 'unknown' && local.entryId !== null
  const getEntry = useCallback(() => (watching ? deps.activity.get(local.address, local.entryId!) : undefined), [deps, watching, local.address, local.entryId])
  const entry = useSyncExternalStore(deps.activity.subscribe, getEntry, getEntry)
  const state = useMemo(() => (entry && entry.phase !== 'unknown' ? entryState(entry) : local.state), [entry, local.state])

  // The state as the store has it now: an unknown outcome may have been resolved since the last render.
  const settle = useCallback((): Local => {
    const current = latest.current.local
    if (current.state.phase !== 'unknown' || !current.entryId) return current
    const stored = deps.activity.get(current.address, current.entryId)
    if (stored && stored.phase !== 'unknown') update({ state: entryState(stored) })
    return latest.current.local
  }, [deps, update])

  const run = useCallback(
    async <T extends TxReceipt>(what: string | TxDescription, write: (opts: Required<TxOptions>) => Promise<T>, created?: (result: T) => string | null): Promise<TxRun<T>> => {
      const d: TxDescription = typeof what === 'string' ? { label: what } : what
      const meta: TxMeta = { product, action: d.action ?? 'other', label: d.label, detail: d.detail ?? null, done: d.done ?? null, subject: d.subject ?? null, address, mock }
      const current = settle()
      if (!canStart(current.state)) return { state: current.state, result: null, entryId: current.entryId }
      const block = needsWallet && !address ? TX_NOT_CONNECTED : networkBlock
      if (block) {
        const refused = refusedState(block)
        update({ state: refused, entryId: null, subject: meta.subject ?? null, address })
        return { state: refused, result: null, entryId: null }
      }
      latest.current.meta = meta
      update({ state: TX_IDLE, entryId: null, subject: meta.subject ?? null, address })
      const done = await runTransaction(deps, meta, write, {
        announce: speak,
        onState: (s) => update({ state: s }),
        created,
        isMounted,
        onEntry: (id) => {
          runningEntry.current = id
          setRunning(id)
        },
      })
      runningEntry.current = null
      setRunning(null)
      update({ state: done.state, entryId: done.entryId })
      return done
    },
    [deps, product, address, mock, speak, needsWallet, networkBlock, update, settle, isMounted],
  )

  const checkAgain = useCallback(async (): Promise<TxState> => {
    const current = settle()
    const meta = latest.current.meta
    if (!meta || !current.entryId || !canCheckAgain(current.state)) return current.state
    const next = await checkEntry(deps, meta, current.entryId, { announce: speak, onState: (s) => update({ state: s }), isMounted })
    return next ?? latest.current.local.state
  }, [deps, speak, update, settle, isMounted])

  const reset = useCallback(() => {
    const current = settle()
    const next = reduce(current.state, { type: 'reset' })
    if (next !== current.state) update({ state: next, entryId: null, subject: null })
  }, [update, settle])

  const stop = useCallback(() => (runningEntry.current ? stopWaiting(runningEntry.current) : false), [])
  const since = state.phase === 'signing' && running ? signingSince(running) : null

  return {
    state,
    run,
    checkAgain,
    reset,
    signingSince: since,
    stopWaiting: stop,
    working: isWorking(state),
    canStart: canStart(state),
    canCheckAgain: canCheckAgain(state) && local.entryId !== null,
    subject: local.subject,
    entryId: local.entryId,
  }
}

/** True while any transaction started on this page is in flight. Disable action buttons with it. */
export function useTxBusy(): boolean {
  return useSyncExternalStore(flights.subscribe, flights.count, flights.count) > 0
}

/** True while a transaction on this subject (`optionSubject(id)`, `bidSubject(id)`) is in flight: the row shows progress. */
export function useSubjectBusy(subject: string | null | undefined): boolean {
  const read = useCallback(() => flights.has(subject), [subject])
  return useSyncExternalStore(flights.subscribe, read, read)
}
