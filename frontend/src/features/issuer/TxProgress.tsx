import { explorerTx } from '../../core/explorer'
import { groupDigits } from '../../core/format'
import { stoppedStage } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { describeTx } from '../../data'
import { TxLink, TxStepper } from '../../ui'
import { COPY } from './copy'

export interface TxProgressProps {
  state: TxState
  /** Names the sequence for screen readers: the action's label. */
  label: string
}

/**
 * The staged state of one issuer transaction: check, sign, submit, confirm, with what the current state means
 * and the transaction link from the moment a hash exists. The three ways it can stop read differently: nothing
 * was sent, the outcome is unknown, the fee was charged.
 */
export function TxProgress({ state, label }: TxProgressProps) {
  if (state.phase === 'idle') return null
  // Where it stopped comes from the shared machine; a refusal by the network reads differently from one before
  // anything was sent (the data layer's `describeTx` words both).
  const stoppedAt = stoppedStage(state)
  const detail =
    state.phase === 'checking'
      ? COPY.tx.checking
      : state.phase === 'confirmed' && state.ledger
          ? COPY.tx.confirmedIn(groupDigits(String(state.ledger)))
          : (describeTx(state)?.detail ?? '')
  return (
    <TxStepper
      state={state.phase}
      failedAt={stoppedAt}
      label={label}
      hash={state.hash ? <TxLink hash={state.hash} explorerUrl={explorerTx(state.hash)} copy /> : undefined}
    >
      {detail}
    </TxStepper>
  )
}
