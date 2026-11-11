import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import { Spinner } from './Spinner'
import { TX_STATE_LABEL } from './txStates'
import type { TxState } from './txStates'
import styles from './Stepper.module.css'

export type StepStatus =
  /** Carried out. */
  | 'done'
  /** Happening now. */
  | 'current'
  /** Not reached yet. */
  | 'upcoming'
  /** Stopped with an error. */
  | 'failed'
  /** Needs the user to look: the outcome is not known. */
  | 'attention'
  /** Ended without effect and without error (declined, expired). */
  | 'stopped'

const STATUS_WORD: Record<StepStatus, string> = {
  done: 'done',
  current: 'in progress',
  upcoming: 'not started',
  failed: 'failed',
  attention: 'needs attention',
  stopped: 'stopped',
}

export interface StepItem {
  label: ReactNode
  status: StepStatus
  /** Shown under the label: what this step means and what to do. */
  detail?: ReactNode
  /** Shows a spinner on a `current` step that is waiting on the network or the wallet. */
  busy?: boolean
}

export interface StepperProps {
  /** Names the sequence ("Transaction progress"). */
  label: string
  steps: ReadonlyArray<StepItem>
  className?: string
}

function StepMark({ status, busy }: { status: StepStatus; busy?: boolean }) {
  if (status === 'current' && busy) return <Spinner />
  const path =
    status === 'done'
      ? 'M3.2 6.2 5.2 8.2 8.8 4'
      : status === 'failed'
        ? 'M4 4 8 8M8 4 4 8'
        : status === 'stopped'
          ? 'M3.6 6H8.4'
          : status === 'attention'
            ? 'M6 3.4V6.6M6 8.5V8.6'
            : null
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      {path ? <path d={path} /> : status === 'current' ? <circle cx="6" cy="6" r="2.2" className={styles.dot} /> : null}
    </svg>
  )
}

export interface TrailStep {
  label: ReactNode
  status: 'done' | 'current' | 'upcoming'
}

export interface StepTrailProps {
  /** Names the sequence ("Steps of the ticket"). */
  label: string
  steps: ReadonlyArray<TrailStep>
  className?: string
}

const TRAIL_WORD: Record<TrailStep['status'], string> = { done: 'done', current: 'current step', upcoming: 'not started' }

/** The state of a step as a shape: a ticked ring, a filled ring, a dashed ring. The word is read out beside it. */
function TrailMark({ status }: { status: TrailStep['status'] }) {
  return (
    <svg className={styles.trailMark} viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" data-status={status}>
      <circle cx="7" cy="7" r="6" className={styles.trailRing} />
      {status === 'done' ? <path d="M4.2 7.2 6.2 9.2 9.9 5" className={styles.trailTick} /> : null}
      {status === 'current' ? <circle cx="7" cy="7" r="3" className={styles.trailDot} /> : null}
    </svg>
  )
}

/**
 * Where the user is in a short flow, on one line: "Terms, Review, Sign, Receipt". Not a control: the steps move
 * with the flow's own actions. For a sequence with details under each step use `Stepper`.
 */
export function StepTrail({ label, steps, className }: StepTrailProps) {
  return (
    <ol className={cx(styles.trail, className)} aria-label={label}>
      {steps.map((step, i) => (
        <li key={i} className={styles.trailStep} data-status={step.status} aria-current={step.status === 'current' ? 'step' : undefined}>
          <TrailMark status={step.status} />
          <span>{step.label}</span>
          <span className="ui-vh">, {TRAIL_WORD[step.status]}</span>
        </li>
      ))}
    </ol>
  )
}

/** A sequence of steps, in order, with the state of each in words as well as shape. */
export function Stepper({ label, steps, className }: StepperProps) {
  return (
    <ol className={cx(styles.root, className)} aria-label={label}>
      {steps.map((step, i) => (
        <li key={i} className={styles.step} data-status={step.status} aria-current={step.status === 'current' ? 'step' : undefined}>
          <span className={styles.mark}>
            <StepMark status={step.status} busy={step.busy} />
          </span>
          <div className={styles.text}>
            <p className={styles.label}>
              {step.label}
              <span className="ui-vh">, {STATUS_WORD[step.status]}</span>
            </p>
            {step.detail ? <div className={styles.detail}>{step.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export type TxStage = 'check' | 'sign' | 'submit' | 'confirm'

const STAGES: readonly TxStage[] = ['check', 'sign', 'submit', 'confirm']
const STAGE_LABEL: Record<TxStage, { upcoming: string; current: string; done: string }> = {
  check: { upcoming: 'Check', current: 'Checking', done: 'Checked' },
  sign: { upcoming: 'Sign in your wallet', current: 'Waiting for signature', done: 'Signed' },
  submit: { upcoming: 'Submit', current: 'Submitting', done: 'Submitted' },
  confirm: { upcoming: 'Confirm on the ledger', current: 'Pending', done: 'Confirmed' },
}

/** Which stage each state sits on, and how that stage reads. */
const AT: Record<TxState, { stage: TxStage; status: StepStatus }> = {
  checking: { stage: 'check', status: 'current' },
  signing: { stage: 'sign', status: 'current' },
  submitting: { stage: 'submit', status: 'current' },
  pending: { stage: 'confirm', status: 'current' },
  confirmed: { stage: 'confirm', status: 'done' },
  failed: { stage: 'confirm', status: 'failed' },
  unknown: { stage: 'confirm', status: 'attention' },
  expired: { stage: 'confirm', status: 'stopped' },
  declined: { stage: 'sign', status: 'stopped' },
}

export interface TxStepperProps {
  state: TxState
  /**
   * Where a `failed` transaction stopped. `check`: refused before anything was sent, no fee. `sign`: the wallet
   * could not sign. `submit`: the network did not accept it. `confirm` (default): included and refused by the
   * contract, fee charged.
   */
  failedAt?: TxStage
  /** The transaction link, shown from the moment a hash exists (pending and after). Usually a `TxLink`. */
  hash?: ReactNode
  /** What the current state means and what to do, in one or two sentences. Supplied by the feature. */
  children?: ReactNode
  /** Names the sequence for screen readers. */
  label?: string
  className?: string
}

/**
 * The transaction progress list: check, sign, submit, confirm, with the nine states of the state machine.
 * The three failure stages always read differently: nothing was sent, outcome unknown, fee charged.
 */
export function TxStepper({ state, failedAt = 'confirm', hash, children, label = 'Transaction progress', className }: TxStepperProps) {
  const at = state === 'failed' ? { stage: failedAt, status: 'failed' as StepStatus } : AT[state]
  const atIndex = STAGES.indexOf(at.stage)
  const steps: StepItem[] = STAGES.map((stage, i) => {
    if (i < atIndex) return { label: STAGE_LABEL[stage].done, status: 'done' }
    if (i > atIndex) return { label: STAGE_LABEL[stage].upcoming, status: 'upcoming' }
    const stepLabel =
      at.status === 'done'
        ? STAGE_LABEL[stage].done
        : at.status === 'current'
          ? STAGE_LABEL[stage].current
          : TX_STATE_LABEL[state]
    const showHash = hash && stage === 'confirm'
    return {
      label: stepLabel,
      status: at.status,
      busy: at.status === 'current',
      detail:
        children || showHash ? (
          <>
            {children ? <div>{children}</div> : null}
            {showHash ? <div className={styles.hash}>{hash}</div> : null}
          </>
        ) : undefined,
    }
  })
  return <Stepper label={label} steps={steps} className={className} />
}
