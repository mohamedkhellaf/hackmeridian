import { useState } from 'react'
import { parseAmount } from '../options/format'
import { Button, Card, Dialog, Tag } from '../ui'
import { countdown, DASH, lots, perLot, usdx, when, whenShort } from './format'
import { ageText, seriesStatus, snapshotAge } from './helpers'
import { Field, Unknown, Usdx, Who } from './parts'
import { usePro } from './proCtx'
import type { OfferView } from './types'
import { USDX_DECIMALS } from './types'

function BuyDialog({ offer, onClose }: { offer: OfferView; onClose: () => void }) {
  const { client, model, me, run } = usePro()
  const [understood, setUnderstood] = useState(false)
  const series = model.series.find((s) => s.id === offer.seriesId)
  return (
    <Dialog
      title="Buy EQTY call"
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
              void run('Buy', client.buy(me, offer.id), 'Bought').then(onClose)
            }}
          >
            Buy for {usdx(offer.premium)} USDx
          </Button>
        </>
      }
    >
      <div className="pro-dialog">
        <dl className="ui-kv">
          <div>
            <dt>Offer</dt>
            <dd>{offer.id}</dd>
          </div>
          <div>
            <dt>Series</dt>
            <dd>{offer.seriesId}</dd>
          </div>
          <div>
            <dt>Strike</dt>
            <dd>{usdx(series?.strike)} USDx</dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>
              {series ? (
                <>
                  {when(series.expiry)}
                  {model.now < series.expiry && <span className="pro-cd"> {countdown(series.expiry, model.now)}</span>}
                </>
              ) : (
                DASH
              )}
            </dd>
          </div>
          <div>
            <dt>Qty</dt>
            <dd>{lots(offer.qty)} lots</dd>
          </div>
          <div>
            <dt>Premium</dt>
            <dd>{usdx(offer.premium)} USDx</dd>
          </div>
          <div>
            <dt>Writer</dt>
            <dd>
              <Who id={offer.writer} />
            </dd>
          </div>
          <div>
            <dt>Collateral</dt>
            <dd>Partial, writer margin checked at buy</dd>
          </div>
        </dl>
        <dl className="ui-kv" aria-label="Who pays you">
          <div>
            <dt>Paid first by</dt>
            <dd>Writer margin</dd>
          </div>
          <div>
            <dt>Then</dt>
            <dd>Vault, pro rata at settlement</dd>
          </div>
          <div>
            <dt>Unpaid</dt>
            <dd>Deficit, cuts your payout</dd>
          </div>
        </dl>
        <label className="pro-check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand my payout can be reduced.</span>
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
      <Card title="Series" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="num">Series</th>
                <th className="hide-sm">Kind</th>
                <th className="num">Strike (USDx)</th>
                <th>Expiry (UTC)</th>
                <th className="num">Mark per lot</th>
                <th className="num hide-sm">Open lots</th>
                <th className="num hide-sm">Spot</th>
                <th className="num hide-sm">Snapshot</th>
                <th className="num hide-sm">Age</th>
                <th className="num hide-sm">Settlement</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {model.series.length === 0 && (
                <tr>
                  <td colSpan={11}>No series listed.</td>
                </tr>
              )}
              {model.series.map((s) => {
                const st = seriesStatus(s, model.now)
                return (
                  <tr key={s.id}>
                    <td className="num">{s.id}</td>
                    <td className="hide-sm">EQTY call</td>
                    <td className="num">{usdx(s.strike)}</td>
                    <td className="pro-exp">
                      <span>{whenShort(s.expiry)}</span>
                      {model.now < s.expiry && (
                        <>
                          {' '}
                          <span className="pro-cd">{countdown(s.expiry, model.now)}</span>
                        </>
                      )}
                    </td>
                    <td className="num">{s.snapshot ? perLot(s.snapshot.mark) : DASH}</td>
                    <td className="num hide-sm">{lots(s.oi)}</td>
                    <td className="num hide-sm">{s.snapshot ? usdx(s.snapshot.spot) : DASH}</td>
                    <td className="num hide-sm">{s.snapshot ? s.snapshot.seq : DASH}</td>
                    <td className="num hide-sm">{ageText(snapshotAge(model, s))}</td>
                    <td className="num hide-sm">{s.settlementPrice != null ? usdx(s.settlementPrice) : DASH}</td>
                    <td>
                      <Tag tone={st.warn ? 'warn' : 'neutral'}>{st.label}</Tag>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Open offers" flush>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="num hide-sm">Offer</th>
                <th className="num">Series</th>
                <th className="num">Qty (lots)</th>
                <th className="num">Premium (USDx)</th>
                <th className="hide-sm">Writer</th>
                <th className="num">
                  <span className="pro-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 && (
                <tr>
                  <td colSpan={6}>No open offers.</td>
                </tr>
              )}
              {open.map((o) => (
                <tr key={o.id}>
                  <td className="num hide-sm">{o.id}</td>
                  <td className="num">{o.seriesId}</td>
                  <td className="num">{lots(o.qty)}</td>
                  <td className="num">
                    <Usdx v={o.premium} />
                  </td>
                  <td className="hide-sm">
                    <Who id={o.writer} />
                  </td>
                  <td className="num">
                    <Button size="sm" variant="secondary" onClick={() => setBuying(o)}>
                      Buy
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Write call">
        {live.length === 0 ? (
          <p className="pro-muted">No live series.</p>
        ) : (
          <div className="pro-write">
            <div className="pro-form">
              <Field label="Series">
                <select value={sid ?? ''} onChange={(e) => setSeriesId(Number(e.target.value))}>
                  {live.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}, strike {usdx(s.strike)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qty" unit="lots">
                <input inputMode="numeric" aria-label="Qty (lots)" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field label="Premium, total" unit="USDx">
                <input inputMode="decimal" aria-label="Premium, total (USDx)" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="0.00" />
              </Field>
            </div>
            <div className="pro-form">
              <dl className="ui-kv" aria-label="Margin after fill">
                <div>
                  <dt>Mark per lot</dt>
                  <dd>{chosen?.snapshot ? `${perLot(chosen.snapshot.mark)} USDx` : DASH}</dd>
                </div>
                <div>
                  <dt>IM after fill</dt>
                  <dd>{preview ? `${usdx(preview.im)} USDx` : <Unknown why="No fixture value for this order" />}</dd>
                </div>
                <div>
                  <dt>NLV after fill</dt>
                  <dd>{preview ? `${usdx(preview.nlv)} USDx` : <Unknown />}</dd>
                </div>
              </dl>
              <p className="pro-muted">A premium below qty times mark is refused at buy. The buy also needs your NLV at or above IM.</p>
              {!preview && params && <p className="pro-muted">No fixture value for this order. Try happy_path_otm at step 5.</p>}
              <div className="pro-actions">
                <Button variant="primary" disabled={!params} onClick={() => params && void run('Write call', client.createOffer(params), 'Offer written')}>
                  Write call
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {buying && <BuyDialog offer={buying} onClose={() => setBuying(null)} />}
    </>
  )
}
