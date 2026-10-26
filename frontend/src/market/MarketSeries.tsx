import { useState } from 'react'
import type { CollateralHealth, OptionOffer, TokenInfo } from '../options/types'
import { AssetFactsDialog } from '../assetfacts/AssetFactsPanel'
import { shortfallFor } from '../reserves/reserves'
import { formatDisplay, shortAddress, strikePerUnit } from '../options/format'
import { implausibleTerms } from '../options/feasibility'
import { Button, Mono, Tag } from '../ui'
import { formatCountdown, formatExpiryShort, sameSeries, sortOffers } from './series'
import './market.css'

// Display only: premium per one unit of underlying.
function premiumPerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  return formatDisplay((o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty, o.quote.decimals)
}

const CHECK_TITLE = 'Premium is at least the total strike. Check the terms before buying.'

/** One flat table of open offers. Offers on the same series sit together; rows after the first are muted in Asset/Kind. */
export function MarketTable({
  offers,
  health = [],
  me,
  busy,
  busyId,
  onBuy,
  empty,
}: {
  offers: OptionOffer[]
  /** Reserved vs held per token: rows on a clawed-back token are marked short (PRODUCT_SPEC D6). */
  health?: CollateralHealth[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
  /** Empty-state line. */
  empty: string
}) {
  const [factsFor, setFactsFor] = useState<TokenInfo | null>(null)
  if (offers.length === 0) return <p className="mk-empty">{empty}</p>

  const rows = sortOffers(offers)
  const quotes = new Set(rows.map((o) => o.quote.code))
  // One quote token on screen: its unit goes in the header once, not after every number.
  const unit = quotes.size === 1 ? ` (${rows[0].quote.code})` : ''
  const cellUnit = (o: OptionOffer) => (unit ? '' : ` ${o.quote.code}`)

  return (
    <div className="ui-table-wrap mk-table">
      {factsFor && <AssetFactsDialog token={factsFor} me={me} onClose={() => setFactsFor(null)} />}
      <table className="ui-table" aria-label="Offers">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Kind</th>
            <th className="num">Qty</th>
            <th className="num">Strike{unit}</th>
            <th>Expiry</th>
            <th className="num">Premium{unit}</th>
            <th className="num hide-sm" title="Total premium">
              Total{unit}
            </th>
            <th className="hide-sm">Maker</th>
            <th>
              <span className="mk-sr">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o, i) => {
            const own = o.writer === me
            const short = shortfallFor(o, health).length > 0
            // Same series as the row above: a competing maker. Muted so the group reads as one series.
            const cont = i > 0 && sameSeries(rows[i - 1], o)
            return (
              <tr key={o.id.toString()} className={cont ? 'mk-cont' : undefined}>
                <td>
                  <button type="button" className="mk-asset" title="Asset facts" onClick={() => setFactsFor(o.underlying)}>
                    {o.underlying.code}
                    <span className="mk-sr"> asset facts</span>
                  </button>
                  {short && (
                    <span className="mk-short" title={`Reserve shortfall on ${o.underlying.code}`}>
                      {' '}
                      Short
                    </span>
                  )}
                </td>
                <td className="mk-kind">{o.kind === 'put' ? 'Put' : 'Call'}</td>
                <td className="num">{formatDisplay(o.underlyingQty, o.underlying.decimals)}</td>
                <td className="num">
                  {strikePerUnit(o)}
                  {cellUnit(o)}
                </td>
                <td className="mk-expiry">
                  {formatExpiryShort(o.expiry)} <span className="mk-countdown">{formatCountdown(o.expiry)}</span>
                </td>
                <td className="num">
                  {implausibleTerms(o) && (
                    <Tag tone="warn" title={CHECK_TITLE} className="mk-check-terms">
                      Check terms
                    </Tag>
                  )}
                  {premiumPerUnit(o)}
                  {cellUnit(o)}
                </td>
                <td className="num hide-sm">
                  {formatDisplay(o.totalPremium, o.quote.decimals)}
                  {cellUnit(o)}
                </td>
                <td className="hide-sm">
                  <Mono>{shortAddress(o.writer)}</Mono>
                  {own && <span className="mk-you"> (you)</span>}
                </td>
                <td className="mk-action">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onBuy(o)}
                    disabled={!me || busy || own}
                    title={!me ? 'Connect a wallet to buy' : own ? 'This is your own offer' : busy ? 'Another transaction is in progress' : undefined}
                    aria-label={`Buy ${o.kind} on ${formatDisplay(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`}
                  >
                    {busyId === o.id ? 'Buying…' : 'Buy'}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
