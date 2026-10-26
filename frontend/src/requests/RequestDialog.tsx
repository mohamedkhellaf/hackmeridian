import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { buildOffer } from '../maker/buildOffer'
import '../maker/write.css'
import type { OptionsClient } from '../options/client'
import { formatExpiry } from '../options/format'
import type { OptionKind, SupportedAssets } from '../options/types'
import { nowMs } from '../portfolio/positions'
import type { TxOutcome } from '../state/runTx'
import { Banner, Button, Dialog, Segmented } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { amt, perUnit } from './requests'
import { MAX_OPEN_BIDS_PER_BUYER } from './types'
import type { NewBid } from './types'

const DEFAULT_TENOR_MS = 3 * 86400 * 1000
const KINDS = [
  { value: 'put' as const, label: 'Put' },
  { value: 'call' as const, label: 'Call' },
]

/** datetime-local wants local time without zone: YYYY-MM-DDTHH:mm */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Buyer posts a funded request (bid) with their own terms. Same term inputs and validation as Write. */
export function RequestDialog({
  assets,
  client,
  me,
  busy,
  onSubmit,
  onClose,
}: {
  assets: SupportedAssets
  client: OptionsClient
  me: string
  busy: boolean
  onSubmit: (bid: NewBid) => Promise<TxOutcome>
  onClose: () => void
}) {
  const [kind, setKind] = useState<OptionKind>('put')
  const [underlyingId, setUnderlyingId] = useState(assets.underlyings[0]?.contractId ?? '')
  const [qty, setQty] = useState('5')
  const [strike, setStrike] = useState('10')
  const [premium, setPremium] = useState('2')
  const [expiry, setExpiry] = useState(() => toLocalInput(nowMs() + DEFAULT_TENOR_MS))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [elig, setElig] = useState<{ key: string; ok: boolean } | null>(null)
  const eligKey = `${underlyingId}:${me}`
  useEffect(() => {
    let live = true
    client
      .isEligible(underlyingId, me)
      .then((ok) => live && setElig({ key: eligKey, ok }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, me, underlyingId, eligKey])
  const eligible = elig?.key === eligKey ? elig.ok : null

  const [openCount, setOpenCount] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    client
      .buyerOpenCount(me)
      .then((n) => live && setOpenCount(n))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, me])

  const tokens = useMemo(() => [assets.quote], [assets.quote])
  const { balances } = useBalances(me, tokens)
  const quoteBal = balances[assets.quote.contractId]
  const bal = quoteBal && quoteBal.status === 'ok' ? quoteBal.balance : null

  const draft = buildOffer(assets, { kind, underlyingId, qty, strike, premium, expiry })
  const bid = 'offer' in draft ? draft.offer : null
  const underlyingCode = assets.underlyings.find((u) => u.contractId === underlyingId)?.code ?? ''
  const q = assets.quote
  const short = bid !== null && bal !== null && bal < bid.totalPremium

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!bid) return
    setSubmitting(true)
    setError(null)
    const res = await onSubmit(bid)
    setSubmitting(false)
    if (res.ok) onClose()
    else setError(res.error)
  }

  const formId = 'request-form'
  return (
    <Dialog
      title="Request an option"
      width={520}
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={submitting} disabled={busy || !bid || short}>
            {bid ? `Post request, escrow ${amt(bid.totalPremium, q)}` : 'Post request'}
          </Button>
        </>
      }
    >
      <form id={formId} className="wr" onSubmit={(e) => void submit(e)}>
        <p className="rq-lead">You set the price. A maker who accepts your terms fills the request and becomes the writer.</p>
        <div className="wr-fields">
          <div className="wr-field">
            <span className="wr-label">Kind</span>
            <Segmented label="Kind" options={KINDS} value={kind} onChange={setKind} />
          </div>
          <label className="wr-field">
            <span className="wr-label">Asset</span>
            <span className="wr-input">
              <select aria-label="Asset" value={underlyingId} onChange={(e) => setUnderlyingId(e.target.value)}>
                {assets.underlyings.map((u) => (
                  <option key={u.contractId} value={u.contractId}>
                    {u.code}
                  </option>
                ))}
              </select>
              <span className="wr-unit" aria-hidden="true" />
            </span>
          </label>
          <label className="wr-field">
            <span className="wr-label">Quantity</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Quantity (${underlyingCode})`} value={qty} onChange={(e) => setQty(e.target.value)} />
              <span className="wr-unit">{underlyingCode}</span>
            </span>
          </label>
          <label className="wr-field">
            <span className="wr-label">Strike per {underlyingCode}</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Strike per ${underlyingCode} (${q.code})`} value={strike} onChange={(e) => setStrike(e.target.value)} />
              <span className="wr-unit">{q.code}</span>
            </span>
          </label>
          <label className="wr-field">
            <span className="wr-label">Premium you offer, total</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Premium you offer, total (${q.code})`} value={premium} onChange={(e) => setPremium(e.target.value)} />
              <span className="wr-unit">{q.code}</span>
            </span>
          </label>
          <label className="wr-field">
            <span className="wr-label">Expiry</span>
            <span className="wr-input">
              <input type="datetime-local" aria-label="Expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              <span className="wr-unit" aria-hidden="true" />
            </span>
          </label>
        </div>

        {bid && (
          <dl className="ui-kv">
            <div>
              <dt>Total strike</dt>
              <dd>{amt(bid.totalStrike, q)}</dd>
            </div>
            <div>
              <dt>Premium offered</dt>
              <dd>
                {amt(bid.totalPremium, q)} ({perUnit(bid.totalPremium, { ...bid, quote: q })} per {underlyingCode})
              </dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>{formatExpiry(bid.expiry)}</dd>
            </div>
          </dl>
        )}
        {bid && (
          <p className="rq-escrow" data-testid="escrow-line">
            You escrow {amt(bid.totalPremium, q)} now; refunded if you cancel or the request expires.
          </p>
        )}
        {'error' in draft && <p className="wr-error">{draft.error}</p>}
        {short && bid && bal !== null && (
          <Banner tone="danger">
            Need {amt(bid.totalPremium, q)}, wallet has {amt(bal, q)}.
          </Banner>
        )}
        {eligible === false && <Banner tone="warn">The {underlyingCode} issuer has not authorized your account, so you could not exercise this option.</Banner>}
        {openCount !== null && openCount >= MAX_OPEN_BIDS_PER_BUYER && (
          <Banner tone="warn">You already have {openCount} open requests. Cancel one or wait for one to fill or expire.</Banner>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
      </form>
    </Dialog>
  )
}
