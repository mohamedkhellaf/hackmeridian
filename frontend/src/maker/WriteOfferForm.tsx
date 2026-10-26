import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { OptionsClient } from '../options/client'
import { formatExpiry } from '../options/format'
import { MAX_OPEN_PER_WRITER, requiredCollateral } from '../options/types'
import type { NewOffer, OptionKind, OptionOffer, SupportedAssets } from '../options/types'
import { money, moneyWith, nowMs } from '../portfolio/positions'
import { Banner, Button, Card, Segmented } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { buildOffer } from './buildOffer'
import { lowestOpenInSeries, premiumPerUnitText } from './lowestOffer'
import './write.css'

const DEFAULT_TENOR_MS = 3 * 86400 * 1000

/** datetime-local wants local time without zone: YYYY-MM-DDTHH:mm */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const KINDS = [
  { value: 'put' as const, label: 'Put' },
  { value: 'call' as const, label: 'Call' },
]

export function WriteOfferForm({
  assets,
  client,
  me,
  disabled,
  onSubmit,
  initial,
  plain,
}: {
  /** Prefill from a series. */
  initial?: Partial<{ kind: OptionKind; underlyingId: string; qty: string; strike: string; premium: string; expiryMs: number }>
  /** Without the card frame (inside a dialog). */
  plain?: boolean
  assets: SupportedAssets
  client: OptionsClient
  me: string | null
  disabled: boolean
  onSubmit: (offer: NewOffer) => Promise<boolean>
}) {
  const [kind, setKind] = useState<OptionKind>(initial?.kind ?? 'put')
  const [underlyingId, setUnderlyingId] = useState(initial?.underlyingId ?? assets.underlyings[0]?.contractId ?? '')
  const [qty, setQty] = useState(initial?.qty ?? '5')
  const [strike, setStrike] = useState(initial?.strike ?? '10')
  const [premium, setPremium] = useState(initial?.premium ?? '2')
  const [expiry, setExpiry] = useState(() => toLocalInput(initial?.expiryMs ?? nowMs() + DEFAULT_TENOR_MS))
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
  const eligible = elig !== null && elig.key === eligKey ? elig.ok : null

  // Open offers, to show the lowest premium in the same series.
  const [listed, setListed] = useState<OptionOffer[]>([])
  useEffect(() => {
    let live = true
    client
      .listOptions()
      .then((l) => live && setListed(l))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client])

  // v1.3+: per-writer cap on open offers. null = unknown or a contract without the cap (v1.2).
  const [openCount, setOpenCount] = useState<{ me: string; n: number } | null>(null)
  const [openTick, setOpenTick] = useState(0)
  useEffect(() => {
    if (!me) return
    let live = true
    client
      .writerOpenCount(me)
      .then((n) => live && setOpenCount(n === null ? null : { me, n }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [client, me, openTick])
  const opened = me && openCount?.me === me ? openCount.n : null
  const atCap = opened !== null && opened >= MAX_OPEN_PER_WRITER

  const tokens = useMemo(() => [assets.quote, ...assets.underlyings], [assets])
  const { balances } = useBalances(me, tokens)

  const draft = buildOffer(assets, { kind, underlyingId, qty, strike, premium, expiry })
  const offer = 'offer' in draft ? draft.offer : null
  const collateral = offer ? requiredCollateral({ ...offer, quote: assets.quote }) : null
  const underlying = assets.underlyings.find((u) => u.contractId === underlyingId)
  const underlyingCode = underlying?.code ?? ''
  const quoteCode = assets.quote.code

  const lowest = offer ? lowestOpenInSeries(listed, offer, assets.quote) : null
  const perUnit = offer ? premiumPerUnitText(offer, assets.quote.decimals) : null

  const balance = collateral ? balances[collateral.token.contractId] : undefined
  const collBalance = balance && balance.status === 'ok' ? balance.balance : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!offer) return
    setSubmitting(true)
    const ok = await onSubmit(offer)
    setSubmitting(false)
    setOpenTick((t) => t + 1)
    if (ok) setExpiry(toLocalInput(nowMs() + DEFAULT_TENOR_MS))
  }

  const form = (
      <form className={plain ? "wr wr--stack" : "wr"} onSubmit={(e) => void submit(e)}>
        <div className="wr-fields">
          <div className="wr-field">
            <span className="wr-label">Kind</span>
            <Segmented label="Kind" options={KINDS} value={kind} onChange={setKind} />
          </div>

          <label className="wr-field">
            <span className="wr-label">Asset</span>
            <span className="wr-input">
              <select value={underlyingId} onChange={(e) => setUnderlyingId(e.target.value)}>
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
              <input inputMode="decimal" aria-label={`Strike per ${underlyingCode} (${quoteCode})`} value={strike} onChange={(e) => setStrike(e.target.value)} />
              <span className="wr-unit">{quoteCode}</span>
            </span>
          </label>

          <label className="wr-field">
            <span className="wr-label">Premium, total</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Premium, total (${quoteCode})`} value={premium} onChange={(e) => setPremium(e.target.value)} />
              <span className="wr-unit">{quoteCode}</span>
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

        <div className="wr-summary" role="group" aria-label="Order summary">
          <dl className="ui-kv">
            <div>
              <dt>Collateral to lock</dt>
              <dd>{collateral ? moneyWith(collateral.amount, collateral.token) : ''}</dd>
            </div>
            <div>
              <dt>Premium received</dt>
              <dd>{offer ? `${moneyWith(offer.totalPremium, assets.quote)} (${perUnit} per ${underlyingCode})` : ''}</dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>{offer ? formatExpiry(offer.expiry) : ''}</dd>
            </div>
            {lowest && (
              <div>
                <dt>Lowest open offer in this series</dt>
                <dd>
                  {premiumPerUnitText(lowest, assets.quote.decimals)} {quoteCode} per {underlyingCode}
                </dd>
              </div>
            )}
            {collateral && collBalance !== null && (
              <div>
                <dt>{collateral.token.code} balance after</dt>
                <dd className={collBalance < collateral.amount ? 'wr-short' : undefined}>
                  {collBalance >= collateral.amount
                    ? money(collBalance - collateral.amount, collateral.token.decimals)
                    : `Need ${moneyWith(collateral.amount, collateral.token)}, wallet has ${money(collBalance, collateral.token.decimals)}`}
                </dd>
              </div>
            )}
          </dl>

          {'error' in draft && <p className="wr-error">{draft.error}</p>}
          {eligible === false && <Banner tone="danger">The {underlyingCode} issuer has not authorized your account. The offer would fail with NotEligible.</Banner>}
          {atCap && (
            <Banner tone="warn">
              You have {opened} of {MAX_OPEN_PER_WRITER} open offers. Cancel one or wait for one to sell or expire.
            </Banner>
          )}

          <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={disabled || !offer || atCap}>
            {kind === 'put' ? 'Write put' : 'Write call'}
          </Button>
        </div>
      </form>
  )
  return plain ? form : <Card>{form}</Card>
}
