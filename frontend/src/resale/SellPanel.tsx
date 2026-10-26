import { useRef, useState } from 'react'
import { formatCountdown, formatExpiryShort } from '../market/series'
import { formatDisplay, parseAmount, strikePerUnit } from '../options/format'
import type { Ask, OptionOffer } from '../options/types'
import type { TxOutcome } from '../state/useStrata'
import { Banner, Button, Dialog } from '../ui'
import { askOf, canList, formatAskPerUnit } from './resale'
import './resale.css'

const nowSec = () => Math.floor(Date.now() / 1000)
const amt = (units: bigint, t: { decimals: number; code: string }) => `${formatDisplay(units, t.decimals)} ${t.code}`

function SellDialog({
  o,
  current,
  onConfirm,
  onClose,
}: {
  o: OptionOffer
  current: Ask | undefined
  onConfirm: (askTotal: bigint) => Promise<TxOutcome>
  onClose: () => void
}) {
  const q = o.quote
  const u = o.underlying
  const [text, setText] = useState(() => (current ? formatDisplay(current.askTotal, q.decimals, q.decimals).replace(/,/g, '') : ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = parseAmount(text, q.decimals)
  const valid = parsed !== null && parsed > 0n
  const invalidMsg = text.trim() === '' ? null : parsed === null ? `Enter an amount with at most ${q.decimals} decimals.` : parsed <= 0n ? 'The price must be above zero.' : null

  const close = () => {
    if (!submitting) onClose()
  }
  const confirm = async () => {
    if (!valid) return
    setSubmitting(true)
    setError(null)
    let closeAfter = false
    try {
      const res = await onConfirm(parsed)
      if (res.ok) closeAfter = true
      else setError(res.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
    if (closeAfter) onClose()
  }

  return (
    <Dialog
      title={`Sell ${u.code} ${o.kind}`}
      width={460}
      onClose={close}
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} disabled={!valid} onClick={() => void confirm()}>
            {submitting ? 'Confirm in wallet…' : valid ? `List for ${amt(parsed, q)}` : 'List for sale'}
          </Button>
        </>
      }
    >
      <dl className="ui-kv">
        <div>
          <dt>Qty</dt>
          <dd className="num">{amt(o.underlyingQty, u)}</dd>
        </div>
        <div>
          <dt>Strike</dt>
          <dd className="num">
            {strikePerUnit(o)} {q.code} per {u.code}, {amt(o.totalStrike, q)} total
          </dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>
            {formatExpiryShort(o.expiry)} <span className="mk-muted">{formatCountdown(o.expiry)}</span>
          </dd>
        </div>
        <div>
          <dt>Original premium (paid to the writer)</dt>
          <dd className="num">{amt(o.totalPremium, q)}</dd>
        </div>
        {current && (
          <div>
            <dt>Listed now</dt>
            <dd className="num">{amt(current.askTotal, q)}</dd>
          </div>
        )}
      </dl>
      <label className="rsl-label" htmlFor="rsl-ask">
        Your price ({q.code}, total)
      </label>
      <input
        id="rsl-ask"
        ref={inputRef}
        className="rsl-input"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
      />
      <p className="rsl-hint" data-testid="ask-per-unit">
        {valid ? `${formatAskPerUnit(o, parsed)} ${q.code} per ${u.code}.` : invalidMsg ?? `Total price in ${q.code} for the whole option.`}
      </p>
      <p className="rsl-copy">
        A buyer pays you this price in {q.code} and becomes the holder. The collateral stays locked in the contract. The sale ends if
        you exercise, the option expires, or you cancel it.{current ? ' Listing again replaces your current price.' : ''}
      </p>
      {error && <Banner tone="danger">{error}</Banner>}
    </Dialog>
  )
}

/**
 * Positions: the connected wallet's held options that can be resold (Active, unexpired). Hidden when the contract
 * has no resale (asks === null) or nothing is listable.
 */
export function SellPanel({
  me,
  rows,
  asks,
  busy,
  busyId,
  onList,
  onCancel,
}: {
  me: string | null
  rows: OptionOffer[]
  asks: Ask[] | null
  busy: boolean
  busyId: bigint | null
  onList: (o: OptionOffer, askTotal: bigint) => Promise<TxOutcome>
  onCancel: (o: OptionOffer) => Promise<TxOutcome>
}) {
  const [selling, setSelling] = useState<bigint | null>(null)
  if (!asks || !me) return null
  const now = nowSec()
  const listable = rows.filter((o) => canList(o, me, now))
  if (listable.length === 0) return null
  const open = selling === null ? undefined : listable.find((o) => o.id === selling)

  return (
    <section className="pf-section rsl-section" aria-label="Resell">
      <h2>Resell</h2>
      <div className="ui-table-wrap">
        <table className="ui-table" aria-label="Resell">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Kind</th>
              <th className="num">Qty</th>
              <th>Expiry</th>
              <th>Your price</th>
              <th className="num">
                <span className="mk-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listable.map((o) => {
              const ask = askOf(asks, o.id)
              const rowBusy = busyId === o.id
              return (
                <tr key={o.id.toString()}>
                  <td>{o.underlying.code}</td>
                  <td>{o.kind === 'put' ? 'Put' : 'Call'}</td>
                  <td className="num">{formatDisplay(o.underlyingQty, o.underlying.decimals)}</td>
                  <td>
                    {formatExpiryShort(o.expiry)} <span className="pf-cd">{formatCountdown(o.expiry)}</span>
                  </td>
                  <td data-testid="resell-status">{ask ? `For sale at ${amt(ask.askTotal, o.quote)}` : 'Not listed'}</td>
                  <td className="num rsl-actions">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSelling(o.id)}>
                      {ask ? 'Change price' : 'Sell'}
                    </Button>
                    {ask && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onCancel(o)}>
                        {rowBusy ? 'Cancelling…' : 'Cancel sale'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {open && <SellDialog o={open} current={askOf(asks, open.id)} onConfirm={(a) => onList(open, a)} onClose={() => setSelling(null)} />}
    </section>
  )
}
