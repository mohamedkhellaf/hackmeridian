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
 * The highlighter. Only behind figures that are the user's own terms: their strike, their breakeven, their offer,
 * their floor. Never for emphasis, promotion or state. On Carbon it is a dark wash with a yellow underline.
 */
export function Marker({ children, flash = false, band = false, className }: MarkerProps) {
  return (
    <mark className={cx(styles.root, className)} data-flash={flash || undefined} data-band={band || undefined}>
      {children}
    </mark>
  )
}
