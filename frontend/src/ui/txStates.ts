/** The states of the one transaction state machine shared by Covered and Margin. */
export type TxState =
  | 'checking'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'unknown'
  | 'expired'
  | 'declined'

export const TX_STATES: readonly TxState[] = [
  'checking',
  'signing',
  'submitting',
  'pending',
  'confirmed',
  'failed',
  'unknown',
  'expired',
  'declined',
]

/** The name of each state, as shown on the button and in the Activity list. */
export const TX_STATE_LABEL: Record<TxState, string> = {
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

/** How a transaction state reads: in flight, done, refused, unknown, or stopped (declined or expired). */
export type TxStateTone = 'working' | 'confirmed' | 'failed' | 'unknown' | 'stopped'

/** The tone of each state: which glyph and ink `TxStateWord` gives it. */
export const TX_STATE_TONE: Record<TxState, TxStateTone> = {
  checking: 'working',
  signing: 'working',
  submitting: 'working',
  pending: 'working',
  confirmed: 'confirmed',
  failed: 'failed',
  unknown: 'unknown',
  expired: 'stopped',
  declined: 'stopped',
}
