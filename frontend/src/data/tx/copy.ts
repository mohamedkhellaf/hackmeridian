// The words for a transaction's state, in one place, so the ticket, a row button, a toast and the Activity list
// say the same thing. Three situations are always told apart (brief 6.3): nothing was sent, the outcome is
// unknown, the network fee was charged.
import { refusedOnSend } from '../../core/tx/machine'
import type { TxEffect, TxPhase, TxState } from '../../core/tx/machine'

/** The name of each phase, as shown on a button and in the Activity list. Same words as the ui kit's `TX_STATE_LABEL`. */
export const TX_PHASE_LABEL: Record<Exclude<TxPhase, 'idle'>, string> = {
  checking: 'Checking',
  signing: 'Waiting for signature',
  submitting: 'Submitting',
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
  unknown: 'Outcome unknown',
  expired: 'Expired',
  declined: 'Declined',
}

/** What happened to the user's money, as one sentence. */
export const TX_EFFECT_TEXT: Record<TxEffect, string> = {
  'nothing-sent': 'Nothing was sent. No fee was charged.',
  'outcome-unknown': 'The transaction was sent and is not confirmed yet. It can still be included.',
  'fee-charged': 'A ledger included the transaction. The network fee was charged.',
}

/**
 * A transaction that was signed and sent, then refused by the network before any ledger took it (a bad sequence
 * number, a signature the network rejects). "Nothing was sent" would be untrue; "no fee" is true.
 */
export const TX_REFUSED_ON_SEND = 'The transaction was sent, but no ledger included it. No fee was charged.'

/** What happened to the user's money for this state, as one sentence: `TX_EFFECT_TEXT`, except for a refusal on send. */
export const txEffectText = (state: TxState): string => (refusedOnSend(state) ? TX_REFUSED_ON_SEND : TX_EFFECT_TEXT[state.effect])

/** What each phase means and what to do, for the Sign step. */
export const TX_PHASE_HELP: Record<Exclude<TxPhase, 'idle'>, string> = {
  checking: 'Simulating the transaction against the contract. Nothing has been sent.',
  signing: 'Approve the transaction in your wallet. Nothing has been sent.',
  submitting: 'Signed. Sending the transaction to the network.',
  pending: 'The network accepted the transaction. Waiting for a ledger to include it.',
  confirmed: 'A ledger included the transaction.',
  failed: 'The transaction did not go through.',
  unknown: 'The transaction was sent and is not confirmed yet. Do not send it again: check again first.',
  expired: 'The transaction was never included and can no longer be. Nothing was charged. You can send it again.',
  declined: 'You declined the request in the wallet. Nothing was sent.',
}

/** Shown when a second transaction is started while one is in flight. */
export const TX_BUSY_MESSAGE = 'Another transaction is in progress. Wait for it to finish, then try again.'
/** Shown when a write is started without a wallet. */
export const TX_NOT_CONNECTED = 'Connect a wallet first.'

export interface TxSummary {
  /** Two or three words: the phase name. */
  title: string
  /** One or two sentences: the error or the meaning of the phase, then what happened to the fee. */
  detail: string
}

/** A state as a title and a detail line. `idle` has none. */
export function describeTx(state: TxState): TxSummary | null {
  if (state.phase === 'idle') return null
  const title = TX_PHASE_LABEL[state.phase]
  if (state.phase === 'failed') return { title, detail: `${state.error ?? TX_PHASE_HELP.failed} ${txEffectText(state)}` }
  return { title, detail: TX_PHASE_HELP[state.phase] }
}

/**
 * What a screen reader hears when a transaction changes phase: the label, then the phase. Failures and unknown
 * outcomes interrupt (assertive); progress and a decline do not.
 */
export function announcementFor(label: string, state: TxState, done?: string | null): { message: string; politeness: 'polite' | 'assertive' } | null {
  switch (state.phase) {
    case 'idle':
    case 'checking':
      return null
    case 'signing':
    case 'submitting':
    case 'pending':
      return { message: `${label}: ${TX_PHASE_LABEL[state.phase]}.`, politeness: 'polite' }
    case 'confirmed':
      return { message: `${label}: ${done ?? TX_PHASE_LABEL.confirmed}.`, politeness: 'polite' }
    case 'declined':
      return { message: `${label}: ${TX_PHASE_HELP.declined}`, politeness: 'polite' }
    case 'failed':
      return { message: `${label}: ${TX_PHASE_LABEL.failed}. ${state.error ?? ''} ${txEffectText(state)}`.replace(/\s+/g, ' ').trim(), politeness: 'assertive' }
    case 'unknown':
      return { message: `${label}: ${TX_PHASE_LABEL.unknown}. ${TX_PHASE_HELP.unknown}`, politeness: 'assertive' }
    case 'expired':
      return { message: `${label}: ${TX_PHASE_LABEL.expired}. ${TX_PHASE_HELP.expired}`, politeness: 'assertive' }
  }
}
