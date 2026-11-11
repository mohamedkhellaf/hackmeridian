// The Requests tab of an asset: buyers' funded bids waiting for a seller. A seller fills one from the ticket
// ("Sell to this bid"); a buyer posts one ("Post a request"); the wallet's own bids are marked and can be
// cancelled, which refunds the escrowed premium.
import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { AssetSearch } from '../../../app/search'
import { formatCountdown, formatUnits } from '../../../core/format'
import type { TokenInfo } from '../../../core/options/types'
import { STATUS_LABEL } from '../../../core/requests/requests'
import type { Bid } from '../../../core/requests/types'
import { premiumUnits, strikeUnits } from '../../../core/units'
import { bidSubject, describeTx, txEffectText, useBids, useCancelBid, useMe, useNowSec, useSubjectBusy } from '../../../data'
import { Button, ButtonLink, Callout, DateTime, EmptyNote, Glyph, Marker, Skeleton, Table, TableWrap, Tag, TBody, Td, Th, THead, Tr } from '../../../ui'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import {
  CANCEL_REFUND,
  CANCEL_REQUEST,
  KIND_WORD,
  NONE,
  POST_REQUEST,
  REQUESTS_EMPTY_HINT,
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
import { assetRequests } from '../model'
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

function CancelButton({ bid }: { bid: Bid }) {
  const cancel = useCancelBid()
  const busy = useSubjectBusy(bidSubject(bid.id))
  const failed = cancel.state.phase === 'failed' || cancel.state.phase === 'declined' || cancel.state.phase === 'expired' || cancel.state.phase === 'unknown'
  const summary = failed ? describeTx(cancel.state) : null
  return (
    <span className={styles.cancel}>
      <Button size="sm" loading={cancel.working || busy} aria-label={`${CANCEL_REQUEST} your request for ${KIND_WORD[bid.kind].toLowerCase()} on ${moneyText(bid.underlyingQty, bid.underlying)}. ${CANCEL_REFUND}`} onClick={() => void cancel.run(bid)}>
        {CANCEL_REQUEST}
      </Button>
      {summary ? (
        <span className={styles.cancelError}>
          {summary.title}. {cancel.state.phase === 'failed' ? summary.detail : txEffectText(cancel.state)}
        </span>
      ) : null}
    </span>
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

const stateOf = (r: AssetRequest): string => (r.open ? STATUS_LABEL.open : STATUS_LABEL.expired)

export function RequestsTab({ token }: RequestsTabProps) {
  const me = useMe()
  const bids = useBids()
  const nowSec = useNowSec(30)
  const param = useAssetParam()
  const search = useAssetSearch()
  const ticketSearch = useTicketSearch()
  const rows = useMemo(() => (bids.data ? assetRequests(bids.data, token.contractId, me, nowSec) : null), [bids.data, token.contractId, me, nowSec])

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
      <header className={styles.head}>
        <div className={styles.headMain}>
          <h2 id="asset-requests" className={styles.title}>
            {REQUESTS_HEADING}
          </h2>
          <p className={styles.lead}>{requestsLead(token.code)}</p>
        </div>
        {rows && rows.length > 0 ? postRequest : null}
      </header>

      {bids.isError && rows === null ? (
        <Callout variant="danger" title={REQUESTS_ERROR} actions={<Button onClick={() => void bids.refetch()}>{RETRY}</Button>}>
          {bids.error instanceof Error ? bids.error.message : null}
        </Callout>
      ) : bids.isPending ? (
        <Skeleton variant="rows" lines={4} />
      ) : rows === null ? (
        <EmptyNote title={REQUESTS_UNSUPPORTED} />
      ) : rows.length === 0 ? (
        <EmptyNote title={requestsEmpty(token.code)} hint={REQUESTS_EMPTY_HINT} action={postRequest} />
      ) : (
        <>
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
                  <Th>{REQ_COL.state}</Th>
                  <Th pinned>{REQ_COL.action}</Th>
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
                        <span className={styles.stack}>
                          <DateTime value={bid.expiry * 1000} format="date" />
                          <span className={styles.sub}>{formatCountdown(bid.expiry - nowSec)}</span>
                        </span>
                      </Td>
                      <Td numeric>
                        <span className={styles.stack}>
                          <span>{r.mine ? <Marker>{premium}</Marker> : premium}</span>
                          {per !== null ? <span className={styles.sub}>{perUnitLine(formatUnits(per, bid.quote.decimals))}</span> : null}
                        </span>
                      </Td>
                      <Td>{r.mine ? <span className={styles.yours}>{YOURS}</span> : <ChainId value={bid.buyer} copyLabel={null} explorerLabel="View the buyer on the explorer" />}</Td>
                      <Td>
                        <Tag state={stateOf(r)} />
                      </Td>
                      <Td pinned>
                        {r.mine ? (
                          <CancelButton bid={bid} />
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
                    <Tag state={stateOf(r)} />
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
                        <span className={styles.sub}>{formatCountdown(bid.expiry - nowSec)}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>{REQ_COL.premium}</dt>
                      <dd>
                        <span>{r.mine ? <Marker><Money units={bid.totalPremium} token={bid.quote} /></Marker> : <Money units={bid.totalPremium} token={bid.quote} />}</span>
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
                      <CancelButton bid={bid} />
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
        </>
      )}
    </section>
  )
}
