// The selected series under the chain: what the contract is, in one sentence, and its two-sided book. Funded
// offers and resale listings on one side (cheapest first), funded bids on the other (highest first).
import { useId } from 'react'
import { countOf } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import type { SeriesRef } from '../../../core/market/selection'
import { moneyness } from '../../../core/reference'
import type { BookEntry, MarketView } from '../../../data'
import { useBook, useHealth, useOptionsClient, useTxBusy } from '../../../data'
import { Button, Callout, Countdown, DateTime, EmptyNote, Glyph, Skeleton } from '../../../ui'
import { BIDS, COPY, OFFERS, RIGHT_OF } from './copy'
import { referenceLine, seriesTitle, strikeText } from './model'
import { OrdersList } from './OrdersList'
import { OrdersTable } from './OrdersTable'
import styles from './SeriesPanel.module.css'

export interface SeriesPanelProps {
  view: MarketView
  series: SeriesRef
  /** The contract has requests (v1.5). Without them there is no bid side. */
  bidsOn: boolean
  /** Phone width: orders are a list, not a table. */
  narrow: boolean
  /** `row.key` of the order the open ticket is about. */
  ticketKey: string | null
  onTake: (row: BookRow) => void
  onCancel: (row: BookRow) => void
  /** Opens the write or the bid ticket on this series, prefilled next to the best order of the other side. */
  onWrite: (qty: string | undefined, premium: string | undefined) => void
  onBid: (qty: string | undefined, premium: string | undefined) => void
}

const MONEYNESS_SENTENCE = {
  in: (phrase: string, price: string) => `In the money at ${phrase}, ${price}.`,
  out: (phrase: string, price: string) => `Out of the money at ${phrase}, ${price}.`,
  at: (phrase: string, price: string) => `At the money: the strike equals ${phrase}, ${price}.`,
} as const

export function SeriesPanel({ view, series, bidsOn, narrow, ticketKey, onTake, onCancel, onWrite, onBid }: SeriesPanelProps) {
  const headingId = useId()
  const book = useBook(series)
  const health = useHealth()
  const busy = useTxBusy()
  const { isMock } = useOptionsClient()
  const decimals = view.quote.decimals
  const code = view.asset.code
  const title = seriesTitle(code, series, decimals)
  const reference = referenceLine(view.reference, decimals)
  const where = moneyness(series.kind, series.strikePerUnit, view.reference)
  const data = book.data

  const Orders = narrow ? OrdersList : OrdersTable
  const table = (side: 'offers' | 'bids', entries: BookEntry[], best: BookRow | null) => (
    <Orders
      label={`${side === 'offers' ? COPY.offers : COPY.bids} on ${title}`}
      side={side}
      lines={entries}
      bestKey={entries.length > 1 ? (best?.key ?? null) : null}
      ticketKey={ticketKey}
      health={health.data}
      explorer={!isMock}
      busy={busy}
      onTake={onTake}
      onCancel={onCancel}
    />
  )

  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid="series-panel">
      <header className={styles.head}>
        <div className={styles.title}>
          <span className={styles.glyph}>
            <Glyph name={series.kind === 'call' ? 'long-call' : 'long-put'} size={12} />
          </span>
          <h2 id={headingId} className="ui-h2">
            {title}
          </h2>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => onWrite(data?.prefill.sell.qty, data?.prefill.sell.premium)}>{COPY.writeHere}</Button>
          {bidsOn ? <Button onClick={() => onBid(data?.prefill.buy.qty, data?.prefill.buy.premium)}>{COPY.bidHere}</Button> : null}
        </div>
        <p className={styles.terms}>
          {RIGHT_OF[series.kind]} 1 {code} for {strikeText(series.strikePerUnit, decimals)} {view.quote.code}. {reference && where !== 'unknown' ? MONEYNESS_SENTENCE[where](reference.phrase, reference.price) : null}
        </p>
        <p className={styles.deadline}>
          {COPY.deadlineIn} <Countdown to={series.expiry * 1000} label="Time left" />: <DateTime value={series.expiry * 1000} local="inline" />
        </p>
      </header>

      {data && !data.onGrid ? <Callout variant="info">{COPY.offGridSeries}</Callout> : null}

      {!data ? (
        <div aria-busy="true">
          <Skeleton variant="rows" lines={3} />
        </div>
      ) : data.empty ? (
        <EmptyNote title={COPY.emptySeries} hint={bidsOn ? COPY.emptySeriesHint : undefined} />
      ) : (
        <>
          <p className={styles.note}>
            Quantities in {code}, premiums in {view.quote.code}. {COPY.bookNote}
          </p>
          <div className={styles.sides} data-two={bidsOn || undefined}>
            <section className={styles.side} aria-label={`${COPY.offers}, ${countOf(data.offers.length, OFFERS)}`}>
              <h3 className={styles.sideTitle}>
                {COPY.offers} <span className={styles.sideCount}>{data.offers.length}</span>
              </h3>
              {data.offers.length ? table('offers', data.offers, data.bestOffer) : <p className={styles.sideEmpty}>{COPY.noOffers}</p>}
            </section>
            {bidsOn ? (
              <section className={styles.side} aria-label={`${COPY.bids}, ${countOf(data.bids.length, BIDS)}`}>
                <h3 className={styles.sideTitle}>
                  {COPY.bids} <span className={styles.sideCount}>{data.bids.length}</span>
                </h3>
                {data.bids.length ? table('bids', data.bids, data.bestBid) : <p className={styles.sideEmpty}>{COPY.noBids}</p>}
              </section>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
