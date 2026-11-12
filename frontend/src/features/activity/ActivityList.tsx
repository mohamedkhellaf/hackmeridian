import { useId } from 'react'
import { Button } from '../../ui'
import { CHECK_AGAIN } from './copy'
import type { ActivityRowsProps } from './ActivityTable'
import { HashCell } from './HashCell'
import type { ActivityGroup } from './model'
import { Time, What } from './RowParts'
import { StateWord } from './StateWord'
import { TargetLink } from './TargetLink'
import css from './ActivityList.module.css'

function Group({ group, checking, onCheck }: { group: ActivityGroup } & Pick<ActivityRowsProps, 'checking' | 'onCheck'>) {
  const headingId = useId()
  return (
    <section className={css.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={css.groupHead}>
        {group.title}
      </h2>
      <ul className={css.list} role="list" aria-labelledby={headingId}>
        {group.rows.map((row) => (
          <li key={row.id} className={css.item} data-tone={row.tone} data-testid="activity-row">
            <div className={css.head}>
              <span className={css.label}>{row.label}</span>
              <StateWord row={row} />
            </div>
            {row.terms || row.product === 'margin' ? (
              <p className={css.what}>
                <What row={row} stacked termsOnly />
              </p>
            ) : null}
            {row.note ? <p className={css.note}>{row.note}</p> : null}
            <div className={css.foot}>
              <span className={css.proof}>
                <Time row={row} local={false} unit />
                <HashCell row={row} />
              </span>
              {row.target ? (
                <span className={css.target}>
                  <TargetLink target={row.target} />
                </span>
              ) : null}
            </div>
            {row.canCheck ? (
              <Button size="sm" variant="secondary" className={css.check} loading={checking === row.id} onClick={() => onCheck(row.id)}>
                {CHECK_AGAIN}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The same rows below 1200 px (a phone, a tablet): a group per heading, and per transaction the label with its state word, the terms,
 * the note when there is one, and one line with the time and hash on the left and the link on the right. The
 * ledger of a confirmation is on the explorer page the hash links to. 44 px targets.
 */
export function ActivityList({ groups, checking, onCheck }: ActivityRowsProps) {
  return (
    <div className={css.root}>
      {groups.map((group) => (
        <Group key={group.key} group={group} checking={checking} onCheck={onCheck} />
      ))}
    </div>
  )
}
