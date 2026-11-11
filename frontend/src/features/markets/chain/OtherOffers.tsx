// Orders that are not on the standard grid: still tradable, listed with the rule each one does not meet. Nothing
// is hidden: the count is in the heading line and every reason present is explained under the table.
import type { BookRow } from '../../../core/market/book'
import { NON_STANDARD_REASONS } from '../../../core/series'
import type { MarketView } from '../../../data'
import { useHealth, useOptionsClient, useTxBusy } from '../../../data'
import { COPY, REASON_LABEL, REASON_MEANING } from './copy'
import { OrdersList } from './OrdersList'
import { OrdersTable } from './OrdersTable'
import styles from './OtherOffers.module.css'

/** The id the "Other dates" link of the expiry bar points at. */
export const OTHER_OFFERS_ID = 'other-offers'

export interface OtherOffersProps {
  view: MarketView
  /** Phone width: orders are a list, not a table. */
  narrow: boolean
  ticketKey: string | null
  onTake: (row: BookRow) => void
  onCancel: (row: BookRow) => void
}

export function OtherOffers({ view, narrow, ticketKey, onTake, onCancel }: OtherOffersProps) {
  const health = useHealth()
  const busy = useTxBusy()
  const { isMock } = useOptionsClient()
  if (view.other.length === 0) return null
  const reasons = NON_STANDARD_REASONS.filter((r) => view.otherCounts[r] > 0)
  const Orders = narrow ? OrdersList : OrdersTable
  return (
    <section className={styles.root} aria-labelledby={`${OTHER_OFFERS_ID}-title`} id={OTHER_OFFERS_ID} tabIndex={-1} data-testid="other-offers">
      <h2 id={`${OTHER_OFFERS_ID}-title`} className="ui-h2">
        {COPY.otherHeading}
      </h2>
      <p className={styles.intro}>
        {COPY.otherIntro(view.other.length)} Quantities in {view.asset.code}, premiums in {view.quote.code}.
      </p>
      <Orders
        label={`${COPY.otherHeading} on ${view.asset.code}`}
        side="mixed"
        showSeries
        lines={view.other}
        ticketKey={ticketKey}
        health={health.data}
        explorer={!isMock}
        busy={busy}
        onTake={onTake}
        onCancel={onCancel}
      />
      <dl className={styles.reasons}>
        {reasons.map((r) => (
          <div key={r} className={styles.reason}>
            <dt>
              {REASON_LABEL[r]} <span className={styles.count}>{view.otherCounts[r]}</span>
            </dt>
            <dd>{REASON_MEANING[r]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
