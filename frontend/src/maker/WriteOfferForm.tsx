import { useEffect, useState } from 'react'
import type { OptionsClient } from '../options/client'
import type { FormEvent } from 'react'
import { formatAmount } from '../options/format'
import { buildOffer } from './buildOffer'
import { requiredCollateral } from '../options/types'
import type { NewOffer, OptionKind, SupportedAssets } from '../options/types'

const DAY = 86400

function defaultExpiry(): string {
  // datetime-local wants local time without zone: YYYY-MM-DDTHH:mm
  const d = new Date(Date.now() + 3 * DAY * 1000)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function WriteOfferForm({
  assets,
  client,
  me,
  disabled,
  onSubmit,
}: {
  assets: SupportedAssets
  client: OptionsClient
  me: string | null
  disabled: boolean
  onSubmit: (offer: NewOffer) => Promise<boolean>
}) {
  const [kind, setKind] = useState<OptionKind>('put')
  const [underlyingId, setUnderlyingId] = useState(assets.underlyings[0]?.contractId ?? '')
  const [qty, setQty] = useState('5')
  const [strike, setStrike] = useState('10')
  const [premium, setPremium] = useState('2')
  const [expiry, setExpiry] = useState(defaultExpiry)
  const [submitting, setSubmitting] = useState(false)

  const eligKey = me ? `${underlyingId}:${me}` : null
  const [elig, setElig] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!me || !eligKey || !underlyingId) return
    let live = true
    client
      .isEligible(underlyingId, me)
      .then((ok) => live && setElig({ key: eligKey, ok }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, me, eligKey, underlyingId])
  const notEligible = elig !== null && elig.key === eligKey && !elig.ok

  const draft = buildOffer(assets, { kind, underlyingId, qty, strike, premium, expiry })
  const collateral = 'offer' in draft ? requiredCollateral({ ...draft.offer, quote: assets.quote }) : null
  const underlyingCode = assets.underlyings.find((u) => u.contractId === underlyingId)?.code ?? ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!('offer' in draft)) return
    setSubmitting(true)
    const ok = await onSubmit(draft.offer)
    setSubmitting(false)
    if (ok) setExpiry(defaultExpiry())
  }

  return (
    <form className="card form" onSubmit={(e) => void submit(e)}>
      <h2>Write an option</h2>
      <p className="hint">
        You are the writer. The contract locks your collateral now; a buyer pays you the premium at purchase (it is yours immediately and not refunded) and gets the right to{' '}
        {kind === 'put' ? `sell you ${underlyingCode} at the strike` : `buy your ${underlyingCode} at the strike`} until expiry.
      </p>

      <div className="segmented" role="radiogroup" aria-label="Option type">
        {(['put', 'call'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'seg active' : 'seg'} onClick={() => setKind(k)}>
            {k === 'put' ? 'Cash-secured PUT' : 'Covered CALL'}
          </button>
        ))}
      </div>

      <label>
        Underlying
        <select value={underlyingId} onChange={(e) => setUnderlyingId(e.target.value)}>
          {assets.underlyings.map((u) => (
            <option key={u.contractId} value={u.contractId}>
              {u.code}
            </option>
          ))}
        </select>
      </label>
      {notEligible && (
        <p className="form-error" role="alert">
          Your account is not authorized by this asset's issuer; the transaction will likely fail with NotEligible.
        </p>
      )}
      <label>
        Quantity ({underlyingCode})
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      <label>
        Strike per {underlyingCode} ({assets.quote.code})
        <input inputMode="decimal" value={strike} onChange={(e) => setStrike(e.target.value)} />
      </label>
      <label>
        Premium, total ({assets.quote.code})
        <input inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} />
      </label>
      <label>
        Expiry
        <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </label>

      {'error' in draft ? (
        <p className="form-error">{draft.error}</p>
      ) : (
        <dl className="summary">
          <dt>Total strike</dt>
          <dd>
            {formatAmount(draft.offer.totalStrike, assets.quote.decimals)} {assets.quote.code}
          </dd>
          <dt>Collateral locked now</dt>
          <dd>
            <strong>
              {formatAmount(collateral!.amount, collateral!.token.decimals)} {collateral!.token.code}
            </strong>
          </dd>
          <dt>Premium you receive at purchase</dt>
          <dd>
            {formatAmount(draft.offer.totalPremium, assets.quote.decimals)} {assets.quote.code}
          </dd>
        </dl>
      )}

      <button type="submit" disabled={disabled || submitting || 'error' in draft}>
        {submitting ? 'Locking collateral…' : 'Lock collateral & publish offer'}
      </button>
    </form>
  )
}
