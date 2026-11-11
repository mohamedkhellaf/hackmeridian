import { useId } from 'react'
import type { ReactNode } from 'react'
import { crisp } from './geometry.ts'
import { cx } from './cx.ts'
import { Hatch } from './parts.tsx'
import { waterfallLayout } from './waterfallLayout.ts'
import { useChartWidth } from './useChartWidth.ts'
import { useTextMeasure } from './measure.ts'
import shared from './viz.module.css'
import css from './Waterfall.module.css'

export interface WaterfallSegment {
  id: string
  /** "Writer margin", "Vault", "Deficit". */
  label: string
  value: number
  /** Exact amount from the caller: "300.00". */
  valueLabel: string
  /** A deficit is owed and not paid: hatched and outlined, never a plain colour. */
  kind?: 'paid' | 'deficit'
}

export interface WaterfallProps {
  /** In payment order: writer margin, then vault, then any deficit. */
  segments: readonly WaterfallSegment[]
  /** Scale of the bar when several waterfalls share one. Defaults to the sum of the segments. */
  max?: number
  /** Printed above the bar: "Owed 450.00 USDx". */
  heading?: ReactNode
  /** Printed at the line between paid and unpaid: "Paid 400.00 of 450.00". */
  paidLabel?: string
  /** Accessible name. Defaults to the segments read in order. */
  label?: string
  className?: string
}

const SWATCH = 10
const SWATCH_GAP = 6
const BAR_H = 14

/**
 * Where a payout comes from, in order, as one stacked bar: paid from the writer's margin, then from the vault,
 * and what is left is a deficit, hatched. One whole split into parts, so a single bar and no floating columns.
 */
export function Waterfall({ segments, max, heading, paidLabel, label, className }: WaterfallProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [ref, width] = useChartWidth<HTMLDivElement>(420, 120)
  const measureText = useTextMeasure()
  const widths = segments.map((s) => SWATCH + SWATCH_GAP + measureText(s.label, shared.t) + 5 + measureText(s.valueLabel, shared.tStrong))
  const paidW = paidLabel ? measureText(paidLabel, shared.tStrong) : 0
  const layout = waterfallLayout({ width, segments, max, labelWidths: widths, paidLabelWidth: paidW })
  const hatchId = `${uid}-hatch`
  const name = label ?? `${segments.map((s) => `${s.label} ${s.valueLabel}${s.kind === 'deficit' ? ', not paid' : ''}`).join('. ')}.`

  const showPaid = layout.paidX !== null && paidLabel !== undefined && layout.paidLabelX !== null
  const barTop = showPaid ? 20 : 2
  const barBottom = barTop + BAR_H
  const labelBase = barBottom + 8 + 11
  const height = layout.labels ? labelBase + 5 : barBottom + 4
  const tone = [css.first, css.second, css.third]
  const swatch = (s: WaterfallSegment, order: number, x: number, y: number) =>
    s.kind === 'deficit' ? (
      <>
        <rect x={x} y={y} width={SWATCH} height={SWATCH} fill={`url(#${hatchId})`} />
        <rect x={x + 0.5} y={y + 0.5} width={SWATCH - 1} height={SWATCH - 1} className={css.deficit} />
      </>
    ) : (
      <rect x={x} y={y} width={SWATCH} height={SWATCH} className={tone[Math.min(order, 2)]} />
    )
  let paidOrder = 0
  const orders = segments.map((s) => (s.kind === 'deficit' ? 0 : paidOrder++))

  return (
    <div className={cx(css.waterfall, className)}>
      {heading && <p className={css.heading}>{heading}</p>}
      <div className={shared.plot} ref={ref}>
        <svg className={shared.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={name}>
          <defs>
            <Hatch id={hatchId} />
          </defs>
          {layout.bars.length === 0 && <rect x={0.5} y={barTop + 0.5} width={Math.max(0, width - 1)} height={BAR_H - 1} className={css.empty} />}
          {layout.bars.map((b) =>
            b.kind === 'deficit' ? (
              <g key={b.id}>
                <rect x={b.x} y={barTop} width={b.width} height={BAR_H} fill={`url(#${hatchId})`} />
                <rect x={b.x + 0.5} y={barTop + 0.5} width={Math.max(0, b.width - 1)} height={BAR_H - 1} className={css.deficit} />
              </g>
            ) : (
              <rect key={b.id} x={b.x} y={barTop} width={b.width} height={BAR_H} className={tone[Math.min(b.order, 2)]} />
            ),
          )}
          {showPaid && layout.paidX !== null && layout.paidLabelX !== null && (
            <>
              <line x1={crisp(layout.paidX)} x2={crisp(layout.paidX)} y1={barTop - 5} y2={barBottom + 3} className={css.paidRule} />
              <text x={layout.paidLabelX} y={11} className={cx(shared.tStrong, shared.ink)}>
                {paidLabel}
              </text>
            </>
          )}
          {layout.labels?.map((p, i) => {
            const s = segments[i]
            const labelW = measureText(s.label, shared.t)
            return (
              <g key={p.id}>
                {swatch(s, orders[i], p.x, labelBase - 9.5)}
                <text x={p.x + SWATCH + SWATCH_GAP} y={labelBase} className={cx(shared.t, shared.muted)}>
                  {s.label}
                </text>
                <text x={p.x + SWATCH + SWATCH_GAP + labelW + 5} y={labelBase} className={cx(shared.tStrong, shared.ink)}>
                  {s.valueLabel}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {!layout.labels && (
        <ul className={css.key} aria-hidden="true">
          {segments.map((s, i) => (
            <li key={s.id}>
              <svg width={SWATCH} height={SWATCH} viewBox={`0 0 ${SWATCH} ${SWATCH}`} focusable="false">
                {swatch(s, orders[i], 0, 0)}
              </svg>
              <span className={css.keyLabel}>{s.label}</span>
              <span className={css.keyValue}>{s.valueLabel}</span>
            </li>
          ))}
        </ul>
      )}
      {!showPaid && paidLabel && layout.paidX !== null && <p className={css.paidText}>{paidLabel}</p>}
    </div>
  )
}
