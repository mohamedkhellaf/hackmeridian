import { cx } from './internal/cx'
import styles from './Spinner.module.css'

export interface SpinnerProps {
  /** Accessible name. Leave out when a visible word such as "Checking" sits next to it. */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Spinner({ label, size = 'sm', className }: SpinnerProps) {
  return (
    <span
      className={cx(styles.root, className)}
      data-size={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
