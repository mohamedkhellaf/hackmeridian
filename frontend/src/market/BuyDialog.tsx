import { useEffect, useId, useRef, useState } from 'react'
import type { OptionsClient } from '../options/client'
import type { OptionOffer } from '../options/types'
import { requiredCollateral } from '../options/types'
import { formatAmount, formatExpiry, shortAddress } from '../options/format'

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
  onConfirm: () => void
  onCancel: () => void
}) {
  const eligKey = me ? `${offer.underlying.contractId}:${me}` : null
  const [elig, setElig] = useState<{ key: string; ok: boolean } | null>(null)
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    if (!me || !eligKey) return
    let live = true
    client
      .isEligible(offer.underlying.contractId, me)
      .then((ok) => live && setElig({ key: eligKey, ok }))
      .catch(() => undefined) // unknown: do not block
    return () => {
      live = false
    }
  }, [client, me, eligKey, offer.underlying.contractId])
  const notEligible = elig !== null && elig.key === eligKey && !elig.ok

  const u = offer.underlying
  const q = offer.quote
  const qty = `${formatAmount(offer.underlyingQty, u.decimals)} ${u.code}`
  const strike = `${formatAmount(offer.totalStrike, q.decimals)} ${q.code}`
  const col = requiredCollateral(offer)
  const right = offer.kind === 'put' ? `The right to sell ${qty} for ${strike}` : `The right to buy ${qty} for ${strike}`

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>Confirm purchase</h2>
        <dl className="summary">
          <dt>You pay</dt>
          <dd>
            {formatAmount(offer.totalPremium, q.decimals)} {q.code}
          </dd>
          <dt>You get</dt>
          <dd>{right}</dd>
          <dt>Until</dt>
          <dd>{formatExpiry(offer.expiry)}</dd>
          <dt>Writer</dt>
          <dd className="mono">{shortAddress(offer.writer)}</dd>
          <dt>Backed by</dt>
          <dd>
            {formatAmount(col.amount, col.token.decimals)} {col.token.code} locked in the contract
          </dd>
        </dl>
        <p className="hint">
          Your premium is paid to the writer immediately at purchase. It is not refunded if the option expires worthless or if settlement is blocked by
          issuer action.
        </p>
        <p className="hint">
          Physically settled. Issuer controls on regulated assets (freeze, clawback) can block settlement; the collateral lock does not protect against issuer
          action.
        </p>
        {notEligible && (
          <p className="form-error" role="alert">
            Your account is not authorized by the asset issuer; the purchase will fail with NotEligible.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" ref={cancelRef} onClick={onCancel} aria-label="Cancel purchase">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={notEligible} aria-label="Confirm purchase and sign transaction">
            Confirm purchase
          </button>
        </div>
      </div>
    </div>
  )
}
