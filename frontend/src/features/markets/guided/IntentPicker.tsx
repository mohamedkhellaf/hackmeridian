import { useId } from 'react'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import type { GuidedIntent } from '../../../core/payoff/strategies'
import { Glyph } from '../../../ui'
import { INTENT_COPY, PICKER_LABEL } from './copy'
import styles from './IntentPicker.module.css'

export interface IntentPickerProps {
  value: GuidedIntent
  onChange: (intent: GuidedIntent) => void
}

/**
 * The four intents as one radio group, a row of four names: the sentences that explain them were read on
 * Markets, and stay in each option's accessible name. Native radios, so it is one tab stop and the arrow keys
 * move and select.
 */
export function IntentPicker({ value, onChange }: IntentPickerProps) {
  const id = useId()
  return (
    <section className={styles.root} aria-labelledby={`${id}-label`}>
      <h2 id={`${id}-label`} className={styles.label}>
        {PICKER_LABEL}
      </h2>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className={styles.group}>
        {GUIDED_INTENTS.map((intent) => {
          const copy = INTENT_COPY[intent.id]
          return (
            <label key={intent.id} className={styles.option} data-selected={intent.id === value || undefined}>
              <input
                type="radio"
                className={styles.input}
                name={id}
                value={intent.id}
                checked={intent.id === value}
                onChange={() => onChange(intent.id)}
                aria-label={`${intent.name}. ${copy.line} ${copy.money.label} ${copy.money.value}.`}
              />
              <Glyph name={copy.glyph} size={14} className={styles.glyph} />
              <span className={styles.name}>{intent.name}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
