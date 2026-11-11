import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Marker.module.css'

export interface MarkerProps {
  children: ReactNode
  /** Plays the 1.2 s flash used when a figure has just changed. Remount (change `key`) to replay. */
  flash?: boolean
  /** A band across the lower part of the line instead of the full line box. For display-size text. */
  band?: boolean
  className?: string
}

/**
 * The highlighter: one stroke of wash behind a figure, in both themes. Only behind a term the user set (their
 * floor, their price) or, on the term sheet of their own order or position, the breakeven. One marked figure per
 * surface. Never a headline word, a price somebody else set, an example, emphasis, promotion or state.
 */
export function Marker({ children, flash = false, band = false, className }: MarkerProps) {
  return (
    <mark className={cx(styles.root, className)} data-flash={flash || undefined} data-band={band || undefined}>
      {children}
    </mark>
  )
}
