// /portfolio: what needs the wallet (the to-do strip), four exact summary figures, then everything it holds,
// wrote or has on order, in three tabs. The tab and the "Show closed" switch live in the URL.
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PortfolioSearch } from '../../app/search'
import { plural } from '../../core/format'
import type { Bid } from '../../core/requests/types'
import { useAssets, useMe, useNowSec, usePortfolioKpis, usePositions, useTodo } from '../../data'
import type { PositionsView } from '../../data'
import { Button, Callout, EmptyNote, KeyValue, KeyValueItem, PageHeader, Skeleton, Switch, Tab, TabList, TabPanel, Tabs } from '../../ui'
import { useWallet } from '../../wallet'
import { ActionFlow } from './actions/ActionFlow'
import { useActionFlow, useFinalFocus } from './actions/useActionFlow'
import { CancelRequestDialog } from './actions/CancelRequestDialog'
import { CONNECT, EMPTY, GUEST_HINT, GUEST_SECTIONS, GUEST_TITLE, LOAD_ERROR_AFTER, LOAD_ERROR_TITLE, ORDERS, PAGE_DESCRIPTION, PAGE_TITLE, REFRESH_FAILED, SHOW_CLOSED, TABS, VIEW_POSITION, readError } from './copy'
import { MarketsButtonLink, PositionLink, RequestsLink } from './links'
import { HoldingTable, ListingsTable, OffersTable, RequestsTable, WrittenTable } from './PositionTables'
import type { RowActionHandler } from './PositionTables'
import { portfolioRoute } from './route'
import { Summary } from './Summary'
import { TodoStrip } from './TodoStrip'
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

const hiddenLine = (count: number): string =>
  plural(count, {
    one: `${count} closed position or order is hidden. Turn on Show closed to see it.`,
    other: `${count} closed positions or orders are hidden. Turn on Show closed to see them.`,
  })

function Frame({ children }: { children?: ReactNode }) {
  return (
    <div className={css.page}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      {children}
    </div>
  )
}

function OrdersSection({ heading, lead, empty, count, children }: { heading: string; lead: string; empty: ReactNode; count: number; children: ReactNode }) {
  return (
    <section className={css.orders}>
      <div className={css.ordersHead}>
        <h3 className={css.ordersHeading}>{heading}</h3>
        <p className={css.ordersLead}>{lead}</p>
      </div>
      {count > 0 ? children : <p className={css.ordersEmpty}>{empty}</p>}
    </section>
  )
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
  const nowSec = useNowSec(10)
  const flow = useActionFlow()
  const [request, setRequest] = useState<{ bid: Bid; seq: number } | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const requestFocus = useFinalFocus()

  if (!me) {
    return (
      <Frame>
        <div className={css.guest}>
          <EmptyNote
            headingLevel={2}
            title={GUEST_TITLE}
            hint={GUEST_HINT}
            action={
              <Button onClick={() => void wallet.connect()}>
                {CONNECT}
              </Button>
            }
          />
          <KeyValue variant="ruled" figures="sans" layout="stacked" className={css.guestList}>
            {GUEST_SECTIONS.map((s) => (
              <KeyValueItem key={s.label} label={s.label}>
                {s.text}
              </KeyValueItem>
            ))}
          </KeyValue>
        </div>
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
          {readError(positions.error)} {LOAD_ERROR_AFTER}
        </Callout>
      </Frame>
    )
  }

  const view = positions.data
  if (!view) {
    return (
      <Frame>
        <div className={css.loading} aria-busy="true" aria-label="Loading your positions">
          <div className={css.loadingCards}>
            <Skeleton variant="block" height="12rem" />
            <Skeleton variant="block" height="12rem" />
            <Skeleton variant="block" height="12rem" />
          </div>
          <div className={css.loadingStats}>
            <Skeleton lines={2} width="9rem" />
            <Skeleton lines={2} width="9rem" />
            <Skeleton lines={2} width="9rem" />
            <Skeleton lines={2} width="6rem" />
          </div>
          <Skeleton variant="rows" lines={4} />
        </div>
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

  const { holding, written, orders, counts } = view
  const heldOpen = holding.filter((p) => !p.closed).length
  const writtenOpen = written.filter((p) => !p.closed).length + orders.offers.filter((p) => !p.closed).length
  const hidden = !showClosed && counts.closed > 0
  const listingRows = orders.listings.map((l) => l.position)
  const nothingAtAll = counts.holding + counts.written + counts.orders === 0 && counts.closed === 0
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

      {todo.data && todo.data.length > 0 ? <TodoStrip items={todo.data} onAction={(option, action) => flow.start(option, action)} /> : null}

      {kpis.data ? <Summary summary={kpis.data} quote={assets.data?.quote ?? null} held={heldOpen} written={writtenOpen} /> : null}

      <section className={css.lists}>
        <h2 className="ui-vh">Positions and orders</h2>
        <Tabs value={tab} onValueChange={setTab}>
          <div className={css.bar}>
            <TabList label="Positions and orders">
              <Tab value="holding" count={counts.holding} countLabel={plural(counts.holding, { one: '1 option', other: `${counts.holding} options` })}>
                {TABS.holding}
              </Tab>
              <Tab value="written" count={counts.written} countLabel={plural(counts.written, { one: '1 option', other: `${counts.written} options` })}>
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
              <HoldingTable rows={holding} onAction={onRow} />
            ) : (
              <EmptyNote
                className={css.empty}
                title={EMPTY.holding.title}
                hint={hidden ? EMPTY.holding.closedHint : nothingAtAll ? 'Buy a put to set a floor under what you hold, or a call to lock a buy price.' : undefined}
                action={markets}
              />
            )}
          </TabPanel>

          <TabPanel value="written" className={css.panel}>
            {written.length > 0 ? (
              <WrittenTable rows={written} onAction={onRow} />
            ) : (
              <EmptyNote
                className={css.empty}
                title={EMPTY.written.title}
                hint={hidden ? EMPTY.written.closedHint : 'Write an offer in Markets: you lock the collateral and a buyer pays you the premium.'}
                action={markets}
              />
            )}
          </TabPanel>

          <TabPanel value="orders" className={css.panel}>
            <OrdersSection heading={ORDERS.offers.heading} lead={ORDERS.offers.lead} empty={EMPTY.offers} count={orders.offers.length}>
              <OffersTable rows={orders.offers} onAction={onRow} />
            </OrdersSection>
            <OrdersSection
              heading={ORDERS.requests.heading}
              lead={ORDERS.requests.lead}
              empty={
                <>
                  {EMPTY.requests} <RequestsLink>Open the requests board</RequestsLink>
                </>
              }
              count={orders.requests.length}
            >
              <RequestsTable rows={orders.requests} nowSec={nowSec} onCancel={cancelRequest} />
            </OrdersSection>
            <OrdersSection heading={ORDERS.listings.heading} lead={ORDERS.listings.lead} empty={EMPTY.listings} count={listingRows.length}>
              <ListingsTable rows={listingRows} onAction={onRow} />
            </OrdersSection>
          </TabPanel>
        </Tabs>
        {hidden ? <p className={css.hidden}>{hiddenLine(counts.closed)}</p> : null}
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
