import { Link as RouterLink } from '@tanstack/react-router'
import { NO_VALUE } from '../../core/format'
import { bidSubject, useSubjectBusy, useTxBusy } from '../../data'
import { Button, ButtonLink, VisuallyHidden } from '../../ui'
import { holdsEscrow } from './board'
import type { RequestRow } from './board'
import { CANCELLING, CANCEL_REQUEST, FILL_REQUEST, NO_ACTION, TX_BUSY_REASON, VIEW_POSITION, cancelLabel, fillLabel, positionLabel } from './copy'
import { PORTFOLIO_POSITION_ROUTE } from './routing'
import styles from './RowActions.module.css'

export interface RowActionsProps {
  row: RequestRow
  /** `board`: a maker's view. `mine`: every row is the wallet's own, in any state. */
  variant: 'board' | 'mine'
  /** `table`: small buttons in the pinned column. `list`: touch-sized buttons at the foot of a card. */
  layout: 'table' | 'list'
  onSell: (row: RequestRow) => void
  onCancel: (row: RequestRow) => void
}

/**
 * The one thing the wallet can do with a request: fill it, cancel its own (before or after the deadline: either way
 * the premium comes back), or open the position it became. Every action is a secondary button of one size per
 * layout, so the same action looks the same on every row (ruling F14).
 */
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
      // A closed request has nothing left to do. A table cell says so; a card simply has no button.
      return layout === 'list' ? null : (
        <>
          <span aria-hidden="true" className={styles.none}>
            {NO_VALUE}
          </span>
          <VisuallyHidden>{NO_ACTION}</VisuallyHidden>
        </>
      )
    }
    return (
      <ButtonLink size={size} aria-label={positionLabel(row)} render={<RouterLink to={PORTFOLIO_POSITION_ROUTE} params={{ id: row.optionId.toString() }} />}>
        {VIEW_POSITION}
      </ButtonLink>
    )
  }

  return (
    <Button size={size} aria-label={fillLabel(row)} onClick={() => onSell(row)}>
      {FILL_REQUEST}
    </Button>
  )
}
