import { Fragment } from 'react'
import { MarketSeries } from '../market/MarketSeries'
import { formatAmount } from '../options/format'
import type { CollateralHealth, CollateralLine, OptionOffer } from '../options/types'
import { Amount, PageHeader, Stat, StatGrid, Tag } from '../ui'

export interface MarketsViewProps {
  /** Open (state 'offered') offers. */
  offers: OptionOffer[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
  collateral: CollateralLine[]
  health: CollateralHealth[]
  /** In-memory mock client: the backing stat is labelled as mock. */
  mock: boolean
}

export function MarketsView({ offers, me, busy, busyId, onBuy, collateral, health, mock }: MarketsViewProps) {
  const locked = collateral
    .map((l) => ({ token: l.token, total: l.offered + l.active + l.pendingReclaim + l.unclaimed }))
    .filter((l) => l.total > 0n)
  const backed = health.length > 0 && health.every((h) => h.held >= h.reserved)
  const shortfall = health.some((h) => h.held < h.reserved)
  return (
    <>
      <PageHeader
        title="Markets"
        subtitle="Physically settled options on tokenized assets. Every offer is fully collateralized on-chain before it can be bought."
      />
      <StatGrid>
        <Stat label="Open offers">{offers.length}</Stat>
        <Stat label="Collateral locked">
          {locked.length === 0 ? (
            <Amount value="0" />
          ) : (
            locked.map((l, i) => (
              <Fragment key={l.token.contractId}>
                {i > 0 && <span aria-hidden="true">·</span>}
                <Amount value={formatAmount(l.total, l.token.decimals)} unit={l.token.code} />
              </Fragment>
            ))
          )}
        </Stat>
        <Stat label="Backing" hint={mock ? 'Mock data, not read from a chain' : undefined}>
          {shortfall ? <Tag tone="warn">Shortfall</Tag> : backed ? <Tag tone="ok">{mock ? 'Fully backed (mock)' : 'Verified on-chain'}</Tag> : 'n/a'}
        </Stat>
      </StatGrid>
      <details className="how">
        <summary>How it works</summary>
        <ol>
          <li>The maker locks collateral in the contract and publishes an offer.</li>
          <li>A buyer pays the premium to the maker and holds the option.</li>
          <li>The holder exercises before expiry: atomic delivery-versus-payment, all or nothing.</li>
        </ol>
      </details>
      <MarketSeries offers={offers} me={me} busy={busy} busyId={busyId} onBuy={onBuy} />
    </>
  )
}
