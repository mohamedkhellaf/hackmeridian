// Orders that are not on the standard grid: still tradable, listed with the rule each one does not meet. The
// reason is said once per row, in its column, and what each reason present means is explained under the table.
import type { BookRow } from '../../../core/market/book'
import { NON_STANDARD_REASONS } from '../../../core/series'
import type { MarketView } from '../../../data'
import { useHealth, useOptionsClient, useTxBusy } from '../../../data'
import { COPY, OFF_GRID_NO_REFERENCE, REASON_LABEL, REASON_MEANING } from './copy'
import { referenceLine } from './model'
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
  // Without a reference price there is no ladder, and an "off-grid" strike means only that.
  const noReference = referenceLine(view.reference, view.quote.decimals) === null
  const Orders = narrow ? OrdersList : OrdersTable
  return (
    <section className={styles.root} aria-labelledby={`${OTHER_OFFERS_ID}-title`} id={OTHER_OFFERS_ID} tabIndex={-1} data-testid="other-offers">
      <h2 id={`${OTHER_OFFERS_ID}-title`} className="ui-h2">
        {COPY.otherHeading}
      </h2>
      <p className={styles.intro}>
        {COPY.otherIntro(view.other.length)} {COPY.bookUnits(view.asset.code, view.quote.code)}
      </p>
      <Orders
        label={`${COPY.otherHeading} on ${view.asset.code}`}
        sections={[{ key: 'other', lines: view.other }]}
        showSeries
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
            <dt>{REASON_LABEL[r]}</dt>
            <dd>{r === 'off-grid strike' && noReference ? OFF_GRID_NO_REFERENCE : REASON_MEANING[r]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
