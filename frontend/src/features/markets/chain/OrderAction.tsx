// The one action a book row allows: buy it, sell to it, cancel it when it is the wallet's own.
import { Link as RouterLink } from '@tanstack/react-router'
import { formatUnits } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { bidSubject, optionSubject, useSubjectBusy } from '../../../data'
import { Button, Link, shortenAddress } from '../../../ui'
import type { ButtonSize } from '../../../ui'
import { COPY } from './copy'
import { termsOf } from './orders'
import type { OrderLine } from './orders'
import styles from './OrderAction.module.css'

export interface OrderActionProps {
  line: OrderLine
  /** Another transaction is in flight. */
  busy: boolean
  size?: ButtonSize
  onTake: (row: BookRow) => void
  onCancel: (row: BookRow) => void
}

export function OrderAction({ line, busy, size = 'sm', onTake, onCancel }: OrderActionProps) {
  const { row, action } = line
  const subject = row.bid ? bidSubject(row.bid.id) : row.offer ? optionSubject(row.offer.id) : null
  const working = useSubjectBusy(subject)
  const who = shortenAddress(row.counterparty)
  const total = `${formatUnits(row.totalPremium, row.quote.decimals)} ${row.quote.code}`
  switch (action.kind) {
    case 'none':
      // The wallet's own resale listing is managed from its position; an option it wrote cannot be bought back.
      if (action.note === 'Yours' && row.offer)
        return (
          <Link render={<RouterLink to="/portfolio/$id" params={{ id: row.offer.id.toString() }} />} aria-label={`Manage your listing of ${termsOf(row)}`}>
            {COPY.manage}
          </Link>
        )
      return <span className={styles.note}>{COPY.writtenByYou}</span>
    case 'cancel-offer':
    case 'cancel-bid':
      return (
        <Button
          size={size}
          variant="quiet"
          loading={working}
          disabled={busy && !working}
          disabledReason={COPY.busy}
          aria-label={action.kind === 'cancel-offer' ? `Cancel your offer of ${termsOf(row)}` : `Cancel your request for ${termsOf(row)}`}
          onClick={() => onCancel(row)}
        >
          {COPY.cancel}
        </Button>
      )
    case 'fill':
      return (
        <Button size={size} loading={working} aria-label={`Sell to this bid: ${termsOf(row)} from ${who}, ${total} escrowed`} onClick={() => onTake(row)}>
          {COPY.sellToBid}
        </Button>
      )
    case 'buy-resale':
      return (
        <Button size={size} loading={working} aria-label={`Buy ${termsOf(row)} from its holder ${who} for ${total}`} onClick={() => onTake(row)}>
          {COPY.buy}
        </Button>
      )
    case 'buy':
      return (
        <Button size={size} loading={working} aria-label={`Buy ${termsOf(row)} from ${who} for ${total}`} onClick={() => onTake(row)}>
          {COPY.buy}
        </Button>
      )
  }
}
