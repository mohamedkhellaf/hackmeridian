import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './internal/cx'

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode
}

/** Text for screen readers only. Uses the global `.ui-vh` helper from base.css. */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  return <span {...rest} className={cx('ui-vh', className)} />
}
