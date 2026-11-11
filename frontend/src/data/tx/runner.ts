// Runs one write through the transaction machine of core/tx, for Covered and Margin alike. Framework-free: the
// hook in ./useTx.ts only binds it to React state. What the runner adds to `runMachine`:
//
//   - one transaction at a time on this page (a wallet signs one at a time; an account sequence admits one);
//   - every run is recorded in the Activity store, phase by phase, and keeps being recorded if the component
//     that started it unmounts (the user walked away from the ticket);
//   - an attempt that sent nothing (declined in the wallet, refused by a check or the simulation) is taken out
//     of Activity again: there is no transaction to show;
//   - when the outcome is final and something may have changed on chain, `onSettled` runs (cache invalidation);
//   - an unknown outcome is looked up again on a timer and can be looked up by hand (`checkEntry`). It is never
//     re-sent: the first transaction can still be included until a ledger closes after its time bound.
import { TxError } from '../../core/tx/errors'
import { TX_IDLE, reduce, runMachine } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import type { TxCheck, TxOptions, TxReceipt } from '../../core/tx/types'
import { entryState } from './activityStore'
import type { ActivityProduct, ActivityStore } from './activityStore'
import { TX_BUSY_MESSAGE, announcementFor } from './copy'
import type { Flights } from './flights'

/** How often an unknown outcome is looked up again, and how many times before it is left to the user. */
export const AUTO_CHECK_MS = 10_000
export const AUTO_CHECK_ATTEMPTS = 30

export interface TxMeta {
  product: ActivityProduct
  /** Machine name of the action (`buy`, `exercise`, `deposit`...). Decides what is invalidated. */
  action: string
  /** What it is, with figures: "Buy put on 5.00 BOND". Shown in Activity and announced. */
  label: string
  /** Past-tense word for a confirmed outcome: "Bought". */
  done?: string | null
  /** What it acts on: `option:12`, `bid:3`. Lets a row show its own progress. */
  subject?: string | null
  /** The wallet (or Margin party) it is made as. */
  address: string | null
  /** Mock client or fixtures: nothing is persisted and hashes have no explorer page. */
  mock: boolean
}

export interface TxRun<T> {
  /** The state the run ended in: confirmed, failed, declined, unknown or expired. */
  state: TxState
  /** The write's own result when confirmed, else null. */
  result: T | null
  /** The Activity entry of the run, or null when it was refused before starting or removed (nothing sent). */
  entryId: string | null
}

export interface RunnerDeps {
  activity: ActivityStore
  flights: Flights
  /** Called once the outcome is final and a transaction may have been included: invalidate what it changed. */
  onSettled: (meta: TxMeta, state: TxState) => void
  /** Looks a transaction up again (`OptionsClient.checkTx` or the RPC). */
  checkTx: (meta: TxMeta, hash: string, maxTime: number | null) => Promise<TxCheck>
  /** Screen-reader announcements; omit to stay silent. */
  announce?: (message: string, politeness: 'polite' | 'assertive') => void
  /** Timer for the automatic re-check; returns a cancel function. Defaults to `setTimeout`. */
  schedule?: (fn: () => void, ms: number) => () => void
  autoCheck?: boolean
}

export interface RunOptions {
  /** Receives every state of the run, including a later resolution of an unknown outcome. */
  onState?: (state: TxState) => void
  /** Set false to skip the announcements of this run. */
  announce?: boolean
}

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
  const t = setTimeout(fn, ms)
  return () => clearTimeout(t)
}

/** Nothing reached the network: the attempt is not a transaction. */
export const sentNothing = (s: TxState): boolean => s.phase === 'declined' || (s.phase === 'failed' && s.effect === 'nothing-sent')

/** A ledger may have included something: cached reads can be stale. */
export const mayHaveChanged = (s: TxState): boolean => s.phase === 'confirmed' || (s.phase === 'failed' && s.effect === 'fee-charged')

/** The state of an attempt refused before it started. */
export function refusedState(message: string): TxState {
  return reduce(reduce(TX_IDLE, { type: 'start' }), { type: 'error', error: new TxError('refused', message) })
}

function speak(deps: RunnerDeps, meta: TxMeta, state: TxState, on: boolean): void {
  if (!on || !deps.announce) return
  const a = announcementFor(meta.label, state, meta.done)
  if (a) deps.announce(a.message, a.politeness)
}

/**
 * Looks an unknown transaction up again and writes the answer to its Activity entry. Resolves with the new
 * state (still `unknown` when the network has no answer yet), or null when the entry cannot be checked.
 */
export async function checkEntry(deps: RunnerDeps, meta: Pick<TxMeta, 'address' | 'product' | 'action' | 'label' | 'done' | 'subject' | 'mock'>, entryId: string, opts: RunOptions = {}): Promise<TxState | null> {
  const entry = deps.activity.get(meta.address, entryId)
  if (!entry || entry.phase !== 'unknown' || !entry.hash) return entry ? entryState(entry) : null
  let check: TxCheck
  try {
    check = await deps.checkTx(meta, entry.hash, entry.maxTime)
  } catch {
    check = { status: 'unknown' }
  }
  // The entry may have been resolved (by the timer, by another tab) while the lookup was running.
  const current = deps.activity.get(meta.address, entryId)
  if (!current) return null
  const before = entryState(current)
  const next = reduce(before, { type: 'resolve', check })
  if (next === before) return before
  deps.activity.apply(meta.address, entryId, next)
  opts.onState?.(next)
  speak(deps, meta, next, opts.announce ?? true)
  if (mayHaveChanged(next)) deps.onSettled(meta, next)
  return next
}

function watchUnknown(deps: RunnerDeps, meta: TxMeta, entryId: string, opts: RunOptions): void {
  if (deps.autoCheck === false) return
  const schedule = deps.schedule ?? defaultSchedule
  let attempts = 0
  const tick = () => {
    void checkEntry(deps, meta, entryId, opts).then((state) => {
      if (state?.phase === 'unknown' && ++attempts < AUTO_CHECK_ATTEMPTS) schedule(tick, AUTO_CHECK_MS)
    })
  }
  schedule(tick, AUTO_CHECK_MS)
}

/**
 * Runs `write` (a client call that takes `{ onStage }`) through the machine. Never rejects.
 * `meta.label` is announced with each phase unless `opts.announce` is false.
 */
export async function runTransaction<T extends TxReceipt>(deps: RunnerDeps, meta: TxMeta, write: (opts: Required<TxOptions>) => Promise<T>, opts: RunOptions = {}): Promise<TxRun<T>> {
  const announce = opts.announce ?? true
  if (deps.flights.count() > 0) {
    const state = refusedState(TX_BUSY_MESSAGE)
    opts.onState?.(state)
    speak(deps, meta, state, announce)
    return { state, result: null, entryId: null }
  }
  const entry = deps.activity.begin(meta)
  deps.flights.enter(entry.id, meta.subject ?? null)
  let run: { state: TxState; result: T | null }
  try {
    run = await runMachine<T>(write, (state) => {
      deps.activity.apply(meta.address, entry.id, state)
      opts.onState?.(state)
      speak(deps, meta, state, announce)
    })
  } finally {
    deps.flights.leave(entry.id)
  }
  const { state, result } = run
  if (sentNothing(state)) {
    deps.activity.remove(meta.address, entry.id)
    return { state, result, entryId: null }
  }
  if (mayHaveChanged(state)) deps.onSettled(meta, state)
  if (state.phase === 'unknown' && state.hash) watchUnknown(deps, meta, entry.id, opts)
  return { state, result, entryId: entry.id }
}
