import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { ReactNode } from 'react'
import { cx } from './internal/cx'
import styles from './Switch.module.css'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** The label names the setting, not the state ("Show closed positions"). */
  children: ReactNode
  /** Puts the label before the switch, for rows of settings aligned on the right. */
  labelFirst?: boolean
  disabled?: boolean
  className?: string
}

/** An immediate on or off setting. For a choice that needs a confirm step, use a checkbox in a form. */
export function Switch({ checked, onCheckedChange, children, labelFirst = false, disabled = false, className }: SwitchProps) {
  return (
    <label className={cx(styles.root, className)} data-label-first={labelFirst || undefined} data-disabled={disabled || undefined}>
      <BaseSwitch.Root
        className={styles.track}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled}
      >
        <BaseSwitch.Thumb className={styles.thumb} />
      </BaseSwitch.Root>
      <span className={styles.label}>{children}</span>
    </label>
  )
}
