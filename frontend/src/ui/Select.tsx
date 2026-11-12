import { Field as BaseField } from '@base-ui/react/field'
import { Select as BaseSelect } from '@base-ui/react/select'
import type { ReactNode, RefObject } from 'react'
import { FieldMessages } from './Field'
import { IconCheck, IconSelect } from './icons'
import { cx } from './internal/cx'
import { isFieldError } from './internal/fieldError'
import field from './Field.module.css'
import popup from './internal/popup.module.css'
import styles from './Select.module.css'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
  /** Secondary text on the right of the row, for example a count. */
  detail?: string
  disabled?: boolean
}

export interface SelectProps<V extends string = string> {
  label: ReactNode
  /** Keeps the label for screen readers only. */
  hideLabel?: boolean
  value: V | null
  onValueChange: (value: V) => void
  options: ReadonlyArray<SelectOption<V>>
  placeholder?: string
  size?: 'md' | 'sm'
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  name?: string
  /** Called when the list starts to open or close. */
  onOpenChange?: (open: boolean) => void
  /** Called once the list has finished opening or closing (after its exit transition). */
  onOpenChangeComplete?: (open: boolean) => void
  /** Where focus goes when the list closes, instead of the trigger (a heading the choice scrolls to). */
  finalFocus?: RefObject<HTMLElement | null>
  className?: string
}

/** One choice from a short, known list. For long or searchable lists use `Combobox`. */
export function Select<V extends string = string>({
  label,
  hideLabel = false,
  value,
  onValueChange,
  options,
  placeholder = 'Choose',
  size = 'md',
  hint,
  error,
  disabled,
  name,
  onOpenChange,
  onOpenChangeComplete,
  finalFocus,
  className,
}: SelectProps<V>) {
  return (
    <BaseField.Root className={cx(field.root, className)} invalid={isFieldError(error)} disabled={disabled} name={name}>
      <BaseSelect.Root<V>
        items={options as Array<SelectOption<V>>}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next)
        }}
        disabled={disabled}
        onOpenChange={onOpenChange ? (open) => onOpenChange(open) : undefined}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        <BaseSelect.Label className={cx(field.label, hideLabel && 'ui-vh')}>{label}</BaseSelect.Label>
        <BaseSelect.Trigger className={styles.trigger} data-size={size}>
          <BaseSelect.Value className={styles.value} placeholder={placeholder} />
          <BaseSelect.Icon className={styles.caret}>
            <IconSelect />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        <BaseSelect.Portal>
          <BaseSelect.Positioner className={popup.positioner} sideOffset={4} alignItemWithTrigger={false} align="start">
            <BaseSelect.Popup className={popup.popup} finalFocus={finalFocus}>
              <BaseSelect.List className={popup.list}>
                {options.map((option) => (
                  <BaseSelect.Item key={option.value} value={option.value} disabled={option.disabled} className={popup.item}>
                    <span className={popup.indicatorSlot}>
                      <BaseSelect.ItemIndicator>
                        <IconCheck />
                      </BaseSelect.ItemIndicator>
                    </span>
                    <BaseSelect.ItemText className={popup.itemText}>{option.label}</BaseSelect.ItemText>
                    {option.detail ? <span className={popup.itemDetail}>{option.detail}</span> : null}
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            </BaseSelect.Popup>
          </BaseSelect.Positioner>
        </BaseSelect.Portal>
      </BaseSelect.Root>
      <FieldMessages hint={hint} error={error} />
    </BaseField.Root>
  )
}
