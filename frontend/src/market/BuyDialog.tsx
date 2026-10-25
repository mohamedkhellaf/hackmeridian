import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { config, explorerTx } from '../config'
import type { OptionsClient } from '../options/client'
import type { OptionOffer } from '../options/types'
import { requiredCollateral } from '../options/types'
import { formatAmount, formatExpiry, shortAddress, strikePerUnit } from '../options/format'
import type { TxOutcome } from '../state/useStrata'
import { AssetBadge, Button, Dialog, Icon, Mono, Tag } from '../ui'
import './market.css'

type CheckState = 'pending' | 'ok' | 'fail' | 'unknown'

function Check({ state, children }: { state: CheckState; children: ReactNode }) {
  return (
    <li className={`mk-check mk-check--${state}`}>
      <span className="mk-check-icon" aria-hidden="true">
        {state === 'ok' && <Icon name="check" size={16} strokeWidth={1.8} />}
        {state === 'fail' && <Icon name="alert" size={16} strokeWidth={1.6} />}
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
  onConfirm,
  onCancel,
}: {
  offer: OptionOffer
  client: OptionsClient
  me: string | null
  /** Runs the purchase; resolves with the outcome (the hook keeps this dialog mounted). */
  onConfirm: () => Promise<TxOutcome | null>
  onCancel: () => void
}) {
  const [openCheck, setOpenCheck] = useState<CheckState>('pending')
  const [eligCheck, setEligCheck] = useState<CheckState>(me ? 'pending' : 'unknown')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ hash: string; mock: boolean } | null>(null)
  const agreeRef = useRef<HTMLInputElement>(null)

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
  const qty = `${formatAmount(offer.underlyingQty, u.decimals)} ${u.code}`
  const strike = `${formatAmount(offer.totalStrike, q.decimals)} ${q.code}`
  const premium = formatAmount(offer.totalPremium, q.decimals)
  const col = requiredCollateral(offer)
  const locked = `${formatAmount(col.amount, col.token.decimals)} ${col.token.code} locked`
  const kindWord = offer.kind === 'put' ? 'sell' : 'buy'
  const blocked = openCheck === 'fail' || eligCheck === 'fail'
  const where = client.isMock ? 'in the mock contract' : 'on-chain'

  const close = () => {
    if (!submitting) onCancel()
  }

  const confirm = async () => {
    setSubmitting(true)
    setError(null)
    const res = await onConfirm()
    setSubmitting(false)
    if (res?.ok) setDone({ hash: res.hash, mock: res.mock })
    else setError(res?.error ?? 'The purchase could not be submitted.')
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
          <h3 className="mk-done-title">
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
            aria-label="Confirm in wallet: confirm purchase and sign transaction"
          >
            {submitting ? 'Waiting for wallet…' : 'Confirm in wallet'}
          </Button>
        </>
      }
    >
      <div className="mk-review-head">
        <AssetBadge code={u.code} size={38} />
        <div>
          <div className="mk-review-title">
            Buy {u.code} <Tag tone={offer.kind}>{offer.kind.toUpperCase()}</Tag>
          </div>
          <div className="mk-muted-sm">
            Strike {strikePerUnit(offer)} {q.code} · Expires {formatExpiry(offer.expiry)}
          </div>
        </div>
      </div>

      <div className="mk-hero">
        <span className="mk-label">You pay now</span>
        <span className="mk-hero-amount">
          {premium} <span className="mk-hero-unit">{q.code}</span>
        </span>
        <span className="mk-muted mk-hero-note">
          For the right to {kindWord} <b>{qty}</b> for <b>{strike}</b> at any time until expiry.
        </span>
      </div>

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

      {error && (
        <p className="mk-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  )
}
