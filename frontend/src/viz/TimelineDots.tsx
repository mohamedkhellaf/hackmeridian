import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import shared from './viz.module.css'
import css from './TimelineDots.module.css'

export type StepState = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  id: string
  /** "Bought", "Exercise before the deadline", "Claim delivery". */
  label: string
  /** Who acts and by when, a date, a transaction link. */
  detail?: ReactNode
  state: StepState
}

export interface TimelineDotsProps {
  steps: readonly TimelineStep[]
  /** Accessible name of the list: "Lifecycle of this option". */
  label: string
  /** `auto` lays the steps in a row when the container is wide enough, in a column otherwise. */
  orientation?: 'auto' | 'vertical'
  /** Words read after each step for its state. */
  stateWords?: Record<StepState, string>
  className?: string
}

const WORDS: Record<StepState, string> = { done: 'done', current: 'now', upcoming: 'not yet' }

/**
 * Lifecycle steps as dots on a rule: filled for done, a ring with a centre for the current step, open for
 * what is still to come. The shape carries the state; there is no colour to rely on.
 */
export function TimelineDots({ steps, label, orientation = 'auto', stateWords = WORDS, className }: TimelineDotsProps) {
  return (
    <div className={cx(css.wrap, className)} data-orientation={orientation}>
      <ol className={css.steps} role="list" aria-label={label}>
        {steps.map((step) => (
          <li key={step.id} className={css.step} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className={css.dot} aria-hidden="true" />
            <span className={css.body}>
              <span className={css.label}>
                {step.label}
                <span className={shared.vh}>, {stateWords[step.state]}</span>
              </span>
              {step.detail && <span className={css.detail}>{step.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
