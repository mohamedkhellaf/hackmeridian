import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { config, explorerTx } from '../config'
import type { OptionsClient } from '../options/client'
import type { CollateralHealth, OptionOffer } from '../options/types'
import { requiredCollateral } from '../options/types'
import { formatDisplay, formatExpiry, shortAddress, strikePerUnit } from '../options/format'
import { exerciseFeasibility, premiumUnaffordable } from '../options/feasibility'
import { useBalances } from '../wallet/useBalances'
import { PayoffChart } from '../payoff/PayoffChart'
import { fmtNum, fmtSigned, riskLines, strikeOf, legOf } from '../payoff/buyerPayoff'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallBanner } from '../reserves/ShortfallWarning'
import type { TxOutcome } from '../state/useStrata'
import { Button, Dialog, Icon, Mono, PayoffSketch, Sediment, Tag } from '../ui'
import './market.css'

type CheckState = 'pending' | 'ok' | 'fail' | 'unknown' | 'warn'

function Check({ state, children }: { state: CheckState; children: ReactNode }) {
  return (
    <li className={`mk-check mk-check--${state}`}>
      <span className="mk-check-icon" aria-hidden="true">
        {state === 'ok' && <Icon name="check" size={16} strokeWidth={1.8} />}
        {(state === 'fail' || state === 'warn') && <Icon name="alert" size={16} strokeWidth={1.6} />}
        {(state === 'pending' || state === 'unknown') && <span className="mk-check-dot" />}
      </span>
      <span>{children}</span>
    </li>
  )
}

export function BuyDialog({
  offer,
  client,
  me,
  health = [],
  onConfirm,
  onCancel,
  onOutcomeShown,
}: {
  offer: OptionOffer
  client: OptionsClient
  me: string | null
  /** Reserved vs held per token; a token with held < reserved shows the clawback shortfall warning. */
  health?: CollateralHealth[]
  /** Runs the purchase; resolves with the outcome (the hook keeps this dialog mounted). */
  onConfirm: () => Promise<TxOutcome | null>
  onCancel: () => void
  /** Called when this dialog displays the successful outcome itself (bottom sheet), so the app can drop the duplicate toast. */
  onOutcomeShown?: () => void
}) {
  const [openCheck, setOpenCheck] = useState<CheckState>('pending')
  const [eligCheck, setEligCheck] = useState<CheckState>(me ? 'pending' : 'unknown')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hash: string; mock: boolean } | null>(null)
  const agreeRef = useRef<HTMLInputElement>(null)
  // "Assumed price": a what-if input, never a market price (the contract has no oracle). Defaults to the strike.
  const strikeNum = strikeOf(legOf(offer))
  const [assumedText, setAssumedText] = useState(() => String(Number(strikeNum.toFixed(4))))
  const parsed = Number(assumedText)
  const assumed = Number.isFinite(parsed) && parsed > 0 ? parsed : strikeNum

  // Re-fetch the offer when the dialog opens: it may have been bought or may have expired meanwhile.
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
  const cannotPay = premiumUnaffordable(offer, balances[q.contractId])
  const qty = `${formatDisplay(offer.underlyingQty, u.decimals)} ${u.code}`
  const strike = `${formatDisplay(offer.totalStrike, q.decimals)} ${q.code}`
  const premium = formatDisplay(offer.totalPremium, q.decimals)
  const col = requiredCollateral(offer)
  const locked = `${formatDisplay(col.amount, col.token.decimals)} ${col.token.code} locked`
  const kindWord = offer.kind === 'put' ? 'sell' : 'buy'
  const blocked = openCheck === 'fail' || eligCheck === 'fail' || cannotPay
  const short = shortfallFor(offer, health)
  const risk = riskLines(offer, assumed)
  const where = client.isMock ? 'in the mock contract' : 'on-chain'

  const close = () => {
    if (!submitting) onCancel()
  }

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    const res = await onConfirm()
    setSubmitting(false)
    if (res?.ok) {
      setDone({ hash: res.hash, mock: res.mock })
      // On phones the confirmation is a bottom sheet that already shows the tx; the toast would overlap it.
      if (window.matchMedia('(max-width: 640px)').matches) onOutcomeShown?.()
    } else setError(res?.error ?? 'The purchase could not be submitted.')
  }

  const goPortfolio = () => {
    window.location.hash = '#/portfolio'
    onCancel()
  }

  if (done) {
    return (
      <Dialog
        title="Purchase confirmed"
        width={460}
        onClose={onCancel}
        footer={
          <>
            <Button variant="secondary" onClick={onCancel}>
              Back to markets
            </Button>
            <Button variant="primary" onClick={goPortfolio}>
              View in portfolio
            </Button>
          </>
        }
      >
        <div className="mk-done">
          <span className="mk-done-icon" aria-hidden="true">
            <Icon name="check" size={24} strokeWidth={2} />
          </span>
          <h3 className="mk-done-title ui-display">
            You hold a {u.code} {offer.kind}
          </h3>
          <p className="mk-muted">
            You can {kindWord} {qty} for {strike} at any time until {formatExpiry(offer.expiry)}.
          </p>
        </div>
        <dl className="mk-rows">
          <div>
            <dt>Premium paid</dt>
            <dd>
              {premium} {q.code}
            </dd>
          </div>
          <div>
            <dt>Maker</dt>
            <dd>
              <Mono>{shortAddress(offer.writer)}</Mono>
            </dd>
          </div>
          <div>
            <dt>Collateral</dt>
            <dd>{locked}</dd>
          </div>
          <div>
            <dt>Transaction</dt>
            <dd>
              {done.mock ? (
                <Mono>{done.hash.slice(0, 12)}… (mock)</Mono>
              ) : (
                <a className="ui-mono" href={explorerTx(done.hash)} target="_blank" rel="noreferrer">
                  {done.hash.slice(0, 12)}… <Icon name="external" size={12} />
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
      title="Review purchase"
      width={520}
      onClose={close}
      initialFocusRef={agreeRef}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting} aria-label="Cancel purchase">
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={!agreed || blocked}
            onClick={() => void confirm()}
          >
            {submitting ? 'Confirm in wallet…' : `Sign and buy for ${premium} ${q.code}`}
          </Button>
        </>
      }
    >
      <div className="mk-review-head">
        <div className="mk-thumb mk-thumb--sm">
          <Sediment seed={u.code} size="thumb" tone={offer.kind === 'put' ? 'amber' : 'blue'} />
        </div>
        <div className="mk-review-main">
          <div className="mk-review-title">
            <span className="mk-code">{u.code}</span> <Tag tone={offer.kind}>{offer.kind.toUpperCase()}</Tag>
          </div>
          <div className="mk-muted-sm">
            Strike {strikePerUnit(offer)} {q.code} · Expires {formatExpiry(offer.expiry)}
          </div>
        </div>
        <PayoffSketch kind={offer.kind} strikeLabel={strikePerUnit(offer)} asset={u.code} compact className="mk-payoff" />
      </div>

      <div className="mk-hero">
        <span className="mk-label">You pay now</span>
        <span className="mk-hero-amount ui-num">
          {premium} <span className="mk-hero-unit">{q.code}</span>
        </span>
        <span className="mk-muted mk-hero-note">
          For the right to {kindWord} <b>{qty}</b> for <b>{strike}</b> at any time until expiry.
        </span>
      </div>

      {short.map((t) => (
        <ShortfallBanner key={t.contractId} token={t} />
      ))}

      <section className="po-section" aria-label="Payoff and risk">
        <span className="mk-label">If you hold to expiry</span>
        <div className="po-controls">
          <label className="mk-label" htmlFor="assumed-price">
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
              id="assumed-price"
              className="po-num"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={assumedText}
              onChange={(e) => setAssumedText(e.target.value)}
            />
          </div>
          <span className="po-hint">A what-if value you choose, starting at the strike. The contract has no oracle: this is not a market price.</span>
        </div>
        <PayoffChart offer={offer} assumed={assumed} />
        <dl className="mk-rows po-risk">
          <div>
            <dt>Premium (max loss)</dt>
            <dd>
              {fmtNum(risk.maxLoss)} {q.code} · {fmtNum(risk.premiumPerUnit)} / {u.code}
            </dd>
          </div>
          <div>
            <dt>Break-even</dt>
            <dd>
              {fmtNum(risk.breakeven)} {q.code} / {u.code}
            </dd>
          </div>
          <div>
            <dt>Max gain</dt>
            <dd>{risk.maxGain === null ? 'Unlimited' : `${fmtNum(risk.maxGain)} ${q.code}`}</dd>
          </div>
          <div>
            <dt>P&amp;L at assumed price {fmtNum(assumed)} (hypothetical)</dt>
            <dd className={risk.pnlAtAssumed >= 0 ? 'po-pos' : 'po-neg'} data-testid="pnl-at-assumed">
              {fmtSigned(risk.pnlAtAssumed)} {q.code}
            </dd>
          </div>
        </dl>
      </section>

      <dl className="mk-rows">
        <div>
          <dt>Maker</dt>
          <dd>
            <Mono>{shortAddress(offer.writer)}</Mono>
          </dd>
        </div>
        <div>
          <dt>Collateral backing this option</dt>
          <dd>
            {locked}
            {config.optionsContractId && (
              <a className="mk-verify" href={`https://stellar.expert/explorer/testnet/contract/${config.optionsContractId}`} target="_blank" rel="noreferrer">
                Verify <Icon name="external" size={12} />
              </a>
            )}
          </dd>
        </div>
        <div>
          <dt>Exercise window</dt>
          <dd>Now → {formatExpiry(offer.expiry)}</dd>
        </div>
        <div>
          <dt>Settlement</dt>
          <dd>Physical, atomic delivery vs payment</dd>
        </div>
        <div>
          <dt>Network fee</dt>
          <dd className="mk-muted">Shown in your wallet before signing</dd>
        </div>
      </dl>

      <div className="mk-checks">
        <span className="mk-label">Pre-trade checks</span>
        <ul>
          <Check state={openCheck}>
            {openCheck === 'ok' && `Offer is still open ${where}`}
            {openCheck === 'pending' && 'Checking that the offer is still open…'}
            {openCheck === 'fail' && 'This offer is no longer open. Close this dialog and pick another.'}
            {openCheck === 'unknown' && 'Could not re-check the offer; the contract will reject the purchase if it is gone.'}
          </Check>
          <Check state={eligCheck}>
            {eligCheck === 'ok' && `Your account is authorized by the ${u.code} issuer`}
            {eligCheck === 'pending' && `Checking ${u.code} issuer authorization…`}
            {eligCheck === 'fail' && `Your account is not authorized by the ${u.code} issuer; the purchase would fail with NotEligible.`}
            {eligCheck === 'unknown' && `Could not check ${u.code} issuer authorization.`}
          </Check>
          {feasibility.level === 'warn' && <Check state="warn">{feasibility.message}</Check>}
          <Check state={openCheck === 'ok' ? 'ok' : openCheck === 'fail' ? 'fail' : 'pending'}>
            {openCheck === 'fail' ? 'Collateral is no longer locked for this offer' : 'Collateral is fully locked in the contract'}
          </Check>
        </ul>
      </div>

      <div className="mk-terms">
        <p>Your premium is paid to the maker immediately at purchase. It is not refunded if the option expires worthless or if settlement is blocked by issuer action.</p>
        <p>
          Physically settled. Issuer controls on regulated assets (freeze, clawback) can block settlement; the collateral lock does not protect against issuer
          action.
        </p>
      </div>

      <label className="mk-agree">
        <input ref={agreeRef} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={submitting} />
        <span>I understand the premium is non-refundable and the issuer risks above.</span>
      </label>

      {cannotPay && (
        <p className="mk-error" role="alert">
          Your {q.code} balance is lower than the {premium} {q.code} premium, so this purchase is disabled.
        </p>
      )}

      {error && (
        <p className="mk-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
