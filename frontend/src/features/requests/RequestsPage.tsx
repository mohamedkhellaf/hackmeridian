import { Link as RouterLink } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { assetParam, findReferenceAsset, resolveAssetParam } from '../../core/assets'
import { explorerAccount, isMockId } from '../../core/explorer'
import { formatMoney } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { describeError } from '../../core/stellar/errors'
import { referenceMode, useAssets, useBalancesById, useBids, useCancelBid, useNowSec, useOptionsClient } from '../../data'
import { Button, Callout, EmptyNote, IconWarning, Link, PageHeader, shortenAddress, Skeleton, Tab, TabList, TabPanel, Tabs, useIsPhone, VisuallyHidden } from '../../ui'
import type { SelectOption } from '../../ui'
import { useWallet } from '../../wallet'
import { TicketHost } from '../ticket'
import type { TicketIntent } from '../ticket'
import { AssetChooser } from './AssetChooser'
import { DEFAULT_SORT, boardTotals, filterRequests, holdsEscrow, myRequests, openRequests, parseBidId, sortRequests, toRows } from './board'
import type { KindFilter, RequestRow, RequestSort } from './board'
import { BoardTable } from './BoardTable'
import { CancelRequest } from './CancelRequest'
import {
  CLEAR_FILTERS,
  CONNECT_WALLET,
  EMPTY_BOARD,
  EMPTY_FILTERED,
  EMPTY_MINE,
  FILTER_ASSET_ALL,
  GUEST_MINE,
  LOADING,
  LOAD_ERROR_FIX,
  LOAD_ERROR_TITLE,
  NO_REQUESTS_IN_CONTRACT,
  PAGE_LEAD,
  PAGE_TITLE,
  POST_REQUEST,
  REFRESH_FAILED,
  RETRY,
  SEE_RESERVES,
  TABS_LABEL,
  TAB_BOARD,
  TAB_MINE,
  UNKNOWN_ASSET_FILTER,
  boardSummary,
  holdingCount,
  openCount,
} from './copy'
import { HowItWorks } from './HowItWorks'
import { RequestList } from './RequestList'
import { RESERVES_ROUTE, usePatchRequestsSearch, useRequestsSearch } from './routing'
import { ALL, Toolbar } from './Toolbar'
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
 * /requests: the board of funded bids across assets, the wallet's own requests, and the two tickets that act on
 * them (sell to a bid, post a request). Filters, order, tab and the open ticket all live in the URL.
 */
export function RequestsPage() {
  const search = useRequestsSearch()
  const patch = usePatchRequestsSearch()
  const { me, isMock } = useOptionsClient()
  const wallet = useWallet()
  const phone = useIsPhone()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const bidsQuery = useBids()
  const assetsQuery = useAssets()
  const balances = useBalancesById(me).data
  const nowSec = useNowSec(30)

  const allBids = bidsQuery.data ?? NO_BIDS
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

  // ---- rows
  const open = useMemo(() => openRequests(allBids, nowSec), [allBids, nowSec])
  const boardRows = useMemo(() => toRows(sortRequests(filterRequests(open, { assetId: filterAssetId, kind }), sort), me), [open, filterAssetId, kind, sort, me])
  const mineRows = useMemo(() => toRows(myRequests(allBids, me), me), [allBids, me])
  const holding = useMemo(() => mineRows.filter((r) => holdsEscrow(r.bid)).length, [mineRows])
  const totals = useMemo(() => boardTotals(boardRows.map((r) => r.bid)), [boardRows])
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

  // ---- the ticket: `bid` opens the fill ticket, `new` the bid ticket (after an asset is known)
  const bidId = parseBidId(search.bid)
  const posting = search.new === '1' && bidId === null
  const [chosenAssetId, setChosenAssetId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TicketIntent | null>(null)
  const [wasPosting, setWasPosting] = useState(posting)
  if (wasPosting !== posting) {
    // Leaving the bid ticket by any road (close, Back, a link) forgets the asset choice and the typed terms.
    setWasPosting(posting)
    if (!posting) {
      setChosenAssetId(null)
      setDraft(null)
    }
  }
  const postAssetId = filterAssetId ?? chosenAssetId ?? (underlyings.length === 1 ? underlyings[0].contractId : null)
  const intent = useMemo<TicketIntent | null>(() => {
    if (bidId !== null) return { mode: 'fill', bidId }
    if (!posting) return null
    if (draft) return draft
    return postAssetId ? { mode: 'bid', assetId: postAssetId, kind: kind ?? 'put' } : null
  }, [bidId, posting, draft, postAssetId, kind])
  const choosing = posting && intent === null && listed !== undefined

  const post = useCallback(() => patch({ new: '1', bid: undefined }), [patch])
  const sell = useCallback((row: RequestRow) => patch({ bid: row.bid.id.toString(), new: undefined }), [patch])
  const closeTicket = useCallback(() => patch({ bid: undefined, new: undefined }, { replace: true }), [patch])
  const changeIntent = useCallback(
    (next: TicketIntent) => {
      if (next.mode === 'fill') patch({ bid: next.bidId.toString(), new: undefined }, { replace: true })
      else setDraft(next)
    },
    [patch],
  )

  // ---- cancelling one of the wallet's own requests
  const cancel = useCancelBid()
  const [cancelling, setCancelling] = useState<RequestRow | null>(null)
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

  const view = (rows: readonly RequestRow[], variant: RequestsViewProps['variant']) => {
    const props: RequestsViewProps = { rows, variant, selectedId: bidId, balances, explorerOf, onSell: sell, onCancel: openCancel }
    return phone ? <RequestList {...props} /> : <BoardTable {...props} />
  }

  const loading = bidsQuery.isPending
  const failed = bidsQuery.isError && bidsQuery.data === undefined
  const unsupported = bidsQuery.data === null
  const refreshFailed = bidsQuery.isError && bidsQuery.data !== undefined

  const status = loading ? (
    <div aria-busy="true" className={styles.loading}>
      <VisuallyHidden>{LOADING}</VisuallyHidden>
      <Skeleton variant="block" width="12rem" height="3.625rem" />
      <Skeleton variant="rows" lines={4} />
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
      {describeError(bidsQuery.error)} {LOAD_ERROR_FIX}
    </Callout>
  ) : unsupported ? (
    <EmptyNote title={NO_REQUESTS_IN_CONTRACT.title} hint={NO_REQUESTS_IN_CONTRACT.hint} headingLevel={2} />
  ) : null

  const stale = refreshFailed ? (
    <p className={styles.stale}>
      <IconWarning size={14} />
      <span>{REFRESH_FAILED}</span>
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

      <Tabs value={search.mine === '1' ? 'mine' : 'board'} onValueChange={(value) => patch({ mine: value === 'mine' ? '1' : undefined })}>
        <TabList label={TABS_LABEL}>
          <Tab value="board" count={loading || failed || unsupported ? undefined : open.length} countLabel={openCount(open.length)}>
            {TAB_BOARD}
          </Tab>
          <Tab value="mine" count={me && !loading && !failed && !unsupported ? holding : undefined} countLabel={holdingCount(holding)}>
            {TAB_MINE}
          </Tab>
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
                  onSortChange={(next) => patch({ sort: next === DEFAULT_SORT ? undefined : next }, { replace: true })}
                />
              ) : null}
              {unknownAsset ? <p className={styles.notice}>{UNKNOWN_ASSET_FILTER}</p> : null}
              {boardRows.length > 0 ? (
                <>
                  {view(boardRows, 'board')}
                  <p className={styles.summary} data-testid="board-summary">
                    <span>{boardSummary(boardRows.length, open.length, totals.escrowed !== null && totals.quote ? formatMoney(totals.escrowed, totals.quote) : null)}</span>{' '}
                    <Link render={<RouterLink to={RESERVES_ROUTE} />}>{SEE_RESERVES}</Link>
                  </p>
                </>
              ) : open.length > 0 ? (
                <EmptyNote
                  title={EMPTY_FILTERED.title}
                  hint={EMPTY_FILTERED.hint}
                  headingLevel={2}
                  action={<Button onClick={() => patch({ asset: undefined, kind: undefined }, { replace: true })}>{CLEAR_FILTERS}</Button>}
                />
              ) : (
                <EmptyNote title={EMPTY_BOARD.title} hint={EMPTY_BOARD.hint} headingLevel={2} action={<Button onClick={post}>{POST_REQUEST}</Button>} />
              )}
              {stale}
            </>
          )}
        </TabPanel>

        <TabPanel value="mine" className={styles.panel}>
          {!me ? (
            <EmptyNote title={GUEST_MINE.title} hint={GUEST_MINE.hint} headingLevel={2} action={<Button onClick={() => void wallet.connect()}>{CONNECT_WALLET}</Button>} />
          ) : (
            (status ??
            (mineRows.length > 0 ? (
              <>
                {view(mineRows, 'mine')}
                {stale}
              </>
            ) : (
              <EmptyNote title={EMPTY_MINE.title} hint={EMPTY_MINE.hint} headingLevel={2} action={<Button onClick={post}>{POST_REQUEST}</Button>} />
            )))
          )}
        </TabPanel>
      </Tabs>

      <HowItWorks />

      {listed ? (
        <AssetChooser
          open={choosing}
          onOpenChange={(next) => {
            if (!next) closeTicket()
          }}
          assets={listed}
          openCounts={openCounts}
          onChoose={(asset) => setChosenAssetId(asset.contractId)}
          sheet={phone}
        />
      ) : null}
      <CancelRequest row={cancelling} tx={cancel} isMock={isMock} onClose={closeCancel} sheet={phone} fallbackFocus={headingRef} />
      <TicketHost intent={intent} onClose={closeTicket} onIntentChange={changeIntent} placement="overlay" />
    </div>
  )
}
