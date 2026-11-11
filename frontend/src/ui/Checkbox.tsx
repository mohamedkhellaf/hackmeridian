import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Checkbox.module.css'

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** The label. For a consent gate, the full sentence the user agrees to. */
  children: ReactNode
  /** A second line under the label. */
  description?: ReactNode
  indeterminate?: boolean
  disabled?: boolean
  required?: boolean
  name?: string
  className?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  children,
  description,
  indeterminate = false,
  disabled = false,
  required,
  name,
  className,
}: CheckboxProps) {
  return (
    <label className={cx(styles.root, className)} data-disabled={disabled || undefined}>
      <BaseCheckbox.Root
        className={styles.box}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        indeterminate={indeterminate}
        disabled={disabled}
        required={required}
        name={name}
      >
        <BaseCheckbox.Indicator className={styles.indicator}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
            <path d={indeterminate ? 'M3 6h6' : 'M2.5 6.3 5 8.7 9.5 3.6'} />
          </svg>
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span className={styles.text}>
        <span className={styles.label}>{children}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
    </label>
  )
}
