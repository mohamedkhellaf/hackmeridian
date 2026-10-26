import { useState } from 'react'
import type { ReactNode } from 'react'
import { TermsList } from '../market/BuyTicket'
import { registerTicketSlot, useNarrow, useTicketOpen } from '../market/ticketSlot'
import {
  assetCodes,
  buildChain,
  dayLabel,
  defaultAsset,
  defaultSeries,
  expiryDays,
  inColumn,
  premiumUnit,
  seriesOffers,
  settlementLine,
} from '../market/chain'
import type { ChainSide } from '../market/chain'
import '../market/market.css'
import { formatExpiryShort } from '../market/series'
import { formatDisplay, shortAddress } from '../options/format'
import { implausibleTerms } from '../options/feasibility'
import type { CollateralHealth, CollateralLine, OptionOffer } from '../options/types'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallNotice } from '../reserves/ShortfallWarning'
import { AssetFactsDialog } from '../assetfacts/AssetFactsPanel'
import { Button, Dialog, Mono, PageHeader, Segmented, Tag } from '../ui'

export interface MarketsViewProps {
  /** Open (state 'offered') offers. */
  offers: OptionOffer[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  /** Fills the buy ticket with this offer (the app renders it). */
  onBuy: (o: OptionOffer) => void
  /** Opens the wallet connection. */
  onConnect?: () => void
  collateral: CollateralLine[]
  health: CollateralHealth[]
  /** In-memory mock client. The shell footer carries the mock notice, so this view does not repeat it. */
  mock: boolean
  /** Resale section (contract v1.4), rendered below the offers. */
  resale?: ReactNode
}

const CHECK_TITLE = 'Premium is at least the total strike. Check the terms before buying.'

function ChainCell({
  side,
  kind,
  strike,
  selected,
  onPick,
}: {
  side?: ChainSide
  kind: 'call' | 'put'
  strike: string
  selected: boolean
  onPick: () => void
}) {
  if (!side) return <span className="ch-none">—</span>
  const label = kind === 'call' ? 'Call' : 'Put'
  return (
    <button
      type="button"
      className={selected ? 'ch-price is-on' : 'ch-price'}
      aria-pressed={selected}
      aria-label={`${label} at ${strike}, best premium ${premiumUnit(side.best)}, ${side.makers} ${side.makers === 1 ? 'maker' : 'makers'}`}
      onClick={onPick}
    >
      <span className="ch-num">{premiumUnit(side.best)}</span> <span className="ch-makers">({side.makers})</span>
    </button>
  )
}

export function MarketsView({ offers, me, busy, busyId, onBuy, onConnect, health, resale }: MarketsViewProps) {
  const narrow = useNarrow()
  const [asset, setAsset] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [series, setSeries] = useState<string | null>(null)
  const [picked, setPicked] = useState<OptionOffer | null>(null)
  const [factsOpen, setFactsOpen] = useState(false)
  const ticketOpen = useTicketOpen()

  const codes = assetCodes(offers)
  const activeAsset = asset && codes.includes(asset) ? asset : defaultAsset(offers)
  const days = expiryDays(offers, activeAsset)
  const activeDay = day && days.includes(day) ? day : (days[0] ?? '')
  const column = inColumn(offers, activeAsset, activeDay)
  const rows = buildChain(column)
  const wanted = series && rows.some((r) => series === `call:${r.strike}` || series === `put:${r.strike}`) ? series : null
  const activeSeries = wanted ?? defaultSeries(rows)
  const listed = activeSeries ? seriesOffers(column, activeSeries) : []
  const shortTokens = health.filter((h) => h.held < h.reserved).map((h) => h.token)
  const n = offers.length
  const quoteCode = column[0]?.quote.code ?? ''
  const mixedQuotes = new Set(column.map((o) => o.quote.code)).size > 1
  const unit = quoteCode && !mixedQuotes ? ` (${quoteCode})` : ''
  const [seriesKind, seriesStrike] = activeSeries ? activeSeries.split(':') : ['', '']
  const pickedLive = picked && offers.some((o) => o.id === picked.id) ? picked : null
  const selectedId = (me ? ticketOpen : !!pickedLive) && pickedLive ? pickedLive.id : null
  const connect = onConnect ?? (() => {})

  const factsToken = offers.find((o) => o.underlying.code === activeAsset)?.underlying ?? null

  const pickSeries = (key: string) => setSeries(key)
  const pickOffer = (o: OptionOffer) => {
    setPicked(o)
    onBuy(o)
  }

  return (
    <div className="mk-page">
      <PageHeader
        title="Markets"
        actions={
          <>
            <span role="group" aria-label="Open offers" className="mk-count">
              {n} open {n === 1 ? 'offer' : 'offers'}
            </span>
            {codes.length > 0 && (
              <>
                <select
                  className="ui-select"
                  aria-label="Asset"
                  value={activeAsset}
                  onChange={(e) => {
                    setAsset(e.target.value)
                    setDay(null)
                    setSeries(null)
                  }}
                >
                  {codes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setFactsOpen(true)}>
                  Asset facts
                </Button>
                <Segmented
                  label="Expiry"
                  options={days.map((d) => ({ value: d, label: dayLabel(d) }))}
                  value={activeDay}
                  onChange={(d) => {
                    setDay(d)
                    setSeries(null)
                  }}
                />
              </>
            )}
          </>
        }
      />
      <ShortfallNotice tokens={shortTokens} className="mk-short-note" />

      {n === 0 ? (
        <p className="mk-empty">No open offers.</p>
      ) : (
        <div className="mk-layout">
          <div className="mk-main">
            <div className="ui-table-wrap ch-wrap">
              <table className="ui-table ch" aria-label="Option chain">
                <thead>
                  <tr>
                    <th className="num">Calls{unit ? ` per ${activeAsset}${unit}` : ''}</th>
                    <th className="ch-strike">Strike</th>
                    <th>Puts{unit ? ` per ${activeAsset}${unit}` : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const on = activeSeries?.endsWith(`:${r.strike}`)
                    return (
                      <tr key={r.strike} className={on ? 'is-on' : undefined}>
                        <td className="num">
                          <ChainCell side={r.call} kind="call" strike={r.strike} selected={activeSeries === `call:${r.strike}`} onPick={() => pickSeries(`call:${r.strike}`)} />
                        </td>
                        <td className="ch-strike">{r.strike}</td>
                        <td>
                          <ChainCell side={r.put} kind="put" strike={r.strike} selected={activeSeries === `put:${r.strike}`} onPick={() => pickSeries(`put:${r.strike}`)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {listed.length > 0 && (
              <section className="mk-list" aria-label="Offers in series">
                <h2 className="mk-list-title">
                  Offers at {activeAsset} {seriesStrike} {seriesKind}
                </h2>
                <div className="ui-table-wrap mk-table">
                  <table className="ui-table" aria-label="Offers">
                    <thead>
                      <tr>
                        <th>Maker</th>
                        <th className="num">Qty</th>
                        <th className="num">Premium per {activeAsset}{unit}</th>
                        <th className="num hide-sm">Total{unit}</th>
                        <th className="hide-sm">Expiry</th>
                        <th>
                          <span className="mk-sr">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {listed.map((o, i) => {
                        const own = o.writer === me
                        const short = shortfallFor(o, health).length > 0
                        const best = i === 0 && listed.length > 1
                        const cell = mixedQuotes ? ` ${o.quote.code}` : ''
                        return (
                          <tr key={o.id.toString()} className={[best ? 'is-best' : '', selectedId === o.id ? 'is-picked' : ''].join(' ').trim() || undefined}>
                            <td>
                              <Mono>{shortAddress(o.writer)}</Mono>
                              {own && <span className="mk-you"> (you)</span>}
                              {short && (
                                <span className="mk-short" title={`Reserve shortfall on ${o.underlying.code}`}>
                                  {' '}
                                  Short
                                </span>
                              )}
                            </td>
                            <td className="num">{formatDisplay(o.underlyingQty, o.underlying.decimals)}</td>
                            <td className="num mk-prem">
                              {implausibleTerms(o) && (
                                <Tag tone="warn" title={CHECK_TITLE} className="mk-check-terms">
                                  Check terms
                                </Tag>
                              )}
                              {premiumUnit(o)}
                              {cell}
                            </td>
                            <td className="num hide-sm">
                              {formatDisplay(o.totalPremium, o.quote.decimals)}
                              {cell}
                            </td>
                            <td className="hide-sm mk-expiry">{formatExpiryShort(o.expiry)}</td>
                            <td className="mk-action">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => pickOffer(o)}
                                disabled={busy || own}
                                reason={own ? 'This is your own offer' : busy ? 'Another transaction is in progress' : undefined}
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
              </section>
            )}
          </div>

          {!narrow && (
            <div className="tk-col">
              <div ref={registerTicketSlot} />
              {!ticketOpen && !(pickedLive && !me) && <p className="tk-empty">Select a price in the chain.</p>}
              {!me && pickedLive && !narrow && <GuestTicket offer={pickedLive} onConnect={connect} />}
            </div>
          )}
        </div>
      )}

      {resale}

      {factsOpen && factsToken && <AssetFactsDialog token={factsToken} me={me} onClose={() => setFactsOpen(false)} />}

      {narrow && !me && pickedLive && (
        <Dialog title={`Buy ${pickedLive.underlying.code} ${pickedLive.kind}`} width={520} onClose={() => setPicked(null)}>
          <GuestTicket offer={pickedLive} onConnect={connect} sheet />
        </Dialog>
      )}
    </div>
  )
}

/** Terms and a Connect wallet button for a visitor without a wallet. */
function GuestTicket({ offer, onConnect, sheet }: { offer: OptionOffer; onConnect: () => void; sheet?: boolean }) {
  const title = `Buy ${offer.underlying.code} ${offer.kind}`
  const body = (
    <div className="tk-body">
      <TermsList offer={offer} />
      <p className="tk-settle">{settlementLine(offer)}</p>
      <div className="tk-actions">
        <Button variant="primary" onClick={onConnect}>
          Connect wallet
        </Button>
      </div>
    </div>
  )
  if (sheet) return body
  return (
    <section className="tk" role="dialog" aria-modal="false" aria-label={title}>
      <h2 className="tk-title">{title}</h2>
      {body}
    </section>
  )
}
