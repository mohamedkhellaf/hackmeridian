import type { CollateralHealth, OptionOffer } from '../options/types'
import { shortfallFor } from '../reserves/reserves'
import { ShortfallNotice } from '../reserves/ShortfallWarning'
import { requiredCollateral } from '../options/types'
import { formatDisplay, formatExpiry, shortAddress, strikePerUnit } from '../options/format'
import { Button, Mono, PayoffSketch, Sediment, Tag } from '../ui'
import { implausibleTerms } from '../options/feasibility'
import { formatCountdown, groupSeries } from './series'
import './market.css'

// Short descriptions for the demo assets; anything else gets the generic line (never claims more than we know).
const KNOWN: Record<string, string> = {
  FUND: 'Fictional Testnet fund token',
  BOND: 'Fictional Testnet bond token',
}
function describe(code: string): string {
  return `${KNOWN[code] ?? 'Testnet asset'} · issuer-authorized`
}

// Display only: premium per one unit of underlying.
function premiumPerUnit(o: OptionOffer): string {
  if (o.underlyingQty === 0n) return '–'
  return formatDisplay((o.totalPremium * 10n ** BigInt(o.underlying.decimals)) / o.underlyingQty, o.quote.decimals)
}

function lockedAmount(o: OptionOffer): string {
  const c = requiredCollateral(o)
  return `${formatDisplay(c.amount, c.token.decimals)} ${c.token.code}`
}

const CHECK_TITLE = 'Premium is at least the total strike — check the terms before buying.'

export function MarketSeries({
  offers,
  health = [],
  me,
  busy,
  busyId,
  onBuy,
}: {
  offers: OptionOffer[]
  /** Reserved vs held per token: options on a clawed-back token show the shortfall warning. */
  health?: CollateralHealth[]
  me: string | null
  busy: boolean
  busyId: bigint | null
  onBuy: (o: OptionOffer) => void
}) {
  const series = groupSeries(offers)
  if (series.length === 0) return <p className="mk-empty">No open offers match.</p>

  const buyProps = (o: OptionOffer) => ({
    disabled: !me || busy || o.writer === me,
    title: !me ? 'Connect a wallet to buy' : o.writer === me ? 'This is your own offer' : busy ? 'Another transaction is in progress' : undefined,
    'aria-label': `Buy ${o.kind} on ${formatDisplay(o.underlyingQty, o.underlying.decimals)} ${o.underlying.code} from ${shortAddress(o.writer)}`,
  })

  return (
    <div className="mk-series-list">
      {series.map((s) => {
        const first = s.offers[0]
        const n = s.offers.length
        const barClass = first.kind === 'call' ? 'ui-bar ui-bar--call' : 'ui-bar'
        const strike = strikePerUnit(first)
        return (
          <section key={s.key} className="mk-series">
            <header className="mk-series-head">
              <div className="mk-thumb">
                <Sediment seed={first.underlying.code} size="thumb" tone={first.kind === 'put' ? 'amber' : 'blue'} />
              </div>
              <div className="mk-series-title">
                <h2>
                  <span className="mk-code">{first.underlying.code}</span>
                  <Tag tone={first.kind}>{first.kind.toUpperCase()}</Tag>
                  <span className="mk-sr"> Strike {strike} {first.quote.code}</span>
                  <span className="mk-desc">{describe(first.underlying.code)}</span>
                </h2>
                <p className="mk-terms-line">
                  <span>
                    Strike <Mono>{strike}</Mono> {first.quote.code} / unit
                  </span>
                  <span>
                    Expires <Mono>{formatExpiry(first.expiry)}</Mono> · {formatCountdown(first.expiry)}
                  </span>
                  <span>
                    Right to <b>{first.kind === 'put' ? 'sell' : 'buy'}</b> {first.underlying.code} at strike
                  </span>
                </p>
                <p className="mk-count">{n > 1 ? `${n} makers competing` : '1 maker'}</p>
                <ShortfallNotice tokens={shortfallFor(first, health)} />
              </div>
              <PayoffSketch kind={first.kind} strikeLabel={strike} asset={first.underlying.code} className="mk-payoff" />
            </header>

            <div className="ui-table-wrap mk-table">
              <table className="ui-table" aria-label={`${first.underlying.code} ${first.kind} offers`}>
                <thead>
                  <tr>
                    <th>Maker</th>
                    <th>Size</th>
                    <th>Total strike</th>
                    <th>Premium / unit</th>
                    <th>Total premium</th>
                    <th>Collateral</th>
                    <th>
                      <span className="mk-sr">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.offers.map((o, i) => {
                    const best = n > 1 && i === 0
                    const primary = best || n === 1
                    return (
                      <tr key={o.id.toString()} className={primary ? 'is-best' : undefined}>
                        <td>
                          <span className="mk-maker">
                            <span className={barClass} />
                            <span>
                              <Mono>{shortAddress(o.writer)}</Mono>
                              {o.writer === me && ' (you)'}{' '}
                              {implausibleTerms(o) && (
  <Tag tone="warn" title={CHECK_TITLE}>
    Check terms
  </Tag>
)}
                              <span className="ui-sub">{best ? 'Maker · Best price' : 'Maker'}</span>
                            </span>
                          </span>
                        </td>
                        <td className="ui-mono">
                          {formatDisplay(o.underlyingQty, o.underlying.decimals)} <span className="mk-unit">{o.underlying.code}</span>
                        </td>
                        <td className="ui-mono">
                          {formatDisplay(o.totalStrike, o.quote.decimals)} <span className="mk-unit">{o.quote.code}</span>
                        </td>
                        <td className="ui-mono">{premiumPerUnit(o)}</td>
                        <td className="ui-mono ui-strong">
                          {formatDisplay(o.totalPremium, o.quote.decimals)} <span className="mk-unit">{o.quote.code}</span>
                        </td>
                        <td>
                          <Tag tone="ok">Locked</Tag>
                          <span className="ui-sub ui-mono">{lockedAmount(o)}</span>
                        </td>
                        <td>
                          <Button size="sm" variant={primary ? 'primary' : 'secondary'} onClick={() => onBuy(o)} {...buyProps(o)}>
                            {busyId === o.id ? 'Buying…' : 'Buy'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="mk-offers" aria-label={`${first.underlying.code} ${first.kind} offers (list)`}>
              {s.offers.map((o, i) => {
                const best = n > 1 && i === 0
                return (
                  <li key={o.id.toString()} className="mk-offer">
                    <div className="mk-offer-main">
                      <span className="mk-offer-price">
                        {formatDisplay(o.totalPremium, o.quote.decimals)} {o.quote.code} {best && <Tag tone="ok">Best</Tag>}
                      </span>
                      <span className="mk-offer-sub">
                        {formatDisplay(o.underlyingQty, o.underlying.decimals)} {o.underlying.code} · {premiumPerUnit(o)} / unit
                      </span>
                      <span className="mk-offer-sub">
                        <Tag tone="ok">Locked</Tag> {lockedAmount(o)}
                      </span>
                      <span className="mk-offer-sub">
                        Maker <Mono>{shortAddress(o.writer)}</Mono>
                        {o.writer === me && ' (you)'}{' '}
                        {implausibleTerms(o) && (
  <Tag tone="warn" title={CHECK_TITLE}>
    Check terms
  </Tag>
)}
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
