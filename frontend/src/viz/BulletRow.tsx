import { Bullet } from './Bullet.tsx'
import { reserveState } from './bulletGeometry.ts'
import type { ReserveState } from './bulletGeometry.ts'
import { cx } from './cx.ts'
import { SignGlyph } from './parts.tsx'
import css from './BulletRow.module.css'

const WORDS: Record<ReserveState, string> = { short: 'short', over: 'over', equal: 'equal' }

export interface BulletRowProps {
  /** Row name, usually the token code. */
  name?: string
  /** What open options require. Drawn as the tick. */
  locked: number
  /** What the contract holds. Drawn as the bar. */
  held: number
  /** Right end of the scale. Defaults to the larger of the two, so every row fills its own width. */
  max?: number
  /** Exact, caller-formatted texts: "Held 230.00", "Locked 250.00". */
  heldLabel: string
  lockedLabel: string
  /** The exact difference, signed by the caller: "−20.00", "+0.40", "0.00". */
  differenceLabel: string
  /** The word that goes with the difference. Defaults to short, over, equal. */
  differenceWord?: string
  /** Hides the row from assistive technology when a table beside it carries the same figures. */
  decorative?: boolean
  className?: string
}

/**
 * One reserve as a bullet: the held balance (bar) against what is locked (tick), with the exact difference in
 * words and figures. A shortfall is hatched. Nothing here says a reserve is "backed": it shows two numbers.
 */
export function BulletRow({ name, locked, held, max, heldLabel, lockedLabel, differenceLabel, differenceWord, decorative = false, className }: BulletRowProps) {
  const state = reserveState(locked, held)
  const word = differenceWord ?? WORDS[state]
  const top = (max ?? Math.max(locked, held)) / 0.94
  return (
    <div className={cx(css.wrap, className)} aria-hidden={decorative ? true : undefined}>
      <div className={css.row} data-state={state} data-named={name ? 'true' : undefined}>
        {name && <span className={css.name}>{name}</span>}
        <div className={css.bar}>
          <Bullet value={held} target={locked} max={top} excess="neutral" height={18} />
        </div>
        <p className={css.text}>
          <span className={css.amounts}>
            {heldLabel}
            <span className={css.sep} aria-hidden="true">
              {' / '}
            </span>
            <span className={css.vhComma}>, </span>
            {lockedLabel}
          </span>
          <span className={css.difference}>
            {state === 'short' && <SignGlyph direction="loss" />}
            <span>
              {differenceLabel} {word}
            </span>
          </span>
        </p>
      </div>
    </div>
  )
}
