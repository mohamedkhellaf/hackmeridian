import { useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../internal/cx'
import styles from './Mark.module.css'

/**
 * The cuts of the Counterpart mark.
 * `two-ink` is the standard cut: royal ink above, ink below.
 * `hollow` is one ink with an outlined upper part, for stamps and one-colour print.
 * `display` hatches the upper part at 45 degrees; 48 px and up only.
 */
export type MarkCut = 'two-ink' | 'hollow' | 'display'

/* A 36 unit sheet with 3 unit corners, cut in two along a call payoff. The gap between the parts is 3 units. */
const UPPER = 'M6 6H39.88L19.38 26.5H6Z'
const LOWER = 'M6 29.5H20.62L42 8.12V42H6Z'

export interface MarkProps {
  cut?: MarkCut
  /** Width and height in px. */
  size?: number
  /** Accessible name. Leave out when the wordmark is next to it. */
  label?: string
  className?: string
}

/**
 * "Counterpart": a square sheet cut in two along the payoff line. Two parties, one contract.
 * The lower part takes the current text colour and the upper part the accent, so it follows the theme.
 */
export function Mark({ cut = 'two-ink', size = 24, label, className }: MarkProps) {
  const id = useId()
  const sheet = `${id}-sheet`
  const upper = `${id}-upper`
  const hatch = `${id}-hatch`
  let upperPart: ReactNode
  if (cut === 'hollow') {
    upperPart = (
      <g clipPath={`url(#${upper})`} fill="none" stroke="currentColor" strokeWidth={5}>
        <path d={UPPER} />
        <rect x="6" y="6" width="36" height="36" rx="3" />
      </g>
    )
  } else if (cut === 'display') {
    upperPart = <path d={UPPER} fill={`url(#${hatch})`} />
  } else {
    upperPart = <path d={UPPER} className={styles.accent} />
  }
  return (
    <svg
      className={cx(styles.mark, className)}
      viewBox="6 6 36 36"
      width={size}
      height={size}
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-cut={cut}
    >
      <defs>
        <clipPath id={sheet}>
          <rect x="6" y="6" width="36" height="36" rx="3" />
        </clipPath>
        {cut === 'hollow' ? (
          <clipPath id={upper}>
            <path d={UPPER} />
          </clipPath>
        ) : null}
        {cut === 'display' ? (
          <pattern id={hatch} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="1.1" fill="currentColor" />
          </pattern>
        ) : null}
      </defs>
      <g clipPath={`url(#${sheet})`}>
        {upperPart}
        <path d={LOWER} fill="currentColor" />
      </g>
    </svg>
  )
}

export interface WordmarkProps {
  /** Font size as a CSS length. Defaults to the size of its context. */
  size?: string
  className?: string
}

/** "StellSec" set in Source Serif 4 at weight 620, tracked at minus 0.012 em. It is text, not a picture. */
export function Wordmark({ size, className }: WordmarkProps) {
  return (
    <span className={cx(styles.wordmark, className)} style={size ? { fontSize: size } : undefined}>
      StellSec
    </span>
  )
}

export interface LogoProps {
  /** Height of the mark in px. The wordmark scales with it. */
  size?: number
  cut?: MarkCut
  className?: string
}

/** The lockup: the mark, then the wordmark. The wordmark carries the name, so the mark is decorative here. */
export function Logo({ size = 22, cut = 'two-ink', className }: LogoProps) {
  return (
    <span className={cx(styles.logo, className)} style={{ fontSize: `${(size * 1.0) / 16}rem` }}>
      <Mark cut={cut} size={size} />
      <Wordmark />
    </span>
  )
}
