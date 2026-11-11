import { MARGIN_PRODUCT, ledgerLine } from './copy'
import { isoTime, localTime, termsText, utcTime } from './model'
import type { ActivityRow } from './model'
import { StateWord } from './StateWord'
import css from './RowParts.module.css'

/**
 * What the transaction is: the label, its terms after it, and which contract when it went to Margin. `stacked`
 * puts the terms under the label (a phone); `termsOnly` leaves the label to the caller.
 */
export function What({ row, stacked = false, termsOnly = false }: { row: ActivityRow; stacked?: boolean; termsOnly?: boolean }) {
  return (
    <span className={css.what} data-stacked={stacked || undefined}>
      {termsOnly ? null : <span className={css.label}>{row.label}</span>}
      {row.terms ? <span className={css.terms}>{termsText(row.terms)}</span> : null}
      {row.product === 'margin' ? <span className={css.terms}>{MARGIN_PRODUCT}</span> : null}
    </span>
  )
}

/**
 * The state word with its glyph, the ledger after a confirmation, and the note when there is something to say
 * (`note={false}` when the caller sets the note elsewhere).
 */
export function State({ row, note = true }: { row: ActivityRow; note?: boolean }) {
  return (
    <span className={css.state}>
      <span className={css.stateLine}>
        <StateWord row={row} />
        {row.ledger ? <span className={css.ledger}>{ledgerLine(row.ledger)}</span> : null}
      </span>
      {note && row.note ? <span className={css.note}>{row.note}</span> : null}
    </span>
  )
}

/** When it started: the UTC time of day (the day is the heading above), then the viewer's own time when it differs. */
export function Time({ row, local, unit = false }: { row: ActivityRow; local: boolean; unit?: boolean }) {
  return (
    <span className={css.time}>
      <time dateTime={isoTime(row.startedAt)}>{unit ? `${utcTime(row.startedAt)} UTC` : utcTime(row.startedAt)}</time>
      {local ? <span className={css.local}>{localTime(row.startedAt)}</span> : null}
    </span>
  )
}
