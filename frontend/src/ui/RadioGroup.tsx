import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './RadioGroup.module.css'

export interface RadioOption<V extends string = string> {
  value: V
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface RadioGroupProps<V extends string = string> {
  /** Names the group. */
  label: ReactNode
  hideLabel?: boolean
  value: V
  onValueChange: (value: V) => void
  options: ReadonlyArray<RadioOption<V>>
  orientation?: 'vertical' | 'horizontal'
  disabled?: boolean
  name?: string
  className?: string
}

/** One choice among a few, each with room for a description. Arrow keys move and select; Tab leaves the group. */
export function RadioGroup<V extends string = string>({
  label,
  hideLabel = false,
  value,
  onValueChange,
  options,
  orientation = 'vertical',
  disabled = false,
  name,
  className,
}: RadioGroupProps<V>) {
  const labelId = useId()
  return (
    <div className={cx(styles.root, className)}>
      <div id={labelId} className={cx(styles.groupLabel, hideLabel && 'ui-vh')}>
        {label}
      </div>
      <BaseRadioGroup<V>
        aria-labelledby={labelId}
        className={styles.group}
        data-orientation={orientation}
        value={value}
        onValueChange={(next) => onValueChange(next)}
        disabled={disabled}
        name={name}
      >
        {options.map((option) => (
          <label key={option.value} className={styles.item} data-disabled={disabled || option.disabled || undefined}>
            <BaseRadio.Root value={option.value} disabled={option.disabled} className={styles.radio}>
              <BaseRadio.Indicator className={styles.dot} />
            </BaseRadio.Root>
            <span className={styles.text}>
              <span>{option.label}</span>
              {option.description ? <span className={styles.description}>{option.description}</span> : null}
            </span>
          </label>
        ))}
      </BaseRadioGroup>
    </div>
  )
}
