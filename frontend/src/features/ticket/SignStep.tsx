// The Sign step: the one transaction state machine, each state in words (what it means, what to do).
// Three situations always read differently: nothing was sent, the outcome is unknown, the fee was charged.
// An unknown outcome never offers to send again: only "Check again", until the validity window has passed.
import { useState } from 'react'
import { explorerTx } from '../../core/explorer'
import { hasHash, stoppedStage } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { useOptionsClient } from '../../data'
import { Button, TxLink, TxStepper } from '../../ui'
import type { TxState as StepperState } from '../../ui'
import { BACK_TO_REVIEW, CHECK_AGAIN, RECHECK_HELP, SIGN_AGAIN, WORKING_LABEL, signHelp } from './copy'
import { Actions } from './Actions'
import { utcClock } from './fmt'
import { useFrame } from './frame'
import styles from './SignStep.module.css'

export function SignStep(props: {
  summary: string
  state: TxState
  /** The fresh re-check before the wallet is asked is still running. */
  rechecking: boolean
  canCheckAgain: boolean
  onCheckAgain: () => Promise<unknown>
  onSignAgain: () => void
  onBackToReview: () => void
}) {
  const { summary, state, rechecking } = props
  const frame = useFrame()
  const { isMock } = useOptionsClient()
  const [looking, setLooking] = useState(false)

  const phase: StepperState = rechecking || state.phase === 'idle' ? 'checking' : state.phase
  const inFlight = phase === 'checking' || phase === 'signing' || phase === 'submitting' || phase === 'pending'
  const until = state.maxTime ? utcClock(state.maxTime) : null
  const help = rechecking || state.phase === 'idle' ? RECHECK_HELP : signHelp(state.phase, state.effect, until)
  const hash = !rechecking && hasHash(state) ? <TxLink hash={state.hash} explorerUrl={isMock ? undefined : explorerTx(state.hash)} copy /> : undefined

  const checkAgain = async () => {
    setLooking(true)
    try {
      await props.onCheckAgain()
    } finally {
      setLooking(false)
    }
  }

  return (
    <>
      <p className={styles.summary}>{summary}</p>
      <TxStepper state={phase} failedAt={stoppedStage(state)} hash={hash} className={styles.stepper}>
        {phase === 'failed' && state.error ? <p className={styles.cause}>{state.error}</p> : null}
        <p>{help}</p>
      </TxStepper>
      <Actions>
        {inFlight ? (
          <>
            {phase === 'pending' ? (
              <Button variant="quiet" onClick={frame.close}>
                Close
              </Button>
            ) : null}
            <Button variant="primary" fullWidth className={styles.primary} loading>
              {WORKING_LABEL[rechecking || state.phase === 'idle' ? 'recheck' : (phase as 'checking' | 'signing' | 'submitting' | 'pending')]}
            </Button>
          </>
        ) : phase === 'unknown' ? (
          <>
            <Button variant="quiet" onClick={frame.close}>
              Close
            </Button>
            <Button variant="primary" fullWidth className={styles.primary} loading={looking} disabled={!props.canCheckAgain} disabledReason="The transaction has no hash to look up yet." onClick={() => void checkAgain()}>
              {CHECK_AGAIN}
            </Button>
          </>
        ) : phase === 'failed' ? (
          <Button variant="primary" fullWidth className={styles.primary} onClick={props.onBackToReview}>
            {BACK_TO_REVIEW}
          </Button>
        ) : (
          <>
            <Button variant="quiet" onClick={props.onBackToReview}>
              {BACK_TO_REVIEW}
            </Button>
            <Button variant="primary" fullWidth className={styles.primary} onClick={props.onSignAgain}>
              {SIGN_AGAIN}
            </Button>
          </>
        )}
      </Actions>
    </>
  )
}
