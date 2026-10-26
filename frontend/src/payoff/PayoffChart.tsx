import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { OptionOffer } from '../options/types'
import { chartModel, fmtNum, riskLines } from './buyerPayoff'
import './payoff.css'

// The viewBox width follows the rendered width, so 1 SVG unit = 1 CSS px and labels keep their font size on phones.
const DEFAULT_W = 480
const MIN_W = 260
const M = { l: 52, r: 14, t: 22, b: 34 }
// Rough width of an 11px Plex Sans label, used only to keep labels inside the plot.
const textW = (t: string) => t.length * 6.2

function useWidth() {
  const ref = useRef<HTMLElement>(null)
  const [w, setW] = useState(DEFAULT_W)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const cw = Math.round(el.getBoundingClientRect().width)
      if (cw > 0) setW(Math.max(MIN_W, cw))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Buyer payoff at expiry as inline SVG. Hypothetical: the price axis is an assumed price, never a market price. */
export function PayoffChart({ offer, assumed }: { offer: OptionOffer; assumed: number }) {
  const uid = useId().replace(/:/g, '')
  const [ref, W] = useWidth()
  const H = W < 420 ? 200 : 230
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

  const ax = x(assumed)
  const ay = y(r.pnlAtAssumed)
  const summary = `Hypothetical payoff at expiry for a ${offer.kind} on ${offer.underlying.code}. Strike ${fmtNum(r.strike)} ${quote}, break-even ${fmtNum(
    r.breakeven,
  )}, maximum loss ${fmtNum(r.maxLoss)} ${quote}. At the assumed price ${fmtNum(assumed)} the result is ${fmtNum(r.pnlAtAssumed)} ${quote}.`

  const xTicks = [m.from, r.strike, m.to]
  // Zero always gets its line; its label is dropped when it would collide with the max or min label.
  const yLines = [m.maxPnl, 0, m.minPnl].filter((v, i, a) => a.indexOf(v) === i)
  const yLabels = yLines.filter((v) => v !== 0 || yLines.every((o) => o === 0 || Math.abs(y(o) - y(0)) >= 16))
  const kx = x(r.strike)
  const bx = x(r.breakeven)
  // Break-even label sits on the break-even side of the strike line (left of the dot for a put, right for a call),
  // just under the zero line where the curve does not run. Flipped when it would leave the plot.
  const beText = `Break-even ${fmtNum(r.breakeven)}`
  const beLeft = offer.kind === 'put' ? bx - 6 - textW(beText) >= M.l : bx + 6 + textW(beText) > W - M.r
  const beY = y0 + 15 <= H - M.b + 2 ? y0 + 15 : y0 - 8

  return (
    <figure className="po-chart" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="po-svg" data-testid="payoff-chart">
        <defs>
          <clipPath id={`${uid}-up`}>
            <rect x={M.l} y={0} width={W - M.l - M.r} height={y0} />
          </clipPath>
          <clipPath id={`${uid}-down`}>
            <rect x={M.l} y={y0} width={W - M.l - M.r} height={H - y0} />
          </clipPath>
        </defs>

        {yLines.map((v) => (
          <line key={v} x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'po-zero' : 'po-grid'} />
        ))}
        {yLabels.map((v) => (
          <text key={v} x={M.l - 8} y={y(v) + 3.5} textAnchor="end" className="po-tick">
            {fmtNum(v)}
          </text>
        ))}

        <path d={area} fill="var(--profit)" opacity="0.18" clipPath={`url(#${uid}-up)`} />
        <path d={area} fill="var(--loss)" opacity="0.18" clipPath={`url(#${uid}-down)`} />
        <path d={line} fill="none" className="po-line" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        <line x1={kx} x2={kx} y1={M.t} y2={H - M.b} className="po-strike" />
        <text x={kx} y={M.t - 6} textAnchor="middle" className="po-mark">
          Strike
        </text>

        <circle cx={bx} cy={y0} r="3.5" fill="var(--bg)" className="po-line" strokeWidth="1.5" />
        <text x={beLeft ? bx - 6 : bx + 6} y={beY} textAnchor={beLeft ? 'end' : 'start'} className="po-mark">
          {beText}
        </text>

        <line x1={ax} x2={ax} y1={M.t} y2={H - M.b} className="po-assumed" />
        <circle cx={ax} cy={ay} r="4" fill={r.pnlAtAssumed >= 0 ? 'var(--profit)' : 'var(--loss)'} stroke="var(--bg)" strokeWidth="1.5" />

        {xTicks.map((v, i) => (
          <text key={i} x={x(v)} y={H - M.b + 16} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="po-tick">
            {fmtNum(v)}
          </text>
        ))}
        <text x={0} y={M.t - 8} textAnchor="start" className="po-axis">
          P&amp;L ({quote})
        </text>
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" className="po-axis">
          Assumed price per {offer.underlying.code} ({quote})
        </text>
      </svg>
      <figcaption className="po-caption">Hypothetical payoff at expiry. Not a quote.</figcaption>
    </figure>
  )
}
