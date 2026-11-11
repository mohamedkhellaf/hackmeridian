// The Requests tab of an asset: buyers' funded bids waiting for a maker. A maker fills one from the ticket ("Fill
// request"); a buyer posts one ("Post a request"); the wallet's own requests are marked and can be cancelled in
// the same dialog as in the chain, which says what comes back and shows the transaction's stages.
import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { AssetSearch } from '../../../app/search'
import { formatCountdown, formatUnits } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import type { TokenInfo } from '../../../core/options/types'
import type { Bid } from '../../../core/requests/types'
import { premiumUnits, strikeUnits } from '../../../core/units'
import { bidSubject, useBids, useMe, useNowSec, useSubjectBusy } from '../../../data'
import { Button, ButtonLink, Callout, DateTime, EmptyNote, Glyph, Marker, Skeleton, Table, TableWrap, TBody, Td, Th, THead, Tr } from '../../../ui'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { CancelDialog } from '../chain/CancelDialog'
import {
  CANCEL_REFUND,
  CANCEL_REQUEST,
  KIND_WORD,
  LAPSED,
  NONE,
  POST_REQUEST,
  REQUESTS_ERROR,
  REQUESTS_HEADING,
  REQUESTS_UNSUPPORTED,
  REQ_COL,
  RETRY,
  SELL_TO_BID,
  YOURS,
  perUnitLine,
  requestsCaption,
  requestsEmpty,
  requestsLead,
} from '../copy'
import { assetRequests, requestRow } from '../model'
import type { AssetRequest } from '../model'
import { ChainId, Money } from '../parts'
import { moneyText } from '../values'
import { ASSET_ROUTE, CLEAR_TICKET, EXACT, compactSearch, useAssetParam, useAssetSearch } from '../routing'
import styles from './RequestsTab.module.css'

export interface RequestsTabProps {
  token: TokenInfo
}

/** The search of this page with the ticket opened on `intent`. */
function useTicketSearch(): (intent: TicketIntent) => AssetSearch {
  const search = useAssetSearch()
  return (intent) => compactSearch({ ...search, ...CLEAR_TICKET, ...searchFromTicketIntent(intent) })
}

function CancelButton({ bid, onCancel, fullWidth = false }: { bid: Bid; onCancel: (bid: Bid) => void; fullWidth?: boolean }) {
  const busy = useSubjectBusy(bidSubject(bid.id))
  return (
    <Button size={fullWidth ? 'md' : 'sm'} fullWidth={fullWidth} loading={busy} aria-label={`${CANCEL_REQUEST} your request for ${KIND_WORD[bid.kind].toLowerCase()} on ${moneyText(bid.underlyingQty, bid.underlying)}. ${CANCEL_REFUND}`} onClick={() => onCancel(bid)}>
      {CANCEL_REQUEST}
    </Button>
  )
}

function Kind({ bid }: { bid: Bid }) {
  return (
    <span className={styles.kind}>
      <Glyph name={bid.kind === 'put' ? 'long-put' : 'long-call'} />
      {KIND_WORD[bid.kind]}
    </span>
  )
}

/** The deadline, and under it the time left; the wallet's own lapsed request says it expired instead. */
function Deadline({ r, nowSec }: { r: AssetRequest; nowSec: number }) {
  return (
    <span className={styles.stack}>
      <DateTime value={r.bid.expiry * 1000} format="date" />
      <span className={styles.sub}>{r.open ? formatCountdown(r.bid.expiry - nowSec) : LAPSED}</span>
    </span>
  )
}

export function RequestsTab({ token }: RequestsTabProps) {
  const me = useMe()
  const bids = useBids()
  const nowSec = useNowSec(30)
  const param = useAssetParam()
  const search = useAssetSearch()
  const ticketSearch = useTicketSearch()
  const rows = useMemo(() => (bids.data ? assetRequests(bids.data, token.contractId, me, nowSec) : null), [bids.data, token.contractId, me, nowSec])
  const [cancelling, setCancelling] = useState<BookRow | null>(null)
  const cancel = (bid: Bid) => setCancelling(requestRow(bid))

  const postRequest = (
    <ButtonLink render={<RouterLink to={ASSET_ROUTE} params={{ asset: param }} search={ticketSearch({ mode: 'bid', assetId: token.contractId, kind: 'put' })} activeOptions={EXACT} resetScroll={false} />}>
      {POST_REQUEST}
    </ButtonLink>
  )
  const sellLink = (bid: Bid) => <RouterLink to={ASSET_ROUTE} params={{ asset: param }} search={ticketSearch({ mode: 'fill', bidId: bid.id })} activeOptions={EXACT} resetScroll={false} />
  const sellName = (bid: Bid) =>
    `${SELL_TO_BID}: ${KIND_WORD[bid.kind].toLowerCase()} on ${moneyText(bid.underlyingQty, bid.underlying)}, premium ${moneyText(bid.totalPremium, bid.quote)}`

  return (
    <section className={styles.root} aria-labelledby="asset-requests" aria-busy={bids.isPending || undefined}>
      {/* The tab above already says "Requests": the heading is for screen readers, the definition leads. */}
      <h2 id="asset-requests" className="ui-vh">
        {REQUESTS_HEADING}
      </h2>
      <div className={styles.head}>
        <p className={styles.lead}>{requestsLead(token.code)}</p>
        {rows && rows.length > 0 ? postRequest : null}
      </div>

      {bids.isError && rows === null ? (
        <Callout variant="danger" title={REQUESTS_ERROR} actions={<Button onClick={() => void bids.refetch()}>{RETRY}</Button>}>
          {bids.error instanceof Error ? bids.error.message : null}
        </Callout>
      ) : bids.isPending ? (
        <Skeleton variant="rows" lines={4} />
      ) : rows === null ? (
        <EmptyNote title={REQUESTS_UNSUPPORTED} />
      ) : rows.length === 0 ? (
        <EmptyNote title={requestsEmpty(token.code)} action={postRequest} />
      ) : (
        <div className={styles.list}>
          <TableWrap label={requestsCaption(token.code)} className={styles.table}>
            <Table caption={requestsCaption(token.code)}>
              <THead>
                <Tr>
                  <Th>{REQ_COL.kind}</Th>
                  <Th numeric>{REQ_COL.strike}</Th>
                  <Th numeric>{REQ_COL.qty}</Th>
                  <Th numeric>{REQ_COL.expiry}</Th>
                  <Th numeric>{REQ_COL.premium}</Th>
                  <Th>{REQ_COL.buyer}</Th>
                  <Th>
                    <span className="ui-vh">{REQ_COL.action}</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const { bid } = r
                  const strike = strikeUnits(bid)
                  const per = premiumUnits(bid)
                  const premium = <Money units={bid.totalPremium} token={bid.quote} />
                  return (
                    <Tr key={String(bid.id)} selected={search.bid === String(bid.id)}>
                      <Td>
                        <Kind bid={bid} />
                      </Td>
                      <Td numeric className={styles.strike}>
                        {strike !== null ? <Money units={strike} token={bid.quote} /> : NONE}
                      </Td>
                      <Td numeric>
                        <Money units={bid.underlyingQty} token={bid.underlying} />
                      </Td>
                      <Td numeric>
                        <Deadline r={r} nowSec={nowSec} />
                      </Td>
                      <Td numeric>
                        <span className={styles.stack}>
                          <span>{r.mine ? <Marker>{premium}</Marker> : premium}</span>
                          {per !== null ? <span className={styles.sub}>{perUnitLine(formatUnits(per, bid.quote.decimals))}</span> : null}
                        </span>
                      </Td>
                      <Td>{r.mine ? <span className={styles.yours}>{YOURS}</span> : <ChainId value={bid.buyer} copyLabel={null} explorerLabel="View the buyer on the explorer" />}</Td>
                      <Td align="end" className={styles.actionCell}>
                        {r.mine ? (
                          <CancelButton bid={bid} onCancel={cancel} />
                        ) : (
                          <ButtonLink size="sm" aria-label={sellName(bid)} render={sellLink(bid)}>
                            {SELL_TO_BID}
                          </ButtonLink>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </TBody>
            </Table>
          </TableWrap>

          <ul className={styles.cards} role="list" aria-label={requestsCaption(token.code)}>
            {rows.map((r) => {
              const { bid } = r
              const strike = strikeUnits(bid)
              const per = premiumUnits(bid)
              return (
                <li key={String(bid.id)} className={styles.card} data-selected={search.bid === String(bid.id) || undefined}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardKind}>
                      <Kind bid={bid} />
                      {strike !== null ? (
                        <span className={styles.cardStrike}>
                          at <Money units={strike} token={bid.quote} figure="serif" />
                        </span>
                      ) : null}
                    </span>
                    {r.open ? null : <span className={styles.lapsed}>{LAPSED}</span>}
                  </div>
                  <dl className={styles.cardFacts}>
                    <div>
                      <dt>{REQ_COL.qty}</dt>
                      <dd>
                        <Money units={bid.underlyingQty} token={bid.underlying} />
                      </dd>
                    </div>
                    <div>
                      <dt>{REQ_COL.expiry}</dt>
                      <dd>
                        <DateTime value={bid.expiry * 1000} format="date" />
                        {r.open ? <span className={styles.sub}>{formatCountdown(bid.expiry - nowSec)}</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt>{REQ_COL.premium}</dt>
                      <dd>
                        <span>
                          {r.mine ? (
                            <Marker>
                              <Money units={bid.totalPremium} token={bid.quote} />
                            </Marker>
                          ) : (
                            <Money units={bid.totalPremium} token={bid.quote} />
                          )}
                        </span>
                        {per !== null ? <span className={styles.sub}>{perUnitLine(formatUnits(per, bid.quote.decimals))}</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt>{REQ_COL.buyer}</dt>
                      <dd>{r.mine ? <span className={styles.yours}>{YOURS}</span> : <ChainId value={bid.buyer} copyLabel={null} />}</dd>
                    </div>
                  </dl>
                  <div className={styles.cardFoot}>
                    {r.mine ? (
                      <CancelButton bid={bid} onCancel={cancel} fullWidth />
                    ) : (
                      <ButtonLink fullWidth aria-label={sellName(bid)} render={sellLink(bid)}>
                        {SELL_TO_BID}
                      </ButtonLink>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
    </section>
  )
}
