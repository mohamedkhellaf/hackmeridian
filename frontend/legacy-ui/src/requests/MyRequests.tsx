import { formatCountdown, formatExpiryShort } from '../market/series'
import type { TxOutcome } from '../state/runTx'
import { Button } from '../ui'
import { STATUS_LABEL, amt, myOpenBids, perUnit } from './requests'
import './requests.css'
import type { Bid } from './types'

/**
 * Positions: the connected wallet's requests that still hold its escrowed premium, with Cancel (refund).
 * A filled request appears as an Active position in the Held table instead. Hidden before v1.5 or when empty.
 */
export function MyRequests({
  me,
  bids,
  busy,
  busyId,
  bidBusyId,
  onCancel,
}: {
  me: string | null
  bids: Bid[] | null
  busy: boolean
  busyId: bigint | null
  bidBusyId: (id: bigint) => bigint
  onCancel: (b: Bid) => Promise<TxOutcome>
}) {
  if (!bids || !me) return null
  const rows = myOpenBids(bids, me)
  if (rows.length === 0) return null
  return (
    <section className="pf-section rsl-section" aria-label="My requests">
      <h2>My requests</h2>
      <div className="ui-table-wrap">
        <table className="ui-table" aria-label="My requests">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Asset</th>
              <th className="num">Qty</th>
              <th className="num">Strike</th>
              <th className="num">Escrowed premium</th>
              <th>Expiry</th>
              <th>Status</th>
              <th className="num">
                <span className="mk-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id.toString()}>
                <td>{b.kind === 'put' ? 'Put' : 'Call'}</td>
                <td>{b.underlying.code}</td>
                <td className="num">{amt(b.underlyingQty, b.underlying)}</td>
                <td className="num">
                  {perUnit(b.totalStrike, b)} {b.quote.code}
                </td>
                <td className="num">{amt(b.totalPremium, b.quote)}</td>
                <td>
                  {formatExpiryShort(b.expiry)} <span className="pf-cd">{formatCountdown(b.expiry)}</span>
                </td>
                <td>{STATUS_LABEL[b.state]}</td>
                <td className="num">
                  <Button size="sm" variant="secondary" disabled={busy} aria-label={`Cancel request ${b.id.toString()}`} onClick={() => void onCancel(b)}>
                    {busyId === bidBusyId(b.id) ? 'Cancelling…' : 'Cancel'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rsl-lead">Cancelling refunds the escrowed premium. A filled request shows up above as a held position.</p>
    </section>
  )
}
