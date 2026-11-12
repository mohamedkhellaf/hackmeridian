import { Field as BaseField } from '@base-ui/react/field'
import { useState } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { hasExponent, sanitizeDecimalInput } from './format'
import { IconWarning } from './icons'
import { cx } from './internal/cx'
import { isFieldError } from './internal/fieldError'
import styles from './Field.module.css'

export interface FieldProps {
  label: ReactNode
  /** One line under the control: what the value means, or a balance. */
  hint?: ReactNode
  /** Cause, consequence, fix, with exact figures. Shown with an icon, never by colour alone. */
  error?: ReactNode
  /** Right side of the label row, for example "Balance 12.50 BOND". */
  aside?: ReactNode
  /** Adds "optional" after the label. Required is the default and is not marked. */
  optional?: boolean
  /** Keeps the label for screen readers only. Use when a visible heading already names the control. */
  hideLabel?: boolean
  disabled?: boolean
  className?: string
  children: ReactNode
}

/** The error and hint lines under a control. Shared by the controls that bring their own label part. */
export function FieldMessages({ hint, error }: { hint?: ReactNode; error?: ReactNode }) {
  return (
    <>
      {isFieldError(error) ? (
        <BaseField.Error className={styles.error} match>
          <IconWarning className={styles.errorIcon} />
          <span>{error}</span>
        </BaseField.Error>
      ) : null}
      {hint ? <BaseField.Description className={styles.hint}>{hint}</BaseField.Description> : null}
    </>
  )
}

/**
 * Label, control, hint and error, wired together (label association, `aria-describedby`, `aria-invalid`).
 * Any Base UI control placed inside picks the wiring up; `TextField`, `AmountField`, `Select`, `Combobox`
 * and `Slider` already use it.
 */
export function Field({
  label,
  hint,
  error,
  aside,
  optional = false,
  hideLabel = false,
  disabled,
  className,
  children,
}: FieldProps) {
  return (
    <BaseField.Root className={cx(styles.root, className)} invalid={isFieldError(error)} disabled={disabled}>
      <div className={cx(styles.labelRow, hideLabel && 'ui-vh')}>
        <BaseField.Label className={styles.label}>
          {label}
          {optional ? <span className={styles.optional}> (optional)</span> : null}
        </BaseField.Label>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      {children}
      <FieldMessages hint={hint} error={error} />
    </BaseField.Root>
  )
}

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'value' | 'defaultValue' | 'onChange' | 'prefix' | 'type'
>

export interface TextFieldProps extends NativeInputProps, Omit<FieldProps, 'children'> {
  value: string
  onValueChange: (value: string) => void
  type?: 'text' | 'search' | 'email' | 'url'
  /** Mono face with a slashed zero, for addresses, ids and hashes. */
  mono?: boolean
  /** Inside the well, before the text (an icon). */
  prefix?: ReactNode
  /** Inside the well, after the text (a unit or a button). */
  suffix?: ReactNode
  inputRef?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  hint,
  error,
  aside,
  optional,
  hideLabel,
  disabled,
  className,
  value,
  onValueChange,
  type = 'text',
  mono = false,
  prefix,
  suffix,
  inputRef,
  ...input
}: TextFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      aside={aside}
      optional={optional}
      hideLabel={hideLabel}
      disabled={disabled}
      className={className}
    >
      <div className={styles.well} data-mono={mono || undefined}>
        {prefix ? <span className={styles.adornment}>{prefix}</span> : null}
        <BaseField.Control
          {...input}
          ref={inputRef}
          type={type}
          className={styles.input}
          value={value}
          onValueChange={(next) => onValueChange(next)}
          spellCheck={mono ? false : input.spellCheck}
          autoCapitalize={mono ? 'off' : input.autoCapitalize}
        />
        {suffix ? <span className={styles.adornment}>{suffix}</span> : null}
      </div>
    </Field>
  )
}

export interface AmountFieldProps
  extends Omit<NativeInputProps, 'inputMode' | 'pattern'>,
    Omit<FieldProps, 'children'> {
  /** A decimal string exactly as typed ("12.5"). Parsing to integer units is the caller's job. */
  value: string
  onValueChange: (value: string) => void
  /** Unit shown once, as a suffix ("USDx", "BOND"). */
  unit?: string
  /** Most fraction digits the asset allows. Further digits are not accepted. */
  decimals?: number
  /** Exact validation by the caller. Returns the error text, or nothing when the value is fine. Shown after the first blur. */
  validate?: (value: string) => ReactNode | undefined | null
  /** Shows a "Max" action inside the field. */
  onMax?: () => void
  /** Said after "Max" to screen readers, for example "use the full balance, 12.50 BOND". The visible word stays in the name. */
  maxLabel?: string
  inputRef?: Ref<HTMLInputElement>
}

/**
 * Amount entry on decimal strings. It is a text input with a decimal keypad, never `type="number"`:
 * no float, no spinner, no locale surprises. The figure is set in the serif at 16 px on every screen.
 */
export function AmountField({
  label,
  hint,
  error,
  aside,
  optional,
  hideLabel,
  disabled,
  className,
  value,
  onValueChange,
  unit,
  decimals,
  validate,
  onMax,
  maxLabel,
  inputRef,
  placeholder = '0.00',
  onBlur,
  ...input
}: AmountFieldProps) {
  const [touched, setTouched] = useState(false)
  // What the user typed, while it still reads as the value given back: "1,000" stays on screen as typed (it is
  // 1000) instead of turning into "1000" under the cursor, and a comma typed mid-number is not swallowed.
  const [draft, setDraft] = useState<string | null>(null)
  const validation = touched && validate ? validate(value) : undefined
  const shown = error ?? validation ?? undefined
  const display = draft !== null && sanitizeDecimalInput(draft, decimals) === value ? draft : value

  return (
    <Field
      label={
        <>
          {label}
          {unit ? <span className="ui-vh">, in {unit}</span> : null}
        </>
      }
      hint={hint}
      error={shown}
      aside={aside}
      optional={optional}
      hideLabel={hideLabel}
      disabled={disabled}
      className={className}
    >
      <div className={styles.well} data-amount>
        <BaseField.Control
          {...input}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={placeholder}
          className={styles.input}
          value={display}
          onValueChange={(next) => {
            // An exponent is refused rather than read as digits ("1e3" would otherwise become 13).
            if (hasExponent(next)) return
            const clean = sanitizeDecimalInput(next, decimals)
            const typed = next.replace(/[^0-9.,]/g, '')
            setDraft(typed.includes(',') ? typed : null)
            onValueChange(clean)
          }}
          onBlur={(event) => {
            setTouched(true)
            setDraft(null)
            onBlur?.(event)
          }}
        />
        {onMax ? (
          <button type="button" className={styles.max} onClick={onMax} disabled={disabled}>
            Max{maxLabel ? <span className="ui-vh">, {maxLabel}</span> : null}
          </button>
        ) : null}
        {unit ? (
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        ) : null}
      </div>
    </Field>
  )
}
