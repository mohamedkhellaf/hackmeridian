import { useState } from 'react'
import type { ReactNode } from 'react'
import { MarketTable } from '../market/MarketSeries'
import { filterOffers } from '../market/series'
import type { KindFilter } from '../market/series'
import '../market/market.css'
import { formatDisplay } from '../options/format'
import type { CollateralHealth, CollateralLine, OptionOffer, TokenInfo } from '../options/types'
import { ShortfallNotice } from '../reserves/ShortfallWarning'
import { Card, PageHeader, Segmented } from '../ui'

export interface MarketsViewProps {
  /** Open (state 'offered') offers. */
  offers: OptionOffer[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
  collateral: CollateralLine[]
  health: CollateralHealth[]
  /** In-memory mock client. The shell footer carries the mock notice, so this view does not repeat it. */
  mock: boolean
  /** Resale section (contract v1.4), rendered below the offers. */
  resale?: ReactNode
}

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'put', label: 'Put' },
  { value: 'call', label: 'Call' },
  { value: 'all', label: 'All' },
]

export function MarketsView({ offers, me, busy, busyId, onBuy, health, resale }: MarketsViewProps) {
  const [asset, setAsset] = useState('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const codes = [...new Set(offers.map((o) => o.underlying.code))].sort()
  // A selected asset whose offers all sold out falls back to "all" instead of showing an empty list.
  const activeAsset = asset !== 'all' && !codes.includes(asset) ? 'all' : asset
  const shown = filterOffers(offers, activeAsset, kind)
  const shortTokens: TokenInfo[] = health.filter((h) => h.held < h.reserved).map((h) => h.token)
  const n = offers.length

  return (
    <div className="mk-page">
      <PageHeader
        title="Markets"
        actions={
          <>
            <span role="group" aria-label="Open offers" className="mk-count">
              {n} open {n === 1 ? 'offer' : 'offers'}
            </span>
            <select className="mk-select" aria-label="Asset" value={activeAsset} onChange={(e) => setAsset(e.target.value)}>
              <option value="all">All assets</option>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Segmented label="Kind" options={KINDS} value={kind} onChange={setKind} />
          </>
        }
      />
      <ShortfallNotice tokens={shortTokens} className="mk-short-note" />
      <div className="mk-layout">
        <div className="mk-main">
          <MarketTable
            offers={shown}
            health={health}
            me={me}
            busy={busy}
            busyId={busyId}
            onBuy={onBuy}
            empty={n === 0 ? 'No open offers.' : 'No open offers match.'}
          />
        </div>
        <Card title="Collateral" actions={<a href="#/reserves">Details</a>} flush className="mk-collateral">
          {health.length === 0 ? (
            <p className="mk-empty mk-pad">Not available.</p>
          ) : (
            <table className="ui-table" aria-label="Collateral">
              <thead>
                <tr>
                  <th>Token</th>
                  <th className="num">Owed</th>
                  <th className="num">Held</th>
                </tr>
              </thead>
              <tbody>
                {health.map((h) => (
                  <tr key={h.token.contractId}>
                    <td>{h.token.code}</td>
                    <td className="num">{formatDisplay(h.reserved, h.token.decimals)}</td>
                    <td className="num">{formatDisplay(h.held, h.token.decimals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {resale}
    </div>
  )
}
