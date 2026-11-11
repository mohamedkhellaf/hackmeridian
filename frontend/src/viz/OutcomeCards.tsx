import type { ReactNode } from 'react'
import { direction } from './a11y.ts'
import { Bullet } from './Bullet.tsx'
import { cx } from './cx.ts'
import { SignGlyph } from './parts.tsx'
import css from './OutcomeCards.module.css'

export interface ScenarioBarProps {
  /** The value with the option: the ink bar. */
  value: number
  /** The value without it: the tick. */
  compare?: number
  /** Right end of the scale. Give every bar of a set the same maximum so they compare. */
  max?: number
  /** Accessible name. Leave out when the text beside the bar already gives the figures. */
  label?: string
}

/** A small bar for one scenario: what you would hold, against what you would hold without the option. */
export function ScenarioBar({ value, compare, max, label }: ScenarioBarProps) {
  const top = max ?? Math.max(value, compare ?? 0)
  return <Bullet value={value} target={compare} max={top / 0.94} excess="gain" height={16} label={label} />
}

export interface Outcome {
  id: string
  /** The scenario in words: "If BOND falls to 8.00". */
  label: string
  /** The headline figure, formatted by the caller from exact amounts: "48.20". */
  figure: string
  unit?: string
  /** The difference the option makes in this scenario. `value` gives the sign; `text` is the full signed phrase. */
  delta?: { value: number; text: string }
  /** One sentence on what the holder would do or hold. */
  sentence?: ReactNode
  /** The small bar. `compare` is the same scenario without the option. */
  bar?: { value: number; compare?: number }
  /** The scenario the price handle is on. */
  current?: boolean
}

export interface OutcomeCardsProps {
  outcomes: readonly Outcome[]
  /** Makes each card selectable, for example to move the price handle to that scenario. */
  onSelect?: (id: string) => void
  /** What the bar and the tick stand for, printed once under the cards. */
  barKey?: { value: string; compare: string }
  /** Accessible name of the list. */
  label?: string
  className?: string
}

/** Three scenarios side by side (low, reference, high): a serif figure, a sentence and a small bar each. */
export function OutcomeCards({ outcomes, onSelect, barKey, label = 'Outcomes', className }: OutcomeCardsProps) {
  const max = Math.max(0, ...outcomes.flatMap((o) => (o.bar ? [o.bar.value, o.bar.compare ?? 0] : [])))
  return (
    <div className={cx(css.wrap, className)}>
      <ul className={css.cards} role="list" aria-label={label} data-count={outcomes.length}>
        {outcomes.map((o) => {
          const side = o.delta ? direction(o.delta.value) : 'even'
          return (
            <li key={o.id} className={css.card} data-current={o.current ? 'true' : undefined} data-selectable={onSelect ? 'true' : undefined}>
              {onSelect ? (
                <button type="button" className={css.select} aria-pressed={o.current ? 'true' : 'false'} onClick={() => onSelect(o.id)}>
                  {o.label}
                </button>
              ) : (
                <p className={css.label}>{o.label}</p>
              )}
              <p className={css.figure}>
                {o.figure}
                {o.unit && <span className={css.unit}> {o.unit}</span>}
              </p>
              {o.delta && (
                <p className={css.delta} data-direction={side}>
                  {side !== 'even' && <SignGlyph direction={side} />}
                  <span>{o.delta.text}</span>
                </p>
              )}
              {o.sentence && <p className={css.sentence}>{o.sentence}</p>}
              {o.bar && (
                <div className={css.bar}>
                  <ScenarioBar value={o.bar.value} compare={o.bar.compare} max={max} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {barKey && (
        <p className={css.key} aria-hidden="true">
          <span className={css.keyBar} />
          {barKey.value}
          <span className={css.keyTick} />
          {barKey.compare}
        </p>
      )}
    </div>
  )
}
