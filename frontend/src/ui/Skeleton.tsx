import type { CSSProperties } from 'react'
import { cx } from './internal/cx'
import styles from './Skeleton.module.css'

export interface SkeletonProps {
  /** `text` is one or more lines, `block` is a box (a chart, a note), `rows` is a ruled list (a table loading). */
  variant?: 'text' | 'block' | 'rows'
  /** Number of lines or rows. */
  lines?: number
  /** A CSS length. Text lines default to full width with a shorter last line. */
  width?: string
  /** A CSS length, for `block`. */
  height?: string
  className?: string
}

/**
 * A content-shaped placeholder for the first load of a view. It is hidden from assistive technology: set
 * `aria-busy="true"` on the container and announce "Loading Markets" once. Later refreshes keep the stale data
 * on screen and do not show a skeleton.
 */
export function Skeleton({ variant = 'text', lines = 1, width, height, className }: SkeletonProps) {
  if (variant === 'block') {
    return <span className={cx(styles.bone, styles.block, className)} style={{ width, height } as CSSProperties} aria-hidden="true" />
  }
  const count = Math.max(1, lines)
  return (
    <span className={cx(styles.stack, className)} data-variant={variant} style={{ width } as CSSProperties} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={variant === 'rows' ? styles.row : styles.line}>
          <span className={styles.bone} data-last={count > 1 && i === count - 1 ? '' : undefined} />
          {variant === 'rows' ? <span className={cx(styles.bone, styles.rowEnd)} /> : null}
        </span>
      ))}
    </span>
  )
}
