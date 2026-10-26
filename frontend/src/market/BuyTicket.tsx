import { useEffect, useMemo, useState } from 'react'
import type { MutableRefObject } from 'react'
import { explorerTx } from '../config'
import type { OptionsClient } from '../options/client'
import type { CollateralHealth, OptionOffer } from '../options/types'
import { formatDisplay, shortAddress, strikePerUnit } from '../options/format'
import { exerciseFeasibility, premiumUnaffordable } from '../options/feasibility'
import { useBalances } from '../wallet/useBalances'
import { PayoffChart } from '../payoff/PayoffChart'
import { fmtNum, fmtSigned, riskLines, strikeOf, legOf } from '../payoff/buyerPayoff'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallBanner } from '../reserves/ShortfallWarning'
import type { TxOutcome } from '../state/useStrata'
import { Banner, Button, Mono } from '../ui'
import { premiumUnit, settlementLine } from './chain'
import { formatCountdown, formatExpiryShort } from './series'
import './market.css'

type CheckState = 'pending' | 'ok' | 'fail' | 'unknown'

/** Terms of an offer as key/value rows. Shared by the live ticket and the disconnected ticket. */
export function TermsList({ offer }: { offer: OptionOffer }) {
  const u = offer.underlying
  const q = offer.quote
  const premium = formatDisplay(offer.totalPremium, q.decimals)
  return (
    <dl className="ui-kv">
      <div>
        <dt>Qty</dt>
        <dd className="num">
          {formatDisplay(offer.underlyingQty, u.decimals)} {u.code}
        </dd>
      </div>
      <div>
        <dt>Strike</dt>
        <dd className="num">
          {strikePerUnit(offer)} {q.code} per {u.code}, {formatDisplay(offer.totalStrike, q.decimals)} {q.code} total
        </dd>
      </div>
      <div>
        <dt>Expiry</dt>
        <dd>
          {formatExpiryShort(offer.expiry)} <span className="mk-muted">{formatCountdown(offer.expiry)}</span>
        </dd>
      </div>
      <div>
        <dt>Premium</dt>
        <dd className="num">
          {premiumUnit(offer)} {q.code} per {u.code}, {premium} {q.code} total
          <span className="mk-note">Paid to the maker now. Not refundable.</span>
        </dd>
      </div>
      <div>
        <dt>Maker</dt>
        <dd>
          <Mono>{shortAddress(offer.writer)}</Mono>
        </dd>
      </div>
    </dl>
  )
}

/**
 * Contents of the buy flow: pre-trade checks, payoff, warnings, the checkbox gate and the confirmed contract note.
 * Rendered by BuyDialog, either in the Markets ticket column or inside a Dialog.
 */
export function BuyTicket({
  offer,
  client,
  me,
  health = [],
  onConfirm,
  onClose,
  onOutcomeShown,
  submittingRef,
  inline,
}: {
  offer: OptionOffer
  client: OptionsClient
  me: string | null
  health?: CollateralHealth[]
  onConfirm: () => Promise<TxOutcome | null>
  /** Leaves the ticket (cancel or done). */
  onClose: () => void
  onOutcomeShown?: () => void
  /** Set while a purchase is being signed, so the wrapper does not close mid-transaction. */
  submittingRef: MutableRefObject<boolean>
  /** True in the Markets ticket column; false inside a Dialog. */
  inline: boolean
}) {
  const [openCheck, setOpenCheck] = useState<CheckState>('pending')
  const [eligCheck, setEligCheck] = useState<CheckState>(me ? 'pending' : 'unknown')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hash: string; mock: boolean } | null>(null)
  // "Assumed price": a what-if input, never a market price (the contract has no oracle). Defaults to the strike.
  const strikeNum = strikeOf(legOf(offer))
  const [assumedText, setAssumedText] = useState(() => String(Number(strikeNum.toFixed(4))))
  const parsed = Number(assumedText)
  const assumed = Number.isFinite(parsed) && parsed > 0 ? parsed : strikeNum

  // Re-fetch the offer on open: it may have been bought or may have expired meanwhile.
  useEffect(() => {
    let live = true
    client
      .getOption(offer.id)
      .then((o) => live && setOpenCheck(o.state === 'offered' && o.expiry * 1000 > Date.now() ? 'ok' : 'fail'))
      .catch(() => live && setOpenCheck('unknown')) // unknown: do not block
    return () => {
      live = false
    }
  }, [client, offer.id])

  useEffect(() => {
    if (!me) return
    let live = true
    client
      .isEligible(offer.underlying.contractId, me)
      .then((ok) => live && setEligCheck(ok ? 'ok' : 'fail'))
      .catch(() => live && setEligCheck('unknown')) // unknown: do not block
    return () => {
      live = false
    }
  }, [client, me, offer.underlying.contractId])

  const u = offer.underlying
  const q = offer.quote
  const tokens = useMemo(() => [offer.underlying, offer.quote], [offer.underlying, offer.quote])
  const { balances } = useBalances(me, tokens)
  const feasibility = exerciseFeasibility(offer, balances[u.contractId], balances[q.contractId])
  const quoteBal = balances[q.contractId]
  const cannotPay = premiumUnaffordable(offer, quoteBal)
  const premium = formatDisplay(offer.totalPremium, q.decimals)
  const blocked = openCheck === 'fail' || eligCheck === 'fail' || cannotPay
  const short = shortfallFor(offer, health)
  const risk = riskLines(offer, assumed)

  const confirm = async () => {
    setSubmitting(true)
    submittingRef.current = true
    setError(null)
    try {
      const res = await onConfirm()
      if (res?.ok) {
        setDone({ hash: res.hash, mock: res.mock })
        // The contract note already shows the tx, so the app drops its duplicate toast.
        onOutcomeShown?.()
      } else setError(res?.error ?? 'The purchase could not be submitted.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const goPortfolio = () => {
    window.location.hash = '#/portfolio'
    onClose()
  }

  if (done) {
    return (
      <div className="tk-body">
        <p className="mk-done">Bought. Position {offer.id.toString()}</p>
        <dl className="ui-kv">
          <div>
            <dt>Contract</dt>
            <dd>
              {u.code} {offer.kind}, strike {strikePerUnit(offer)} {q.code}, {formatExpiryShort(offer.expiry)}
            </dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd className="num">
              {formatDisplay(offer.underlyingQty, u.decimals)} {u.code}
            </dd>
          </div>
          <div>
            <dt>Premium paid</dt>
            <dd className="num">
              {premium} {q.code}
            </dd>
          </div>
          <div>
            <dt>Maker</dt>
            <dd>
              <Mono>{shortAddress(offer.writer)}</Mono>
            </dd>
          </div>
          {done.hash && (
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
          )}
        </dl>
        <div className="tk-actions">
          <Button variant="secondary" onClick={onClose}>
            {inline ? 'Done' : 'Back to markets'}
          </Button>
          <Button variant="primary" onClick={goPortfolio}>
            View in positions
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="tk-body">
      <TermsList offer={offer} />
      <dl className="ui-kv tk-checks">
        <div>
          <dt>Offer</dt>
          <dd className={openCheck === 'fail' ? 'mk-bad' : undefined}>
            {openCheck === 'ok' && 'Open'}
            {openCheck === 'pending' && 'Checking'}
            {openCheck === 'fail' && 'No longer open. Pick another offer.'}
            {openCheck === 'unknown' && 'Could not re-check. The contract rejects the purchase if it is gone.'}
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
      <p className="tk-settle">{settlementLine(offer)}</p>

      <section className="po-section" aria-label="Payoff">
        <label className="po-label" htmlFor={`assumed-price-${offer.id}`}>
          Assumed price ({q.code} per {u.code})
        </label>
        <div className="po-controls-row">
          <input
            type="range"
            aria-label="Assumed price slider"
            min={strikeNum * 0.5}
            max={strikeNum * 1.5}
            step={strikeNum / 200}
            value={Math.min(Math.max(assumed, strikeNum * 0.5), strikeNum * 1.5)}
            onChange={(e) => setAssumedText(String(Number(Number(e.target.value).toFixed(4))))}
          />
          <input
            id={`assumed-price-${offer.id}`}
            className="po-num"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={assumedText}
            onChange={(e) => setAssumedText(e.target.value)}
          />
        </div>
        <PayoffChart offer={offer} assumed={assumed} />
        <dl className="ui-kv">
          <div>
            <dt>Break-even</dt>
            <dd className="num">
              {fmtNum(risk.breakeven)} {q.code} per {u.code}
            </dd>
          </div>
          <div>
            <dt>Max loss</dt>
            <dd className="num">
              {fmtNum(risk.maxLoss)} {q.code}
            </dd>
          </div>
          <div>
            <dt>Max gain</dt>
            <dd className="num">{risk.maxGain === null ? 'Unlimited' : `${fmtNum(risk.maxGain)} ${q.code}`}</dd>
          </div>
          <div>
            <dt>P&amp;L at {fmtNum(assumed)}</dt>
            <dd className="num" data-testid="pnl-at-assumed">
              {fmtSigned(risk.pnlAtAssumed)} {q.code}
            </dd>
          </div>
        </dl>
      </section>

      <p className="mk-muted mk-issuer">
        The issuer controls this asset and can freeze or claw it back, which can block settlement. Collateral does not cover that.
      </p>

      {short.map((t) => (
        <ShortfallBanner key={t.contractId} token={t} />
      ))}
      {feasibility.level === 'warn' && <Banner tone="warn">{feasibility.message}</Banner>}
      {cannotPay && quoteBal?.balance != null && (
        <Banner tone="danger">
          Need {premium} {q.code}, wallet has {formatDisplay(quoteBal.balance, q.decimals)}.
        </Banner>
      )}
      {error && <Banner tone="danger">{error}</Banner>}

      <label className="mk-agree">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={submitting} />
        <span>I understand the terms above.</span>
      </label>

      <div className="tk-actions">
        <Button variant="secondary" onClick={onClose} disabled={submitting} aria-label="Cancel purchase">
          Cancel
        </Button>
        <Button variant="primary" loading={submitting} disabled={!agreed || blocked} onClick={() => void confirm()}>
          {submitting ? 'Confirm in wallet…' : `Buy for ${premium} ${q.code}`}
        </Button>
      </div>
    </div>
  )
}
