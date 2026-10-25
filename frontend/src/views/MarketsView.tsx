import { Fragment, useState } from 'react'
import { MarketSeries } from '../market/MarketSeries'
import { filterOffers } from '../market/series'
import type { KindFilter } from '../market/series'
import '../market/market.css'
import { formatDisplay } from '../options/format'
import type { CollateralHealth, CollateralLine, OptionOffer } from '../options/types'
import { Amount, Card, Chip, PageHeader, Stat, StatGrid, Tag } from '../ui'

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
  const [asset, setAsset] = useState('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const codes = [...new Set(offers.map((o) => o.underlying.code))].sort()
  // A selected asset whose offers all sold out falls back to "all" instead of showing an empty list.
  const activeAsset = asset !== 'all' && !codes.includes(asset) ? 'all' : asset
  const shown = filterOffers(offers, activeAsset, kind)
  return (
    <div className="mk-layout">
      <div className="mk-main">
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
                <Amount value={formatDisplay(l.total, l.token.decimals)} unit={l.token.code} />
              </Fragment>
            ))
          )}
        </Stat>
        <Stat label="Backing" hint={mock ? 'Mock data, not read from a chain' : undefined}>
          {shortfall ? <Tag tone="warn">Shortfall</Tag> : backed ? <Tag tone="ok">{mock ? 'Fully backed (mock)' : 'Verified on-chain'}</Tag> : 'n/a'}
        </Stat>
      </StatGrid>
      <div className="mk-filters" role="group" aria-label="Filters">
        <Chip selected={activeAsset === 'all'} onClick={() => setAsset('all')}>
          All assets
        </Chip>
        {codes.map((c) => (
          <Chip key={c} selected={activeAsset === c} onClick={() => setAsset(c)}>
            {c}
          </Chip>
        ))}
        <span className="mk-filter-sep" aria-hidden="true" />
        <Chip selected={kind === 'all'} onClick={() => setKind('all')}>
          Puts &amp; calls
        </Chip>
        <Chip selected={kind === 'put'} onClick={() => setKind('put')}>
          Puts
        </Chip>
        <Chip selected={kind === 'call'} onClick={() => setKind('call')}>
          Calls
        </Chip>
        <span className="mk-sorted">Sorted by expiry</span>
      </div>
      <MarketSeries offers={shown} me={me} busy={busy} busyId={busyId} onBuy={onBuy} />
      </div>
      <aside className="mk-rail" aria-label="About settlement">
        <Card title="How settlement works">
          <ol className="mk-steps">
            <li>
              <span>
                <b>Maker locks collateral.</b> Puts lock the full strike in the quote asset, calls lock the underlying.
              </span>
            </li>
            <li>
              <span>
                <b>You pay the premium.</b> It goes to the maker at purchase.
              </span>
            </li>
            <li>
              <span>
                <b>Exercise any time before expiry.</b> Delivery and payment settle in one atomic transaction.
              </span>
            </li>
          </ol>
        </Card>
        <p className="mk-risk">
          Underlying assets are permissioned. Their issuer can freeze accounts or claw back tokens, which can block settlement. Collateral does not protect
          against issuer action.
        </p>
      </aside>
    </div>
  )
}
