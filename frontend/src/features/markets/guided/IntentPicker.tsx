import { useId } from 'react'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import type { GuidedIntent } from '../../../core/payoff/strategies'
import { Glyph } from '../../../ui'
import { INTENT_COPY, PICKER_LABEL, SECONDARY_INTENT_LEAD } from './copy'
import styles from './IntentPicker.module.css'

export interface IntentPickerProps {
  value: GuidedIntent
  onChange: (intent: GuidedIntent) => void
}

/**
 * The four intents as one radio group: the three main ones as cards, "Lock a buy price" as a quieter row under
 * them. Native radios, so it is one tab stop and the arrow keys move and select.
 */
export function IntentPicker({ value, onChange }: IntentPickerProps) {
  const id = useId()
  const main = GUIDED_INTENTS.filter((i) => i.main)
  const secondary = GUIDED_INTENTS.filter((i) => !i.main)
  const option = (intent: (typeof GUIDED_INTENTS)[number], quiet: boolean) => {
    const copy = INTENT_COPY[intent.id]
    return (
      <label key={intent.id} className={styles.option} data-quiet={quiet || undefined} data-selected={intent.id === value || undefined}>
        <input
          type="radio"
          className={styles.input}
          name={id}
          value={intent.id}
          checked={intent.id === value}
          onChange={() => onChange(intent.id)}
          aria-label={`${intent.name}. ${copy.line} ${copy.money.label} ${copy.money.value}.`}
        />
        <span className={styles.head}>
          <Glyph name={copy.glyph} size={quiet ? 12 : 14} className={styles.glyph} />
          {quiet ? <span className={styles.lead}>{SECONDARY_INTENT_LEAD}:</span> : null}
          <span className={styles.name}>{intent.name}</span>
        </span>
        <span className={styles.line}>{copy.line}</span>
        <span className={styles.money}>
          <span className={styles.moneyLabel}>{copy.money.label}</span> {copy.money.value}
        </span>
      </label>
    )
  }
  return (
    <section className={styles.root} aria-labelledby={`${id}-label`}>
      <h2 id={`${id}-label`} className={styles.label}>
        {PICKER_LABEL}
      </h2>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className={styles.group}>
        <div className={styles.cards}>{main.map((intent) => option(intent, false))}</div>
        {secondary.map((intent) => option(intent, true))}
      </div>
    </section>
  )
}
