// Chain mode of the asset page (brief 4.3): deadline tabs, the option chain on the standard grid, the book of the
// selected series and the orders that are off the grid. The selection lives in the URL (`expiry`, `kind`,
// `strike`); tickets are opened by writing the ticket's own search params, which the asset page turns into the
// order ticket in its rail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUtc } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { cellKey, seriesRefOf } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import { useMarket, useMe, useNowSec, usePositions } from '../../../data'
import type { GridCell, MarketView } from '../../../data'
import { Button, Callout, EmptyNote, IconWarning, Skeleton, VisuallyHidden, announce, useIsWide } from '../../../ui'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { CancelDialog } from './CancelDialog'
import { ChainTable } from './ChainTable'
import { COPY } from './copy'
import { ExpiryBar } from './ExpiryBar'
import { halfAction, halfRow, missingDeadlineLine, referenceLine, resolveSelection, selectionSearch, seriesTitle, strikeParam } from './model'
import type { Half } from './model'
import { OtherOffers } from './OtherOffers'
import { SeriesPanel } from './SeriesPanel'
import type { Reveal } from './SeriesPanel'
import { CLEAR_TICKET, useChainSearch, usePatchSearch } from './url'
import { NARROW_BOOK_PX, NARROW_SERIES_PX, useNarrow } from './useNarrow'
import { YourOrders } from './YourOrders'
import styles from './ChainMode.module.css'

/** The first load: the shape of the chain (deadline tabs, the units line, nine strikes around a toned spine). */
function ChainSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <VisuallyHidden>{COPY.loading('option')}</VisuallyHidden>
      <Skeleton variant="block" width="20rem" height="2.75rem" />
      <Skeleton variant="text" width="22rem" />
      <div className={styles.skeletonTable} aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={styles.skeletonRow} data-head={i === 0 || undefined}>
            <span className={styles.skeletonSide} data-side="call">
              <Skeleton variant="block" width={i === 0 ? '3rem' : '2.5rem'} height="0.75rem" />
            </span>
            <span className={styles.skeletonStrike}>
              <Skeleton variant="block" width="3rem" height="0.75rem" />
            </span>
            <span className={styles.skeletonSide} data-side="put">
              <Skeleton variant="block" width={i === 0 ? '3rem' : '2.5rem'} height="0.75rem" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The ticket's order as a book row key (`o12`, `r9`, `b3`), to mark the row the open ticket is about. */
function ticketRowKey(search: { offer?: string; ask?: string; bid?: string }): string | null {
  if (search.offer) return `o${search.offer}`
  if (search.ask) return `r${search.ask}`
  if (search.bid) return `b${search.bid}`
  return null
}

/** The ticket that takes one order of the book: buy an offer or a listing, or fill a request. */
function ticketFor(row: BookRow): TicketIntent | null {
  if (row.source === 'bid' && row.bid) return { mode: 'fill', bidId: row.bid.id }
  if (row.source === 'resale' && row.offer) return { mode: 'buy-resale', optionId: row.offer.id }
  if (row.offer) return { mode: 'buy', offerId: row.offer.id }
  return null
}

export function ChainMode({ assetId }: { assetId: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const narrow = useNarrow(rootRef)
  // The order tables have fixed columns: each becomes a list below the width its columns need.
  const listBook = useNarrow(rootRef, NARROW_BOOK_PX)
  const listSeries = useNarrow(rootRef, NARROW_SERIES_PX)
  const market = useMarket(assetId)

  const view = market.data

  return (
    <div ref={rootRef} className={styles.root} data-narrow={narrow || undefined} data-testid="chain-mode">
      {market.isLoading ? (
        <ChainSkeleton />
      ) : market.isError ? (
        <Callout variant="danger" title={COPY.loadFailedTitle} actions={<Button onClick={market.retry}>{COPY.retry}</Button>}>
          {market.error ? `${market.error} ` : null}
          {COPY.loadFailedHint}
        </Callout>
      ) : !view ? (
        <EmptyNote title={COPY.notListed} headingLevel={2} />
      ) : (
        // A contract without requests answers `null`; while the read is out, assume the current contract.
        <Chain view={view} narrow={narrow} listBook={listBook} listSeries={listSeries} bidsOn={view.bidsOn} refreshFailed={market.refreshFailed} onRefresh={market.retry} />
      )}
    </div>
  )
}

interface ChainProps {
  view: MarketView
  /** The chain takes its phone layout. */
  narrow: boolean
  /** The book of a series is a list, not a table. */
  listBook: boolean
  /** "Your orders" and "Other offers" are lists, not tables. */
  listSeries: boolean
  bidsOn: boolean
  refreshFailed: boolean
  onRefresh: () => void
}

function Chain({ view, narrow, listBook, listSeries, bidsOn, refreshFailed, onRefresh }: ChainProps) {
  const search = useChainSearch()
  const patch = usePatchSearch()
  const me = useMe()
  const positions = usePositions().data ?? null
  // From 1200 px the ticket is a column beside the chain; below, it opens over the page.
  const wide = useIsWide()
  const [cancelling, setCancelling] = useState<BookRow | null>(null)
  const assetId = view.asset.contractId
  const code = view.asset.code
  const decimals = view.quote.decimals

  const { column, ref, cell, missing } = useMemo(() => resolveSelection(view, search), [view, search])
  const nowSec = useNowSec(30)
  const ticketOpen = !!(search.offer || search.ask || search.bid || search.side)

  // The URL named a date the chain does not show (it passed with the page open, or an old link): say so, show the
  // default date with nothing selected, and put that date in the URL so a reload shows the same thing. A ticket on
  // an order of the old date keeps its URL until it is closed. The line stays until the next choice.
  const [moved, setMoved] = useState<{ from: string; line: string } | null>(null)
  const movedLine = missing && column ? missingDeadlineLine(missing, column, nowSec) : null
  if (missing && movedLine && moved?.from !== missing) setMoved({ from: missing, line: movedLine })
  useEffect(() => {
    if (!missing || !column || ticketOpen) return
    patch({ expiry: column.day, kind: undefined, strike: undefined }, { replace: true })
  }, [missing, column, ticketOpen, patch])
  const selectedKey = cell?.key ?? null
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const ticketKey = ticketRowKey(search)
  // A write or request form follows the selection (its terms are the same search params); a ticket on one exact
  // order does not survive a new selection.
  const keptSide = search.side === 'write' || search.side === 'bid' ? search.side : undefined

  // A link that names a series, opened where the ticket is not a column: its book is under the chain, so it is
  // brought into view once, as a press would.
  const [reveal, setReveal] = useState<Reveal | null>(() => (!wide && ref ? { key: cellKey(ref), n: 0 } : null))

  const openTicket = useCallback(
    (intent: TicketIntent, selection?: SeriesRef) => {
      patch({ ...CLEAR_TICKET, ...(selection ? selectionSearch(selection, decimals) : {}), ...searchFromTicketIntent(intent) })
    },
    [patch, decimals],
  )

  // The forms open empty: nothing the user did not type sits in a premium field (the ticket shows the best order
  // of the series as a row of its own).
  const openOnSeries = useCallback(
    (mode: 'write' | 'bid', series: SeriesRef) => {
      openTicket({ mode, assetId, kind: series.kind, strike: strikeParam(series.strikePerUnit, decimals), expiry: series.expiry }, series)
    },
    [openTicket, assetId, decimals],
  )

  // A press on one half of a cell (ruling F3): the offer opens Buy on it and the request opens Fill on it (from 1200
  // px, where the ticket is a column); an empty half opens the request form on the series (ruling F2); a write or
  // request form that is open follows the selection instead; below 1200 px a price selects its series and brings
  // the book into view. Pressing the selected series again closes it, unless that press opens another order.
  const press = useCallback(
    (picked: GridCell, half: Half) => {
      const title = seriesTitle(code, picked.ref, decimals)
      const again = picked.key === selectedKey
      setMoved(null)
      const action = halfAction(halfRow(picked, half), { bidsOn, me, wide, form: keptSide ?? null })
      if (again && keptSide) return
      if (action.kind === 'post' || action.kind === 'write') {
        // The form that opens announces itself; the chain does not talk over it.
        openOnSeries(action.kind === 'post' ? 'bid' : 'write', picked.ref)
        return
      }
      const intent = action.kind === 'take' && !(again && ticketKey === action.row.key) ? ticketFor(action.row) : null
      if (intent) {
        openTicket(intent, picked.ref)
        return
      }
      if (again) {
        patch({ ...CLEAR_TICKET, kind: undefined, strike: undefined })
        announce(`${title} closed.`)
        return
      }
      patch({ ...CLEAR_TICKET, ...selectionSearch(picked.ref, decimals) })
      // Below 1200 px the book under the chain is the result of the press: bring its heading into view.
      if (!wide) setReveal((prev) => ({ key: picked.key, n: (prev?.n ?? 0) + 1 }))
      announce(`${title} selected. Its offers and requests are listed under the chain.`)
    },
    [code, decimals, bidsOn, me, wide, selectedKey, keptSide, ticketKey, patch, openOnSeries, openTicket],
  )

  const take = useCallback(
    (row: BookRow) => {
      const intent = ticketFor(row)
      if (intent) openTicket(intent)
    },
    [openTicket],
  )

  // A row of "Your orders" selects its series in the chain (and its date tab), and brings the book into view.
  const show = useCallback(
    (row: BookRow) => {
      const series = seriesRefOf(row)
      if (!series) return
      setMoved(null)
      patch({ ...CLEAR_TICKET, ...selectionSearch(series, decimals) })
      setReveal((prev) => ({ key: cellKey(series), n: (prev?.n ?? 0) + 1 }))
    },
    [patch, decimals],
  )

  const otherDates = useMemo(() => view.other.filter((o) => !view.expiries.includes(o.row.expiry)).length, [view.other, view.expiries])

  if (!column || view.ladder.length === 0) {
    return (
      <>
        <h2 className="ui-vh">{COPY.chainHeading(code)}</h2>
        <EmptyNote
          title={view.other.length ? COPY.noLadder(code, view.other.length) : COPY.noStrikes(code)}
          hint={COPY.noStrikesHint}
          action={<Button onClick={() => openTicket({ mode: 'write', assetId, kind: 'put' })}>{COPY.writeFirst}</Button>}
        />
        <OtherOffers view={view} narrow={listSeries} ticketKey={ticketKey} onTake={take} onCancel={setCancelling} />
        <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
      </>
    )
  }

  const orders = column.offers + column.bids
  const units = COPY.units(view.quote.code, code, formatUtc(column.expiry))
  // On a phone the number of orders leaves the deadline tab (after a time left it read as hours) for this line.
  const caption = narrow ? COPY.units(view.quote.code, code, formatUtc(column.expiry), orders) : units
  // The one line under the chain while nothing is selected: what a press does, or that nothing is posted yet.
  const hint = orders === 0 ? (bidsOn ? COPY.noOrders : COPY.noOrdersNoBids) : bidsOn ? COPY.selectHint : COPY.selectHintNoBids

  return (
    <>
      <section className={styles.chain} aria-labelledby="chain-title">
        <h2 id="chain-title" className="ui-vh">
          {COPY.chainHeading(code)}
        </h2>
        <ExpiryBar
          columns={view.columns}
          value={column.day}
          onChange={(day) => {
            setMoved(null)
            patch({ ...CLEAR_TICKET, side: keptSide, expiry: day })
          }}
          otherDates={otherDates}
          compact={narrow}
        />
        {moved ? <p className={styles.moved}>{moved.line}</p> : null}
        <p className={styles.caption}>{caption}</p>
        {refreshFailed ? (
          <p className={styles.stale}>
            <IconWarning size={16} />
            <span>{COPY.refreshFailed}</span>
            <Button size="sm" variant="quiet" onClick={onRefresh}>
              {COPY.refresh}
            </Button>
          </p>
        ) : null}
        <ChainTable
          key={column.expiry}
          view={view}
          column={column}
          selectedKey={selectedKey}
          context={{ bidsOn, me, wide, form: keptSide ?? null }}
          compact={narrow}
          caption={`${COPY.chainHeading(code)}. ${units}`}
          onPress={press}
        />
        <p className={styles.legend}>{reference ? COPY.shaded(reference.phrase) : COPY.noReference}</p>
        {ref ? null : <p className={styles.hint}>{hint}</p>}
      </section>

      {ref ? (
        <SeriesPanel
          view={view}
          series={ref}
          bidsOn={bidsOn}
          narrow={listBook}
          ticketKey={ticketKey}
          reveal={reveal}
          positions={positions}
          onTake={take}
          onCancel={setCancelling}
          onWrite={() => openOnSeries('write', ref)}
          onBid={() => openOnSeries('bid', ref)}
        />
      ) : null}

      <YourOrders view={view} narrow={listSeries} positions={positions} selected={ref} ticketKey={ticketKey} onSelect={show} onCancel={setCancelling} />
      <OtherOffers view={view} narrow={listSeries} ticketKey={ticketKey} onTake={take} onCancel={setCancelling} />
      <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
    </>
  )
}
