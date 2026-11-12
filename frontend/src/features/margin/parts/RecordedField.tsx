import type { ReactNode } from 'react'
import { AmountField } from '../../../ui'
import css from './RecordedField.module.css'

const KEEP = () => {}

export interface RecordedFieldProps {
  label: string
  unit: string
  /** The recorded amount as it would be typed, or '' when the scenario records none. */
  value: string
  /** "Recorded amount for step 4.", and which steps a press runs first. */
  hint: ReactNode
  aside?: ReactNode
}

/**
 * Fixture builds: an amount the replay takes from the recorded step, shown in the field it would be typed in and
 * locked (read-only, still focusable and read out), so the form never shows a figure the press does not use
 * (ruling F11). The hint names the step. With no recorded step there is no field: the hint alone says why.
 */
export function RecordedField({ label, unit, value, hint, aside }: RecordedFieldProps) {
  if (value === '') return hint ? <p className={css.none}>{hint}</p> : null
  return <AmountField label={label} unit={unit} value={value} onValueChange={KEEP} readOnly placeholder="" className={css.locked} hint={hint} aside={aside} />
}
