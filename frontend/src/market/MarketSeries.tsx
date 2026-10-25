import type { OptionOffer } from '../options/types'
import { requiredCollateral } from '../options/types'
import { formatAmount, formatExpiry, shortAddress, strikePerUnit } from '../options/format'
import { AssetBadge, Button, Mono, Tag } from '../ui'
import { formatCountdown, groupSeries } from './series'
import './market.css'

// Display only: premium per one unit of underlying.
function premiumPerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  return formatAmount((o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty, o.quote.decimals)
}

function locked(o: OptionOffer): string {
  const c = requiredCollateral(o)
  return `${formatAmount(c.amount, c.token.decimals)} ${c.token.code} locked`
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
  if (series.length === 0) return <p className="mk-empty">No open offers match.</p>

  const buyProps = (o: OptionOffer) => ({
    disabled: !me || busy || o.writer === me,
    title: !me ? 'Connect Freighter to buy' : o.writer === me ? 'This is your own offer' : busy ? 'Another transaction is in progress' : undefined,
    'aria-label': `Buy ${o.kind} on ${formatAmount(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`,
  })

  return (
    <div className="mk-series-list">
      {series.map((s) => {
        const first = s.offers[0]
        const n = s.offers.length
        return (
          <section key={s.key} className="mk-series">
            <header className="mk-series-head">
              <AssetBadge code={first.underlying.code} size={34} />
              <div className="mk-series-title">
                <h2>
                  {first.underlying.code} <Tag tone={first.kind}>{first.kind.toUpperCase()}</Tag>{' '}
                  <span className="mk-strike">
                    Strike {strikePerUnit(first)} {first.quote.code}
                  </span>
                </h2>
                <p>
                  Expires {formatExpiry(first.expiry)} · {formatCountdown(first.expiry)} ·{' '}
                  {first.kind === 'put' ? 'American, physical delivery' : 'Covered by the underlying'}
                </p>
              </div>
              <span className="mk-series-count">{n > 1 ? `${n} makers competing` : '1 maker'}</span>
            </header>

            <div className="ui-table-wrap mk-table">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Maker</th>
                    <th>Size</th>
                    <th>Total strike</th>
                    <th>Premium</th>
                    <th>Per unit</th>
                    <th>Backing</th>
                    <th>
                      <span className="mk-sr">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.offers.map((o, i) => {
                    const best = n > 1 && i === 0
                    return (
                      <tr key={o.id.toString()} className={best ? 'is-best' : undefined}>
                        <td>
                          <Mono>{shortAddress(o.writer)}</Mono>
                          {o.writer === me && ' (you)'}
                          {best && (
                            <>
                              {' '}
                              <Tag tone="ok">Best price</Tag>
                            </>
                          )}
                        </td>
                        <td>
                          {formatAmount(o.underlyingQty, o.underlying.decimals)} {o.underlying.code}
                        </td>
                        <td>
                          {formatAmount(o.totalStrike, o.quote.decimals)} {o.quote.code}
                        </td>
                        <td className="ui-strong">
                          {formatAmount(o.totalPremium, o.quote.decimals)} {o.quote.code}
                        </td>
                        <td>{premiumPerUnit(o)}</td>
                        <td className="mk-backing">{locked(o)}</td>
                        <td>
                          <Button size="sm" variant={best || n === 1 ? 'primary' : 'secondary'} onClick={() => onBuy(o)} {...buyProps(o)}>
                            {busyId === o.id ? 'Buying…' : 'Buy'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="mk-offers" aria-label={`${first.underlying.code} ${first.kind} offers`}>
              {s.offers.map((o, i) => {
                const best = n > 1 && i === 0
                return (
                  <li key={o.id.toString()} className="mk-offer">
                    <div className="mk-offer-main">
                      <span className="mk-offer-price">
                        {formatAmount(o.totalPremium, o.quote.decimals)} {o.quote.code} {best && <Tag tone="ok">Best</Tag>}
                      </span>
                      <span className="mk-offer-sub">
                        {formatAmount(o.underlyingQty, o.underlying.decimals)} {o.underlying.code} · {premiumPerUnit(o)} / unit · {locked(o)}
                      </span>
                      <span className="mk-offer-sub">
                        Maker <Mono>{shortAddress(o.writer)}</Mono>
                        {o.writer === me && ' (you)'}
                      </span>
                    </div>
                    <Button size="md" variant={best || n === 1 ? 'primary' : 'secondary'} onClick={() => onBuy(o)} {...buyProps(o)}>
                      {busyId === o.id ? 'Buying…' : 'Buy'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
