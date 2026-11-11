import { Link as RouterLink } from '@tanstack/react-router'
import { NO_VALUE } from '../../core/format'
import { bidSubject, useSubjectBusy, useTxBusy } from '../../data'
import { Button, ButtonLink, Link, VisuallyHidden } from '../../ui'
import { holdsEscrow } from './board'
import type { RequestRow } from './board'
import { CANCELLING, CANCEL_REQUEST, FILL_REQUEST, NO_ACTION, TAKING_BACK, TX_BUSY_REASON, VIEW_POSITION, cancelLabel, fillLabel, positionLabel, takeBack, takeBackLabel } from './copy'
import { PORTFOLIO_POSITION_ROUTE } from './routing'
import styles from './RowActions.module.css'

export interface RowActionsProps {
  row: RequestRow
  /** `board`: a maker's view. `mine`: every row is the wallet's own, in any state. */
  variant: 'board' | 'mine'
  /** `table`: 28 px buttons in the pinned column. `list`: full-size buttons at the foot of a row. */
  layout: 'table' | 'list'
  onSell: (row: RequestRow) => void
  onCancel: (row: RequestRow) => void
}

/**
 * The one thing the wallet can do with a request: fill it, cancel its own, take back the premium of its own expired
 * one, or open the position it became.
 */
export function RowActions({ row, variant, layout, onSell, onCancel }: RowActionsProps) {
  const busy = useTxBusy()
  const rowBusy = useSubjectBusy(bidSubject(row.bid.id))
  const size = layout === 'list' ? 'md' : 'sm'

  if (row.mine && holdsEscrow(row.bid)) {
    // The column is fixed in width, so the shorter in-flight word moves nothing around it.
    const expired = row.state === 'expired'
    return (
      <Button size={size} loading={rowBusy} disabled={busy && !rowBusy} disabledReason={TX_BUSY_REASON} aria-label={expired ? takeBackLabel(row) : cancelLabel(row)} onClick={() => onCancel(row)}>
        {rowBusy ? (expired ? TAKING_BACK : CANCELLING) : expired ? takeBack(row.premium) : CANCEL_REQUEST}
      </Button>
    )
  }

  if (variant === 'mine') {
    if (row.optionId === null) {
      // A closed request has nothing left to do. A table cell says so; a list row simply has no button.
      return layout === 'list' ? null : (
        <>
          <span aria-hidden="true" className={styles.none}>
            {NO_VALUE}
          </span>
          <VisuallyHidden>{NO_ACTION}</VisuallyHidden>
        </>
      )
    }
    const to = <RouterLink to={PORTFOLIO_POSITION_ROUTE} params={{ id: row.optionId.toString() }} />
    return layout === 'list' ? (
      <ButtonLink aria-label={positionLabel(row)} render={to}>
        {VIEW_POSITION}
      </ButtonLink>
    ) : (
      <Link className={styles.link} aria-label={positionLabel(row)} render={to}>
        {VIEW_POSITION}
      </Link>
    )
  }

  return (
    <Button size={size} aria-label={fillLabel(row)} onClick={() => onSell(row)}>
      {FILL_REQUEST}
    </Button>
  )
}
