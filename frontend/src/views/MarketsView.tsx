import { Fragment, useState } from 'react'
import { MarketSeries } from '../market/MarketSeries'
import { filterOffers } from '../market/series'
import type { KindFilter } from '../market/series'
import '../market/market.css'
import { formatDisplay } from '../options/format'
import type { CollateralHealth, CollateralLine, OptionOffer } from '../options/types'
import { Amount, Chip, PageHero, StatusDot, StrataBar } from '../ui'

export interface MarketsViewProps {
  /** Open (state 'offered') offers. */
  offers: OptionOffer[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
  collateral: CollateralLine[]
  health: CollateralHealth[]
  /** In-memory mock client: the backing caption is labelled as mock. */
  mock: boolean
}

function Amounts({ items }: { items: { value: string; unit: string }[] }) {
  if (items.length === 0) return <Amount value="0" />
  return (
    <>
      {items.map((l, i) => (
        <Fragment key={l.unit}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <Amount value={l.value} unit={l.unit} />
        </Fragment>
      ))}
    </>
  )
}

export function MarketsView({ offers, me, busy, busyId, onBuy, collateral, health, mock }: MarketsViewProps) {
  const locked = collateral
    .map((l) => {
      const total = l.offered + l.active + l.pendingReclaim + l.unclaimed
      return { value: formatDisplay(total, l.token.decimals), unit: l.token.code, total }
    })
    .filter((l) => l.total > 0n)
  const underlyingIds = new Set(offers.map((o) => o.underlying.contractId))
  const quoteIds = new Set(offers.map((o) => o.quote.contractId))
  const isCallToken = (id: string) => underlyingIds.has(id) && !quoteIds.has(id)
  const underlyingHeld = health
    .filter((h) => isCallToken(h.token.contractId))
    .map((h) => ({ value: formatDisplay(h.held, h.token.decimals), unit: h.token.code }))
  const backed = health.length > 0 && health.every((h) => h.held >= h.reserved)
  const shortfall = health.some((h) => h.held < h.reserved)
  const [asset, setAsset] = useState('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const codes = [...new Set(offers.map((o) => o.underlying.code))].sort()
  // A selected asset whose offers all sold out falls back to "all" instead of showing an empty list.
  const activeAsset = asset !== 'all' && !codes.includes(asset) ? 'all' : asset
  const shown = filterOffers(offers, activeAsset, kind)

  const caption = shortfall ? (
    <span className="mk-cap">
      <StatusDot tone="warn" />
      Shortfall: held is below owed on at least one token
    </span>
  ) : backed ? (
    <span className="mk-cap">
      <StatusDot tone={mock ? 'neutral' : 'ok'} />
      {mock ? 'Owed equals held in the mock contract. Mock data, not read from a chain.' : 'Owed equals held on every token'}
    </span>
  ) : (
    <span className="mk-cap">
      <StatusDot tone="neutral" />
      Backing not available
    </span>
  )

  return (
    <div className="mk-page">
      <PageHero
        eyebrow="Physically settled · fully collateralized"
        title="Markets"
        lede="Puts and calls on tokenized assets. Every offer below is backed by collateral the contract already holds, so what you see is what can settle."
        stats={[
          { label: 'Open offers', value: offers.length },
          { label: 'Collateral locked', value: <Amounts items={locked} /> },
          { label: 'Underlying held', value: <Amounts items={underlyingHeld} /> },
        ]}
        sediment={{ seed: 'strata-markets', captionLabel: 'Backing', caption }}
      />
      <div className="mk-layout">
        <div className="mk-main">
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
        <aside className="mk-rail" aria-label="Reserves and settlement">
          <div className="mk-rail-block">
            <div className="mk-rail-head">
              <span className="ui-label">Reserves, right now</span>
              <a href="#/reserves">Full proof →</a>
            </div>
            {health.length === 0 ? (
              <p className="mk-muted-sm">Reserve data is not available right now.</p>
            ) : (
              health.map((h) => {
                const line = collateral.find((c) => c.token.contractId === h.token.contractId)
                const d = h.token.decimals
                return (
                  <StrataBar
                    key={h.token.contractId}
                    code={h.token.code}
                    unit={h.token.code}
                    kind={isCallToken(h.token.contractId) ? 'call' : 'put'}
                    owed={h.reserved}
                    held={h.held}
                    layers={{ offered: line?.offered, active: line?.active, awaiting: line?.unclaimed, reclaim: line?.pendingReclaim }}
                    format={(n) => formatDisplay(BigInt(n), d)}
                    legend={false}
                  />
                )
              })
            )}
            <ul className="mk-rail-legend">
              <li>
                <i style={{ background: 'var(--layer-offered)' }} />
                Offered
              </li>
              <li>
                <i style={{ background: 'var(--layer-active)' }} />
                Active
              </li>
              <li>
                <i style={{ background: 'var(--layer-awaiting)' }} />
                Awaiting claim
              </li>
              <li>
                <i style={{ background: 'var(--layer-reclaim)' }} />
                Pending reclaim
              </li>
            </ul>
          </div>
          <div className="mk-rail-block">
            <span className="ui-label">How settlement works</span>
            <ol className="mk-steps">
              <li>
                <span className="ui-mono">01</span>
                <span>
                  <b>Maker locks collateral.</b> Puts lock the full strike in the quote asset; calls lock the underlying.
                </span>
              </li>
              <li>
                <span className="ui-mono">02</span>
                <span>
                  <b>You pay the premium.</b> It goes to the maker at purchase.
                </span>
              </li>
              <li>
                <span className="ui-mono">03</span>
                <span>
                  <b>Exercise before expiry.</b> Delivery and payment settle in one atomic transaction.
                </span>
              </li>
            </ol>
          </div>
          <p className="mk-risk">
            Underlying assets are permissioned. Their issuer can freeze accounts or claw back tokens, which can block settlement. Collateral does not protect
            against issuer action.
          </p>
        </aside>
      </div>
    </div>
  )
}
