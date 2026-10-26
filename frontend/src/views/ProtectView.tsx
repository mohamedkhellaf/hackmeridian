import { useMemo, useState } from 'react'
import { formatAmount, formatDisplay, formatExpiry, parseAmount, shortAddress } from '../options/format'
import type { OptionOffer, SupportedAssets, TokenInfo } from '../options/types'
import { coverageText, formatPU, matchProtection } from '../protect/match'
import type { ProtectMatch } from '../protect/match'
import '../protect/protect.css'
import type { TokenBalance } from '../stellar/tokens'
import { AssetBadge, Banner, Button, Chip, PageHero, Sediment, Tag } from '../ui'

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

const WINDOWS: { label: string; days: number | null }[] = [
  { label: 'Any expiry', days: null },
  { label: '≤ 3 days', days: 3 },
  { label: '≤ 7 days', days: 7 },
  { label: '≤ 14 days', days: 14 },
]

function Step({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="pr-step" aria-labelledby={`pr-step-${n}`}>
      <header className="pr-step-head">
        <span className="ui-mono pr-step-n">{n}</span>
        <h2 id={`pr-step-${n}`}>{title}</h2>
        {hint && <span className="pr-step-hint">{hint}</span>}
      </header>
      {children}
    </section>
  )
}

export function ProtectView({ assets, offers, me, balances, mock, busy, onBuy }: ProtectViewProps) {
  const [assetId, setAssetId] = useState<string | null>(null)
  const [qtyInput, setQtyInput] = useState<string | null>(null) // null = default to the wallet balance
  const [floorInput, setFloorInput] = useState('')
  const [days, setDays] = useState<number | null>(null)
  const [picked, setPicked] = useState<bigint | null>(null)

  const underlyings = assets?.underlyings ?? []
  const asset: TokenInfo | null = underlyings.find((t) => t.contractId === assetId) ?? null
  const quote = assets?.quote ?? null
  const balanceOf = (t: TokenInfo) => balances[t.contractId]?.balance ?? null
  const balance = asset ? balanceOf(asset) : null

  const defaultQty = asset && balance != null && balance > 0n ? formatAmount(balance, asset.decimals, asset.decimals) : ''
  const qtyText = qtyInput ?? defaultQty
  const qty = asset ? parseAmount(qtyText, asset.decimals) : null
  const floor = quote ? parseAmount(floorInput, quote.decimals) : null
  const ready = !!asset && !!quote && qty != null && qty > 0n && floor != null && floor > 0n

  // eslint-disable-next-line react-hooks/purity
  const nowSec = Math.floor(Date.now() / 1000)
  const result = useMemo(
    () => (ready ? matchProtection(offers, { underlyingId: asset.contractId, qty, floor, maxDays: days, me }, nowSec) : null),
    // nowSec changes every render; minute granularity is plenty for a list that re-reads on offers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers, ready, asset, qty, floor, days, me, Math.floor(nowSec / 60)],
  )
  const best = result?.matches[0] ?? null
  const chosen = result?.matches.find((m) => m.offer.id === picked) ?? best

  const pick = (t: TokenInfo) => {
    setAssetId(t.contractId)
    setQtyInput(null)
    setPicked(null)
  }

  const listedStrikes = useMemo(() => {
    if (!asset) return null
    const ps = offers.filter((o) => o.kind === 'put' && o.underlying.contractId === asset.contractId && o.underlyingQty > 0n)
    if (ps.length === 0) return null
    const per = ps.map((o) => (o.totalStrike * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty)
    return { lo: per.reduce((a, b) => (a < b ? a : b)), hi: per.reduce((a, b) => (a > b ? a : b)), n: ps.length }
  }, [offers, asset])

  return (
    <div className="pr-page">
      <PageHero
        eyebrow="Easy mode · puts only"
        title="Protect"
        lede="Hold an asset and want a floor under it? Pick the asset, name a floor price and a date, and we line up the funded put offers that fit. Every figure comes from a real offer."
        sediment={{ seed: 'strata-protect', captionLabel: 'How it works', caption: 'A put pays you the strike for your asset if you exercise before expiry. You pay the premium up front.' }}
      />

      <Step n="01" title="Asset" hint={me && !mock ? 'Balances from your wallet' : undefined}>
        {underlyings.length === 0 ? (
          <p className="pr-muted">No listed assets yet.</p>
        ) : (
          <ul className="pr-assets" role="list">
            {underlyings.map((t) => {
              const b = balanceOf(t)
              const on = t.contractId === assetId
              return (
                <li key={t.contractId}>
                  <button type="button" className={on ? 'pr-asset is-on' : 'pr-asset'} aria-pressed={on} onClick={() => pick(t)}>
                    <span className="pr-asset-thumb">
                      <Sediment seed={t.code} size="fill" />
                    </span>
                    <span className="pr-asset-body">
                      <AssetBadge code={t.code} size={30} />
                      <span className="pr-asset-code">{t.code}</span>
                      <span className="pr-asset-bal ui-mono">
                        {b != null ? `${formatDisplay(b, t.decimals)} held` : me && !mock ? 'Balance unavailable' : mock ? 'Mock asset' : 'Connect to see balance'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Step>

      {asset && quote && (
        <Step n="02" title="Protection">
          <div className="pr-form">
            <label className="pr-field">
              <span className="ui-label">Quantity ({asset.code})</span>
              <input inputMode="decimal" value={qtyText} onChange={(e) => { setQtyInput(e.target.value); setPicked(null) }} placeholder="e.g. 50" aria-label={`Quantity of ${asset.code}`} />
              <span className="pr-hint">
                {balance != null ? `Defaults to your balance (${formatDisplay(balance, asset.decimals)}).` : mock ? 'Mock mode has no wallet balance: enter a quantity.' : 'Enter how many you hold.'}
              </span>
            </label>
            <label className="pr-field">
              <span className="ui-label">Floor price ({quote.code} per {asset.code})</span>
              <input inputMode="decimal" value={floorInput} onChange={(e) => { setFloorInput(e.target.value); setPicked(null) }} placeholder="e.g. 10" aria-label={`Floor price in ${quote.code}`} />
              <span className="pr-hint">
                {listedStrikes
                  ? `Listed put strikes: ${formatPU(listedStrikes.lo, quote.decimals)} to ${formatPU(listedStrikes.hi, quote.decimals)} ${quote.code}.`
                  : 'No put offers are listed for this asset right now.'}
              </span>
            </label>
          </div>
          <div className="pr-chips" role="group" aria-label="Expiry window">
            <span className="ui-label">Until</span>
            {WINDOWS.map((w) => (
              <Chip key={w.label} selected={days === w.days} onClick={() => { setDays(w.days); setPicked(null) }}>
                {w.label}
              </Chip>
            ))}
          </div>

          <p className="pr-sentence" aria-live="polite">
            Protect <b className="ui-mono">{qty != null && qty > 0n ? formatDisplay(qty, asset.decimals) : '…'}</b> {asset.code} below{' '}
            <b className="ui-mono">{floor != null && floor > 0n ? formatPU(floor, quote.decimals) : '…'}</b> {quote.code} until{' '}
            <b>{days == null ? 'any expiry' : `${days} days from now at the latest`}</b>.
          </p>

          {!ready ? (
            <p className="pr-muted">Enter a quantity and a floor price to see matching offers.</p>
          ) : result && result.matches.length > 0 ? (
            <>
              <div className="ui-table-wrap pr-table">
                <table className="ui-table">
                  <caption className="pr-caption">Funded put offers, lowest premium per {asset.code} first</caption>
                  <thead>
                    <tr>
                      <th className="ui-left">Offer</th>
                      <th>Strike / unit</th>
                      <th>Premium / unit</th>
                      <th>Expires</th>
                      <th>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((m, i) => (
                      <MatchRow key={String(m.offer.id)} m={m} best={i === 0} on={chosen?.offer.id === m.offer.id} goalQty={qty} onPick={() => setPicked(m.offer.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pr-muted">
                Premium is what you pay now and do not get back. Coverage counts only this offer; to cover the rest you would buy another one.
                {result.oversized > 0 && ` ${result.oversized} larger offer${result.oversized > 1 ? 's' : ''} hidden: they would insure more than you hold.`}
              </p>
            </>
          ) : (
            <div className="pr-empty" role="status">
              <b>No funded put matches these filters.</b>
              <p>
                Try a lower floor, a later expiry window, or a smaller quantity
                {result && result.oversized > 0 ? ` (${result.oversized} offer${result.oversized > 1 ? 's are' : ' is'} larger than your quantity)` : ''}. You can also{' '}
                <a href="#/write">write a request as a maker</a> and wait for a counterparty.
              </p>
              {result && result.closest.length > 0 && (
                <>
                  <p className="pr-muted">Closest listed strikes below your floor (not protecting you down to your floor):</p>
                  <ul className="pr-closest">
                    {result.closest.map((m) => (
                      <li key={String(m.offer.id)} className="ui-mono">
                        strike {formatPU(m.strikePU, quote.decimals)} · premium {formatPU(m.premiumPU, quote.decimals)} per {asset.code} · expires {formatExpiry(m.offer.expiry)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Step>
      )}

      {asset && quote && chosen && result && result.matches.length > 0 && (
        <Step n="03" title="Review">
          <div className="pr-review">
            <div>
              <p className="pr-review-line">
                <Tag tone="put">PUT</Tag> {formatDisplay(chosen.offer.underlyingQty, asset.decimals)} {asset.code} · strike{' '}
                <b className="ui-mono">{formatPU(chosen.strikePU, quote.decimals)}</b> {quote.code} / unit · expires {formatExpiry(chosen.offer.expiry)}
              </p>
              <p className="pr-muted">
                You pay <b className="ui-mono">{formatDisplay(chosen.offer.totalPremium, quote.decimals)} {quote.code}</b> premium. If you exercise before expiry you receive{' '}
                <b className="ui-mono">{formatDisplay(chosen.offer.totalStrike, quote.decimals)} {quote.code}</b> for{' '}
                {formatDisplay(chosen.offer.underlyingQty, asset.decimals)} {asset.code}. {coverageText(chosen, qty ?? 0n, asset.decimals, asset.code)}.
              </p>
            </div>
            <div className="pr-review-cta">
              <Button variant="primary" size="lg" disabled={!me || busy} onClick={() => onBuy(chosen.offer)}>
                Review and buy
              </Button>
              {!me && <span className="pr-hint">Connect a wallet to continue.</span>}
            </div>
          </div>
        </Step>
      )}

      {!assets && <Banner tone="info">Loading assets…</Banner>}
    </div>
  )
}

function MatchRow({ m, best, on, goalQty, onPick }: { m: ProtectMatch; best: boolean; on: boolean; goalQty: bigint; onPick: () => void }) {
  const o = m.offer
  const d = o.underlying.decimals
  const q = o.quote.decimals
  return (
    <tr className={best ? 'is-best' : undefined} data-testid="protect-match">
      <td className="ui-left">
        <label className="pr-pick">
          <input type="radio" name="protect-offer" checked={on} onChange={onPick} aria-label={`Choose put on ${formatDisplay(o.underlyingQty, d)} ${o.underlying.code} from ${shortAddress(o.writer)}`} />
          <span>
            <span className="ui-strong">
              {formatDisplay(o.underlyingQty, d)} {o.underlying.code}
            </span>
            <span className="ui-sub">
              {shortAddress(o.writer)}
              {best && ' · best premium'}
            </span>
          </span>
        </label>
      </td>
      <td className="ui-mono">{formatPU(m.strikePU, q)}</td>
      <td className="ui-mono ui-strong">{formatPU(m.premiumPU, q)}</td>
      <td>{formatExpiry(o.expiry)}</td>
      <td>
        {coverageText(m, goalQty, d, o.underlying.code)}
        {m.partial && <span className="ui-sub">Partial coverage</span>}
      </td>
    </tr>
  )
}
