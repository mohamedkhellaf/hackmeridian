import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { OptionsClient } from '../options/client'
import { formatExpiry } from '../options/format'
import { requiredCollateral } from '../options/types'
import type { NewOffer, OptionKind, OptionOffer, SupportedAssets } from '../options/types'
import { money, moneyWith, nowMs } from '../portfolio/positions'
import { AssetBadge, Button, Chip, Icon } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { buildOffer } from './buildOffer'
import { lowestOpenInSeries, premiumPerUnitText } from './lowestOffer'
import './write.css'

const DAY = 86400
const PRESETS = [1, 3, 7, 14] as const
type Preset = (typeof PRESETS)[number] | 'custom'

/** datetime-local wants local time without zone: YYYY-MM-DDTHH:mm */
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const KINDS: { kind: OptionKind; title: string; text: (quote: string, asset: string) => string }[] = [
  { kind: 'put', title: 'Cash-secured put', text: (q) => `Lock ${q}. You may have to buy the asset at the strike.` },
  { kind: 'call', title: 'Covered call', text: (_q, a) => `Lock ${a}. You may have to sell it at the strike.` },
]

function Unit({ children }: { children: string }) {
  return <span className="wr-unit">{children}</span>
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
  const [preset, setPreset] = useState<Preset>(3)
  // The moment the chosen preset counts from; refreshed on preset change and after a publish.
  const [anchor, setAnchor] = useState(() => nowMs())
  const [custom, setCustom] = useState(() => toLocalInput(nowMs() + 3 * DAY * 1000))
  const [submitting, setSubmitting] = useState(false)

  const expiry = preset === 'custom' ? custom : toLocalInput(anchor + preset * DAY * 1000)

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

  const balanceOf = (contractId: string): bigint | null => {
    const b = balances[contractId]
    return b && b.status === 'ok' ? b.balance : null
  }
  const collBalance = collateral ? balanceOf(collateral.token.contractId) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!offer) return
    setSubmitting(true)
    const ok = await onSubmit(offer)
    setSubmitting(false)
    if (ok) {
      setAnchor(nowMs())
      setCustom(toLocalInput(nowMs() + 3 * DAY * 1000))
    }
  }

  const pickPreset = (p: Preset) => {
    if (p === 'custom') setCustom(toLocalInput(anchor + (preset === 'custom' ? 0 : preset) * DAY * 1000))
    setAnchor(nowMs())
    setPreset(p)
  }

  const receiveIfExercised = offer
    ? kind === 'put'
      ? moneyWith(offer.underlyingQty, offer.underlying)
      : moneyWith(offer.totalStrike, assets.quote)
    : null

  return (
    <form className="wr" onSubmit={(e) => void submit(e)}>
      <section className="wr-main">
        <div className="wr-kinds" role="radiogroup" aria-label="Option type">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              className={kind === k.kind ? 'wr-kind is-on' : 'wr-kind'}
              onClick={() => setKind(k.kind)}
            >
              <span className="wr-kind-title">{k.title}</span>
              <span className="wr-kind-text">{k.text(quoteCode, underlyingCode)}</span>
            </button>
          ))}
        </div>

        <div className="wr-field" role="radiogroup" aria-label="Underlying asset">
          <span className="wr-label">Underlying asset</span>
          <div className="wr-assets">
            {assets.underlyings.map((u) => {
              const bal = balanceOf(u.contractId)
              return (
                <button
                  key={u.contractId}
                  type="button"
                  role="radio"
                  aria-checked={u.contractId === underlyingId}
                  className={u.contractId === underlyingId ? 'wr-asset is-on' : 'wr-asset'}
                  onClick={() => setUnderlyingId(u.contractId)}
                >
                  <AssetBadge code={u.code} size={26} />
                  <span className="wr-asset-text">
                    <span className="wr-asset-code">{u.code}</span>
                    {bal !== null && <span className="wr-asset-sub">Balance {money(bal, u.decimals)}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="wr-two">
          <label className="wr-field">
            <span className="wr-label">Quantity</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Quantity (${underlyingCode})`} value={qty} onChange={(e) => setQty(e.target.value)} />
              <Unit>{underlyingCode}</Unit>
            </span>
          </label>
          <label className="wr-field">
            <span className="wr-label">Strike per {underlyingCode}</span>
            <span className="wr-input">
              <input inputMode="decimal" aria-label={`Strike per ${underlyingCode} (${quoteCode})`} value={strike} onChange={(e) => setStrike(e.target.value)} />
              <Unit>{quoteCode}</Unit>
            </span>
          </label>
        </div>

        <label className="wr-field">
          <span className="wr-label">Premium you ask, total</span>
          <span className="wr-input">
            <input inputMode="decimal" aria-label={`Premium, total (${quoteCode})`} value={premium} onChange={(e) => setPremium(e.target.value)} />
            <Unit>{quoteCode}</Unit>
          </span>
          {perUnit && (
            <span className="wr-help">
              {perUnit} {quoteCode} per {underlyingCode}.
              {lowest && (
                <>
                  {' '}
                  Lowest open offer in this series: {premiumPerUnitText(lowest, assets.quote.decimals)}.
                </>
              )}
            </span>
          )}
        </label>

        <div className="wr-field">
          <span className="wr-label">Expiry</span>
          <div className="wr-expiry">
            {PRESETS.map((d) => (
              <Chip key={d} selected={preset === d} onClick={() => pickPreset(d)}>
                {d} {d === 1 ? 'day' : 'days'}
              </Chip>
            ))}
            <Chip selected={preset === 'custom'} onClick={() => pickPreset('custom')}>
              Custom
            </Chip>
            {offer && <span className="wr-resolved">{formatExpiry(offer.expiry)}</span>}
          </div>
          {preset === 'custom' && (
            <span className="wr-input wr-input--wide">
              <input type="datetime-local" aria-label="Custom expiry" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </span>
          )}
        </div>
      </section>

      <aside className="wr-summary" aria-label="Order summary">
        <h2 className="wr-summary-title">Order summary</h2>
        <div className="wr-hero">
          <span className="wr-label">Collateral locked now</span>
          <span className="wr-hero-value">
            {collateral ? money(collateral.amount, collateral.token.decimals) : '—'}
            {collateral && <span className="wr-hero-unit"> {collateral.token.code}</span>}
          </span>
          <span className="wr-help">Returned to you if the offer is cancelled or expires unexercised.</span>
        </div>

        <dl className="wr-rows">
          <div className="wr-row">
            <dt>Premium you receive at purchase</dt>
            <dd className={offer ? 'wr-pos' : undefined}>{offer ? `+${moneyWith(offer.totalPremium, assets.quote)}` : '—'}</dd>
          </div>
          <div className="wr-row">
            <dt>If exercised, you receive</dt>
            <dd>{receiveIfExercised ?? '—'}</dd>
          </div>
          <div className="wr-row">
            <dt>Total strike</dt>
            <dd>{offer ? moneyWith(offer.totalStrike, assets.quote) : '—'}</dd>
          </div>
          {collateral && collBalance !== null && (
            <div className="wr-row">
              <dt>{collateral.token.code} balance after</dt>
              <dd>
                {money(collBalance, collateral.token.decimals)} → {collBalance >= collateral.amount ? money(collBalance - collateral.amount, collateral.token.decimals) : 'insufficient'}
              </dd>
            </div>
          )}
        </dl>

        <ul className="wr-checks">
          {eligible === false ? (
            <li className="wr-check is-bad" role="alert">
              <Icon name="alert" size={16} />
              Your account is not authorized by this asset's issuer; the transaction will likely fail with NotEligible.
            </li>
          ) : eligible === true ? (
            <li className="wr-check is-ok">
              <Icon name="check" size={16} />
              You are authorized to hold {underlyingCode}
            </li>
          ) : (
            <li className="wr-check">
              <Icon name="alert" size={16} />
              {me ? `Checking authorization for ${underlyingCode}…` : `Connect a wallet to check authorization for ${underlyingCode}`}
            </li>
          )}
          {'error' in draft ? (
            <li className="wr-check is-bad">
              <Icon name="alert" size={16} />
              {draft.error}
            </li>
          ) : (
            <li className="wr-check is-ok">
              <Icon name="check" size={16} />
              Strike × quantity is an exact amount
            </li>
          )}
        </ul>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting} disabled={disabled || !offer}>
          {submitting ? 'Locking collateral…' : collateral ? `Lock ${moneyWith(collateral.amount, collateral.token)} and publish` : 'Lock collateral and publish'}
        </Button>
        <p className="wr-help">
          You sign once in your wallet. The premium is yours at purchase and is not refunded to the buyer. The buyer gets the right to{' '}
          {kind === 'put' ? `sell you ${underlyingCode} at the strike` : `buy your ${underlyingCode} at the strike`} until expiry.
        </p>
      </aside>
    </form>
  )
}
