import { Popover as BasePopover } from '@base-ui/react/popover'
import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import { announce } from './announce'
import { cx } from './internal/cx'
import styles from './Amount.module.css'

const MINUS = '\u2212'

export interface AmountProps {
  /**
   * The figure as shown: formatted by the caller from exact integer units, truncated (never rounded up), grouped,
   * with the asset's fixed decimals. For a signed figure pass the magnitude and set `direction`.
   */
  value: string
  /** The same amount at full precision. When it differs from `value`, a press (click, Enter or Space) shows it in a popover. */
  exact?: string
  /** Shown once after the figure. Leave out where the column header carries the unit. */
  unit?: string
  /** Adds the sign (`+`, or the true minus) and the gain or loss colour; screen readers hear "gain of" or "loss of". Never colour alone. */
  direction?: 'gain' | 'loss'
  /** `serif` for key figures (term sheets, summaries), `sans` in tables. */
  figure?: 'sans' | 'serif'
  size?: 'md' | 'lg'
  /** Replaces the words read by screen readers ("loss of 0.36 USDx"). */
  srLabel?: string
  className?: string
}

/**
 * An amount on screen. The exact value is one press away, in a popover below the figure; it is never put in a
 * `title` attribute, which keyboard and touch users cannot reach. Focus alone opens nothing, so Tab moves from
 * figure to figure without stopping in a popup.
 */
export const Amount = memo(function Amount({ value, exact, unit, direction, figure = 'sans', size = 'md', srLabel, className }: AmountProps) {
  const [open, setOpen] = useState(false)
  const sign = direction === 'gain' ? '+' : direction === 'loss' ? MINUS : ''
  const spoken =
    srLabel ?? `${direction ? `${direction} of ` : ''}${value}${unit ? ` ${unit}` : ''}`

  const hasExact = exact !== undefined && exact !== value
  const body: ReactNode = (
    <>
      <span className="ui-vh">{hasExact ? `${spoken}, show the exact value` : spoken}</span>
      <span aria-hidden="true" className={styles.visible}>
        <span className={styles.number}>
          {sign}
          {value}
        </span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
    </>
  )

  if (!hasExact) {
    return (
      <span className={cx(styles.root, className)} data-direction={direction} data-figure={figure} data-size={size}>
        {body}
      </span>
    )
  }

  const exactText = `${sign}${exact}${unit ? ` ${unit}` : ''}`
  const change = (next: boolean) => {
    setOpen(next)
    if (next) announce(`Exact value ${exactText}`)
  }

  return (
    <BasePopover.Root open={open} onOpenChange={(next) => change(next)}>
      <BasePopover.Trigger
        className={cx(styles.root, styles.trigger, className)}
        data-direction={direction}
        data-figure={figure}
        data-size={size}
      >
        {body}
      </BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner className={styles.positioner} side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <BasePopover.Popup className={styles.popup} initialFocus={false}>
            <BasePopover.Title render={<span />} className={styles.popupLabel}>
              Exact value
            </BasePopover.Title>
            <span className={styles.popupValue}>{exactText}</span>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
})
