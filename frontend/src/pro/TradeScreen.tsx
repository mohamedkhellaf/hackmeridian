import { useState } from 'react'
import { parseAmount } from '../options/format'
import { Banner, Button, Card, Dialog, Mono, PageHeader, Tag } from '../ui'
import { DASH, lots, usdx } from './format'
import { ageText, seriesStatus, snapshotAge } from './helpers'
import { Field, Unknown, Who } from './parts'
import { usePro } from './proCtx'
import type { OfferView } from './types'
import { USDX_DECIMALS } from './types'
import { when } from './format'

/** Payout order, shown before every buy and next to every open offer. */
function Waterfall() {
  return (
    <ol className="pro-waterfall" aria-label="Who pays you">
      <li>
        <strong>1. Writer margin</strong>
        <span>The writer's margin pays first.</span>
      </li>
      <li>
        <strong>2. Backstop vault</strong>
        <span>If margin falls short, the LP-funded vault pays pro rata within the series, at settlement.</span>
      </li>
      <li className="is-risk">
        <strong>3. Deficit</strong>
        <span>Anything still unpaid is recorded as a deficit and cuts your payout. It is shown at claim.</span>
      </li>
    </ol>
  )
}

function BuyDialog({ offer, onClose }: { offer: OfferView; onClose: () => void }) {
  const { client, model, me, run } = usePro()
  const [understood, setUnderstood] = useState(false)
  const series = model.series.find((s) => s.id === offer.seriesId)
  return (
    <Dialog
      title="Review purchase"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!understood}
            onClick={() => {
              void run('Buy', client.buy(me, offer.id), 'Call bought.').then(onClose)
            }}
          >
            Buy call
          </Button>
        </>
      }
    >
      <div className="pro-dialog">
        <p>
          You buy {lots(offer.qty)} lots of a call (strike {usdx(series?.strike, 2)}) for {usdx(offer.premium)} USDx. The writer's margin is checked now, at buy.
        </p>
        <Banner tone="warn" title="Partially collateralized">
          This call is only partially collateralized. It is paid from the writer's margin, then from the vault, and a deficit is possible.
        </Banner>
        <Waterfall />
        <label className="pro-check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand this call is partially collateralized and my payout can be reduced.</span>
        </label>
      </div>
    </Dialog>
  )
}

export function TradeScreen() {
  const { client, model, me, run } = usePro()
  const live = model.series.filter((s) => !s.closed && model.now < s.expiry)
  const [seriesId, setSeriesId] = useState<number | ''>('')
  const [qty, setQty] = useState('1000')
  const [premium, setPremium] = useState('')
  const [buying, setBuying] = useState<OfferView | null>(null)

  const sid = seriesId === '' ? (live[0]?.id ?? null) : seriesId
  const chosen = model.series.find((s) => s.id === sid)
  const qtyN = /^\d+$/.test(qty) ? BigInt(qty) : null
  const premiumN = parseAmount(premium, USDX_DECIMALS)
  const params = sid != null && qtyN != null && qtyN > 0n && premiumN != null ? { writer: me, seriesId: sid, qty: qtyN, premium: premiumN, quoteExpiry: chosen?.expiry ?? 0 } : null
  const preview = params ? client.requirementAfterFill(params) : null
  const open = model.offers.filter((o) => o.status === 'open')

  return (
    <>
      <PageHeader title="Trade calls" subtitle="American calls on one underlying, cash-settled in USDx. Writers sell without holding the underlying." />

      <Card title="Series" subtitle="Prices come from the latest snapshot posted by the team's publisher." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Series</th>
                <th>Strike</th>
                <th>Expiry</th>
                <th>Spot</th>
                <th>Mark</th>
                <th>Snapshot</th>
                <th>Open interest</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {model.series.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={8}>
                    No series listed yet at this point of the simulation.
                  </td>
                </tr>
              )}
              {model.series.map((s) => {
                const st = seriesStatus(s, model.now)
                const age = snapshotAge(model, s)
                return (
                  <tr key={s.id}>
                    <td className="ui-left ui-strong">#{s.id} EQTY call</td>
                    <td>{usdx(s.strike, 2)}</td>
                    <td>{when(s.expiry)}</td>
                    <td>{s.snapshot ? usdx(s.snapshot.spot, 2) : DASH}</td>
                    <td>{s.snapshot ? usdx(s.snapshot.mark) : DASH}</td>
                    <td>
                      {s.snapshot ? `#${s.snapshot.seq}` : DASH}
                      <span className="ui-sub">{ageText(age)} old</span>
                    </td>
                    <td>{lots(s.oi)} lots</td>
                    <td>
                      <Tag tone={st.tone === 'call' ? 'call' : st.tone}>{st.label}</Tag>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Open offers" subtitle="Offers are unfunded quotes: the writer's margin is checked when someone buys." flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="ui-left">Offer</th>
                <th>Writer</th>
                <th>Series</th>
                <th>Quantity</th>
                <th>Premium</th>
                <th>
                  <span className="pro-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 && (
                <tr>
                  <td className="ui-left" colSpan={6}>
                    No open offers at this point of the simulation.
                  </td>
                </tr>
              )}
              {open.map((o) => (
                <tr key={o.id}>
                  <td className="ui-left ui-strong">#{o.id}</td>
                  <td>
                    <Who id={o.writer} />
                  </td>
                  <td>#{o.seriesId}</td>
                  <td>{lots(o.qty)} lots</td>
                  <td>{usdx(o.premium)} USDx</td>
                  <td>
                    <Button size="sm" variant="primary" onClick={() => setBuying(o)}>
                      Buy
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="pro-grid">
        <Card title="Write an uncovered call" subtitle="You sell without holding the underlying. Nothing moves when you publish the quote.">
          {live.length === 0 ? (
            <p className="pro-hint">No live series at this point of the simulation.</p>
          ) : (
            <div className="pro-form">
              <Field label="Series">
                <select className="pro-input" value={sid ?? ''} onChange={(e) => setSeriesId(Number(e.target.value))}>
                  {live.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} · strike {usdx(s.strike, 2)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity (lots)">
                <input className="pro-input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field
                label="Total premium (USDx)"
                hint={
                  <>
                    Latest mark per lot: {chosen?.snapshot ? usdx(chosen.snapshot.mark) : DASH} USDx. A premium below quantity × mark is refused at buy (PremiumBelowMark).
                  </>
                }
              >
                <input className="pro-input" inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="0.00" />
              </Field>
              <dl className="pro-dl" aria-label="Margin after fill">
                <dt>IM after fill (get_requirement)</dt>
                <dd>{preview ? `${usdx(preview.im)} USDx` : <Unknown why="No fixture value for this order" />}</dd>
                <dt>NLV after fill</dt>
                <dd>{preview ? `${usdx(preview.nlv)} USDx` : <Unknown />}</dd>
              </dl>
              {!preview && params && <span className="pro-hint">The simulation has no scripted margin value for exactly this order. Try the happy_path_otm scenario at step 5.</span>}
              <Banner tone="info">
                The offer is an unfunded quote. At buy, the contract needs your NLV to be at least your IM, otherwise the buy is refused (InsufficientMargin).
              </Banner>
              <Button
                variant="primary"
                disabled={!params}
                onClick={() => params && void run('Publish quote', client.createOffer(params), 'Quote published (no funds moved).')}
              >
                Publish unfunded quote
              </Button>
            </div>
          )}
        </Card>

        <Card title="How a purchase is paid" subtitle="Read before you buy.">
          <Waterfall />
          <p className="pro-hint">
            Acting as <Mono>{me}</Mono>. Early exercise and settlement are on the Positions screen.
          </p>
        </Card>
      </div>

      {buying && <BuyDialog offer={buying} onClose={() => setBuying(null)} />}
    </>
  )
}
