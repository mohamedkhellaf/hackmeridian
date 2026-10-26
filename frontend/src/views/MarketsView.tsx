import { useState } from 'react'
import { asSample, bookRows, sortBook } from '../market/book'
import type { BookRow } from '../market/book'
import { TradeDialog } from '../market/TradeDialogs'
import type { Prefill } from '../market/TradeDialogs'
import { formatCountdown } from '../market/series'
import type { OptionsClient } from '../options/client'
import type { Ask, NewOffer, SupportedAssets } from '../options/types'
import { FillDialog } from '../requests/RequestsMarket'
import type { Bid, NewBid } from '../requests/types'
import { ResaleBuyDialog } from '../resale/ResaleMarket'
import { resaleRows } from '../resale/resale'
import type { PositionAction, TxOutcome } from '../state/useStrata'
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
  /** All options (resale asks are joined against them). */
  options: OptionOffer[]
  /** Resale asks; null when the contract has no resale. */
  asks: Ask[] | null
  /** Buyer bids; null when the contract has no bids. */
  bids: Bid[] | null
  assets: SupportedAssets | null
  client: OptionsClient
  actionFor: (o: OptionOffer) => PositionAction | undefined
  bidBusyId: (id: bigint) => bigint
  onCreateBid: (bid: NewBid) => Promise<TxOutcome>
  onFillBid: (b: Bid) => Promise<TxOutcome>
  onCancelBid: (b: Bid) => Promise<TxOutcome>
  onBuyResale: (o: OptionOffer, maxTotal: bigint) => Promise<TxOutcome>
  onWriteOffer: (offer: NewOffer) => Promise<boolean>
  onOutcomeShown?: () => void
}

/** Decimal string without grouping, for prefilling an input. */
function plain(units: bigint, decimals: number): string {
  const neg = units < 0n
  const v = neg ? -units : units
  const d = 10n ** BigInt(decimals)
  const frac = (v % d).toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${v / d}${frac ? `.${frac}` : ''}`
}

const nowSecs = () => Math.floor(Date.now() / 1000)
const CHECK_TITLE = 'Premium is at least the total strike. Check the terms before buying.'

function ChainCell({
  side,
  bidOnly,
  kind,
  strike,
  selected,
  onPick,
}: {
  side?: ChainSide
  /** The series has bids but no offers. */
  bidOnly?: boolean
  kind: 'call' | 'put'
  strike: string
  selected: boolean
  onPick: () => void
}) {
  const label = kind === 'call' ? 'Call' : 'Put'
  if (!side && bidOnly)
    return (
      <button type="button" className={selected ? 'ch-price is-on' : 'ch-price'} aria-pressed={selected} aria-label={`${label} at ${strike}, bids only`} onClick={onPick}>
        <span className="ch-makers">bids</span>
      </button>
    )
  if (!side) return <span className="ch-none">—</span>
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

export function MarketsView(props: MarketsViewProps) {
  const { offers, me, busy, busyId, onBuy, onConnect, health, options, asks, bids, assets, client, actionFor, bidBusyId } = props
  const [trade, setTrade] = useState<'buy' | 'sell' | null>(null)
  const [resaleBuying, setResaleBuying] = useState<BookRow | null>(null)
  const [filling, setFilling] = useState<BookRow | null>(null)
  const nowSec = nowSecs()
  const entries = bookRows(offers, resaleRows(options, asks, nowSec), bids, nowSec).map((r) => ({ r, s: asSample(r) }))
  const rowOf = new Map(entries.map((e) => [e.s, e.r]))
  const samples = entries.map((e) => e.s)
  const offerSamples = entries.filter((e) => e.r.source !== 'bid').map((e) => e.s)
  const narrow = useNarrow()
  const [asset, setAsset] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [series, setSeries] = useState<string | null>(null)
  const [picked, setPicked] = useState<OptionOffer | null>(null)
  const [factsOpen, setFactsOpen] = useState(false)
  const ticketOpen = useTicketOpen()

  const codes = assetCodes(samples)
  const activeAsset = asset && codes.includes(asset) ? asset : defaultAsset(offerSamples.length ? offerSamples : samples)
  const days = expiryDays(samples, activeAsset)
  const activeDay = day && days.includes(day) ? day : (days[0] ?? '')
  const column = inColumn(samples, activeAsset, activeDay)
  const rows = buildChain(column)
  const offerRowsByStrike = new Map(buildChain(inColumn(offerSamples, activeAsset, activeDay)).map((r) => [r.strike, r]))
  const wanted = series && rows.some((r) => series === `call:${r.strike}` || series === `put:${r.strike}`) ? series : null
  const activeSeries = wanted ?? defaultSeries([...offerRowsByStrike.values()]) ?? defaultSeries(rows)
  const book = sortBook(activeSeries ? seriesOffers(column, activeSeries).map((x) => rowOf.get(x)!) : [])
  const bestOffer = book.offers.find((r) => r.counterparty !== me && !(r.offer && r.offer.writer === me))
  const bestBid = book.bids.find((r) => r.counterparty !== me)
  const sample = book.offers[0] ?? book.bids[0]
  const prefill = (best: BookRow | undefined): Prefill =>
    sample
      ? {
          kind: sample.kind,
          underlyingId: sample.underlying.contractId,
          qty: plain((best ?? sample).underlyingQty, sample.underlying.decimals),
          strike: plain((sample.totalStrike * 10n ** BigInt(sample.underlying.decimals)) / sample.underlyingQty, sample.quote.decimals),
          premium: plain((best ?? sample).totalPremium, sample.quote.decimals),
          expiryMs: sample.expiry * 1000,
        }
      : {}
  const bidsOn = bids !== null
  const shortTokens = health.filter((h) => h.held < h.reserved).map((h) => h.token)
  const n = offers.length
  const nAll = entries.length
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
      <p className="mk-intro">
        Each price is an option a market maker is selling, with the maker's reserves already locked in the contract. Calls on the left give
        you the right to <b>buy</b> the asset at that strike before expiry; puts on the right give you the right to <b>sell</b> it. Pick a price
        to see every maker and the premium you pay once, up front.
      </p>
      <ShortfallNotice tokens={shortTokens} className="mk-short-note" />

      {nAll === 0 ? (
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
                          <ChainCell side={offerRowsByStrike.get(r.strike)?.call} bidOnly={!!r.call} kind="call" strike={r.strike} selected={activeSeries === `call:${r.strike}`} onPick={() => pickSeries(`call:${r.strike}`)} />
                        </td>
                        <td className="ch-strike">{r.strike}</td>
                        <td>
                          <ChainCell side={offerRowsByStrike.get(r.strike)?.put} bidOnly={!!r.put} kind="put" strike={r.strike} selected={activeSeries === `put:${r.strike}`} onPick={() => pickSeries(`put:${r.strike}`)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {activeSeries && (
              <BookSection
                title={`${activeAsset} ${seriesStrike} ${seriesKind}`}
                book={book}
                me={me}
                busy={busy}
                busyId={busyId}
                bidsOn={bidsOn}
                health={health}
                selectedId={selectedId}
                actionFor={actionFor}
                bidBusyId={bidBusyId}
                canTrade={!!assets}
                onBuyButton={() => (me ? setTrade('buy') : connect())}
                onSellButton={() => (me ? setTrade('sell') : connect())}
                onTake={(r) => (r.source === 'resale' ? setResaleBuying(r) : r.offer && pickOffer(r.offer))}
                onFill={setFilling}
                onCancelBid={(b) => void props.onCancelBid(b)}
              />
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

      {trade && me && assets && activeSeries && (
        <TradeDialog
          key={`${trade}:${activeSeries}`}
          mode={trade}
          series={`${activeAsset} ${seriesStrike} ${seriesKind}`}
          best={trade === 'buy' ? bestOffer : bestBid}
          bidsEnabled={bidsOn}
          initial={prefill(trade === 'buy' ? bestOffer : bestBid)}
          assets={assets}
          client={client}
          me={me}
          busy={busy}
          onTake={(r) => (r.source === 'resale' ? setResaleBuying(r) : r.offer && pickOffer(r.offer))}
          onCreateBid={props.onCreateBid}
          onFillBid={(r) => props.onFillBid(r.bid!)}
          onWriteOffer={props.onWriteOffer}
          onOutcomeShown={props.onOutcomeShown}
          onClose={() => setTrade(null)}
        />
      )}
      {resaleBuying && me && resaleBuying.offer && resaleBuying.ask && (
        <ResaleBuyDialog
          row={{ option: resaleBuying.offer, ask: resaleBuying.ask }}
          client={client}
          me={me}
          busy={busy}
          onConfirm={() => props.onBuyResale(resaleBuying.offer!, resaleBuying.ask!.askTotal)}
          onClose={() => setResaleBuying(null)}
          onOutcomeShown={props.onOutcomeShown}
        />
      )}
      {filling?.bid && me && (
        <FillDialog
          bid={filling.bid}
          client={client}
          me={me}
          busy={busy}
          onConfirm={() => props.onFillBid(filling.bid!)}
          onClose={() => setFilling(null)}
          onOutcomeShown={props.onOutcomeShown}
        />
      )}

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

function BookSection({
  title,
  book,
  me,
  busy,
  busyId,
  bidsOn,
  health,
  selectedId,
  actionFor,
  bidBusyId,
  canTrade,
  onBuyButton,
  onSellButton,
  onTake,
  onFill,
  onCancelBid,
}: {
  title: string
  book: { bids: BookRow[]; offers: BookRow[] }
  me: string | null
  busy: boolean
  busyId: bigint | null
  bidsOn: boolean
  health: CollateralHealth[]
  selectedId: bigint | null
  actionFor: (o: OptionOffer) => PositionAction | undefined
  bidBusyId: (id: bigint) => bigint
  canTrade: boolean
  onBuyButton: () => void
  onSellButton: () => void
  onTake: (r: BookRow) => void
  onFill: (r: BookRow) => void
  onCancelBid: (b: Bid) => void
}) {
  const head = (
    <thead>
      <tr>
        <th className="num">Qty</th>
        <th className="num hide-sm">Strike/unit</th>
        <th className="num">Premium/unit</th>
        <th className="num hide-sm">Total</th>
        <th className="hide-sm">Expiry</th>
        <th>Counterparty</th>
        <th>
          <span className="mk-sr">Action</span>
        </th>
      </tr>
    </thead>
  )
  const cells = (r: BookRow) => {
    const s = asSample(r)
    return (
      <>
        <td className="num">{formatDisplay(r.underlyingQty, r.underlying.decimals)}</td>
        <td className="num hide-sm">{formatDisplay((r.totalStrike * 10n ** BigInt(r.underlying.decimals)) / r.underlyingQty, r.quote.decimals)}</td>
        <td className="num mk-prem">
          {r.source === 'maker' && implausibleTerms(s) && (
            <Tag tone="warn" title={CHECK_TITLE} className="mk-check-terms">
              Check terms
            </Tag>
          )}
          {premiumUnit(s)}
        </td>
        <td className="num hide-sm">
          {formatDisplay(r.totalPremium, r.quote.decimals)} {r.quote.code}
        </td>
        <td className="hide-sm mk-expiry">{formatCountdown(r.expiry)}</td>
        <td>
          {r.source === 'resale' && <Tag className="mk-resale">resale</Tag>} <Mono>{shortAddress(r.counterparty)}</Mono>
          {r.counterparty === me && <span className="mk-you"> (you)</span>}
          {r.offer && r.source === 'maker' && shortfallFor(r.offer, health).length > 0 && (
            <span className="mk-short" title={`Reserve shortfall on ${r.underlying.code}`}>
              {' '}
              Short
            </span>
          )}
        </td>
      </>
    )
  }
  const offerAction = (r: BookRow) => {
    const o = r.offer!
    if (r.source === 'maker' && o.writer === me) {
      const a = actionFor(o)
      return a ? (
        <Button size="sm" variant="secondary" disabled={a.disabled} onClick={a.onClick} aria-label={`Cancel offer ${o.id.toString()}`}>
          {busyId === o.id ? 'Cancelling…' : 'Cancel'}
        </Button>
      ) : null
    }
    if (r.source === 'resale') {
      if (r.ask?.holder === me) return <span className="mk-muted">Yours</span>
      if (o.writer === me) return <span className="mk-muted">Written by you</span>
      return (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !me}
          reason={!me ? 'Connect a wallet to buy' : undefined}
          aria-label={`Buy resale of option ${o.id.toString()}`}
          onClick={() => onTake(r)}
        >
          Buy
        </Button>
      )
    }
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onTake(r)}
        disabled={busy}
        reason={busy ? 'Another transaction is in progress' : undefined}
        aria-label={`Buy ${o.kind} on ${formatDisplay(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`}
      >
        {busyId === o.id ? 'Buying…' : 'Buy'}
      </Button>
    )
  }
  const bidAction = (r: BookRow) => {
    const b = r.bid!
    if (b.buyer === me)
      return (
        <Button size="sm" variant="secondary" disabled={busy} aria-label={`Cancel request ${b.id.toString()}`} onClick={() => onCancelBid(b)}>
          {busyId === bidBusyId(b.id) ? 'Cancelling…' : 'Cancel'}
        </Button>
      )
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={busy || !me}
        reason={!me ? 'Connect a wallet to fill' : busy ? 'Another transaction is in progress' : undefined}
        aria-label={`Sell to bid ${b.id.toString()}`}
        onClick={() => onFill(r)}
      >
        Sell
      </Button>
    )
  }

  return (
    <section className="mk-list mk-book" aria-label="Book">
      <div className="mk-book-head">
        <h2 className="mk-list-title">{title}</h2>
        <div className="mk-book-actions">
          <Button variant="primary" disabled={!canTrade || busy} onClick={onBuyButton}>
            Buy
          </Button>
          <Button variant="secondary" disabled={!canTrade || busy} onClick={onSellButton}>
            Sell
          </Button>
        </div>
      </div>
      <p className="mk-muted mk-book-note">Bids and offers are limit prices set by buyers, makers and reselling holders.</p>
      <div className={bidsOn ? 'mk-book-cols' : 'mk-book-cols is-one'}>
        {bidsOn && (
          <div className="mk-book-side">
            <h3>Bids</h3>
            {book.bids.length === 0 ? (
              <p className="mk-empty">No bids yet</p>
            ) : (
              <div className="ui-table-wrap mk-table">
                <table className="ui-table" aria-label="Bids">
                  {head}
                  <tbody>
                    {book.bids.map((r, i) => (
                      <tr key={r.key} className={i === 0 && book.bids.length > 1 ? 'is-best' : undefined}>
                        {cells(r)}
                        <td className="mk-action">{bidAction(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div className="mk-book-side">
          <h3>Offers</h3>
          {book.offers.length === 0 ? (
            <p className="mk-empty">No offers yet</p>
          ) : (
            <div className="ui-table-wrap mk-table">
              <table className="ui-table" aria-label="Offers">
                {head}
                <tbody>
                  {book.offers.map((r, i) => (
                    <tr
                      key={r.key}
                      className={
                        [i === 0 && book.offers.length > 1 ? 'is-best' : '', r.source === 'maker' && selectedId === r.offer?.id ? 'is-picked' : ''].join(' ').trim() ||
                        undefined
                      }
                    >
                      {cells(r)}
                      <td className="mk-action">{offerAction(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
