import { useId } from 'react'
import type { ReactNode } from 'react'
import { Amount, IconSelect, Marker } from '../../../ui'
import css from './Term.module.css'

interface TermLook {
  /** The value as it is typeset on the note: an asset code, a `TermAmount`, a date. */
  figure: ReactNode
  /** What follows a date on the same line: "08:00 UTC", "2026, 01:56 UTC". An amount carries its own unit. */
  rest?: ReactNode
  /** The visitor's own term goes under the highlighter. */
  marked?: boolean
}

/** An amount on the note: the kit's `Amount` at the size of the terms, its unit drawn by `Amount` itself. */
export function TermAmount({ value, unit }: { value: string; unit: string }) {
  return <Amount value={value} unit={unit} figure="serif" className={css.amount} />
}

export interface TermValueProps extends TermLook {
  label: string
}

/** A fixed term of the note, as `dt` and `dd`: the parent is a `dl`. */
export function TermValue({ label, figure, rest, marked = false }: TermValueProps) {
  return (
    <div className={css.term}>
      <dt className={css.label}>{label}</dt>
      <dd className={css.value}>
        <span className={css.figure}>{marked ? <Marker>{figure}</Marker> : figure}</span>
        {rest ? <span className={css.rest}>{rest}</span> : null}
      </dd>
    </div>
  )
}

export interface TermSelectProps<V extends string> extends TermLook {
  label: string
  value: V
  onChange: (value: V) => void
  /** `label` is the full text of the choice in the list: "10.00 USDx, premium 0.36 per unit". */
  options: ReadonlyArray<{ value: V; label: string }>
}

/**
 * A term the visitor can change. The note shows it typeset (serif figure, unit, highlighter); a native select
 * lies over it, so the keyboard, a screen reader and a phone's own picker all work without a line of script.
 * The ui kit's `Select` is a boxed form control and cannot carry the highlighter: see README.md.
 */
export function TermSelect<V extends string>({ label, value, onChange, options, figure, rest, marked = false }: TermSelectProps<V>) {
  const id = useId()
  return (
    <div className={css.term}>
      <label className={css.label} htmlFor={id}>
        {label}
      </label>
      <span className={css.value} data-editable="true">
        <span className={css.figure} aria-hidden="true">
          {marked ? <Marker>{figure}</Marker> : figure}
        </span>
        {rest ? (
          <span className={css.rest} aria-hidden="true">
            {rest}
          </span>
        ) : null}
        <IconSelect className={css.caret} size={14} />
        <select id={id} className={css.native} value={value} onChange={(event) => onChange(event.target.value as V)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
