import type { ReactNode } from 'react'
import { direction } from './a11y.ts'
import { cx } from './cx.ts'
import css from './OutcomeCards.module.css'

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
  /** The scenario the price handle is on. */
  current?: boolean
}

export interface OutcomeCardsProps {
  outcomes: readonly Outcome[]
  /** Makes each card selectable, for example to move the price handle to that scenario. */
  onSelect?: (id: string) => void
  /** Accessible name of the list. */
  label?: string
  className?: string
}

/** "+6.64 USDx more than without the floor": the signed amount and its unit, then the words. */
const SIGNED_LEAD = /^([+\u2212-]\s?[<\d][\d,.]*(?:\s[A-Z][A-Za-z]{1,5})?)(\s.*)?$/

function DeltaText({ text }: { text: string }) {
  const m = SIGNED_LEAD.exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      <span className={css.deltaAmount}>{m[1]}</span>
      {m[2] ?? null}
    </>
  )
}

/** Scenarios side by side (a lower and a higher price, or low, reference, high): a serif figure and a sentence each. */
export function OutcomeCards({ outcomes, onSelect, label = 'Outcomes', className }: OutcomeCardsProps) {
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
                  <DeltaText text={o.delta.text} />
                </p>
              )}
              {o.sentence && <p className={css.sentence}>{o.sentence}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
