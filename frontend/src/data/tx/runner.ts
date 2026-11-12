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
//     re-sent: the first transaction can still be included until a ledger closes after its time bound. The rule
//     holds across components and reloads: a new write by the same account is refused while such an entry is in
//     Activity (looked up once more first), and `resumeUnknown` restarts the timer for entries found in storage.
import { TxError } from '../../core/tx/errors'
import { TX_IDLE, reduce, runMachine } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import type { TxCheck, TxOptions, TxReceipt } from '../../core/tx/types'
import { entryState } from './activityStore'
import type { ActivityEntry, ActivityProduct, ActivityStore } from './activityStore'
import { formatUtcClock } from '../../core/format/time'
import { TX_BUSY_MESSAGE, announcementFor, noticeFor, txUnsettledMessage } from './copy'
import type { TxNotice } from './copy'
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
  /** The terms behind the label, as a second line in Activity. Not announced. */
  detail?: string | null
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
  /**
   * A visible notice (a toast) for a run that ends after the screen that started it was closed. It announces
   * itself, so the runner does not also speak that end state. Omit to rely on announcements alone.
   */
  notify?: (notice: TxNotice) => void
  /** Timer for the automatic re-check; returns a cancel function. Defaults to `setTimeout`. */
  schedule?: (fn: () => void, ms: number) => () => void
  autoCheck?: boolean
  /** Unix seconds now, for the time bound of an unknown entry. Defaults to the device clock. */
  nowSec?: () => number
}

export interface RunOptions<T = unknown> {
  /** Receives every state of the run, including a later resolution of an unknown outcome. */
  onState?: (state: TxState) => void
  /** Set false to skip the announcements of this run. */
  announce?: boolean
  /**
   * Whether the screen that started the run is still on screen. When it is not, the end state is told in a
   * visible notice (`deps.notify`) instead of only in the live region: nobody is looking at the receipt.
   */
  isMounted?: () => boolean
  /** Called with the Activity entry id as soon as the run starts (for `stopWaiting` while it waits for the wallet). */
  onEntry?: (entryId: string) => void
  /**
   * What the confirmed write created, from its result: `option:<id>` for a new offer, `bid:<id>` for a new
   * request. Recorded on the Activity entry, so the thing created can link the transaction that made it.
   */
  created?: (result: T) => string | null
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

function speak(deps: RunnerDeps, meta: TxMeta, state: TxState, on: boolean, isMounted?: () => boolean): void {
  if (deps.notify && isMounted && !isMounted()) {
    const notice = noticeFor(meta.label, state, meta.done)
    if (notice) {
      deps.notify(notice)
      return
    }
  }
  if (!on || !deps.announce) return
  const a = announcementFor(meta.label, state, meta.done)
  if (a) deps.announce(a.message, a.politeness)
}

/**
 * Looks an unknown transaction up again and writes the answer to its Activity entry. Resolves with the new
 * state (still `unknown` when the network has no answer yet), or null when the entry cannot be checked.
 */
export async function checkEntry(deps: RunnerDeps, meta: Pick<TxMeta, 'address' | 'product' | 'action' | 'label' | 'detail' | 'done' | 'subject' | 'mock'>, entryId: string, opts: RunOptions = {}): Promise<TxState | null> {
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
  speak(deps, meta, next, opts.announce ?? true, opts.isMounted)
  if (mayHaveChanged(next)) deps.onSettled(meta, next)
  return next
}

const nowOf = (deps: RunnerDeps): number => (deps.nowSec ? deps.nowSec() : Math.floor(Date.now() / 1000))

/**
 * The account's latest transaction whose outcome is unknown and can still be included (it has a hash and its time
 * bound has not passed): another write by the same account must wait for it, or both could land.
 */
export function unsettledEntry(deps: Pick<RunnerDeps, 'activity' | 'nowSec'>, meta: Pick<TxMeta, 'address' | 'product'>): ActivityEntry | undefined {
  const now = nowOf(deps as RunnerDeps)
  return deps.activity.list(meta.address).find((e) => e.product === meta.product && e.phase === 'unknown' && e.hash !== null && e.maxTime !== null && e.maxTime > now)
}

const metaOf = (e: ActivityEntry): TxMeta => ({ product: e.product, action: e.action, label: e.label, detail: e.detail, done: e.done, subject: e.subject, address: e.address, mock: e.mock })

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

/** Runs in flight, by Activity entry id: their abort handle, and since when they wait for the wallet. */
const waiting = new Map<string, { control: AbortController; signingSince: number | null }>()

/** How long a signature request may stay unanswered before the screens offer "Stop waiting". */
export const STOP_WAITING_AFTER_MS = 60_000

/** Since when (epoch ms) the run of this entry waits for the wallet's signature, or null when it does not. */
export const signingSince = (entryId: string): number | null => waiting.get(entryId)?.signingSince ?? null

/**
 * Stops waiting for a wallet that does not answer (review finding 42). Only while the run waits for the signature:
 * the run then ends `declined` ("You stopped waiting for the wallet..."), its flight is released and its Activity
 * entry removed, since nothing was signed or sent. Returns whether it stopped anything.
 */
export function stopWaiting(entryId: string): boolean {
  const w = waiting.get(entryId)
  if (!w || w.signingSince === null) return false
  w.control.abort()
  return true
}

/** The entry ids that wait for a signature right now (for the Activity list and the screens of a stuck wallet). */
export const waitingForSignature = (): string[] => [...waiting.entries()].filter(([, w]) => w.signingSince !== null).map(([id]) => id)

/** Ids of the entries a `resumeUnknown` timer already watches, so a second mount does not start another. */
const resumed = new Set<string>()

/**
 * Restarts the automatic look-up for the unknown entries of `address` found in Activity (after a reload, or after
 * the page that sent them was closed). Silent: nobody is waiting on a screen for them. Returns how many it watches.
 */
export function resumeUnknown(deps: RunnerDeps, address: string | null): number {
  let n = 0
  for (const e of deps.activity.list(address)) {
    if (e.phase !== 'unknown' || !e.hash || resumed.has(e.id)) continue
    resumed.add(e.id)
    watchUnknown(deps, metaOf(e), e.id, { announce: false })
    n++
  }
  return n
}

/**
 * Runs `write` (a client call that takes `{ onStage }`) through the machine. Never rejects.
 * `meta.label` is announced with each phase unless `opts.announce` is false.
 */
export async function runTransaction<T extends TxReceipt>(deps: RunnerDeps, meta: TxMeta, write: (opts: Required<TxOptions>) => Promise<T>, opts: RunOptions<T> = {}): Promise<TxRun<T>> {
  const announce = opts.announce ?? true
  const refuse = (message: string): TxRun<T> => {
    const state = refusedState(message)
    opts.onState?.(state)
    speak(deps, meta, state, announce)
    return { state, result: null, entryId: null }
  }
  if (deps.flights.count() > 0) return refuse(TX_BUSY_MESSAGE)
  // An earlier transaction of this account may still land: look it up once more, and refuse while it is unknown.
  const open = unsettledEntry(deps, meta)
  if (open) {
    const after = await checkEntry(deps, metaOf(open), open.id, { announce: false })
    if (after === null || after.phase === 'unknown') return refuse(txUnsettledMessage(formatUtcClock(Math.floor(open.startedAt / 1000)), formatUtcClock(open.maxTime!)))
  }
  if (deps.flights.count() > 0) return refuse(TX_BUSY_MESSAGE)
  const entry = deps.activity.begin(meta)
  deps.flights.enter(entry.id, meta.subject ?? null)
  const control = new AbortController()
  waiting.set(entry.id, { control, signingSince: null })
  opts.onEntry?.(entry.id)
  let run: { state: TxState; result: T | null }
  try {
    run = await runMachine<T>(
      (o) => write({ ...o, signal: control.signal }),
      (state) => {
        const w = waiting.get(entry.id)
        if (w) w.signingSince = state.phase === 'signing' ? (w.signingSince ?? Date.now()) : null
        deps.activity.apply(meta.address, entry.id, state)
        opts.onState?.(state)
        speak(deps, meta, state, announce, opts.isMounted)
      },
    )
  } finally {
    waiting.delete(entry.id)
    deps.flights.leave(entry.id)
  }
  const { state, result } = run
  if (sentNothing(state)) {
    deps.activity.remove(meta.address, entry.id)
    return { state, result, entryId: null }
  }
  if (state.phase === 'confirmed' && result !== null && opts.created) {
    const created = opts.created(result)
    if (created) deps.activity.setCreated(meta.address, entry.id, created)
  }
  if (mayHaveChanged(state)) deps.onSettled(meta, state)
  if (state.phase === 'unknown' && state.hash) watchUnknown(deps, meta, entry.id, { onState: opts.onState, announce: opts.announce, isMounted: opts.isMounted })
  return { state, result, entryId: entry.id }
}
