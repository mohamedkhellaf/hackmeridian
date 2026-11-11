// The listed deadlines as one radio group: a date, the number of orders on it as a plain muted numeral, and the
// time left under it. A date with no order has its date in muted ink and carries no numeral. "Other dates" links to the
// orders on dates that are not listed.
import { formatUtc } from '../../../core/format'
import type { ExpiryColumn } from '../../../data'
import { Link, Segmented, VisuallyHidden } from '../../../ui'
import { COPY } from './copy'
import { expiryLabel, leftLabel } from './model'
import { OTHER_OFFERS_ID } from './OtherOffers'
import styles from './ExpiryBar.module.css'

export interface ExpiryBarProps {
  columns: readonly ExpiryColumn[]
  /** The `day` of the column shown. */
  value: string
  onChange: (day: string) => void
  /** Orders on dates that are not listed. Zero hides the link. */
  otherDates: number
  /** A narrow column: the count goes on the second line, after the time left, so five dates still fit. */
  compact?: boolean
}

export function ExpiryBar({ columns, value, onChange, otherDates, compact = false }: ExpiryBarProps) {
  return (
    <div className={styles.root}>
      <Segmented
        label={COPY.deadlineLabel}
        value={value}
        onValueChange={onChange}
        options={columns.map((c) => {
          const orders = c.offers + c.bids
          const quiet = orders === 0 || undefined
          return {
            value: c.day,
            label: (
              <span className={styles.date} data-quiet={quiet}>
                {expiryLabel(c.expiry)}
              </span>
            ),
            count: orders > 0 && !compact ? orders : undefined,
            countLabel: orders > 0 && !compact ? COPY.ordersOn(c.offers, c.bids) : undefined,
            detail: (
              <>
                {leftLabel(c.secondsLeft)}
                {orders > 0 && compact ? (
                  <>
                    <span aria-hidden="true">, {orders}</span>
                    <VisuallyHidden>, {COPY.ordersOn(c.offers, c.bids)}</VisuallyHidden>
                  </>
                ) : null}
                <VisuallyHidden>
                  {' '}
                  {COPY.left}, {formatUtc(c.expiry)}
                  {orders === 0 ? `, ${COPY.ordersOn(0, 0)}` : null}
                </VisuallyHidden>
              </>
            ),
          }
        })}
      />
      {otherDates > 0 ? (
        <Link href={`#${OTHER_OFFERS_ID}`} tone="quiet" className={styles.other}>
          {COPY.otherDatesLink(otherDates)}
        </Link>
      ) : null}
    </div>
  )
}
