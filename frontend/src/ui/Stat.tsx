import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Stat.module.css'

export interface StatProps {
  label: ReactNode
  /** The figure, already formatted from exact units. */
  value: ReactNode
  /** Unit, once, after the figure. */
  unit?: ReactNode
  /**
   * One line of context: the source of a price, what a total includes, a second figure of the same quantity, or
   * where the money sits. Never a definition of the label, never a description of the page.
   */
  hint?: ReactNode
  size?: 'md' | 'lg'
  className?: string
}

/**
 * A key figure with its label: the serif gives it rank. For real, exact figures only (premium paid, collateral
 * locked, positions open). Never for vanity numbers, and never more than four in a row.
 */
export function Stat({ label, value, unit, hint, size = 'md', className }: StatProps) {
  return (
    <div className={cx(styles.root, className)} data-size={size}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        <span className={styles.figure}>{value}</span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}
