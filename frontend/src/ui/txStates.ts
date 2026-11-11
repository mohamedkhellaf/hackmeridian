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
