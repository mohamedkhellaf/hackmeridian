import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { direction, payoffValueText, sentences } from './a11y.ts'
import type { Direction } from './a11y.ts'
import { autoDecimals, formatAxis, formatNumber, formatSigned, MINUS } from './format.ts'
import { clipLine, crossingsAt, interpolateAt, linePath, polygonPath, sortPoints } from './geometry.ts'
import type { Point } from './geometry.ts'
import { cx } from './cx.ts'
import { DataTable, Grip, Hatch, Knockout, SvgLabel } from './parts.tsx'
import type { TableRow } from './parts.tsx'
import { extremeAnchor, payoffLayout } from './payoffLayout.ts'
import type { ExtremeSpec } from './payoffLayout.ts'
import { needsBareGround } from './richLabel.ts'
import type { RichLabel, Span } from './richLabel.ts'
import { extent, niceStep, niceTicks } from './scales.ts'
import { useChartWidth } from './useChartWidth.ts'
import { useControlledPrice, usePriceSlider } from './usePriceSlider.ts'
import { useTextMeasure } from './measure.ts'
import css from './viz.module.css'

/** A marked price. `label` is the exact text from the caller (formatted from integers); the chart formats `value` when it is absent. */
export interface PriceMark {
  value: number
  label?: string
}

export interface PayoffExtreme {
  /** The total gain, or the total loss as a magnitude. `Infinity` for an unlimited side. */
  value: number
  /** Exact text of the amount, without a sign. */
  label?: string
  /** The price at which it is reached. When that is outside the plotted range the label says so. */
  at?: number
}

export interface PayoffReference {
  value: number
  /** The full label, source included: "Demo price 9.82", "Testnet faucet price 10.00". */
  label: string
}

export interface PayoffReadoutState {
  price: number
  /** Payoff at that price. */
  value: number
  direction: Direction
  priceText: string
  /** Signed, with the true minus sign. */
  valueText: string
}

export interface PayoffLabels {
  strike: string
  breakeven: string
  maxGain: string
  maxLoss: string
  unlimited: string
  at: string
  beyond: string
  gain: string
  loss: string
  even: string
  slider: string
}

const DEFAULT_LABELS: PayoffLabels = {
  strike: 'Strike',
  breakeven: 'Breakeven',
  maxGain: 'Most you can gain',
  maxLoss: 'Most you can lose',
  unlimited: 'unlimited',
  at: 'at',
  beyond: 'beyond this range',
  gain: 'gain',
  loss: 'loss',
  even: 'break even',
  slider: 'Assumed price at the deadline',
}

export interface PayoffChartProps {
  /** Payoff at the deadline against the price of the underlying, sorted or not. Sample the kinks exactly (`samplePiecewise`). */
  points: readonly Point[]
  /** Price range to plot. Defaults to the range of `points`. */
  domain?: readonly [number, number]
  strike?: number | PriceMark | ReadonlyArray<number | PriceMark>
  /** Defaults to where the line crosses zero. Pass `[]` to mark none. */
  breakevens?: ReadonlyArray<number | PriceMark>
  /** The reference price, always with its source in the label. */
  reference?: PayoffReference
  maxGain?: PayoffExtreme
  maxLoss?: PayoffExtreme
  /** The assumed price (controlled). Leave out, with `defaultPrice`, for an uncontrolled handle. */
  price?: number
  defaultPrice?: number
  onPriceChange?: (price: number) => void
  /** Arrow-key step. Defaults to a round hundredth of the range. */
  step?: number
  /** Page Up, Page Down and Shift with an arrow. Defaults to ten steps. */
  largeStep?: number
  /** No handle: the figure of a closed position. A given `price` is still marked. */
  readOnly?: boolean
  /** Quote unit of the payoff, for example "USDx". */
  unit: string
  /** Code of the underlying, for example "BOND". */
  asset?: string
  /** Decimals of payoff figures the chart formats itself. */
  decimals?: number
  /** Decimals of prices the chart formats itself. Defaults to what the range needs. */
  priceDecimals?: number
  /** Accessible name of the drawing, for example "Payoff at the deadline, long put on BOND". */
  title: string
  /** Replaces the generated description. */
  description?: string
  /** Required: the caption carries the "hypothetical, not a quote" sentence. */
  caption: ReactNode
  /** Replaces the read-out above the plot. `false` removes it. */
  readout?: ReactNode | ((state: PayoffReadoutState) => ReactNode) | false
  /** Replaces the sentence read on the handle ("At 8.00 you would gain 28.20 USDx"). */
  valueText?: (price: number, value: number) => string
  /** Axis title under the plot. */
  xLabel?: string
  labels?: Partial<PayoffLabels>
  height?: number
  /** Shows the table of sampled points instead of hiding it visually. */
  tableVisible?: boolean
  tableCaption?: string
  className?: string
}

const toMark = (m: number | PriceMark): PriceMark => (typeof m === 'number' ? { value: m } : m)

function toMarks(input: number | PriceMark | ReadonlyArray<number | PriceMark> | undefined): PriceMark[] {
  if (input === undefined) return []
  const list: ReadonlyArray<number | PriceMark> = typeof input === 'number' || !('length' in input) ? [input] : input
  return list.map(toMark)
}

function signedLabel(label: string | undefined, signed: number, decimals: number): string {
  if (!label) return formatSigned(signed, decimals)
  if (/^[+−-]/.test(label) || signed === 0) return label.replace(/^-/, MINUS)
  return `${signed > 0 ? '+' : MINUS}${label}`
}

/** Payoff at the deadline for one position, with a draggable assumed price. Hypothetical by construction: the caption says so. */
export function PayoffChart(props: PayoffChartProps) {
  const { points, unit, asset, title, caption, decimals = 2, readOnly = false, tableVisible = false } = props
  const L = { ...DEFAULT_LABELS, ...props.labels }
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [wrapRef, width] = useChartWidth<HTMLDivElement>(480, 200)
  const measureText = useTextMeasure()
  const measure = (text: string, strong = false) => measureText(text, strong ? css.tStrong : css.t)

  const sorted = useMemo(() => sortPoints(points), [points])
  const xs = extent(sorted.map((p) => p.x)) ?? [0, 1]
  const d0 = Math.min(props.domain?.[0] ?? xs[0], props.domain?.[1] ?? xs[1])
  const d1 = Math.max(props.domain?.[0] ?? xs[0], props.domain?.[1] ?? xs[1])
  const visible = useMemo(() => clipLine(sorted, d0, d1), [sorted, d0, d1])
  const priceDecimals = props.priceDecimals ?? autoDecimals(d1 - d0)
  // Zero is zero: "at 0.00", never "at 0.000000" on an axis of small prices.
  const fmtPrice = (v: number) => formatNumber(v, v === 0 ? Math.min(priceDecimals, 2) : priceDecimals)

  const strikes = toMarks(props.strike)
  const bes = (props.breakevens ?? crossingsAt(visible, 0)).map(toMark)
  const near = (a: number, b: number) => Math.abs(a - b) <= (d1 - d0) * 1e-6
  // With a zero premium the breakeven is the strike: one label for both.
  const strikeSpecs = strikes.map((s) => {
    const text = s.label ?? fmtPrice(s.value)
    return { value: s.value, text: bes.some((b) => near(b.value, s.value)) ? `${L.strike}, ${L.breakeven} ${text}` : `${L.strike} ${text}` }
  })
  const beSpecs = bes.map((b) => ({
    value: b.value,
    text: strikes.some((s) => near(b.value, s.value)) ? '' : `${L.breakeven} ${b.label ?? fmtPrice(b.value)}`,
  }))

  const step = props.step ?? (niceStep(d1 - d0, 100) || 1)
  const start = props.defaultPrice ?? props.reference?.value ?? strikes[0]?.value ?? (d0 + d1) / 2
  const [rawPrice, setPrice] = useControlledPrice(props.price, start, props.onPriceChange)
  const showHandle = !(readOnly && props.price === undefined)
  const price = Math.min(d1, Math.max(d0, rawPrice))
  const value = interpolateAt(visible, price)
  const side = direction(value, decimals)
  const priceText = fmtPrice(price)
  const valueLabel = formatSigned(value, decimals)

  const extremes: ExtremeSpec[] = []
  const describeExtreme: string[] = []
  // A finite maximum or minimum the plotted range does not reach is not pinned to the end of the line, where it
  // would read as the value of that point: it is said in a line of text above the plot instead.
  const offScale: Array<{ id: string; word: string; figure: string; tone: 'gain' | 'loss' | 'even'; where: string }> = []
  const addExtreme = (kind: 'max' | 'min', extreme: PayoffExtreme | undefined) => {
    if (!extreme) return
    const anchor = extremeAnchor(visible, [d0, d1], kind, extreme)
    if (!anchor) return
    const tone = kind === 'max' ? 'gain' : 'loss'
    const word = kind === 'max' ? L.maxGain : L.maxLoss
    const unlimited = !Number.isFinite(extreme.value)
    const signed = kind === 'max' ? extreme.value : -Math.abs(extreme.value)
    const zero = !unlimited && direction(signed, decimals) === 'even'
    const figure = unlimited ? L.unlimited : signedLabel(extreme.label, zero ? 0 : signed, decimals)
    const suffix = unlimited || !anchor.offScale ? '' : extreme.at !== undefined ? `${L.at} ${fmtPrice(extreme.at)}` : L.beyond
    const amount = unlimited ? L.unlimited : `${extreme.label ?? formatNumber(Math.abs(extreme.value), decimals)} ${unit}`
    describeExtreme.push(`${kind === 'max' ? 'Maximum gain' : 'Maximum loss'} ${amount}${suffix ? ` ${suffix}` : ''}`)
    if (anchor.offScale && !unlimited) {
      const where = extreme.at !== undefined ? (asset ? `if ${asset} is at ${fmtPrice(extreme.at)}` : `${L.at} ${fmtPrice(extreme.at)}`) : L.beyond
      offScale.push({ id: kind, word, figure, tone: zero ? 'even' : tone, where })
      return
    }
    const core: Span[] = [{ text: figure, tone: zero ? 'ink' : tone, strong: true }]
    if (suffix) core.push({ text: suffix, tone: 'muted' })
    const variants: RichLabel[] = [{ spans: [{ text: word, tone: 'muted' }, ...core] }, { spans: core }]
    extremes.push({ id: kind === 'max' ? 'max-gain' : 'max-loss', kind, anchor, variants })
  }
  addExtreme('max', props.maxGain)
  addExtreme('min', props.maxLoss)

  const height = props.height ?? (width < 360 ? 200 : width < 560 ? 220 : 250)
  const layout = payoffLayout({
    width,
    height,
    points: sorted,
    domain: [d0, d1],
    strikes: strikeSpecs,
    breakevens: beSpecs.filter((b) => b.text !== ''),
    reference: props.reference ? { value: props.reference.value, text: props.reference.label } : undefined,
    extremes,
    price: showHandle ? price : undefined,
    priceText: showHandle ? priceText : undefined,
    minText: formatAxis(d0, priceDecimals),
    maxText: formatAxis(d1, priceDecimals),
    measure,
  })
  // Circles are drawn for every breakeven, including one that shares its label with the strike.
  const beCircles = bes.filter((b) => b.value >= d0 && b.value <= d1).map((b) => ({ x: layout.x(b.value), y: layout.zeroY }))

  const { sliderRef, dragging, plotHandlers, onKeyDown } = usePriceSlider({
    plotRef: wrapRef,
    value: price,
    min: d0,
    max: d1,
    step,
    largeStep: props.largeStep,
    onChange: setPrice,
    invert: layout.x.invert,
    magnets: [...strikes.map((s) => s.value), ...bes.map((b) => b.value), ...(props.reference ? [props.reference.value] : [])],
    pxPerUnit: (layout.plot.right - layout.plot.left) / (d1 - d0 || 1),
    disabled: readOnly,
  })

  const valueText = props.valueText?.(price, value) ?? payoffValueText({ price, value, unit, decimals, priceDecimals })
  const description =
    props.description ??
    sentences(
      strikeSpecs.length > 0 && `Strike ${strikes.map((s) => s.label ?? fmtPrice(s.value)).join(' and ')}`,
      bes.length > 0 && `Breakeven ${bes.map((b) => b.label ?? fmtPrice(b.value)).join(' and ')}`,
      ...describeExtreme,
      props.reference && props.reference.label,
    )

  const state: PayoffReadoutState = { price, value, direction: side, priceText, valueText: valueLabel }
  const readout =
    props.readout === false ? null : typeof props.readout === 'function' ? (
      props.readout(state)
    ) : props.readout !== undefined ? (
      props.readout
    ) : showHandle ? (
      <div className={css.readout}>
        <p className={css.readoutLabel}>{asset ? `If ${asset} is at ${priceText} at the deadline` : `At ${priceText} at the deadline`}</p>
        <p className={css.readoutValue} data-direction={side}>
          <span>{valueLabel}</span>
          <span className={css.readoutUnit}>{unit}</span>
          <span className={css.readoutWord}>{side === 'gain' ? L.gain : side === 'loss' ? L.loss : L.even}</span>
        </p>
      </div>
    ) : null

  const tablePrices = [...new Set([d0, d1, ...niceTicks(d0, d1, 6), ...strikes.map((s) => s.value), ...bes.map((b) => b.value), ...(props.reference ? [props.reference.value] : []), ...(showHandle ? [price] : [])])]
    .filter((v) => v >= d0 && v <= d1)
    .sort((a, b) => a - b)
  const rows: TableRow[] = tablePrices.map((p) => {
    const v = interpolateAt(visible, p)
    const d = direction(v, decimals)
    return { key: String(p), cells: [fmtPrice(p), formatSigned(v, decimals), d === 'gain' ? L.gain : d === 'loss' ? L.loss : L.even], current: showHandle && p === price }
  })

  const { plot, handle } = layout
  const hatchId = `${uid}-hatch`
  const labelMask = `${uid}-labels`
  const tintMask = `${uid}-tint`
  const circleMask = `${uid}-circles`
  const descId = `${uid}-desc`
  const knockCircles = [...beCircles.map((c) => ({ ...c, r: 3.5 })), ...(handle ? [{ x: handle.x, y: handle.y, r: 6.5 }] : [])]

  return (
    <figure className={cx(css.figure, props.className)} data-viz="payoff">
      {readout}
      {offScale.map((o) => (
        <p key={o.id} className={css.offScale} aria-hidden="true">
          {o.word}{' '}
          <span className={css.offScaleFigure} data-direction={o.tone}>
            {o.figure} {unit}
          </span>
          , {o.where}
        </p>
      ))}
      <div
        className={css.plot}
        ref={wrapRef}
        data-interactive={showHandle && !readOnly ? 'true' : undefined}
        data-dragging={dragging ? 'true' : undefined}
        {...(showHandle && !readOnly ? plotHandlers : {})}
      >
        <svg className={css.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} aria-describedby={descId} data-testid="payoff-chart">
          <defs>
            <Hatch id={hatchId} />
            <Knockout id={labelMask} width={width} height={height} boxes={layout.labels.map((l) => l.box)} />
            <Knockout id={tintMask} width={width} height={height} boxes={layout.labels.filter(needsBareGround).map((l) => l.box)} />
            <Knockout id={circleMask} width={width} height={height} circles={knockCircles} />
          </defs>
          <g mask={`url(#${circleMask})`}>
            <g mask={`url(#${tintMask})`}>
              {layout.gain.map((poly, i) => (
                <path key={`g${i}`} d={polygonPath(poly)} className={css.gainArea} />
              ))}
            </g>
            <g mask={`url(#${labelMask})`}>
              {layout.loss.map((poly, i) => (
                <g key={`l${i}`}>
                  <path d={polygonPath(poly)} className={css.lossTint} />
                  <path d={polygonPath(poly)} fill={`url(#${hatchId})`} />
                </g>
              ))}
              <line x1={plot.left} x2={plot.right} y1={layout.zeroY} y2={layout.zeroY} className={css.zero} />
              {layout.strikes.map((s, i) => (
                <line key={`k${i}`} x1={s.x} x2={s.x} y1={plot.top} y2={plot.bottom + 3} className={css.dotted} />
              ))}
            </g>
            <path d={linePath(layout.line)} className={css.line} />
          </g>
          {handle && (
            <g mask={`url(#${labelMask})`}>
              <line x1={handle.x} x2={handle.x} y1={handle.top} y2={handle.flagTop} className={css.rule} />
            </g>
          )}
          {beCircles.map((c, i) => (
            <circle key={`be${i}`} cx={c.x} cy={c.y} r={3.5} className={css.openDot} />
          ))}
          {/* The reference tick steps aside while the handle sits on it: one mark, not two fused glyphs. */}
          {layout.reference && !(handle && Math.abs(handle.x - layout.reference.x) < 3) && (
            <line x1={layout.reference.x} x2={layout.reference.x} y1={layout.zeroY - 6} y2={layout.zeroY + 6} className={css.tick} />
          )}
          {handle && <circle cx={handle.x} cy={handle.y} r={4} className={css.dot} />}
          <text x={layout.zeroLabel.x} y={layout.zeroLabel.y} textAnchor="end" className={cx(css.t, css.muted)}>
            {layout.zeroLabel.text}
          </text>
          {layout.labels.map((label) => (
            <SvgLabel key={label.id} label={label} />
          ))}
          {layout.lane.map((label) => (
            <text key={label.id} x={label.x} y={layout.laneBaseline} className={cx(css.t, label.tone === 'muted' && css.muted)} data-lane={label.id}>
              {label.text}
            </text>
          ))}
        </svg>
        {handle &&
          (readOnly ? (
            <div className={css.handle} data-static="true" style={{ left: handle.flagLeft, top: handle.flagTop, width: handle.flagWidth }} aria-hidden="true">
              {priceText}
            </div>
          ) : (
            <div
              ref={sliderRef}
              className={css.handle}
              style={{ left: handle.flagLeft, top: handle.flagTop, width: handle.flagWidth }}
              role="slider"
              tabIndex={0}
              aria-label={L.slider}
              aria-orientation="horizontal"
              aria-valuemin={d0}
              aria-valuemax={d1}
              aria-valuenow={price}
              aria-valuetext={valueText}
              onKeyDown={onKeyDown}
            >
              <Grip side="left" />
              {priceText}
              <Grip side="right" />
            </div>
          ))}
      </div>
      <p className={css.axisTitle}>{props.xLabel ?? (asset ? `${asset} price at the deadline, ${unit} per unit` : `Price at the deadline, ${unit}`)}</p>
      <figcaption className={css.caption}>{caption}</figcaption>
      <p className={css.vh} id={descId}>
        {description}
      </p>
      <DataTable
        caption={props.tableCaption ?? `${title}: sampled points`}
        columns={[{ header: asset ? `${asset} price (${unit})` : `Price (${unit})`, numeric: true }, { header: `Payoff (${unit})`, numeric: true }, { header: 'Result' }]}
        rows={rows}
        visible={tableVisible}
      />
    </figure>
  )
}
