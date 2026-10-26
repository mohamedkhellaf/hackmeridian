import { useEffect, useMemo, useState } from 'react'
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
import { Banner, Button, Dialog, Mono } from '../ui'
import { formatCountdown, formatExpiryShort } from './series'
import './market.css'

type CheckState = 'pending' | 'ok' | 'fail' | 'unknown'

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
  /** Called when this dialog displays the successful outcome itself, so the app can drop the duplicate toast. */
  onOutcomeShown?: () => void
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
  const quoteBal = balances[q.contractId]
  const cannotPay = premiumUnaffordable(offer, quoteBal)
  const kind = offer.kind === 'put' ? 'Put' : 'Call'
  const premium = formatDisplay(offer.totalPremium, q.decimals)
  // Display only, exact in bigint: premium per one unit of underlying.
  const premiumUnit =
    offer.underlyingQty === 0n ? '–' : formatDisplay((offer.totalPremium * 10n ** BigInt(u.decimals)) / offer.underlyingQty, q.decimals)
  const blocked = openCheck === 'fail' || eligCheck === 'fail' || cannotPay
  const short = shortfallFor(offer, health)
  const risk = riskLines(offer, assumed)
  const title = `Buy ${u.code} ${offer.kind}`

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
      // The confirmed step already shows the tx, so the app drops its duplicate toast (phones and desktop).
      onOutcomeShown?.()
    } else setError(res?.error ?? 'The purchase could not be submitted.')
  }

  const goPortfolio = () => {
    window.location.hash = '#/portfolio'
    onCancel()
  }

  if (done) {
    return (
      <Dialog
        title={title}
        width={460}
        onClose={onCancel}
        footer={
          <>
            <Button variant="secondary" onClick={onCancel}>
              Back to markets
            </Button>
            <Button variant="primary" onClick={goPortfolio}>
              View in positions
            </Button>
          </>
        }
      >
        <p className="mk-done">Bought. Position {offer.id.toString()}</p>
        {done.hash && (
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
        )}
      </Dialog>
    )
  }

  return (
    <Dialog
      title={title}
      width={520}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting} aria-label="Cancel purchase">
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} disabled={!agreed || blocked} onClick={() => void confirm()}>
            {submitting ? 'Confirm in wallet…' : `Buy for ${premium} ${q.code}`}
          </Button>
        </>
      }
    >
      <dl className="ui-kv">
        <div>
          <dt>Underlying</dt>
          <dd>{u.code}</dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{kind}</dd>
        </div>
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
            {premiumUnit} {q.code} per {u.code}, {premium} {q.code} total
            <span className="mk-note">Paid to the maker now. Not refundable.</span>
          </dd>
        </div>
        <div>
          <dt>Maker</dt>
          <dd>
            <Mono>{shortAddress(offer.writer)}</Mono>
          </dd>
        </div>
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

      <section className="po-section" aria-label="Payoff">
        <label className="po-label" htmlFor="assumed-price">
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
    </Dialog>
  )
}
