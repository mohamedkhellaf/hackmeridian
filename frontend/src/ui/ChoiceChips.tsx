import { useId } from 'react'
import type { ReactNode } from 'react'
import { IconCheck } from './icons'
import { cx } from './internal/cx'
import styles from './ChoiceChips.module.css'

export interface ChoiceChip<V extends string = string> {
  value: V
  /** The first line: a figure or a date. */
  label: string
  /** A second, smaller line: the days left under a deadline, the distance from a reference price. */
  detail?: string
  /** The full accessible name, when the two short lines do not read well on their own. */
  name?: string
  /** Something stands behind this choice (a funded offer). Drawn as a tick; say it in `name` too. */
  marked?: boolean
}

export interface ChoiceChipsProps<V extends string = string> {
  /** Visible label of the group. */
  label: ReactNode
  /** Right of the label: a reference price with its source, a count. */
  aside?: ReactNode
  /** `null` when none is chosen (a custom value is in play). */
  value: V | null
  onValueChange: (value: V) => void
  chips: ReadonlyArray<ChoiceChip<V>>
  /** How many columns the grid aims for (default 5). */
  columns?: number
  /**
   * `control` (default): compact chips, ink when chosen, for forms.
   * `note`: serif figures typeset on a contract note; a tick when `marked`. The grid drops to five, then three
   * columns as its container narrows.
   */
  appearance?: 'control' | 'note'
  /** `fixed` keeps a few chips from stretching across the whole row (`note` only). */
  width?: 'even' | 'fixed'
  className?: string
}

/**
 * One choice among a handful of values that need more room than a `Segmented` strip: chips that wrap, each with
 * an optional second line. A real radio group on native inputs: one tab stop, arrow keys move and select, the
 * choice is announced. Chips are 44 px tall on touch screens.
 */
export function ChoiceChips<V extends string = string>({
  label,
  aside,
  value,
  onValueChange,
  chips,
  columns = 5,
  appearance = 'control',
  width = 'even',
  className,
}: ChoiceChipsProps<V>) {
  const id = useId()
  return (
    <div className={cx(styles.root, className)} data-appearance={appearance}>
      <div className={styles.head}>
        <span id={`${id}-label`} className={styles.legend}>
          {label}
        </span>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className={styles.grid}
        data-width={width}
        style={{ ['--chip-columns' as string]: String(Math.max(1, columns)) }}
      >
        {chips.map((chip) => (
          <label key={chip.value} className={styles.chip} data-checked={chip.value === value || undefined} data-marked={chip.marked || undefined}>
            <input
              type="radio"
              className={styles.input}
              name={id}
              value={chip.value}
              checked={chip.value === value}
              onChange={() => onValueChange(chip.value)}
              aria-label={chip.name}
            />
            <span className={styles.label}>
              <span>{chip.label}</span>
              {chip.marked ? <IconCheck className={styles.tick} size={12} /> : null}
            </span>
            {chip.detail ? <span className={styles.detail}>{chip.detail}</span> : null}
          </label>
        ))}
      </div>
    </div>
  )
}
