import { Link as RouterLink } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { assetParam, findReferenceAsset, resolveAssetParam } from '../../core/assets'
import { explorerAccount, isMockId } from '../../core/explorer'
import { formatMoney, formatUtcClock } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { describeError } from '../../core/stellar/errors'
import { referenceMode, useAssets, useBalancesById, useBids, useCancelBid, useNowSec, useOptionsClient } from '../../data'
import { Button, Callout, EmptyNote, IconWarning, Link, PageHeader, shortenAddress, Skeleton, Switch, Tab, TabList, TabPanel, Tabs, useIsPhone, useIsWide, VisuallyHidden } from '../../ui'
import type { SelectOption } from '../../ui'
import { useWallet } from '../../wallet'
import { TicketHost } from '../ticket'
import type { TicketIntent } from '../ticket'
import { AssetChooser } from './AssetChooser'
import { DEFAULT_SORT, asOf, boardTotals, filterRequests, isClosed, myRequests, openRequests, parseBidId, sortRequests, toRows } from './board'
import type { KindFilter, RequestRow, RequestSort } from './board'
import { BoardTable } from './BoardTable'
import { CancelRequest } from './CancelRequest'
import {
  CLEAR_FILTERS,
  CONNECT_WALLET,
  EMPTY_BOARD,
  EMPTY_FILTERED,
  EMPTY_MINE,
  EMPTY_MINE_OPEN,
  FILTER_ASSET_ALL,
  GET_TEST_FUNDS,
  GUEST_MINE,
  LOADING,
  LOAD_ERROR_TITLE,
  NO_REQUESTS_IN_CONTRACT,
  PAGE_LEAD,
  PAGE_SIZE,
  PAGE_TITLE,
  POST_REQUEST,
  RETRY,
  SEE_RESERVES,
  SHOW_CLOSED,
  TABS_LABEL,
  TAB_BOARD,
  TAB_MINE,
  UNKNOWN_ASSET_FILTER,
  boardSummary,
  noFunds,
  refreshFailed,
  showMore,
} from './copy'
import { RequestList } from './RequestList'
import { MARKETS_ROUTE, RESERVES_ROUTE, usePatchRequestsSearch, useRequestsSearch } from './routing'
import { ALL, Toolbar } from './Toolbar'
import { emptyCollateral } from './view'
import type { RequestsViewProps } from './view'
import styles from './RequestsPage.module.css'

const NO_BIDS: readonly Bid[] = []

/** The assets a request can be on: the contract's list, or, until it is read, the assets of the requests shown. */
function underlyingsOf(listed: readonly TokenInfo[] | undefined, bids: readonly Bid[]): readonly TokenInfo[] {
  if (listed) return listed
  const seen = new Map<string, TokenInfo>()
  for (const b of bids) seen.set(b.underlying.contractId, b.underlying)
  return [...seen.values()]
}

/** A code is a label, not a key: an asset outside the reference list is told apart by its issuer. */
const assetLabel = (asset: TokenInfo): string => (findReferenceAsset(asset.contractId) || !asset.issuer ? asset.code : `${asset.code} (${shortenAddress(asset.issuer, 'short')})`)

/**
 * /requests: the board of open requests across assets, the wallet's own requests, and the two tickets that act on
 * them (fill a request, post a request). Filters, order, tab and the open ticket all live in the URL.
 */
export function RequestsPage() {
  const search = useRequestsSearch()
  const patch = usePatchRequestsSearch()
  const { me, isMock } = useOptionsClient()
  const wallet = useWallet()
  const phone = useIsPhone()
  const wide = useIsWide()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const bidsQuery = useBids()
  const assetsQuery = useAssets()
  const balances = useBalancesById(me).data
  const nowSec = useNowSec(30)

  const allBids = useMemo(() => asOf(bidsQuery.data ?? NO_BIDS, nowSec), [bidsQuery.data, nowSec])
  const listed = assetsQuery.data
  const underlyings = useMemo(() => underlyingsOf(listed?.underlyings, allBids), [listed, allBids])

  // ---- filters and order, from the URL
  const network = referenceMode()
  const filterAsset = useMemo(() => {
    if (!search.asset) return null
    const resolved = resolveAssetParam(search.asset, network, underlyings)
    return resolved.status === 'found' ? (underlyings.find((u) => u.contractId === resolved.contractId) ?? null) : null
  }, [search.asset, network, underlyings])
  const filterAssetId = filterAsset?.contractId ?? null
  const unknownAsset = search.asset !== undefined && filterAsset === null && listed !== undefined
  const kind: KindFilter | null = search.kind ?? null
  const sort: RequestSort = search.sort ?? DEFAULT_SORT
  const filtered = filterAssetId !== null || kind !== null

  // ---- the board: open requests, filtered and ordered, shown a page at a time
  const [limit, setLimit] = useState(PAGE_SIZE)
  const listKey = `${filterAssetId ?? ''}|${kind ?? ''}|${sort}`
  const [seenListKey, setSeenListKey] = useState(listKey)
  if (seenListKey !== listKey) {
    setSeenListKey(listKey)
    setLimit(PAGE_SIZE)
  }
  const open = useMemo(() => openRequests(allBids, nowSec), [allBids, nowSec])
  const matching = useMemo(() => toRows(sortRequests(filterRequests(open, { assetId: filterAssetId, kind }), sort), me, network), [open, filterAssetId, kind, sort, me, network])
  const boardRows = useMemo(() => matching.slice(0, limit), [matching, limit])
  const remaining = matching.length - boardRows.length
  const totals = useMemo(() => boardTotals(boardRows.map((r) => r.bid)), [boardRows])
  const empty = useMemo(() => emptyCollateral(boardRows, balances), [boardRows, balances])
  const emptyTokens = useMemo(() => new Set(empty.keys()), [empty])
  const openCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of open) counts.set(b.underlying.contractId, (counts.get(b.underlying.contractId) ?? 0) + 1)
    return counts
  }, [open])
  const assetOptions = useMemo<SelectOption[]>(
    () => [
      { value: ALL, label: FILTER_ASSET_ALL, detail: String(open.length) },
      ...underlyings.map((u) => ({ value: assetParam(u), label: assetLabel(u), detail: String(openCounts.get(u.contractId) ?? 0) })),
    ],
    [underlyings, open.length, openCounts],
  )

  // ---- my requests: the ones that still hold premium or became a position; closed ones on request
  const showClosed = search.closed === '1'
  const setShowClosed = useCallback((next: boolean) => patch({ closed: next ? '1' : undefined }, { replace: true }), [patch])
  const mineAll = useMemo(() => toRows(myRequests(allBids, me), me, network), [allBids, me, network])
  const closedCount = useMemo(() => mineAll.filter((r) => isClosed(r.bid)).length, [mineAll])
  const mineRows = useMemo(() => (showClosed ? mineAll : mineAll.filter((r) => !isClosed(r.bid))), [mineAll, showClosed])

  // ---- the ticket: `bid` opens the fill ticket, `new` the request ticket (after an asset is known)
  const bidId = parseBidId(search.bid)
  const posting = search.new === '1' && bidId === null
  // The chooser writes its choice to the board's asset filter, so a reload, Forward or a shared link reopens the same
  // ticket. Closing the ticket puts the filter back as it was before the choice.
  const [restore, setRestore] = useState<{ asset: string | undefined } | null>(null)
  const [wasPosting, setWasPosting] = useState(posting)
  if (wasPosting !== posting) {
    setWasPosting(posting)
    if (!posting) setRestore(null)
  }
  const postAssetId = filterAssetId ?? (underlyings.length === 1 ? underlyings[0].contractId : null)
  const intent = useMemo<TicketIntent | null>(() => {
    if (bidId !== null) return { mode: 'fill', bidId }
    if (!posting || !postAssetId) return null
    return { mode: 'bid', assetId: postAssetId, kind: kind ?? 'put' }
  }, [bidId, posting, postAssetId, kind])
  const choosing = posting && intent === null

  const post = useCallback(() => patch({ new: '1', bid: undefined }), [patch])
  const sell = useCallback((row: RequestRow) => patch({ bid: row.bid.id.toString(), new: undefined }), [patch])
  const closeTicket = useCallback(() => patch({ bid: undefined, new: undefined, ...(restore ? { asset: restore.asset } : {}) }, { replace: true }), [patch, restore])
  const choose = useCallback(
    (asset: TokenInfo) => {
      setRestore({ asset: search.asset })
      patch({ asset: assetParam(asset) }, { replace: true })
    },
    [patch, search.asset],
  )

  // ---- cancelling one of the wallet's own requests
  const [cancelling, setCancelling] = useState<RequestRow | null>(null)
  // The dialog stays mounted while closed: a run that ends after it closed is told in a toast.
  const cancel = useCancelBid({ open: cancelling !== null })
  const { reset: resetCancel } = cancel
  const openCancel = useCallback(
    (row: RequestRow) => {
      resetCancel()
      setCancelling(row)
    },
    [resetCancel],
  )
  const closeCancel = useCallback(() => {
    setCancelling(null)
    resetCancel()
  }, [resetCancel])

  const explorerOf = useCallback((address: string) => (isMock || isMockId(address) ? undefined : explorerAccount(address)), [isMock])
  const onSort = useCallback((next: RequestSort) => patch({ sort: next === DEFAULT_SORT ? undefined : next }, { replace: true }), [patch])

  const view = (rows: readonly RequestRow[], variant: RequestsViewProps['variant']) => {
    const props: RequestsViewProps = { rows, variant, selectedId: bidId, balances, emptyTokens, nowSec, sort, onSort, explorerOf, onSell: sell, onCancel: openCancel }
    return wide ? <BoardTable {...props} /> : <RequestList {...props} />
  }

  const loading = bidsQuery.isPending
  const failed = bidsQuery.isError && bidsQuery.data === undefined
  const unsupported = bidsQuery.data === null
  const refreshFailedAt = bidsQuery.isError && bidsQuery.data !== undefined ? bidsQuery.dataUpdatedAt : null

  const status = loading ? (
    <div aria-busy="true" className={styles.loading} data-layout={wide ? 'table' : 'list'}>
      <VisuallyHidden>{LOADING}</VisuallyHidden>
      <div className={styles.loadingBar}>
        <Skeleton variant="block" className={styles.boneAsset} />
        <Skeleton variant="block" className={styles.boneKind} />
        {wide ? null : <Skeleton variant="block" className={styles.boneSort} />}
      </div>
      <div className={styles.loadingRows}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.loadingRow}>
            <Skeleton variant="text" lines={wide ? 1 : 2} />
          </div>
        ))}
      </div>
    </div>
  ) : failed ? (
    <Callout
      variant="danger"
      title={LOAD_ERROR_TITLE}
      actions={
        <Button size="sm" onClick={() => void bidsQuery.refetch()}>
          {RETRY}
        </Button>
      }
    >
      {describeError(bidsQuery.error)}
    </Callout>
  ) : unsupported ? (
    <EmptyNote title={NO_REQUESTS_IN_CONTRACT} headingLevel={2} />
  ) : null

  const stale =
    refreshFailedAt !== null ? (
      <p className={styles.stale}>
        <IconWarning size={14} />
        <span>{refreshFailed(formatUtcClock(Math.floor(refreshFailedAt / 1000)))}</span>
        <Button size="sm" variant="quiet" onClick={() => void bidsQuery.refetch()}>
          {RETRY}
        </Button>
      </p>
    ) : null

  return (
    <div className={styles.page}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_LEAD}
        headingRef={headingRef}
        actions={
          unsupported ? undefined : (
            <Button variant="primary" onClick={post}>
              {POST_REQUEST}
            </Button>
          )
        }
      />

      <Tabs value={search.mine === '1' ? 'mine' : 'board'} onValueChange={(value) => patch({ mine: value === 'mine' ? '1' : undefined }, { replace: true })}>
        <TabList label={TABS_LABEL}>
          <Tab value="board">{TAB_BOARD}</Tab>
          <Tab value="mine">{TAB_MINE}</Tab>
        </TabList>

        <TabPanel value="board" className={styles.panel}>
          {status ?? (
            <>
              {open.length > 0 || filtered ? (
                <Toolbar
                  assetOptions={assetOptions}
                  asset={filterAsset ? assetParam(filterAsset) : ALL}
                  onAssetChange={(value) => patch({ asset: value === ALL ? undefined : value }, { replace: true })}
                  kind={kind}
                  onKindChange={(next) => patch({ kind: next ?? undefined }, { replace: true })}
                  sort={sort}
                  onSortChange={onSort}
                  sortControl={wide ? 'headers' : phone ? 'menu' : 'select'}
                />
              ) : null}
              {unknownAsset ? <p className={styles.notice}>{UNKNOWN_ASSET_FILTER}</p> : null}
              {stale}
              {empty.size > 0 ? (
                <p className={styles.funds}>
                  <span>{noFunds([...empty.values()])}</span> <Link render={<RouterLink to={MARKETS_ROUTE} search={{ funds: '1' }} />}>{GET_TEST_FUNDS}</Link>
                </p>
              ) : null}
              {boardRows.length > 0 ? (
                <>
                  {view(boardRows, 'board')}
                  {remaining > 0 ? (
                    <div>
                      <Button onClick={() => setLimit((n) => n + PAGE_SIZE)}>{showMore(Math.min(PAGE_SIZE, remaining))}</Button>
                    </div>
                  ) : null}
                  <p className={styles.summary} data-testid="board-summary">
                    <span>{boardSummary(boardRows.length, open.length, totals.escrowed !== null && totals.quote ? formatMoney(totals.escrowed, totals.quote) : null)}</span>{' '}
                    <Link render={<RouterLink to={RESERVES_ROUTE} />}>{SEE_RESERVES}</Link>
                  </p>
                </>
              ) : open.length > 0 ? (
                <EmptyNote
                  title={EMPTY_FILTERED}
                  headingLevel={2}
                  action={<Button onClick={() => patch({ asset: undefined, kind: undefined }, { replace: true })}>{CLEAR_FILTERS}</Button>}
                />
              ) : (
                <EmptyNote title={EMPTY_BOARD} headingLevel={2} />
              )}
            </>
          )}
        </TabPanel>

        <TabPanel value="mine" className={styles.panel}>
          {!me ? (
            <EmptyNote title={GUEST_MINE} headingLevel={2} action={<Button onClick={() => void wallet.connect()}>{CONNECT_WALLET}</Button>} />
          ) : (
            (status ?? (
              <>
                {closedCount > 0 ? (
                  <div className={styles.mineBar}>
                    <Switch checked={showClosed} onCheckedChange={setShowClosed} labelFirst>
                      {SHOW_CLOSED}
                    </Switch>
                  </div>
                ) : null}
                {stale}
                {mineRows.length > 0 ? view(mineRows, 'mine') : <EmptyNote title={closedCount > 0 ? EMPTY_MINE_OPEN : EMPTY_MINE} headingLevel={2} />}
              </>
            ))
          )}
        </TabPanel>
      </Tabs>

      <AssetChooser
        open={choosing}
        onOpenChange={(next) => {
          if (!next) closeTicket()
        }}
        assets={listed}
        failed={assetsQuery.isError && listed === undefined}
        onRetry={() => void assetsQuery.refetch()}
        onChoose={choose}
      />
      <CancelRequest row={cancelling} tx={cancel} isMock={isMock} onClose={closeCancel} fallbackFocus={headingRef} />
      <TicketHost intent={intent} onClose={closeTicket} placement="overlay" startAt={bidId !== null && me ? 'review' : undefined} />
    </div>
  )
}
