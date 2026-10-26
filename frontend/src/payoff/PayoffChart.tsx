import { useId } from 'react'
import type { OptionOffer } from '../options/types'
import { chartModel, fmtNum, riskLines } from './buyerPayoff'
import './payoff.css'

const W = 480
const H = 230
const M = { l: 58, r: 14, t: 18, b: 34 }

/** Buyer payoff at expiry as inline SVG. Hypothetical: the price axis is an assumed price, never a market price. */
export function PayoffChart({ offer, assumed }: { offer: OptionOffer; assumed: number }) {
  const uid = useId().replace(/:/g, '')
  const m = chartModel(offer, assumed)
  const r = riskLines(offer, assumed)
  const quote = offer.quote.code

  const span = m.maxPnl - m.minPnl || 1
  const pad = span * 0.08
  const yMin = m.minPnl - pad
  const yMax = m.maxPnl + pad
  const x = (s: number) => M.l + ((s - m.from) / (m.to - m.from)) * (W - M.l - M.r)
  const y = (v: number) => M.t + ((yMax - v) / (yMax - yMin)) * (H - M.t - M.b)
  const y0 = y(0)

  const line = m.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.s).toFixed(1)} ${y(p.pnl).toFixed(1)}`).join(' ')
  const first = m.points[0]
  const last = m.points[m.points.length - 1]
  const area = `${line} L${x(last.s).toFixed(1)} ${y0.toFixed(1)} L${x(first.s).toFixed(1)} ${y0.toFixed(1)} Z`

  const tone = offer.kind === 'put' ? 'var(--put)' : 'var(--call)'
  const ax = x(assumed)
  const ay = y(r.pnlAtAssumed)
  const summary = `Hypothetical payoff at expiry for a ${offer.kind} on ${offer.underlying.code}. Strike ${fmtNum(r.strike)} ${quote}, break-even ${fmtNum(
    r.breakeven,
  )}, maximum loss ${fmtNum(r.maxLoss)} ${quote}. At the assumed price ${fmtNum(assumed)} the result is ${fmtNum(r.pnlAtAssumed)} ${quote}.`

  const xTicks = [m.from, r.strike, m.to]
  const yTicks = [m.maxPnl, 0, m.minPnl].filter((v, i, a) => a.indexOf(v) === i)
  const kx = x(r.strike)
  const bx = x(r.breakeven)

  return (
    <figure className="po-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="po-svg" data-testid="payoff-chart">
        <defs>
          <clipPath id={`${uid}-up`}>
            <rect x={M.l} y={0} width={W - M.l - M.r} height={y0} />
          </clipPath>
          <clipPath id={`${uid}-down`}>
            <rect x={M.l} y={y0} width={W - M.l - M.r} height={H - y0} />
          </clipPath>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'po-zero' : 'po-grid'} />
            <text x={M.l - 8} y={y(v) + 3.5} textAnchor="end" className="po-tick">
              {fmtNum(v)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--ok)" opacity="0.2" clipPath={`url(#${uid}-up)`} />
        <path d={area} fill="var(--danger)" opacity="0.2" clipPath={`url(#${uid}-down)`} />
        <path d={line} fill="none" stroke={tone} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

        <line x1={kx} x2={kx} y1={M.t} y2={H - M.b} className="po-strike" />
        <text x={kx} y={M.t - 6} textAnchor="middle" className="po-mark">
          Strike
        </text>

        <circle cx={bx} cy={y0} r="4" fill="var(--bg)" stroke={tone} strokeWidth="2" />
        <text x={offer.kind === 'put' ? bx + 8 : bx - 8} y={y0 - 8} textAnchor={offer.kind === 'put' ? 'start' : 'end'} className="po-mark">
          Break-even {fmtNum(r.breakeven)}
        </text>

        <line x1={ax} x2={ax} y1={M.t} y2={H - M.b} className="po-assumed" />
        <circle cx={ax} cy={ay} r="5" fill={r.pnlAtAssumed >= 0 ? 'var(--ok)' : 'var(--danger)'} stroke="var(--bg)" strokeWidth="2" />

        {xTicks.map((v, i) => (
          <text key={i} x={x(v)} y={H - M.b + 16} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="po-tick">
            {fmtNum(v)}
          </text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="po-axis">
          Assumed price per {offer.underlying.code} ({quote})
        </text>
      </svg>
      <figcaption className="po-caption">Hypothetical payoff at expiry — not a market price. P&amp;L in {quote}, premium included.</figcaption>
    </figure>
  )
}
