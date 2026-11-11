import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Timeline.module.css'

export interface TimelineItem {
  /** What happens: "Exercise before the deadline". */
  title: ReactNode
  /** When, or by when. A `DateTime`, or words such as "Now" and "Until the deadline". */
  time?: ReactNode
  /** Who acts: "You", "The maker", "Anyone". */
  actor?: ReactNode
  /** One or two sentences, or a transaction link. */
  description?: ReactNode
  status: 'done' | 'current' | 'upcoming'
}

export interface TimelineProps {
  /** Names the list ("Lifecycle of this option"). */
  label: string
  items: ReadonlyArray<TimelineItem>
  className?: string
}

const STATUS_WORD = { done: 'done', current: 'now', upcoming: 'later' } as const

/** A lifecycle in order: what happens, who acts and by when. The order is real, so it is an ordered list. */
export function Timeline({ label, items, className }: TimelineProps) {
  return (
    <ol className={cx(styles.root, className)} aria-label={label}>
      {items.map((item, i) => (
        <li key={i} className={styles.item} data-status={item.status} aria-current={item.status === 'current' ? 'step' : undefined}>
          <span className={styles.mark} aria-hidden="true" />
          <div className={styles.body}>
            <div className={styles.head}>
              {item.time ? <span className={styles.time}>{item.time}</span> : null}
              {item.actor ? <span className={styles.actor}>{item.actor}</span> : null}
            </div>
            <p className={styles.title}>
              {item.title}
              <span className="ui-vh">, {STATUS_WORD[item.status]}</span>
            </p>
            {item.description ? <div className={styles.description}>{item.description}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
