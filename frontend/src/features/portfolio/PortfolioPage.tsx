// /portfolio: what needs the wallet (the to-do strip), the exact totals, then everything it holds, wrote or has
// on order, in three tabs. The tab and the "Show closed" switch live in the URL.
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PortfolioSearch } from '../../app/search'
import { clawbackShortfallDisclosure } from '../../core/disclosures'
import { plural } from '../../core/format'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import { canList } from '../../core/resale/resale'
import { useAsks, useAssets, useBalancesById, useMe, useNowSec, useOptions, usePortfolioKpis, usePositions, useTodo } from '../../data'
import type { PositionView, PositionsView } from '../../data'
import { Button, Callout, EmptyNote, PageHeader, Skeleton, Switch, Tab, TabList, TabPanel, Tabs } from '../../ui'
import { useWallet } from '../../wallet'
import { ActionFlow } from './actions/ActionFlow'
import { useActionFlow, useFinalFocus } from './actions/useActionFlow'
import { CancelRequestDialog } from './actions/CancelRequestDialog'
import { CONNECT, EMPTY, GUEST_TITLE, LOAD_ERROR_TITLE, NOTHING_TITLE, ORDERS, PAGE_TITLE, REFRESH_FAILED, SELL_ONE, SHOW_CLOSED, SOLD_SINCE, TABS, VIEW_POSITION, expiredLine, readError } from './copy'
import { shortOf, useReserveHealth, useSoldSinceLastVisit } from './hooks'
import { HoldingTabLink, MarketsButtonLink, PositionLink, RequestsLink, ReservesLink } from './links'
import { markListLeft } from './listReturn'
import { HoldingTable, ListingsTable, OffersTable, RequestsTable, WrittenTable } from './PositionTables'
import type { RowActionHandler } from './PositionTables'
import { rankInSeries } from './model'
import { portfolioRoute } from './route'
import { Summary } from './Summary'
import { TodoStrip } from './TodoStrip'
import { portfolioTotals, requestExpired } from './totals'
import css from './PortfolioPage.module.css'

type TabId = NonNullable<PortfolioSearch['tab']>
const TAB_IDS: readonly TabId[] = ['holding', 'written', 'orders']

/** The tab a wallet lands on when the link names none: the first one with something in it. */
function defaultTab(v: PositionsView | null): TabId {
  if (!v) return 'holding'
  if (v.counts.holding > 0) return 'holding'
  if (v.counts.written > 0) return 'written'
  if (v.counts.orders > 0) return 'orders'
  return 'holding'
}

function Frame({ children }: { children?: ReactNode }) {
  return (
    <div className={css.page}>
      <PageHeader title={PAGE_TITLE} />
      {children}
    </div>
  )
}

function OrdersSection({ heading, empty, count, children }: { heading: string; empty: ReactNode; count: number; children: ReactNode }) {
  return (
    <section className={css.orders}>
      <h3 className={css.ordersHeading}>{heading}</h3>
      {count > 0 ? children : <p className={css.ordersEmpty}>{empty}</p>}
    </section>
  )
}

/** Every token that a row of this wallet pays out in and that the contract holds less of than it owes. */
function shortTokensOf(view: PositionsView, health: Parameters<typeof shortOf>[1]): TokenInfo[] {
  if (health.length === 0) return []
  const out = new Map<string, TokenInfo>()
  const rows: { underlying: TokenInfo; quote: TokenInfo }[] = [...view.holding, ...view.written, ...view.orders.offers].filter((p) => !p.closed).map((p) => p.option)
  for (const o of [...rows, ...view.orders.requests]) for (const t of shortOf(o, health)) out.set(t.contractId, t)
  return [...out.values()]
}

export function PortfolioPage() {
  const search = portfolioRoute.useSearch()
  const navigate = useNavigate({ from: '/portfolio' })
  const me = useMe()
  const wallet = useWallet()
  const showClosed = search.closed === '1'
  const positions = usePositions(undefined, { showClosed })
  const todo = useTodo()
  const kpis = usePortfolioKpis()
  const assets = useAssets()
  const asks = useAsks()
  const allOptions = useOptions({ enabled: !!me })
  const balances = useBalancesById(me)
  const soldSince = useSoldSinceLastVisit(me, allOptions.data ?? null)
  const health = useReserveHealth()
  const nowSec = useNowSec(10)
  const flow = useActionFlow()
  const [request, setRequest] = useState<{ bid: Bid; seq: number } | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const requestFocus = useFinalFocus()
  const view = positions.data
  const totals = useMemo(() => (view ? portfolioTotals(view, nowSec) : null), [view, nowSec])
  const short = useMemo(() => (view ? shortTokensOf(view, health) : []), [view, health])

  // A position opened from this list goes back to it in history, which keeps the tab, the switch and the scroll.
  useEffect(() => markListLeft, [])

  if (!me) {
    return (
      <Frame>
        <EmptyNote slip className={css.empty} headingLevel={2} title={GUEST_TITLE} action={<Button onClick={() => void wallet.connect()}>{CONNECT}</Button>} />
      </Frame>
    )
  }

  if (positions.isError || (positions.data === null && !positions.isLoading)) {
    return (
      <Frame>
        <Callout
          variant="danger"
          title={LOAD_ERROR_TITLE}
          actions={
            <Button size="sm" onClick={positions.retry}>
              Try again
            </Button>
          }
        >
          {readError(positions.error)}
        </Callout>
      </Frame>
    )
  }

  if (!view) {
    return (
      <Frame>
        <div className={css.loading} aria-busy="true" aria-label="Loading your positions">
          <div className={css.loadingStats}>
            <Skeleton lines={2} width="9rem" />
            <Skeleton lines={2} width="9rem" />
            <Skeleton lines={2} width="9rem" />
          </div>
          <Skeleton variant="rows" lines={4} />
        </div>
      </Frame>
    )
  }

  const { holding, written, orders, counts } = view
  const nothingAtAll = counts.holding + counts.written + counts.orders === 0 && counts.closed === 0
  if (nothingAtAll) {
    return (
      <Frame>
        <EmptyNote slip className={css.empty} headingLevel={2} title={NOTHING_TITLE} action={<MarketsButtonLink>Go to Markets</MarketsButtonLink>} />
      </Frame>
    )
  }

  const tab: TabId = search.tab ?? defaultTab(view)
  const setTab = (next: string) => {
    if (!TAB_IDS.includes(next as TabId)) return
    void navigate({ search: (prev: PortfolioSearch) => ({ ...prev, tab: next as TabId }), replace: true })
  }
  const setClosed = (on: boolean) => void navigate({ search: (prev: PortfolioSearch) => ({ ...prev, closed: on ? ('1' as const) : undefined }), replace: true })

  const onRow: RowActionHandler = (p, action) => flow.start(p.option, action, p.listing)
  const cancelRequest = (bid: Bid) => {
    requestFocus.remember()
    setRequest((prev) => ({ bid, seq: (prev?.seq ?? 0) + 1 }))
    setRequestOpen(true)
  }
  const resale = Array.isArray(asks.data)
  const canSell = (p: PositionView) => resale && canList(p.option, me, nowSec)
  const sellable = holding.some(canSell)
  const rankOf = (p: PositionView) => (allOptions.data ? rankInSeries(p.option, allOptions.data) : null)
  const soldNote = (p: PositionView) => (soldSince.has(p.option.id) ? SOLD_SINCE : null)
  // What sold since the last visit comes first in Written.
  const writtenRows = soldSince.size > 0 ? [...written.filter((p) => soldSince.has(p.option.id)), ...written.filter((p) => !soldSince.has(p.option.id))] : written
  const soldCount = written.filter((p) => soldSince.has(p.option.id)).length

  const hidden = !showClosed && counts.closed > 0
  const listingRows = orders.listings.map((l) => l.position)
  const expiredRequests = orders.requests.filter((b) => requestExpired(b, nowSec))
  const lapsed = (todo.data ?? []).filter((t) => t.kind === 'expired-unexercised')
  const markets = <MarketsButtonLink>Go to Markets</MarketsButtonLink>

  return (
    <Frame>
      {positions.refreshFailed ? (
        <Callout
          variant="warning"
          actions={
            <Button size="sm" onClick={positions.retry}>
              Try again
            </Button>
          }
        >
          {REFRESH_FAILED}
        </Callout>
      ) : null}

      {short.length > 0 ? (
        <Callout variant="warning" actions={<ReservesLink>Reserves</ReservesLink>}>
          {clawbackShortfallDisclosure(short.map((t) => t.code))}
        </Callout>
      ) : null}

      {todo.data ? <TodoStrip items={todo.data} expiredRequests={expiredRequests} short={short} balances={balances.data} onAction={(option, action) => flow.start(option, action)} onCancelRequest={cancelRequest} /> : null}

      {kpis.data && totals ? <Summary summary={kpis.data} totals={totals} quote={assets.data?.quote ?? null} /> : null}

      <section className={css.lists}>
        <h2 className="ui-vh">Positions and orders</h2>
        {lapsed.map((t) => (
          <p key={t.key} className={css.lapsed} data-testid={`lapsed-${t.option.id}`}>
            {expiredLine(t.option)}{' '}
            <PositionLink id={t.option.id} className={css.lapsedLink} aria-label={`${VIEW_POSITION}: ${expiredLine(t.option)}`}>
              {VIEW_POSITION}
            </PositionLink>
          </p>
        ))}
        <Tabs value={tab} onValueChange={setTab}>
          <div className={css.bar}>
            <TabList label="Positions and orders">
              <Tab value="holding" count={counts.holding} countLabel={plural(counts.holding, { one: '1 option', other: `${counts.holding} options` })}>
                {TABS.holding}
              </Tab>
              <Tab
                value="written"
                count={counts.written}
                countLabel={`${plural(counts.written, { one: '1 option', other: `${counts.written} options` })}${soldCount > 0 ? `, ${soldCount} ${SOLD_SINCE.toLowerCase()}` : ''}`}
              >
                {TABS.written}
              </Tab>
              <Tab value="orders" count={counts.orders} countLabel={plural(counts.orders, { one: '1 order', other: `${counts.orders} orders` })}>
                {TABS.orders}
              </Tab>
            </TabList>
            <Switch checked={showClosed} onCheckedChange={setClosed} labelFirst>
              {SHOW_CLOSED}
            </Switch>
          </div>

          <TabPanel value="holding" className={css.panel}>
            {holding.length > 0 ? (
              <HoldingTable rows={holding} onAction={onRow} short={short} canSell={canSell} />
            ) : (
              <EmptyNote className={css.empty} title={EMPTY.holding.title} hint={hidden ? EMPTY.holding.closedHint : undefined} action={markets} />
            )}
          </TabPanel>

          <TabPanel value="written" className={css.panel}>
            {written.length > 0 ? (
              <WrittenTable rows={writtenRows} onAction={onRow} short={short} noteOf={soldNote} />
            ) : (
              <EmptyNote className={css.empty} title={EMPTY.written.title} hint={hidden ? EMPTY.written.closedHint : undefined} action={markets} />
            )}
          </TabPanel>

          <TabPanel value="orders" className={css.panel}>
            <OrdersSection heading={ORDERS.offers} empty={EMPTY.offers} count={orders.offers.length}>
              <OffersTable rows={orders.offers} onAction={onRow} short={short} noteOf={rankOf} />
            </OrdersSection>
            <OrdersSection
              heading={ORDERS.requests}
              empty={
                <>
                  {EMPTY.requests} <RequestsLink>Open the requests board</RequestsLink>
                </>
              }
              count={orders.requests.length}
            >
              <RequestsTable rows={orders.requests} nowSec={nowSec} onCancel={cancelRequest} short={short} />
            </OrdersSection>
            <OrdersSection
              heading={ORDERS.listings}
              empty={
                <>
                  {EMPTY.listings}{' '}
                  {sellable ? <HoldingTabLink>{SELL_ONE}</HoldingTabLink> : null}
                </>
              }
              count={listingRows.length}
            >
              <ListingsTable rows={listingRows} onAction={onRow} />
            </OrdersSection>
          </TabPanel>
        </Tabs>
      </section>

      <ActionFlow
        flow={flow.flow}
        open={flow.open}
        onClose={flow.close}
        finalFocus={flow.finalFocus}
        receiptAction={(option) => (
          <PositionLink id={option.id} onClick={flow.close}>
            {VIEW_POSITION}
          </PositionLink>
        )}
      />
      {request ? <CancelRequestDialog key={request.seq} open={requestOpen} onClose={() => setRequestOpen(false)} bid={request.bid} finalFocus={requestFocus.ref} /> : null}
    </Frame>
  )
}
