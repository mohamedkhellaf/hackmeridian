import { useEffect, useId, useRef } from 'react'
import type { OptionOffer } from '../options/types'
import { requiredCollateral } from '../options/types'
import { formatAmount, formatExpiry, shortAddress } from '../options/format'

export function BuyDialog({ offer, onConfirm, onCancel }: { offer: OptionOffer; onConfirm: () => void; onCancel: () => void }) {
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
          Physically settled. Issuer controls on regulated assets (freeze, clawback) can block settlement; the collateral lock does not protect against issuer
          action.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary" ref={cancelRef} onClick={onCancel} aria-label="Cancel purchase">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} aria-label="Confirm purchase and sign transaction">
            Confirm purchase
          </button>
        </div>
      </div>
    </div>
  )
}
