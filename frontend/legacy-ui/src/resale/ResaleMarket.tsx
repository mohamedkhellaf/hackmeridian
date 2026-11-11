import { useEffect, useMemo, useState } from 'react'
import { explorerTx } from '../config'
import { formatCountdown, formatExpiryShort } from '../market/series'
import type { OptionsClient } from '../options/client'
import { premiumUnaffordable } from '../options/feasibility'
import { formatDisplay, shortAddress, strikePerUnit } from '../options/format'
import type { Ask, OptionOffer } from '../options/types'
import type { TxOutcome } from '../state/useStrata'
import { Banner, Button, Dialog, Mono } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { formatAskPerUnit, resaleCheck, resaleRows, selfTradeReason } from './resale'
import type { ResaleRow } from './resale'
import '../market/market.css'
import './resale.css'

const nowSec = () => Math.floor(Date.now() / 1000)
type Check = 'pending' | 'ok' | 'fail' | 'changed' | 'unknown'
const amt = (units: bigint, t: { decimals: number; code: string }) => `${formatDisplay(units, t.decimals)} ${t.code}`

export function ResaleBuyDialog({
  row,
  client,
  me,
  busy,
  onConfirm,
  onClose,
  onOutcomeShown,
}: {
  row: ResaleRow
  client: OptionsClient
  me: string
  /** Another transaction is in flight (global runner). */
  busy: boolean
  onConfirm: () => Promise<TxOutcome>
  onClose: () => void
  onOutcomeShown?: () => void
}) {
  const { option: o, ask } = row
  const u = o.underlying
  const q = o.quote
  const [askCheck, setAskCheck] = useState<Check>('pending')
  const [liveAsk, setLiveAsk] = useState<bigint | null>(null)
  const [eligCheck, setEligCheck] = useState<Check>('pending')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hash: string; mock: boolean } | null>(null)

  // Re-read the option and its ask on open: it may have been bought, exercised, transferred, withdrawn or
  // re-priced since the list was loaded.
  useEffect(() => {
    let live = true
    Promise.all([client.getOption(o.id), client.getAsk(o.id)])
      .then(([fresh, a]) => {
        if (!live) return
        setLiveAsk(a)
        setAskCheck(resaleCheck(fresh, a, ask, nowSec()))
      })
      .catch(() => live && setAskCheck('unknown'))
    return () => {
      live = false
    }
  }, [client, o.id, ask])

  useEffect(() => {
    let live = true
    client
      .isEligible(u.contractId, me)
      .then((ok) => live && setEligCheck(ok ? 'ok' : 'fail'))
      .catch(() => live && setEligCheck('unknown'))
    return () => {
      live = false
    }
  }, [client, me, u.contractId])

  const tokens = useMemo(() => [q], [q])
  const { balances } = useBalances(me, tokens)
  const quoteBal = balances[q.contractId]
  const cannotPay = premiumUnaffordable({ totalPremium: ask.askTotal }, quoteBal)
  const self = selfTradeReason(o, ask, me)
  const blocked = !!self || askCheck === 'fail' || askCheck === 'changed' || eligCheck === 'fail' || cannotPay
  const title = `Buy ${u.code} ${o.kind} from holder`

  const close = () => {
    if (!submitting) onClose()
  }
  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await onConfirm()
      if (res.ok) {
        setDone({ hash: res.hash, mock: res.mock })
        onOutcomeShown?.()
      } else setError(res.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Dialog
        title={title}
        width={460}
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Back to markets
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                window.location.hash = '#/portfolio'
                onClose()
              }}
            >
              View in positions
            </Button>
          </>
        }
      >
        <p className="mk-done">Bought from holder. You now hold position {o.id.toString()}.</p>
        <dl className="ui-kv">
          <div>
            <dt>Transaction</dt>
            <dd>
              {done.mock ? (
                <>
                  <Mono title={done.hash}>{done.hash.slice(0, 12)}…</Mono> <span className="mk-muted">(mock)</span>
                </>
              ) : (
                <a className="ui-mono" href={explorerTx(done.hash)} target="_blank" rel="noreferrer" title={done.hash}>
                  {done.hash.slice(0, 12)}…
                </a>
              )}
            </dd>
          </div>
        </dl>
      </Dialog>
    )
  }

  return (
    <Dialog
      title={title}
      width={500}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting} aria-label="Cancel resale purchase">
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} disabled={blocked || busy} onClick={() => void confirm()}>
            {submitting ? 'Confirm in wallet…' : `Pay ${amt(ask.askTotal, q)}`}
          </Button>
        </>
      }
    >
      <p className="rsl-copy">
        <strong>You pay the seller, not the writer. The option's collateral stays locked in the contract.</strong>
      </p>
      <dl className="ui-kv">
        <div>
          <dt>Kind</dt>
          <dd>
            {o.kind === 'put' ? 'Put' : 'Call'} on {amt(o.underlyingQty, u)}
          </dd>
        </div>
        <div>
          <dt>Strike</dt>
          <dd className="num">
            {strikePerUnit(o)} {q.code} per {u.code}, {amt(o.totalStrike, q)} total
          </dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>
            {formatExpiryShort(o.expiry)} <span className="mk-muted">{formatCountdown(o.expiry)}</span>
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd className="num">
            {formatAskPerUnit(o, ask.askTotal)} {q.code} per {u.code}, {amt(ask.askTotal, q)} total
            <span className="mk-note">Set by the seller. Paid to the seller now.</span>
          </dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd>
            <Mono>{shortAddress(ask.holder)}</Mono>
          </dd>
        </div>
        <div>
          <dt>Writer</dt>
          <dd>
            <Mono>{shortAddress(o.writer)}</Mono>
          </dd>
        </div>
        <div>
          <dt>Listing</dt>
          <dd className={askCheck === 'fail' || askCheck === 'changed' ? 'mk-bad' : undefined}>
            {askCheck === 'ok' && 'For sale'}
            {askCheck === 'pending' && 'Checking'}
            {askCheck === 'fail' && 'No longer for sale (bought, withdrawn, exercised or transferred).'}
            {askCheck === 'changed' && liveAsk !== null && `The seller changed the price to ${amt(liveAsk, q)}. Close and reopen to review it.`}
            {askCheck === 'unknown' && 'Could not re-check. The contract rejects the purchase if it is gone.'}
          </dd>
        </div>
        <div>
          <dt>Your account</dt>
          <dd className={eligCheck === 'fail' ? 'mk-bad' : undefined}>
            {eligCheck === 'ok' && `Authorized by the ${u.code} issuer`}
            {eligCheck === 'pending' && 'Checking'}
            {eligCheck === 'fail' && `Not authorized by the ${u.code} issuer. The purchase would fail with NotEligible.`}
            {eligCheck === 'unknown' && 'Could not check'}
          </dd>
        </div>
      </dl>
      <p className="mk-muted mk-issuer">
        The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.
      </p>
      {self && <Banner tone="warn">{self}</Banner>}
      {cannotPay && quoteBal?.balance != null && (
        <Banner tone="danger">
          Need {amt(ask.askTotal, q)}, wallet has {amt(quoteBal.balance, q)}.
        </Banner>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </Dialog>
  )
}

/** Markets: options their holders have listed for resale (contract v1.4). Hidden when the contract has no resale. */
export function ResaleMarket({
  options,
  asks,
  me,
  busy,
  client,
  onBuy,
  onOutcomeShown,
}: {
  /** All options (the asks are joined against them). */
  options: OptionOffer[]
  asks: Ask[] | null
  me: string | null
  busy: boolean
  client: OptionsClient
  /** Buys at most `maxTotal` (the ask shown); the contract refuses a higher price. */
  onBuy: (o: OptionOffer, maxTotal: bigint) => Promise<TxOutcome>
  onOutcomeShown?: () => void
}) {
  const [buying, setBuying] = useState<ResaleRow | null>(null)
  if (!asks) return null
  const rows = resaleRows(options, asks, nowSec())
  const quotes = new Set(rows.map((r) => r.option.quote.code))
  const unit = quotes.size === 1 ? ` (${rows[0].option.quote.code})` : ''
  const cell = (r: ResaleRow) => (unit ? '' : ` ${r.option.quote.code}`)

  return (
    <section className="rsl-section" aria-label="Resale">
      <h2>Resale</h2>
      {rows.length === 0 ? (
        <p className="mk-empty">No options for sale.</p>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table" aria-label="Resale">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Kind</th>
                <th className="num">Qty</th>
                <th className="num">Strike{unit}</th>
                <th>Expiry</th>
                <th className="hide-sm">Seller</th>
                <th className="num">Price{unit}</th>
                <th className="num hide-sm">Per unit{unit}</th>
                <th className="num">
                  <span className="mk-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const { option: o, ask } = r
                const self = selfTradeReason(o, ask, me)
                return (
                  <tr key={o.id.toString()}>
                    <td>{o.underlying.code}</td>
                    <td>{o.kind === 'put' ? 'Put' : 'Call'}</td>
                    <td className="num">{formatDisplay(o.underlyingQty, o.underlying.decimals)}</td>
                    <td className="num">
                      {strikePerUnit(o)}
                      {cell(r)}
                    </td>
                    <td>
                      {formatExpiryShort(o.expiry)} <span className="mk-muted">{formatCountdown(o.expiry)}</span>
                    </td>
                    <td className="hide-sm">
                      <Mono>{shortAddress(ask.holder)}</Mono>
                    </td>
                    <td className="num">
                      {formatDisplay(ask.askTotal, o.quote.decimals)}
                      {cell(r)}
                    </td>
                    <td className="num hide-sm">
                      {formatAskPerUnit(o, ask.askTotal)}
                      {cell(r)}
                    </td>
                    <td className="num">
                      {self ? (
                        <span className="mk-muted">{ask.holder === me ? 'Yours' : 'Written by you'}</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || !me}
                          title={!me ? 'Connect a wallet to buy' : undefined}
                          aria-label={`Buy resale of option ${o.id.toString()}`}
                          onClick={() => setBuying(r)}
                        >
                          Buy
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {buying && me && (
        <ResaleBuyDialog
          row={buying}
          client={client}
          me={me}
          busy={busy}
          onConfirm={() => onBuy(buying.option, buying.ask.askTotal)}
          onClose={() => setBuying(null)}
          onOutcomeShown={onOutcomeShown}
        />
      )}
    </section>
  )
}
