import { Tag, Timeline } from '../../ui'
import type { TimelineItem } from '../../ui'
import { LIFECYCLE_FORK_INTRO, LIFECYCLE_TIMELINE_LABEL, STATE_AFTER, lifecycleBranches, lifecycleSpine } from './content'
import type { LifecycleStep } from './content'
import type { WorkedExample } from './examples'
import css from './Lifecycle.module.css'

const toItem = (step: LifecycleStep, status: TimelineItem['status']): TimelineItem => ({
  title: step.title,
  time: step.when,
  actor: step.who,
  status,
  description: (
    <>
      <p>{step.text}</p>
      {step.state ? (
        <p className={css.state}>
          <span>{STATE_AFTER}</span>
          <Tag state={step.state} />
        </p>
      ) : null}
    </>
  ),
})

export interface LifecycleProps {
  /** The put the walk-through follows. */
  example: WorkedExample
  /** Canonical UTC text of its deadline. */
  deadline: string
}

/**
 * One put from offer to end: who acts, by when, and the contract state after each step. The option has just been
 * bought, so the first two steps are done, the third is where it stands, and the two ways it can end are ahead.
 */
export function Lifecycle({ example, deadline }: LifecycleProps) {
  const spine = lifecycleSpine(example, deadline)
  const branches = lifecycleBranches(example)
  return (
    <div className={css.root}>
      <Timeline
        className={css.spine}
        label={LIFECYCLE_TIMELINE_LABEL}
        items={spine.map((step, i) => toItem(step, i === spine.length - 1 ? 'current' : 'done'))}
      />
      <p className={css.forkIntro}>{LIFECYCLE_FORK_INTRO}</p>
      <div className={css.fork}>
        {branches.map((branch) => (
          <div key={branch.id} className={css.branch}>
            <h3 className={css.branchTitle}>{branch.title}</h3>
            <Timeline label={branch.label} items={branch.steps.map((step) => toItem(step, 'upcoming'))} />
          </div>
        ))}
      </div>
    </div>
  )
}
