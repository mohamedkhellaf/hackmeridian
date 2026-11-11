import { Button, DateTime, KeyValue, KeyValueItem } from '../../ui'
import { CHECK_AGAIN, COLUMNS, PRODUCT_LABEL, TABLE_CAPTION } from './copy'
import type { ActivityRowsProps } from './ActivityTable'
import { HashCell } from './HashCell'
import { StateWord } from './StateWord'
import { TargetLink } from './TargetLink'
import css from './ActivityList.module.css'

/** The same rows on a phone: one block per transaction, every field kept, 44 px targets. */
export function ActivityList({ rows, showProduct, checking, onCheck }: ActivityRowsProps) {
  return (
    <ul className={css.root} role="list" aria-label={TABLE_CAPTION}>
      {rows.map((row) => (
        <li key={row.id} className={css.item} data-tone={row.tone} data-testid="activity-row">
          <div className={css.head}>
            <p className={css.label}>{row.label}</p>
            <StateWord row={row} />
          </div>
          {row.terms ? <p className={css.sub}>{row.terms}</p> : null}
          <p className={css.note}>{row.note}</p>
          <KeyValue variant="plain" figures="sans" className={css.facts}>
            <KeyValueItem label={COLUMNS.started}>
              <DateTime value={row.startedAt} local="below" />
            </KeyValueItem>
            <KeyValueItem label={COLUMNS.hash}>
              <HashCell row={row} />
            </KeyValueItem>
            {showProduct ? <KeyValueItem label="Contract">{PRODUCT_LABEL[row.product]}</KeyValueItem> : null}
          </KeyValue>
          {row.target || row.canCheck ? (
            <div className={css.foot}>
              {row.target ? (
                <span className={css.target}>
                  <TargetLink target={row.target} />
                </span>
              ) : (
                <span />
              )}
              {row.canCheck ? (
                <Button size="sm" variant="secondary" className={css.check} loading={checking === row.id} onClick={() => onCheck(row.id)}>
                  {CHECK_AGAIN}
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
