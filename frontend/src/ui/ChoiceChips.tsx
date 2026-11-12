import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconCheck } from './icons'
import { chipColumns } from './internal/chipColumns'
import { cx } from './internal/cx'
import styles from './ChoiceChips.module.css'

const px = (value: string): number => Number.parseFloat(value) || 0

/** The narrowest track a chip's first line fits in: its in-flow content, the label's padding, the chip's edge. */
function chipNeed(chip: HTMLElement, label: HTMLElement): number {
  const chipStyle = getComputedStyle(chip)
  const labelStyle = getComputedStyle(label)
  let content = 0
  let items = 0
  for (const child of Array.from(label.children)) {
    if (getComputedStyle(child).position === 'absolute') continue
    content += child.getBoundingClientRect().width
    items += 1
  }
  content += Math.max(0, items - 1) * px(labelStyle.columnGap)
  return Math.ceil(
    content +
      px(labelStyle.paddingLeft) +
      px(labelStyle.paddingRight) +
      px(chipStyle.paddingLeft) +
      px(chipStyle.paddingRight) +
      px(chipStyle.borderLeftWidth) +
      px(chipStyle.borderRightWidth),
  )
}

/** Measures the grid and its chips before the first paint and on every resize; `aim` until measured. */
function useChipColumns(count: number, aim: number, contentKey: string) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [columns, setColumns] = useState(aim)
  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return
    const read = () => {
      const chips = Array.from(grid.children) as HTMLElement[]
      let need = 0
      for (const chip of chips) {
        const label = chip.querySelector<HTMLElement>('[data-chip-label]')
        if (label) need = Math.max(need, chipNeed(chip, label))
      }
      setColumns(chipColumns(count, aim, grid.clientWidth, need, px(getComputedStyle(grid).columnGap)))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(read)
    observer.observe(grid)
    // A web font that arrives late changes every figure's width.
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) read()
    })
    return () => {
      live = false
      observer.disconnect()
    }
  }, [count, aim, contentKey])
  return [ref, columns] as const
}

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
  /**
   * How many columns the grid aims for (default 5). Fewer when the widest chip would not fit, balanced across the
   * rows. Pass the number of chips to fill one row edge to edge, so stacked groups end on the same edge.
   */
  columns?: number
  /**
   * `control` (default): compact chips for forms. `note`: serif figures typeset on a contract note. In both the
   * chosen chip takes the selection tint and a tick marks a `marked` chip.
   */
  appearance?: 'control' | 'note'
  /** Deprecated and ignored: every chip grid fills its row, so two stacked groups end on the same edge. */
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
  className,
}: ChoiceChipsProps<V>) {
  const id = useId()
  const contentKey = chips.map((chip) => `${chip.label}${chip.marked ? '*' : ''}`).join('|')
  const [gridRef, fitted] = useChipColumns(chips.length, columns, `${appearance}:${contentKey}`)
  return (
    <div className={cx(styles.root, className)} data-appearance={appearance}>
      <div className={styles.head}>
        <span id={`${id}-label`} className={styles.legend}>
          {label}
        </span>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      <div
        ref={gridRef}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className={styles.grid}
        style={{ ['--chip-columns' as string]: String(Math.max(1, fitted)) }}
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
            <span className={styles.label} data-chip-label="">
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
