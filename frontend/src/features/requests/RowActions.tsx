import { Link as RouterLink } from '@tanstack/react-router'
import { NO_VALUE } from '../../core/format'
import { bidSubject, useSubjectBusy, useTxBusy } from '../../data'
import { Button, ButtonLink, Link, VisuallyHidden } from '../../ui'
import { holdsEscrow } from './board'
import type { RequestRow } from './board'
import { CANCELLING, CANCEL_REQUEST, SELL_TO_BID, TX_BUSY_REASON, VIEW_POSITION, cancelLabel, positionLabel, sellLabel } from './copy'
import { PORTFOLIO_POSITION_ROUTE } from './routing'
import styles from './RowActions.module.css'

export interface RowActionsProps {
  row: RequestRow
  /** `board`: a seller's view. `mine`: every row is the wallet's own, in any state. */
  variant: 'board' | 'mine'
  /** `table`: 28 px buttons in the pinned column. `list`: full-size buttons at the foot of a phone row. */
  layout: 'table' | 'list'
  onSell: (row: RequestRow) => void
  onCancel: (row: RequestRow) => void
}

/** The one thing the wallet can do with a request: sell to it, cancel its own, or open the position it became. */
export function RowActions({ row, variant, layout, onSell, onCancel }: RowActionsProps) {
  const busy = useTxBusy()
  const rowBusy = useSubjectBusy(bidSubject(row.bid.id))
  const size = layout === 'list' ? 'md' : 'sm'

  if (row.mine && holdsEscrow(row.bid)) {
    return (
      <Button size={size} loading={rowBusy} disabled={busy && !rowBusy} disabledReason={TX_BUSY_REASON} aria-label={cancelLabel(row)} onClick={() => onCancel(row)}>
        {rowBusy ? CANCELLING : CANCEL_REQUEST}
      </Button>
    )
  }

  if (variant === 'mine') {
    if (row.optionId === null) {
      // A closed request has nothing left to do. A table cell says so; a phone row simply has no button.
      return layout === 'list' ? null : (
        <>
          <span aria-hidden="true" className={styles.none}>
            {NO_VALUE}
          </span>
          <VisuallyHidden>No action</VisuallyHidden>
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
    <Button size={size} aria-label={sellLabel(row)} onClick={() => onSell(row)}>
      {SELL_TO_BID}
    </Button>
  )
}
