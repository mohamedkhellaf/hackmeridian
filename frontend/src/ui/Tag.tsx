import { cx } from './internal/cx'
import styles from './Tag.module.css'

/**
 * How a state reads at a glance, by shape rather than hue:
 * `open` waits for a counterparty (outline), `live` is in force (ink outline, heavier),
 * `done` was carried out (filled), `ended` lapsed or was withdrawn (dashed, muted).
 */
export type TagAppearance = 'open' | 'live' | 'done' | 'ended'

const KNOWN: Record<string, TagAppearance> = {
  offered: 'open',
  open: 'open',
  listed: 'open',
  pending: 'open',
  active: 'live',
  exercised: 'done',
  filled: 'done',
  settled: 'done',
  claimed: 'done',
  expired: 'ended',
  cancelled: 'ended',
  reclaimed: 'ended',
  liquidated: 'ended',
}

export interface TagProps {
  /** The contract's own state name, unchanged: `Offered`, `Active`, `Exercised`, `Expired`, `Cancelled`. */
  state: string
  /** Override for a state name this list does not know. */
  appearance?: TagAppearance
  className?: string
}

/**
 * The only tag in the product, and it only ever carries a contract state name. Not for "New", "Beta",
 * "Verified", tiers, kinds or anything promotional: those are words in a column.
 */
export function Tag({ state, appearance, className }: TagProps) {
  const look = appearance ?? KNOWN[state.toLowerCase()] ?? 'open'
  return (
    <span className={cx(styles.root, className)} data-appearance={look}>
      {state}
    </span>
  )
}
