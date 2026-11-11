// The Requests tab of an asset: buyers' funded requests waiting for a maker. A request is drawn here as /requests
// draws it (ruling F15): Kind, Strike, Quantity, Deadline, Premium per unit with the total beneath, Buyer and the
// action, the deadline as `13 Nov 2026, 08:00 UTC` with the time left beneath, and on phones the same card. Both
// pages read the row model and its words from core/requests/rows. A maker fills a request from the ticket; a buyer
// posts one; the wallet's own requests are marked and can be cancelled (also after their deadline: the premium
// comes back either way) in the same dialog as in the chain.
import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { AssetSearch } from '../../../app/search'
import type { BookRow } from '../../../core/market/book'
import type { TokenInfo } from '../../../core/options/types'
import {
  CANCEL_REQUEST,
  FILL_REQUEST,
  IN_TOTAL,
  LAPSE_LINE,
  REQUEST_COLUMNS as COL,
  YOURS,
  cancelRequestLabel,
  fillRequestLabel,
  lapsing,
  perAsset,
  requestRow as toRow,
  requestTitle,
  serialText,
  warnBelowOf,
} from '../../../core/requests/rows'
import type { RequestRow } from '../../../core/requests/rows'
import { bidSubject, useBids, useMe, useNowSec, useSubjectBusy } from '../../../data'
import {
  Amount,
  Button,
  ButtonLink,
  Callout,
  Countdown,
  DateTime,
  EmptyNote,
  Glyph,
  IconWarning,
  Marker,
  Skeleton,
  Table,
  TableWrap,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  VisuallyHidden,
} from '../../../ui'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { CancelDialog } from '../chain/CancelDialog'
import { POST_REQUEST, REQUESTS_ERROR, REQUESTS_HEADING, REQUESTS_UNSUPPORTED, RETRY, requestsCaption, requestsEmpty, requestsLead } from '../copy'
import { assetRequests, requestRow as bookRowOf } from '../model'
import { ChainId } from '../parts'
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

/** The premium per unit, the figure a request is priced by, under the highlighter on the wallet's own request. */
function PerUnit({ row, figure }: { row: RequestRow; figure?: 'serif' }) {
  const amount = <Amount value={row.premiumPerUnit.text} exact={row.premiumPerUnit.exact} unit={row.premiumPerUnit.code} figure={figure} />
  return row.mine ? <Marker>{amount}</Marker> : amount
}

/** The total the buyer escrowed, under the premium per unit. */
function Total({ row }: { row: RequestRow }) {
  return (
    <>
      <Amount value={row.premium.text} exact={row.premium.exact} unit={row.premium.code} /> {IN_TOTAL}
    </>
  )
}

/** The one action of a row: fill another wallet's request, or cancel the wallet's own. One look per layout (F14). */
function RowAction({ row, size, fill, onCancel }: { row: RequestRow; size: 'sm' | 'md'; fill: (row: RequestRow) => ReactElement<Record<string, unknown>>; onCancel: (row: RequestRow) => void }) {
  const busy = useSubjectBusy(bidSubject(row.bid.id))
  return row.mine ? (
    <Button size={size} loading={busy} aria-label={cancelRequestLabel(row)} onClick={() => onCancel(row)}>
      {CANCEL_REQUEST}
    </Button>
  ) : (
    <ButtonLink size={size} aria-label={fillRequestLabel(row)} render={fill(row)}>
      {FILL_REQUEST}
    </ButtonLink>
  )
}

export function RequestsTab({ token }: RequestsTabProps) {
  const me = useMe()
  const bids = useBids()
  const nowSec = useNowSec(30)
  const param = useAssetParam()
  const search = useAssetSearch()
  const ticketSearch = useTicketSearch()
  // Every open request on the asset, then the wallet's own whose deadline passed with the premium still escrowed:
  // those read as expired, as on /requests.
  const rows = useMemo(
    () => (bids.data ? assetRequests(bids.data, token.contractId, me, nowSec).map((r) => toRow(r.open ? r.bid : { ...r.bid, state: 'expired' }, me)) : null),
    [bids.data, token.contractId, me, nowSec],
  )
  const [cancelling, setCancelling] = useState<BookRow | null>(null)
  const cancel = (row: RequestRow) => setCancelling(bookRowOf(row.bid))
  const caption = requestsCaption(token.code)

  const postRequest = (
    <ButtonLink render={<RouterLink to={ASSET_ROUTE} params={{ asset: param }} search={ticketSearch({ mode: 'bid', assetId: token.contractId, kind: 'put' })} activeOptions={EXACT} resetScroll={false} />}>
      {POST_REQUEST}
    </ButtonLink>
  )
  const fill = (row: RequestRow) => <RouterLink to={ASSET_ROUTE} params={{ asset: param }} search={ticketSearch({ mode: 'fill', bidId: row.bid.id })} activeOptions={EXACT} resetScroll={false} />
  const selected = (row: RequestRow) => search.bid === row.key

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
          <TableWrap label={caption} className={styles.tableWrap}>
            <Table caption={caption} fixed className={styles.table}>
              <colgroup>
                <col className={styles.colKind} />
                <col className={styles.colStrike} />
                <col className={styles.colQty} />
                <col className={styles.colDeadline} />
                <col className={styles.colPremium} />
                <col className={styles.colBuyer} />
                <col className={styles.colAction} />
              </colgroup>
              <THead>
                <Tr>
                  <Th>{COL.kind}</Th>
                  <Th strike>{COL.strike}</Th>
                  <Th numeric>{COL.quantity}</Th>
                  <Th>{COL.deadline}</Th>
                  <Th numeric>{COL.premium}</Th>
                  <Th>{COL.buyer}</Th>
                  <Th pinned>{COL.action}</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <Tr key={row.key} selected={selected(row)} interactive data-mine={row.mine || undefined}>
                    {/* The request's number sits under the first cell of the row, as on /requests. */}
                    <Td>
                      <span className={styles.stack}>
                        <span className={styles.kind}>
                          <Glyph name={row.glyph} size={12} />
                          <span>{row.kindWord}</span>
                        </span>
                        <span className={styles.sub}>{serialText(row.serial)}</span>
                      </span>
                    </Td>
                    <Td strike>
                      <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                    </Td>
                    <Td numeric>
                      <Amount value={row.quantity.text} exact={row.quantity.exact} unit={row.quantity.code} />
                    </Td>
                    <Td>
                      <span className={styles.stack}>
                        <DateTime value={row.deadlineSec * 1000} />
                        <span className={styles.sub}>
                          <Countdown to={row.deadlineSec * 1000} warnBelowMs={warnBelowOf(row)} />
                        </span>
                        {lapsing(row, nowSec) ? (
                          <span className={styles.warn}>
                            <IconWarning size={12} />
                            <span>{LAPSE_LINE}</span>
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    <Td numeric>
                      <span className={styles.stack} data-align="end">
                        <PerUnit row={row} />
                        <span className={styles.sub}>
                          <Total row={row} />
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <ChainId value={row.bid.buyer} name={row.mine ? YOURS : undefined} copyLabel={null} explorerLabel="View the buyer on the explorer" />
                    </Td>
                    <Td pinned>
                      <RowAction row={row} size="sm" fill={fill} onCancel={cancel} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <ul className={styles.cards} aria-label={caption}>
            {rows.map((row) => (
              <li key={row.key} className={styles.card} data-selected={selected(row) || undefined} data-mine={row.mine || undefined}>
                <div className={styles.line}>
                  <p className={styles.title}>
                    <Glyph name={row.glyph} size={12} className={styles.glyph} />
                    <span>{requestTitle(row)}</span>
                  </p>
                  <p className={styles.premium}>
                    <VisuallyHidden>{COL.premium}: </VisuallyHidden>
                    <PerUnit row={row} figure="serif" />
                    <span className={styles.per}>{perAsset(row)}</span>
                  </p>
                </div>
                <div className={styles.line}>
                  <p className={styles.terms}>
                    <span className={styles.label}>{COL.strike}</span>
                    <Amount value={row.strike.text} exact={row.strike.exact} unit={row.strike.code} />
                  </p>
                  <p className={styles.aside}>
                    <Total row={row} />
                  </p>
                </div>
                <div className={styles.line}>
                  <p className={styles.terms}>
                    <VisuallyHidden>{COL.deadline}: </VisuallyHidden>
                    <DateTime value={row.deadlineSec * 1000} />
                  </p>
                  <p className={styles.aside}>
                    <Countdown to={row.deadlineSec * 1000} warnBelowMs={warnBelowOf(row)} />
                  </p>
                </div>
                {lapsing(row, nowSec) ? (
                  <p className={styles.warnLine}>
                    <IconWarning size={14} />
                    <span>{LAPSE_LINE}</span>
                  </p>
                ) : null}
                <div className={styles.foot}>
                  <p className={styles.facts}>
                    <span className={styles.buyer}>
                      <span>{COL.buyer}</span>
                      <ChainId value={row.bid.buyer} name={row.mine ? YOURS : undefined} copyLabel={null} explorerLabel="View the buyer on the explorer" />
                    </span>
                    <span>{serialText(row.serial)}</span>
                  </p>
                  <div className={styles.action}>
                    <RowAction row={row} size="md" fill={fill} onCancel={cancel} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CancelDialog row={cancelling} onClose={() => setCancelling(null)} />
    </section>
  )
}
