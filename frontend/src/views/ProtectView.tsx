import { useMemo, useState } from 'react'
import { formatAmount, formatDisplay, parseAmount, shortAddress } from '../options/format'
import type { OptionOffer, SupportedAssets, TokenInfo } from '../options/types'
import { formatPU, matchProtection } from '../protect/match'
import type { ProtectMatch } from '../protect/match'
import '../protect/protect.css'
import { formatCountdown, formatExpiryShort } from '../market/series'
import type { TokenBalance } from '../stellar/tokens'
import { Button, Card, Mono, PageHeader } from '../ui'

export interface ProtectViewProps {
  assets: SupportedAssets | null
  /** Open (state 'offered') offers. */
  offers: OptionOffer[]
  me: string | null
  /** Wallet balances by token contract id (real mode only). */
  balances: Record<string, TokenBalance>
  mock: boolean
  busy: boolean
  /** Opens the existing BuyDialog for this offer. */
  onBuy: (o: OptionOffer) => void
}

// No quantity typed: no size filter. Larger than any token supply, so no offer is excluded as oversized.
const ANY_QTY = 2n ** 126n

/** Whole days, or null for any expiry. Blank or invalid input means any. */
function parseDays(s: string): number | null {
  const t = s.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n > 0 ? n : null
}

export function ProtectView({ assets, offers, me, balances, busy, onBuy }: ProtectViewProps) {
  const [assetId, setAssetId] = useState<string | null>(null)
  const [qtyInput, setQtyInput] = useState<string | null>(null) // null = default to the wallet balance
  const [floorInput, setFloorInput] = useState('')
  const [daysInput, setDaysInput] = useState('')

  const underlyings = assets?.underlyings ?? []
  const asset: TokenInfo | null = underlyings.find((t) => t.contractId === assetId) ?? underlyings[0] ?? null
  const quote = assets?.quote ?? null
  const balance = asset ? (balances[asset.contractId]?.balance ?? null) : null

  const defaultQty = asset && balance != null && balance > 0n ? formatAmount(balance, asset.decimals, asset.decimals) : ''
  const qtyText = qtyInput ?? defaultQty
  // Blank floor or quantity means no filter: every funded put on the asset is listed. A typed value filters.
  const qty = !qtyText.trim() ? ANY_QTY : asset ? parseAmount(qtyText, asset.decimals) : null
  const floor = !floorInput.trim() ? 0n : quote ? parseAmount(floorInput, quote.decimals) : null
  const days = parseDays(daysInput)
  const ready = !!asset && !!quote && qty != null && qty > 0n && floor != null && floor >= 0n

  // eslint-disable-next-line react-hooks/purity
  const nowSec = Math.floor(Date.now() / 1000)
  const result = useMemo(
    () => (ready ? matchProtection(offers, { underlyingId: asset.contractId, qty, floor, maxDays: days, me }, nowSec) : null),
    // nowSec changes every render; minute granularity is plenty for a list that re-reads on offers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers, ready, asset, qty, floor, days, me, Math.floor(nowSec / 60)],
  )

  const pick = (id: string) => {
    setAssetId(id)
    setQtyInput(null)
  }

  return (
    <div className="pr-page">
      <PageHeader title="Protect" />

      {!assets ? (
        <p className="pr-muted">Loading</p>
      ) : !asset || !quote ? (
        <p className="pr-muted">No listed assets.</p>
      ) : (
        <>
          <Card>
            <div className="pr-fields">
              <label className="pr-field">
                <span className="pr-label">Asset</span>
                <span className="pr-input">
                  <select value={asset.contractId} onChange={(e) => pick(e.target.value)} aria-label="Asset">
                    {underlyings.map((t) => (
                      <option key={t.contractId} value={t.contractId}>
                        {t.code}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="pr-field">
                <span className="pr-label">Floor price per {asset.code}</span>
                <span className="pr-input">
                  <input inputMode="decimal" value={floorInput} onChange={(e) => setFloorInput(e.target.value)} aria-label={`Floor price in ${quote.code}`} />
                  <span className="pr-unit">{quote.code}</span>
                </span>
              </label>
              <label className="pr-field">
                <span className="pr-label">Quantity</span>
                <span className="pr-input">
                  <input inputMode="decimal" value={qtyText} onChange={(e) => setQtyInput(e.target.value)} aria-label={`Quantity of ${asset.code}`} />
                  <span className="pr-unit">{asset.code}</span>
                </span>
              </label>
              <label className="pr-field">
                <span className="pr-label">Expires within</span>
                <span className="pr-input">
                  <input inputMode="numeric" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} placeholder="Any" aria-label="Expires within days" />
                  <span className="pr-unit">days</span>
                </span>
              </label>
            </div>
          </Card>

          {result &&
            (result.matches.length === 0 ? (
              <p className="pr-muted" role="status">
                No funded put matches.
              </p>
            ) : (
              <MatchTable matches={result.matches} me={me} busy={busy} onBuy={onBuy} />
            ))}
        </>
      )}
    </div>
  )
}

function MatchTable({ matches, me, busy, onBuy }: { matches: ProtectMatch[]; me: string | null; busy: boolean; onBuy: (o: OptionOffer) => void }) {
  const quotes = new Set(matches.map((m) => m.offer.quote.code))
  // One quote token on screen: its unit goes in the header once.
  const unit = quotes.size === 1 ? ` (${matches[0].offer.quote.code})` : ''
  const cellUnit = (o: OptionOffer) => (unit ? '' : ` ${o.quote.code}`)
  return (
    <div className="ui-table-wrap pr-table">
      <table className="ui-table" aria-label="Matching puts">
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
              <span className="pr-sr">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const o = m.offer
            const q = o.quote.decimals
            return (
              <tr key={String(o.id)} data-testid="protect-match">
                <td>{o.underlying.code}</td>
                <td>Put</td>
                <td className="num">{formatDisplay(o.underlyingQty, o.underlying.decimals)}</td>
                <td className="num">
                  {formatPU(m.strikePU, q)}
                  {cellUnit(o)}
                </td>
                <td className="pr-tnum">
                  {formatExpiryShort(o.expiry)} <span className="pr-countdown">{formatCountdown(o.expiry)}</span>
                </td>
                <td className="num">
                  {formatPU(m.premiumPU, q)}
                  {cellUnit(o)}
                </td>
                <td className="num hide-sm">
                  {formatDisplay(o.totalPremium, q)}
                  {cellUnit(o)}
                </td>
                <td className="hide-sm">
                  <Mono>{shortAddress(o.writer)}</Mono>
                </td>
                <td className="pr-action">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!me || busy}
                    title={!me ? 'Connect a wallet to buy' : busy ? 'Another transaction is in progress' : undefined}
                    onClick={() => onBuy(o)}
                    aria-label={`Buy put on ${formatDisplay(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`}
                  >
                    Buy
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
