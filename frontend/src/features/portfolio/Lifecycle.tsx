// The lifecycle of the option as a timeline: who acts and by when, with the transaction of each step this
// wallet made from this browser. The chain keeps no history the app can read yet, so a step made elsewhere has
// no link.
import { explorerTx } from '../../core/explorer'
import type { OptionOffer } from '../../core/options/types'
import { optionSubject, useActivity } from '../../data'
import type { ActivityEntry } from '../../data'
import { Card, DateTime, Timeline, TxLink } from '../../ui'
import type { TimelineItem } from '../../ui'
import { LIFECYCLE_HEADING } from './copy'
import { lifecycleSteps } from './lifecycleSteps'
import type { LifecycleContext, LifecycleStep } from './lifecycleSteps'
import { ActivityLink } from './links'
import css from './Lifecycle.module.css'

/** The confirmed transaction of a step, when this wallet made it from this browser. Newest first in Activity. */
function entryFor(step: LifecycleStep, entries: readonly ActivityEntry[], subject: string): ActivityEntry | null {
  if (step.status !== 'done') return null
  const confirmed = (e: ActivityEntry, names: readonly string[]): boolean => e.phase === 'confirmed' && e.hash !== null && names.includes(e.action)
  if (step.actions) {
    const actions: readonly string[] = step.actions
    const acted = entries.find((e) => e.subject === subject && confirmed(e, actions))
    if (acted) return acted
  }
  if (step.createdBy) {
    const makers: readonly string[] = step.createdBy
    return entries.find((e) => e.created === subject && confirmed(e, makers)) ?? null
  }
  return null
}

export interface LifecycleProps extends LifecycleContext {
  option: OptionOffer
  className?: string
}

export function Lifecycle({ option, className, ...ctx }: LifecycleProps) {
  const { entries } = useActivity()
  const subject = optionSubject(option.id)
  const steps = lifecycleSteps(option, ctx)
  let linked = 0
  const items: TimelineItem[] = steps.map((step) => {
    const entry = entryFor(step, entries, subject)
    if (entry) linked++
    return {
      title: step.title,
      status: step.status,
      time: step.atDeadline ? <DateTime value={option.expiry * 1000} local="inline" /> : undefined,
      description: (
        <>
          <p>{step.text}</p>
          {entry?.hash ? (
            <p className={css.tx}>
              <span>Transaction</span>
              <TxLink hash={entry.hash} explorerUrl={entry.mock ? undefined : explorerTx(entry.hash)} />
            </p>
          ) : null}
        </>
      ),
    }
  })
  return (
    <Card title={LIFECYCLE_HEADING} headingLevel={2} className={className}>
      <Timeline label="Lifecycle of this option" items={items} />
      {linked > 0 ? (
        <p className={css.note}>
          Transactions made from this browser are linked. <ActivityLink tone="quiet" className={css.link}>
            Open Activity
          </ActivityLink>
        </p>
      ) : null}
    </Card>
  )
}
