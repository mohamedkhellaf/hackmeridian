import { useId } from 'react'
import { seriesSummary } from './a11y.ts'
import { cx } from './cx.ts'
import { crisp, linePath } from './geometry.ts'
import { Knockout } from './parts.tsx'
import { sparklineGeometry } from './sparklineGeometry.ts'
import { useChartWidth } from './useChartWidth.ts'
import { useTextMeasure } from './measure.ts'
import shared from './viz.module.css'
import css from './Sparkline.module.css'

export interface SparklineProps {
  /** Values in time order. */
  values: readonly number[]
  /** What the line is, for assistive technology: "BOND demo price, last 7 days". */
  label: string
  /** Replaces the generated summary ("Starts at 10.00, ends at 10.30 (up), low 9.80, high 10.45."). */
  summary?: string
  /** Prints the last value at the right end: the exact text from the caller. */
  lastLabel?: string
  /** A dotted level across the line, for example the strike. Its label is not drawn; name it beside the chart. */
  rule?: number
  height?: number
  decimals?: number
  unit?: string
  className?: string
}

/** A plain line with a dot on its last value. Context, not a chart to read values from: the summary carries them. */
export function Sparkline({ values, label, summary, lastLabel, rule, height = 32, decimals = 2, unit, className }: SparklineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [ref, width] = useChartWidth<HTMLDivElement>(160, 40)
  const measureText = useTextMeasure()
  const labelW = lastLabel ? Math.ceil(measureText(lastLabel, shared.tStrong)) + 8 : 0
  const plotW = Math.max(24, width - labelW)
  const g = sparklineGeometry(values, plotW, height, rule)
  const name = `${label}. ${summary ?? seriesSummary(values, decimals, unit)}`
  const maskId = `${uid}-dot`
  return (
    <div className={cx(css.spark, className)} ref={ref}>
      <svg className={shared.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={name}>
        <defs>
          <Knockout id={maskId} width={width} height={height} circles={g.last ? [{ ...g.last, r: 4.5 }] : []} />
        </defs>
        {g.line.length === 0 && <line x1={4} x2={plotW - 4} y1={crisp(height / 2)} y2={crisp(height / 2)} className={css.none} />}
        <g mask={`url(#${maskId})`}>
          {g.ruleY !== null && <line x1={4} x2={plotW - 4} y1={g.ruleY} y2={g.ruleY} className={shared.dotted} />}
          {g.line.length > 1 && <path d={linePath(g.line)} className={css.line} />}
        </g>
        {g.last && <circle cx={g.last.x} cy={g.last.y} r={2.5} className={shared.dot} />}
        {g.last && lastLabel && (
          <text x={plotW + 4} y={Math.min(height - 3, Math.max(11, g.last.y + 4))} className={cx(shared.tStrong, shared.ink)}>
            {lastLabel}
          </text>
        )}
      </svg>
    </div>
  )
}
