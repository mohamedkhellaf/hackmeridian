// The selected series under the chain: what the contract is, in one sentence, what the wallet holds or wrote of
// it, and its book as one table (ruling E9): funded offers and resale listings above the gap line (cheapest
// first), funded requests below it (highest first).
import { Link as RouterLink } from '@tanstack/react-router'
import { useEffect, useId, useMemo, useRef } from 'react'
import { formatUnits } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { cellKey, sameSeriesRef, seriesRefOf } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import { moneyness } from '../../../core/reference'
import type { MarketView, PositionView, PositionsView } from '../../../data'
import { useBook, useHealth, useOptionsClient, useTxBusy } from '../../../data'
import { Button, Countdown, DateTime, Glyph, Link, Skeleton, formatLocalTime } from '../../../ui'
import { COPY, RIGHT_OF } from './copy'
import { gapLine, referenceLine, seriesTitle, strikeText } from './model'
import { bestKeys } from './orders'
import type { OrderSection } from './orders'
import { OrdersList } from './OrdersList'
import { OrdersTable } from './OrdersTable'
import styles from './SeriesPanel.module.css'

/** A request to bring a series' heading into view, once per press (`n` changes on every press). */
export interface Reveal {
  key: string
  n: number
}

export interface SeriesPanelProps {
  view: MarketView
  series: SeriesRef
  /** The contract has requests (v1.5). Without them the book has no request side. */
  bidsOn: boolean
  /** A column too narrow for the book's six columns (a phone, a drawer-width window): orders are a list. */
  narrow: boolean
  /** `row.key` of the order the open ticket is about. */
  ticketKey: string | null
  /** Scroll the heading into view when this names the series. */
  reveal: Reveal | null
  /** The connected wallet's positions (null for a guest), to say what it holds or wrote of the series. */
  positions: PositionsView | null
  onTake: (row: BookRow) => void
  onCancel: (row: BookRow) => void
  /** Open the write or the request form on this series, with no figure in it. */
  onWrite: () => void
  onBid: () => void
}

const MONEYNESS_SENTENCE = {
  in: (phrase: string, price: string) => `In the money at ${phrase}, ${price}.`,
  out: (phrase: string, price: string) => `Out of the money at ${phrase}, ${price}.`,
  at: (phrase: string, price: string) => `At the money: the strike equals ${phrase}, ${price}.`,
} as const

/** The wallet's live options of this series, by role. */
function useOwnPositions(data: PositionsView | null, series: SeriesRef): { held: PositionView[]; written: PositionView[] } {
  return useMemo(() => {
    if (!data) return { held: [], written: [] }
    const here = (p: PositionView) => {
      const ref = p.option.state === 'active' && !p.closed ? seriesRefOf(p.option) : null
      return ref !== null && sameSeriesRef(ref, series)
    }
    return { held: data.holding.filter(here), written: data.written.filter(here) }
  }, [data, series])
}

function OwnLine({ positions, sentence }: { positions: PositionView[]; sentence: (qty: string) => string }) {
  if (positions.length === 0) return null
  const first = positions[0].option
  const qty = positions.reduce((sum, p) => sum + p.option.underlyingQty, 0n)
  return (
    <p className={styles.own}>
      {sentence(formatUnits(qty, first.underlying.decimals))}{' '}
      {positions.length === 1 ? (
        <Link render={<RouterLink to="/portfolio/$id" params={{ id: first.id.toString() }} />}>{COPY.viewPosition}</Link>
      ) : (
        <Link render={<RouterLink to="/portfolio" />}>{COPY.viewPosition}</Link>
      )}
    </p>
  )
}

export function SeriesPanel({ view, series, bidsOn, narrow, ticketKey, reveal, positions, onTake, onCancel, onWrite, onBid }: SeriesPanelProps) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)

  const book = useBook(series)
  const health = useHealth()
  const busy = useTxBusy()
  const { isMock } = useOptionsClient()
  const own = useOwnPositions(positions, series)
  const decimals = view.quote.decimals
  const code = view.asset.code
  const title = seriesTitle(code, series, decimals)
  const reference = referenceLine(view.reference, decimals)
  const where = moneyness(series.kind, series.strikePerUnit, view.reference)
  const data = book.data
  const key = cellKey(series)
  const deadline = series.expiry * 1000

  // A press below 1200 px (or a link opened there) brings the book into view: it is the result of the press. While
  // the book is still being read the page may be too short to bring the heading to the top, so the move is made
  // again, once, when the book lands. After a press (not on a link opened) focus goes with the view to the heading,
  // so it is never left on a cell that has scrolled away.
  const revealed = useRef<{ n: number; loaded: boolean } | null>(null)
  const loaded = data !== null && data !== undefined
  useEffect(() => {
    if (!reveal || reveal.key !== key) return
    const done = revealed.current
    if (done && done.n === reveal.n && (done.loaded || !loaded)) return
    const first = done?.n !== reveal.n
    revealed.current = { n: reveal.n, loaded }
    const heading = headingRef.current
    if (!heading) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heading.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    if (first && reveal.n > 0) heading.focus({ preventScroll: true })
  }, [reveal, key, loaded])

  const Orders = narrow ? OrdersList : OrdersTable
  const offers = data?.offers ?? []
  const requests = data?.bids ?? []
  const sections: OrderSection[] = data
    ? [
        { key: 'offers', title: COPY.offers, label: `${COPY.offers} on ${title}`, lines: offers, best: bestKeys(offers, data.bestOffer), empty: COPY.noOffers },
        ...(bidsOn ? [{ key: 'requests', title: COPY.requests, label: `${COPY.requests} on ${title}`, lines: requests, best: bestKeys(requests, data.bestBid), empty: COPY.noRequests }] : []),
      ]
    : []
  const bestOfferPerUnit = offers.find((e) => e.row.key === data?.bestOffer?.key)?.perUnit ?? null
  const bestRequestPerUnit = requests.find((e) => e.row.key === data?.bestBid?.key)?.perUnit ?? null
  // Off the grid, every order shares the reason: the terms line says it once.
  const sharedReason = data && !data.onGrid ? (offers[0]?.reason ?? requests[0]?.reason ?? null) : null

  return (
    <section className={styles.root} aria-labelledby={headingId} data-testid="series-panel">
      <header className={styles.head}>
        <div className={styles.title}>
          <span className={styles.glyph}>
            <Glyph name={series.kind === 'call' ? 'long-call' : 'long-put'} size={12} />
          </span>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className={`ui-h2 ${styles.heading}`} data-series-heading>
            {title}
          </h2>
        </div>
        <div className={styles.actions}>
          <Button onClick={onWrite}>{COPY.writeHere}</Button>
          {bidsOn ? <Button onClick={onBid}>{COPY.bidHere}</Button> : null}
        </div>
        <p className={styles.terms}>
          {RIGHT_OF[series.kind]} 1 {code} for {strikeText(series.strikePerUnit, decimals)} {view.quote.code}.{' '}
          {reference && where !== 'unknown' ? MONEYNESS_SENTENCE[where](reference.phrase, reference.price) : null}
          {data && !data.onGrid ? ` ${COPY.offGridSeries}` : null}
        </p>
        <p className={styles.deadline}>
          <span className={styles.keep}>
            {COPY.deadlineLabel} <DateTime value={deadline} />
          </span>
          , in <Countdown to={deadline} label="Time left" /> <span className={styles.local}>{formatLocalTime(deadline)}</span>
        </p>
        <OwnLine positions={own.held} sentence={(qty) => COPY.youHold(qty, code, series.kind)} />
        <OwnLine positions={own.written} sentence={(qty) => COPY.youWrote(qty, code, series.kind)} />
      </header>

      {!data ? (
        <div aria-busy="true">
          <Skeleton variant="rows" lines={3} />
        </div>
      ) : data.empty ? (
        <p className={styles.empty}>{COPY.emptySeries}</p>
      ) : (
        <>
          <p className={styles.note}>{COPY.bookUnits(code, view.quote.code)}</p>
          <Orders
            label={COPY.book(title)}
            sections={sections}
            gap={offers.length && requests.length ? gapLine(bestOfferPerUnit, bestRequestPerUnit, decimals) : null}
            sharedReason={sharedReason}
            ticketKey={ticketKey}
            health={health.data}
            explorer={!isMock}
            busy={busy}
            onTake={onTake}
            onCancel={onCancel}
          />
        </>
      )}
    </section>
  )
}
