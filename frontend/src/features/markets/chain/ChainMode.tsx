// Chain mode of the asset page (brief 4.3): expiry dates, the option chain on the standard grid, the book of the
// selected series and the orders that are off the grid. The selection lives in the URL (`expiry`, `kind`,
// `strike`); tickets are opened by writing the ticket's own search params, which the asset page turns into the
// order ticket in its rail.
import { useCallback, useMemo, useRef, useState } from 'react'
import { formatUtc } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import type { SeriesRef } from '../../../core/market/selection'
import type { OptionKind } from '../../../core/options/types'
import { useMarket } from '../../../data'
import type { GridCell, MarketView } from '../../../data'
import { Button, Callout, EmptyNote, IconWarning, Segmented, Skeleton, VisuallyHidden, announce } from '../../../ui'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { CancelDialog } from './CancelDialog'
import { ChainList } from './ChainList'
import { ChainTable } from './ChainTable'
import { COPY, KIND_PLURAL } from './copy'
import { ExpiryBar } from './ExpiryBar'
import { referenceLine, resolveSelection, selectionSearch, seriesTitle, strikeParam } from './model'
import { OtherOffers } from './OtherOffers'
import { SeriesPanel } from './SeriesPanel'
import { CLEAR_TICKET, useChainSearch, usePatchSearch } from './url'
import { useNarrow } from './useNarrow'
import styles from './ChainMode.module.css'

const HALVES: readonly OptionKind[] = ['call', 'put']

function ChainSkeleton({ code }: { code: string | null }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <VisuallyHidden>{COPY.loading(code ?? 'option')}</VisuallyHidden>
      <Skeleton variant="block" width="20rem" height="2.25rem" />
      <Skeleton variant="rows" lines={9} />
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

export function ChainMode({ assetId }: { assetId: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const narrow = useNarrow(rootRef)
  const market = useMarket(assetId)

  const view = market.data

  return (
    <div ref={rootRef} className={styles.root} data-narrow={narrow || undefined} data-testid="chain-mode">
      {market.isLoading ? (
        <ChainSkeleton code={null} />
      ) : market.isError ? (
        <Callout variant="danger" title={COPY.loadFailedTitle} actions={<Button onClick={market.retry}>{COPY.retry}</Button>}>
          {market.error ? `${market.error} ` : null}
          {COPY.loadFailedHint}
        </Callout>
      ) : !view ? (
        <EmptyNote title={COPY.notListed} headingLevel={2} />
      ) : (
        // A contract without requests answers `null`; while the read is out, assume the current contract.
        <Chain view={view} narrow={narrow} bidsOn={view.bidsOn} refreshFailed={market.refreshFailed} onRefresh={market.retry} />
      )}
    </div>
  )
}

interface ChainProps {
  view: MarketView
  narrow: boolean
  bidsOn: boolean
  refreshFailed: boolean
  onRefresh: () => void
}

function Chain({ view, narrow, bidsOn, refreshFailed, onRefresh }: ChainProps) {
  const search = useChainSearch()
  const patch = usePatchSearch()
  const [cancelling, setCancelling] = useState<BookRow | null>(null)
  const assetId = view.asset.contractId
  const code = view.asset.code
  const decimals = view.quote.decimals

  const { column, ref, cell } = useMemo(() => resolveSelection(view, search), [view, search])
  const selectedKey = cell?.key ?? null
  const reference = useMemo(() => referenceLine(view.reference, decimals), [view.reference, decimals])
  const ticketKey = ticketRowKey(search)
  // A write or bid ticket follows the selection (its terms are the same search params); a ticket on one exact
  // order does not survive a new selection.
  const keptSide = search.side === 'write' || search.side === 'bid' ? search.side : undefined

  // The half shown on a phone: the user's choice until the selection changes, then the half of the selection.
  const selectionId = ref ? `${ref.expiry}:${ref.kind}:${ref.strikePerUnit}` : ''
  const [halfChoice, setHalfChoice] = useState<{ half: OptionKind; at: string } | null>(null)
  const half: OptionKind = halfChoice && halfChoice.at === selectionId ? halfChoice.half : (ref?.kind ?? 'call')

  const openTicket = useCallback(
    (intent: TicketIntent, selection?: SeriesRef) => {
      patch({ ...CLEAR_TICKET, ...(selection ? selectionSearch(selection, decimals) : {}), ...searchFromTicketIntent(intent) })
    },
    [patch, decimals],
  )

  const openOnSeries = useCallback(
    (mode: 'write' | 'bid', series: SeriesRef, qty?: string, premium?: string) => {
      openTicket({ mode, assetId, kind: series.kind, strike: strikeParam(series.strikePerUnit, decimals), expiry: series.expiry, qty, premium }, series)
    },
    [openTicket, assetId, decimals],
  )

  const pick = useCallback(
    (picked: GridCell) => {
      const title = seriesTitle(code, picked.ref, decimals)
      if (picked.empty && picked.bids === 0 && bidsOn && keptSide !== 'write') {
        // An empty cell asks for a price: the series is selected and the bid ticket opens on it. A maker with
        // the write form open is not asking: the form follows the selection instead.
        openOnSeries('bid', picked.ref)
        announce(`${title}. No offer. Request a price.`)
        return
      }
      if (picked.key === selectedKey) {
        // Pressing the selected cell again closes its panel, unless a write or bid form is following the selection.
        if (keptSide) return
        patch({ ...CLEAR_TICKET, kind: undefined, strike: undefined })
        announce(`${title} closed.`)
        return
      }
      patch({ ...CLEAR_TICKET, side: keptSide, ...selectionSearch(picked.ref, decimals) })
      announce(`${title} selected. Its offers and bids are listed under the chain.`)
    },
    [code, decimals, bidsOn, selectedKey, keptSide, patch, openOnSeries],
  )

  const take = useCallback(
    (row: BookRow) => {
      if (row.source === 'bid' && row.bid) openTicket({ mode: 'fill', bidId: row.bid.id })
      else if (row.source === 'resale' && row.offer) openTicket({ mode: 'buy-resale', optionId: row.offer.id })
      else if (row.offer) openTicket({ mode: 'buy', offerId: row.offer.id })
    },
    [openTicket],
  )

  const otherDates = useMemo(() => view.other.filter((o) => !view.expiries.includes(o.row.expiry)).length, [view.other, view.expiries])
  const anyYours = useMemo(() => !!column?.rows.some((r) => r.call.mine || r.call.holding || r.call.wrote || r.put.mine || r.put.holding || r.put.wrote), [column])

  if (!column || view.ladder.length === 0) {
    return (
      <>
        <h2 className="ui-vh">{COPY.chainHeading(code)}</h2>
        <EmptyNote
          title={COPY.noStrikes(code)}
          hint={COPY.noStrikesHint}
          action={<Button onClick={() => openTicket({ mode: 'write', assetId, kind: 'put' })}>{COPY.writeFirst}</Button>}
        />
        <OtherOffers view={view} narrow={narrow} ticketKey={ticketKey} onTake={take} onCancel={setCancelling} />
        <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
      </>
    )
  }

  return (
    <>
      <section className={styles.chain} aria-labelledby="chain-title">
        <h2 id="chain-title" className="ui-vh">
          {COPY.chainHeading(code)}
        </h2>
        <div className={styles.controls}>
          <ExpiryBar
            columns={view.columns}
            value={column.day}
            onChange={(day) => patch({ ...CLEAR_TICKET, side: keptSide, expiry: day })}
            otherDates={otherDates}
          />
          {narrow ? (
            <Segmented
              label={COPY.halfLabel}
              fullWidth
              value={half}
              onValueChange={(next) => setHalfChoice({ half: next, at: selectionId })}
              options={HALVES.map((h) => ({ value: h, label: KIND_PLURAL[h] }))}
            />
          ) : null}
        </div>
        <p className={styles.caption}>
          {COPY.units(view.quote.code, code)} Expiry {formatUtc(column.expiry)}.
        </p>
        {refreshFailed ? (
          <p className={styles.stale}>
            <IconWarning size={16} />
            <span>{COPY.refreshFailed}</span>
            <Button size="sm" variant="quiet" onClick={onRefresh}>
              {COPY.refresh}
            </Button>
          </p>
        ) : null}
        {narrow ? (
          <ChainList key={column.expiry} view={view} column={column} half={half} selectedKey={selectedKey} bidsOn={bidsOn} onPick={pick} />
        ) : (
          <ChainTable key={column.expiry} view={view} column={column} selectedKey={selectedKey} bidsOn={bidsOn} onPick={pick} />
        )}
        <p className={styles.legend}>
          {reference ? `${COPY.shaded(reference.phrase, reference.price)} ${view.reference.note}` : COPY.noReference}
          {anyYours ? ` ${COPY.marked}` : null}
        </p>
      </section>

      {ref ? (
        <SeriesPanel
          view={view}
          series={ref}
          bidsOn={bidsOn}
          narrow={narrow}
          ticketKey={ticketKey}
          onTake={take}
          onCancel={setCancelling}
          onWrite={(qty, premium) => openOnSeries('write', ref, qty, premium)}
          onBid={(qty, premium) => openOnSeries('bid', ref, qty, premium)}
        />
      ) : (
        <p className={styles.hint}>{bidsOn ? COPY.selectHint : COPY.selectHintNoBids}</p>
      )}

      <OtherOffers view={view} narrow={narrow} ticketKey={ticketKey} onTake={take} onCancel={setCancelling} />
      <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
    </>
  )
}
