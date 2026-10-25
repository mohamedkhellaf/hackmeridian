import type { OptionOffer } from '../options/types'
import { formatAmount, formatExpiry, shortAddress, strikePerUnit } from '../options/format'
import { groupSeries } from './series'

// Display only: premium per one unit of underlying.
function premiumPerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  return formatAmount((o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty, o.quote.decimals)
}

export function MarketSeries({
  offers,
  me,
  busy,
  busyId,
  onBuy,
}: {
  offers: OptionOffer[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
}) {
  const series = groupSeries(offers)
  if (series.length === 0) return <p className="empty">No open offers yet.</p>
  return (
    <div className="series-list">
      {series.map((s) => {
        const first = s.offers[0]
        return (
          <section key={s.key} className="card series">
            <h2>
              <span className={`kind kind-${first.kind}`}>{first.kind.toUpperCase()}</span> {first.underlying.code} · strike{' '}
              {strikePerUnit(first)} {first.quote.code}
            </h2>
            <p className="hint">
              Expires {formatExpiry(first.expiry)} · {s.offers.length} {s.offers.length === 1 ? 'offer' : 'offers'}
              {s.offers.length > 1 && ', cheapest premium per unit first'}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Maker</th>
                    <th>Size</th>
                    <th>Total strike</th>
                    <th>Premium</th>
                    <th>Premium / unit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.offers.map((o, i) => {
                    const best = s.offers.length > 1 && i === 0
                    return (
                      <tr key={o.id.toString()} className={best ? 'best' : undefined}>
                        <td className="mono">
                          {shortAddress(o.writer)}
                          {o.writer === me && ' (you)'}
                        </td>
                        <td>
                          {formatAmount(o.underlyingQty, o.underlying.decimals)} {o.underlying.code}
                        </td>
                        <td>
                          {formatAmount(o.totalStrike, o.quote.decimals)} {o.quote.code}
                        </td>
                        <td>
                          {formatAmount(o.totalPremium, o.quote.decimals)} {o.quote.code}
                        </td>
                        <td>
                          {premiumPerUnit(o)} {o.quote.code} {best && <span className="badge">Best price</span>}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => onBuy(o)}
                            disabled={!me || busy || o.writer === me}
                            title={!me ? 'Connect Freighter to buy' : o.writer === me ? 'This is your own offer' : busy ? 'Another transaction is in progress' : undefined}
                            aria-label={`Buy ${o.kind} on ${formatAmount(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`}
                          >
                            {busyId === o.id ? 'Buying…' : 'Buy'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
