// The one transaction state machine, for Covered and Margin. Pure: `reduce(state, event)` and a few selectors.
// The data layer feeds it the stages a client write reports (`onStage`) and the way the write settled; the ticket,
// the row buttons and the Activity list all render the same `TxState`.
//
//   idle -> checking -> signing -> submitting -> pending -> confirmed
//                 \          \            \           \--> failed      (included, refused; fee charged)
//                  \          \            \           \-> unknown     (not found yet, still within its time bound)
//                   \          \            \-> unknown | expired | failed (nothing sent)
//                    \          \-> declined (user said no in the wallet; nothing sent)
//                     \-> failed (refused by a pre-check or the simulation; nothing sent)
//   unknown -> confirmed | failed | expired   (after a later check, `resolve`)
//
// The rule this encodes (Stellar "submit a transaction and wait" guide): a transaction that was sent and is not
// found has NOT failed. It can still be included until a ledger closes after its `maxTime`. Sending another one
// before that can apply both. So `unknown` never allows a retry; only `expired` does.
import { TxError, errorMessage } from './errors'
import type { TxCheck, TxStage, TxStageName } from './types'

export type TxPhase = 'idle' | 'checking' | 'signing' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'unknown' | 'expired' | 'declined'

/**
 * What happened to the user's money, the three stages every message must distinguish:
 *   nothing-sent     no transaction reached the network, no fee
 *   outcome-unknown  a transaction was (or may have been) sent and is not settled yet
 *   fee-charged      a ledger included the transaction (confirmed, or failed there)
 */
export type TxEffect = 'nothing-sent' | 'outcome-unknown' | 'fee-charged'

export interface TxState {
  phase: TxPhase
  /** Known from `pending` on, and on `unknown` / `failed` / `expired` when the transaction was signed. */
  hash: string | null
  /** Unix seconds after which the signed transaction can no longer be included. */
  maxTime: number | null
  /** Ledger that included it, once confirmed and when the client reports it. */
  ledger: number | null
  /** Message for failed, unknown, expired and declined. */
  error: string | null
  effect: TxEffect
  /**
   * The stage the transaction had reached when it stopped short of confirmed (failed, declined, unknown,
   * expired). It tells a refusal by a pre-check (nothing was sent) from a refusal by the network (sent, taken by
   * no ledger): both are `failed` with `nothing-sent`. Absent on states recorded before the field existed; read
   * it through `stoppedStage`.
   */
  stoppedAt?: TxStageName | null
}

/** The four steps of the progress list. */
export type TxStep = 'check' | 'sign' | 'submit' | 'confirm'

const STEP_OF: Record<TxStageName, TxStep> = { checking: 'check', signing: 'sign', submitting: 'submit', pending: 'confirm' }

/**
 * The step of the progress list on which a transaction stopped. A ledger that included it is always `confirm`;
 * a decline is `sign`; otherwise the stage recorded when it stopped, or for an older record a guess from what
 * is known (a hash means it was sent).
 */
export function stoppedStage(s: TxState): TxStep {
  if (s.effect === 'fee-charged') return 'confirm'
  if (s.phase === 'declined') return 'sign'
  if (s.stoppedAt) return STEP_OF[s.stoppedAt]
  return s.hash ? 'submit' : 'check'
}

/** True for a transaction that was signed and sent, then refused by the network before any ledger took it. */
export const refusedOnSend = (s: TxState): boolean => s.phase === 'failed' && s.effect === 'nothing-sent' && (s.stoppedAt === 'submitting' || s.stoppedAt === 'pending')

export type TxEvent =
  /** The user pressed the button. Ignored while a transaction is in flight or its outcome is unknown. */
  | { type: 'start' }
  /** A stage reported by the client (`onStage`). Stages only move forward. */
  | { type: 'stage'; stage: TxStage }
  /** The write resolved. */
  | { type: 'confirmed'; hash: string; ledger?: number | null }
  /** The write rejected. A `TxError` carries where it stopped; anything else is classified from the phase. */
  | { type: 'error'; error: unknown }
  /** Result of a later check of an `unknown` transaction (`OptionsClient.checkTx`). */
  | { type: 'resolve'; check: TxCheck }
  /** Back to idle. Ignored while in flight or unknown. */
  | { type: 'reset' }

export const TX_IDLE: TxState = { phase: 'idle', hash: null, maxTime: null, ledger: null, error: null, effect: 'nothing-sent' }

const RANK: Record<TxStageName, number> = { checking: 1, signing: 2, submitting: 3, pending: 4 }
const WORKING: ReadonlySet<TxPhase> = new Set<TxPhase>(['checking', 'signing', 'submitting', 'pending'])

/** A transaction is in flight: disable the button, show progress. */
export const isWorking = (s: TxState): boolean => WORKING.has(s.phase)

/** The outcome is final for this attempt (confirmed, failed, expired or declined). */
export const isSettled = (s: TxState): boolean => s.phase === 'confirmed' || s.phase === 'failed' || s.phase === 'expired' || s.phase === 'declined'

/**
 * May the user send this action (again)? Never while in flight, and never while the outcome is unknown: the
 * first transaction can still be included until a ledger closes after its time bound.
 */
export const canStart = (s: TxState): boolean => !isWorking(s) && s.phase !== 'unknown'

/** Only an unknown outcome can be looked up again. */
export const canCheckAgain = (s: TxState): boolean => s.phase === 'unknown' && s.hash !== null

/** The hash exists and can be shown and linked (from `pending` on). */
export const hasHash = (s: TxState): s is TxState & { hash: string } => s.hash !== null

/**
 * `expired` or `unknown` for a transaction that is not found: expired only once a ledger has closed after its
 * time bound. `latestLedgerCloseTime` is the close time (unix seconds) of the newest ledger the RPC has.
 */
export function notFoundStatus(latestLedgerCloseTime: number | null | undefined, maxTime: number | null | undefined): 'expired' | 'unknown' {
  if (!maxTime || !latestLedgerCloseTime) return 'unknown'
  return latestLedgerCloseTime > maxTime ? 'expired' : 'unknown'
}

function fromStage(s: TxState, stage: TxStage): TxState {
  // Late or repeated callbacks never move the machine backwards, and never revive a settled transaction.
  if (isSettled(s) || s.phase === 'unknown') return s
  const current = s.phase === 'idle' ? 0 : RANK[s.phase as TxStageName]
  if (RANK[stage.stage] <= current) return s
  switch (stage.stage) {
    case 'checking':
    case 'signing':
      return { ...TX_IDLE, phase: stage.stage }
    case 'submitting':
      return { ...s, phase: 'submitting', error: null, effect: 'outcome-unknown' }
    case 'pending':
      return { ...s, phase: 'pending', hash: stage.hash, maxTime: stage.maxTime, error: null, effect: 'outcome-unknown' }
  }
}

function fromError(s: TxState, error: unknown): TxState {
  if (isSettled(s)) return s
  const message = errorMessage(error) || 'The transaction failed.'
  // The stage it had reached: the phase it is in now, or the one already recorded (an `unknown` being settled).
  const at: TxStageName = s.phase in RANK ? (s.phase as TxStageName) : (s.stoppedAt ?? 'checking')
  if (error instanceof TxError) {
    const hash = error.hash ?? s.hash
    const maxTime = error.maxTime ?? s.maxTime
    switch (error.kind) {
      case 'declined':
        return { ...TX_IDLE, phase: 'declined', error: message, stoppedAt: 'signing' }
      case 'refused':
        return { ...TX_IDLE, phase: 'failed', error: message, stoppedAt: at }
      case 'failed':
        return { ...s, phase: 'failed', hash, maxTime, error: message, effect: 'fee-charged', stoppedAt: 'pending' }
      case 'unknown':
        return { ...s, phase: 'unknown', hash, maxTime, error: message, effect: 'outcome-unknown', stoppedAt: RANK[at] >= RANK.submitting ? at : 'submitting' }
      case 'expired':
        return { ...s, phase: 'expired', hash, maxTime, error: message, effect: 'nothing-sent', stoppedAt: 'pending' }
    }
  }
  // An untyped failure. Before anything was signed, nothing can have been sent. From `submitting` on we cannot
  // know whether the network has it, so the honest state is unknown, never "failed, try again".
  if (s.phase === 'submitting' || s.phase === 'pending' || s.phase === 'unknown') return { ...s, phase: 'unknown', error: message, effect: 'outcome-unknown', stoppedAt: at }
  return { ...TX_IDLE, phase: 'failed', error: message, stoppedAt: at }
}

function fromCheck(s: TxState, check: TxCheck): TxState {
  if (s.phase !== 'unknown' && s.phase !== 'pending') return s
  switch (check.status) {
    case 'confirmed':
      return { ...s, phase: 'confirmed', ledger: check.ledger, error: null, effect: 'fee-charged' }
    case 'failed':
      return { ...s, phase: 'failed', error: check.message, effect: 'fee-charged', stoppedAt: 'pending' }
    case 'expired':
      return { ...s, phase: 'expired', error: null, effect: 'nothing-sent', stoppedAt: 'pending' }
    case 'unknown':
      return s
  }
}

export function reduce(s: TxState, e: TxEvent): TxState {
  switch (e.type) {
    case 'start':
      return canStart(s) ? { ...TX_IDLE, phase: 'checking' } : s
    case 'stage':
      return fromStage(s, e.stage)
    case 'confirmed':
      // A confirmation always wins: the ledger is the truth, whatever a slower callback said before. A replayed
      // fixture step confirms with an empty hash: nothing was sent, so there is none to show.
      return { phase: 'confirmed', hash: e.hash || s.hash, maxTime: s.maxTime, ledger: e.ledger ?? null, error: null, effect: e.hash || s.hash ? 'fee-charged' : 'nothing-sent' }
    case 'error':
      return fromError(s, e.error)
    case 'resolve':
      return fromCheck(s, e.check)
    case 'reset':
      return canStart(s) ? TX_IDLE : s
  }
}

/**
 * Runs one write through the machine: `start`, every stage the client reports, then `confirmed` or `error`.
 * `emit` receives each new state (wire it to a store). Resolves with the final state and, when confirmed, the
 * write's own result. Never rejects.
 */
export async function runMachine<T extends { hash: string; ledger?: number | null }>(
  write: (opts: { onStage: (stage: TxStage) => void }) => Promise<T>,
  emit: (state: TxState) => void,
  from: TxState = TX_IDLE,
): Promise<{ state: TxState; result: T | null }> {
  let state = from
  const step = (e: TxEvent) => {
    const next = reduce(state, e)
    if (next !== state) {
      state = next
      emit(state)
    }
  }
  if (!canStart(state)) return { state, result: null }
  step({ type: 'start' })
  try {
    const result = await write({ onStage: (stage) => step({ type: 'stage', stage }) })
    step({ type: 'confirmed', hash: result.hash, ledger: result.ledger })
    return { state, result }
  } catch (error) {
    step({ type: 'error', error })
    return { state, result: null }
  }
}
