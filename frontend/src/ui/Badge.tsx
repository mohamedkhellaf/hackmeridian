import { cx } from './internal/cx'
import styles from './Badge.module.css'

export interface BadgeProps {
  count: number
  /** What the number counts, for screen readers ("2 actions waiting"). Without it the number is read alone. */
  label?: string
  /** `solid` is ink, for the one count that asks for action (Portfolio in the navigation). `quiet` is a plain muted numeral after a tab label. */
  tone?: 'solid' | 'quiet'
  /** Largest number shown; above it the badge reads "99+". */
  max?: number
  className?: string
}

/** A count. It counts what the data says and nothing else; it is never a status or a "new" marker. */
export function Badge({ count, label, tone = 'solid', max = 99, className }: BadgeProps) {
  const shown = count > max ? `${max}+` : String(count)
  return (
    <span className={cx(styles.root, className)} data-tone={tone}>
      <span aria-hidden={label ? true : undefined}>{shown}</span>
      {label ? <span className="ui-vh">{label}</span> : null}
    </span>
  )
}
