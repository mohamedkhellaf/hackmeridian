import { Tag, Timeline } from '../../ui'
import type { TimelineItem } from '../../ui'
import { LIFECYCLE_FORK_INTRO, LIFECYCLE_TIMELINE_LABEL, STATE_AFTER, lifecycleBranches, lifecycleSpine } from './content'
import type { LifecycleStep } from './content'
import type { WorkedExample } from './examples'
import css from './Lifecycle.module.css'

// A walk-through of an option in general, not anybody's position: no step is done, current or ahead, so every mark
// is the same ink point. The title of each step says who acts; the line above it says by when.
const toItem = (step: LifecycleStep): TimelineItem => ({
  title: step.title,
  time: step.when,
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
 * One put from offer to end: who acts, by when, and the contract state after each step; then the two ways it can
 * end, side by side with equal weight. The first step of each ending names it.
 */
export function Lifecycle({ example, deadline }: LifecycleProps) {
  const spine = lifecycleSpine(example, deadline)
  const branches = lifecycleBranches(example)
  return (
    <div className={css.root}>
      <Timeline className={css.spine} label={LIFECYCLE_TIMELINE_LABEL} items={spine.map(toItem)} />
      <p className={css.forkIntro}>{LIFECYCLE_FORK_INTRO}</p>
      <div className={css.fork}>
        {branches.map((branch) => (
          <div key={branch.id} className={css.branch}>
            <Timeline label={branch.label} items={branch.steps.map(toItem)} />
          </div>
        ))}
      </div>
    </div>
  )
}
