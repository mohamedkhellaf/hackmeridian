import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Field as BaseField } from '@base-ui/react/field'
import type { ReactNode } from 'react'
import { FieldMessages } from './Field'
import { IconCheck, IconChevronDown, IconClose } from './icons'
import { cx } from './internal/cx'
import { isFieldError } from './internal/fieldError'
import field from './Field.module.css'
import popup from './internal/popup.module.css'
import styles from './Combobox.module.css'

export interface ComboboxItem<V extends string = string> {
  value: V
  label: string
  /** Secondary text on the right of the row, for example an issuer's short address. */
  detail?: string
}

export interface ComboboxProps<V extends string = string> {
  label: ReactNode
  hideLabel?: boolean
  value: V | null
  onValueChange: (value: V | null) => void
  items: ReadonlyArray<ComboboxItem<V>>
  placeholder?: string
  /** Shown when nothing matches what was typed. One short line. */
  emptyText?: string
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  className?: string
}

/** A searchable choice from a longer list (assets, accounts). Type to filter, arrow keys to move, Enter to choose. */
export function Combobox<V extends string = string>({
  label,
  hideLabel = false,
  value,
  onValueChange,
  items,
  placeholder,
  emptyText = 'No match.',
  hint,
  error,
  disabled,
  className,
}: ComboboxProps<V>) {
  const selected = items.find((item) => item.value === value) ?? null
  return (
    <BaseField.Root className={cx(field.root, className)} invalid={isFieldError(error)} disabled={disabled}>
      <BaseCombobox.Root<ComboboxItem<V>>
        items={items as Array<ComboboxItem<V>>}
        value={selected}
        onValueChange={(next) => onValueChange(next ? next.value : null)}
        isItemEqualToValue={(a, b) => a.value === b.value}
        disabled={disabled}
      >
        <BaseField.Label className={cx(field.label, hideLabel && 'ui-vh')}>{label}</BaseField.Label>
        <BaseCombobox.InputGroup className={cx(field.well, styles.group)}>
          <BaseCombobox.Input className={field.input} placeholder={placeholder} />
          <BaseCombobox.Clear className={styles.action} aria-label="Clear the selection">
            <IconClose />
          </BaseCombobox.Clear>
          <BaseCombobox.Trigger className={styles.action} aria-label="Show the options">
            <IconChevronDown />
          </BaseCombobox.Trigger>
        </BaseCombobox.InputGroup>
        <BaseCombobox.Portal>
          <BaseCombobox.Positioner className={popup.positioner} sideOffset={4} align="start">
            <BaseCombobox.Popup className={cx(popup.popup, styles.popup)}>
              <BaseCombobox.Empty className={popup.empty}>{emptyText}</BaseCombobox.Empty>
              <BaseCombobox.List className={popup.list}>
                {(item: ComboboxItem<V>) => (
                  <BaseCombobox.Item key={item.value} value={item} className={popup.item}>
                    <span className={popup.indicatorSlot}>
                      <BaseCombobox.ItemIndicator>
                        <IconCheck />
                      </BaseCombobox.ItemIndicator>
                    </span>
                    <span className={popup.itemText}>{item.label}</span>
                    {item.detail ? <span className={cx(popup.itemDetail, 'ui-mono')}>{item.detail}</span> : null}
                  </BaseCombobox.Item>
                )}
              </BaseCombobox.List>
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </BaseCombobox.Root>
      <FieldMessages hint={hint} error={error} />
    </BaseField.Root>
  )
}
