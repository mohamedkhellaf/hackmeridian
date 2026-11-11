import { Field as BaseField } from '@base-ui/react/field'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import type { ReactNode } from 'react'
import { FieldMessages } from './Field'
import { cx } from './internal/cx'
import field from './Field.module.css'
import styles from './Slider.module.css'

export interface SliderProps {
  label: ReactNode
  hideLabel?: boolean
  /** Sliders work on plain numbers and are for illustration only (an assumed price). Never bind one to an amount that is signed. */
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Page Up, Page Down and Shift with an arrow key move by this much. */
  largeStep?: number
  /** The value as text, shown next to the label and read by screen readers ("9.20 USDx per unit"). */
  valueText?: (value: number) => string
  /** Tick labels under the track, for example the low, reference and high price. */
  marks?: ReadonlyArray<{ value: number; label: ReactNode }>
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

export function Slider({
  label,
  hideLabel = false,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep,
  valueText,
  marks,
  hint,
  disabled = false,
  className,
}: SliderProps) {
  const text = valueText ? valueText(value) : String(value)
  const span = max - min || 1
  return (
    <BaseField.Root className={cx(field.root, className)} disabled={disabled}>
      <div className={cx(field.labelRow, hideLabel && 'ui-vh')}>
        <BaseField.Label className={field.label}>{label}</BaseField.Label>
        <span className={styles.value} aria-hidden="true">
          {text}
        </span>
      </div>
      <BaseSlider.Root
        value={value}
        onValueChange={(next) => onValueChange(Array.isArray(next) ? (next[0] ?? min) : next)}
        min={min}
        max={max}
        step={step}
        largeStep={largeStep}
        disabled={disabled}
        thumbAlignment="edge"
      >
        <BaseSlider.Control className={styles.control}>
          <BaseSlider.Track className={styles.track}>
            <BaseSlider.Indicator className={styles.indicator} />
            <BaseSlider.Thumb className={styles.thumb} getAriaValueText={() => text} />
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
      {marks && marks.length > 0 ? (
        <div className={styles.marks} aria-hidden="true">
          {marks.map((mark) => (
            <span
              key={mark.value}
              className={styles.mark}
              style={{ insetInlineStart: `${((mark.value - min) / span) * 100}%` }}
              data-edge={mark.value <= min ? 'start' : mark.value >= max ? 'end' : undefined}
            >
              {mark.label}
            </span>
          ))}
        </div>
      ) : null}
      <FieldMessages hint={hint} />
    </BaseField.Root>
  )
}
