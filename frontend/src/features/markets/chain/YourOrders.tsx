// The wallet's own open orders on this asset, across every deadline: its offers, resale listings and requests in
// one table, so a maker can see and cancel them without opening each series (audit finding "No list of the
// wallet's own orders on the asset"). Shown only when there is one. Each series selects itself in the chain.
import { useMemo } from 'react'
import { bookRows } from '../../../core/market/book'
import type { BookRow } from '../../../core/market/book'
import { bookRowAction } from '../../../core/market/selection'
import { premiumUnits } from '../../../core/units'
import type { MarketView, PositionsView } from '../../../data'
import { useHealth, useMe, useNowSec, useOptionsClient, useTxBusy } from '../../../data'
import { COPY } from './copy'
import type { OrderLine } from './orders'
import { OrdersList } from './OrdersList'
import { OrdersTable } from './OrdersTable'
import styles from './YourOrders.module.css'

export interface YourOrdersProps {
  view: MarketView
  narrow: boolean
  /** The connected wallet's positions and orders, or null for a guest. */
  positions: PositionsView | null
  ticketKey: string | null
  onSelect: (row: BookRow) => void
  onCancel: (row: BookRow) => void
}

export function YourOrders({ view, narrow, positions, ticketKey, onSelect, onCancel }: YourOrdersProps) {
  const me = useMe()
  const nowSec = useNowSec(30)
  const health = useHealth()
  const busy = useTxBusy()
  const { isMock } = useOptionsClient()
  const assetId = view.asset.contractId

  const lines = useMemo<OrderLine[]>(() => {
    const data = positions
    if (!data || !me) return []
    const here = (contractId: string) => contractId === assetId
    const offers = data.orders.offers.map((p) => p.option).filter((o) => o.state === 'offered' && o.expiry > nowSec && here(o.underlying.contractId))
    const listings = data.orders.listings.filter((l) => here(l.position.option.underlying.contractId)).map((l) => ({ option: l.position.option, ask: l.ask }))
    const requests = data.orders.requests.filter((b) => here(b.underlying.contractId))
    return bookRows(offers, listings, requests, nowSec)
      .sort((a, b) => a.expiry - b.expiry || Number(a.source === 'bid') - Number(b.source === 'bid') || (a.key < b.key ? -1 : 1))
      .map((row) => ({ row, perUnit: premiumUnits(row), action: bookRowAction(row, me), reason: null }))
  }, [positions, me, nowSec, assetId])

  if (lines.length === 0) return null
  const title = COPY.yourOrders(view.asset.code)
  const Orders = narrow ? OrdersList : OrdersTable
  return (
    <section className={styles.root} aria-labelledby="your-orders-title" data-testid="your-orders">
      <h2 id="your-orders-title" className="ui-h2">
        {title}
      </h2>
      <Orders
        label={title}
        sections={[{ key: 'mine', lines }]}
        showSeries
        showReason={false}
        onSelect={onSelect}
        ticketKey={ticketKey}
        health={health.data}
        explorer={!isMock}
        busy={busy}
        onTake={() => {}}
        onCancel={onCancel}
      />
    </section>
  )
}
