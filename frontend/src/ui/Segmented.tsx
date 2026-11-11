import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Segmented.module.css'

export interface SegmentedOption<V extends string = string> {
  value: V
  label: ReactNode
  icon?: ReactNode
  /** A second, smaller line inside the segment (days left under a deadline). */
  detail?: ReactNode
  /** A count after the label (offers on a deadline), with its meaning for screen readers ("4 offers"). */
  count?: number
  countLabel?: string
  disabled?: boolean
}

export interface SegmentedProps<V extends string = string> {
  /** Names the group for screen readers; shown above the control with `showLabel`. */
  label: ReactNode
  showLabel?: boolean
  value: V
  onValueChange: (value: V) => void
  options: ReadonlyArray<SegmentedOption<V>>
  size?: 'md' | 'sm'
  fullWidth?: boolean
  disabled?: boolean
  className?: string
}

/**
 * A choice between a few modes of the same view (Guided or Chain, Put or Call, a deadline).
 * It is a real radio group: one tab stop, arrow keys move and select, the choice is announced as "selected".
 * To move between pages use `NavTabs`; to swap panels use `Tabs`.
 */
export function Segmented<V extends string = string>({
  label,
  showLabel = false,
  value,
  onValueChange,
  options,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
}: SegmentedProps<V>) {
  const labelId = useId()
  return (
    <div className={cx(styles.root, className)} data-full-width={fullWidth || undefined}>
      <span id={labelId} className={showLabel ? styles.groupLabel : 'ui-vh'}>
        {label}
      </span>
      <BaseRadioGroup<V>
        aria-labelledby={labelId}
        className={styles.group}
        data-size={size}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        disabled={disabled}
      >
        {options.map((option) => (
          <BaseRadio.Root
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            nativeButton
            render={<button type="button" />}
            className={styles.segment}
          >
            {option.icon ? <span className={styles.icon}>{option.icon}</span> : null}
            <span className={styles.text}>
              {option.count === undefined ? (
                <span>{option.label}</span>
              ) : (
                <span className={styles.labelRow}>
                  <span>{option.label}</span>
                  <span className={styles.count} aria-hidden={option.countLabel ? true : undefined}>
                    {option.count}
                  </span>
                  {option.countLabel ? <span className="ui-vh">, {option.countLabel}</span> : null}
                </span>
              )}
              {option.detail ? <span className={styles.detail}>{option.detail}</span> : null}
            </span>
          </BaseRadio.Root>
        ))}
      </BaseRadioGroup>
    </div>
  )
}
