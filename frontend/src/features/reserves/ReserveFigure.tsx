import { BulletRow } from '../../viz'
import { DIFFERENCE_WORD, FIGURE_LEGEND, HELD_UNAVAILABLE } from './copy'
import { amountText, chartNumber, differenceText } from './model'
import type { ReserveRow } from './model'
import css from './ReserveFigure.module.css'

/**
 * Held against locked, one bullet row per token: the bar is the balance, the tick is what is locked, a hatched
 * gap is a shortfall. The table under it carries the same figures as text, so the drawing is hidden from
 * assistive technology and nothing is read twice.
 */
export function ReserveFigure({ rows }: { rows: readonly ReserveRow[] }) {
  return (
    <div className={css.root} aria-hidden="true" data-testid="reserve-figure">
      <ul className={css.rows} role="list">
        {rows.map((row) => (
          <li key={row.token.contractId} className={css.row} data-state={row.state}>
            {row.held === null ? (
              <p className={css.unknown}>
                <span className={css.name}>{row.token.code}</span>
                <span>
                  Locked {amountText(row.locked, row.token)}. Held: {HELD_UNAVAILABLE.toLowerCase()}.
                </span>
              </p>
            ) : (
              <BulletRow
                decorative
                name={row.token.code}
                locked={chartNumber(row.locked, row.token.decimals)}
                held={chartNumber(row.held, row.token.decimals)}
                heldLabel={`Held ${amountText(row.held, row.token)}`}
                lockedLabel={`Locked ${amountText(row.locked, row.token)}`}
                differenceLabel={differenceText(row)}
                differenceWord={row.state === 'unknown' ? undefined : DIFFERENCE_WORD[row.state]}
              />
            )}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.held !== null) ? <p className={css.legend}>{FIGURE_LEGEND}</p> : null}
    </div>
  )
}
