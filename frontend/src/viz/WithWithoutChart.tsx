import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { direction, sentences } from './a11y.ts'
import type { Direction } from './a11y.ts'
import { autoDecimals, formatAxis, formatNumber, formatSigned } from './format.ts'
import { interpolateAt, linePath, polygonPath, sortPoints } from './geometry.ts'
import { cx } from './cx.ts'
import { DataTable, Grip, Hatch, Knockout, SignGlyph, SvgLabel } from './parts.tsx'
import type { TableRow } from './parts.tsx'
import type { PayoffReference } from './PayoffChart.tsx'
import { needsBareGround } from './richLabel.ts'
import { extent, niceStep, niceTicks } from './scales.ts'
import { useChartWidth } from './useChartWidth.ts'
import { useControlledPrice, usePriceSlider } from './usePriceSlider.ts'
import { useTextMeasure } from './measure.ts'
import { withWithoutLayout } from './withWithoutLayout.ts'
import type { WithWithoutPoint } from './withWithoutLayout.ts'
import css from './viz.module.css'

export interface WithWithoutReadoutState {
  price: number
  withValue: number
  withoutValue: number
  /** withValue minus withoutValue. */
  difference: number
  direction: Direction
  priceText: string
  withText: string
  withoutText: string
  /** Signed, with the true minus sign. */
  differenceText: string
}

export interface WithWithoutChartProps {
  /** Value of the holding at the deadline with and without the option, against the price. Sample the kinks exactly. */
  points: readonly WithWithoutPoint[]
  domain?: readonly [number, number]
  /** The floor or the cap, with its full label: "Floor 10.00", "Cap 11.00". */
  level?: { value: number; label: string }
  /** The reference price, always with its source in the label. */
  reference?: PayoffReference
  /** Direct label of the solid line, for example "With the put". */
  withLabel: string
  /** Direct label of the dashed line. */
  withoutLabel?: string
  price?: number
  defaultPrice?: number
  onPriceChange?: (price: number) => void
  step?: number
  largeStep?: number
  readOnly?: boolean
  /** Quote unit of the values, for example "USDx". */
  unit: string
  asset?: string
  decimals?: number
  priceDecimals?: number
  /** Accessible name of the drawing. */
  title: string
  description?: string
  /** Required: the caption carries the "hypothetical, not a quote" sentence. */
  caption: ReactNode
  /** Replaces the two figures above the plot. `false` removes them. */
  readout?: ReactNode | ((state: WithWithoutReadoutState) => ReactNode) | false
  /** Replaces the sentence read on the handle. */
  valueText?: (state: WithWithoutReadoutState) => string
  xLabel?: string
  /** Accessible name of the handle. */
  sliderLabel?: string
  height?: number
  tableVisible?: boolean
  tableCaption?: string
  className?: string
}

/**
 * What a holding is worth at the deadline with the option (solid ink) and without it (dashed). The area between
 * the two is tinted where the option leaves more and hatched where it costs.
 */
export function WithWithoutChart(props: WithWithoutChartProps) {
  const { points, unit, asset, title, caption, withLabel, withoutLabel = 'Without', decimals = 2, readOnly = false, tableVisible = false } = props
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [wrapRef, width] = useChartWidth<HTMLDivElement>(560, 200)
  const measureText = useTextMeasure()
  const measure = (text: string, strong = false) => measureText(text, strong ? css.tStrong : css.t)

  const withData = useMemo(() => sortPoints(points.map((p) => ({ x: p.x, y: p.with }))), [points])
  const withoutData = useMemo(() => sortPoints(points.map((p) => ({ x: p.x, y: p.without }))), [points])
  const xs = extent(withData.map((p) => p.x)) ?? [0, 1]
  const d0 = Math.min(props.domain?.[0] ?? xs[0], props.domain?.[1] ?? xs[1])
  const d1 = Math.max(props.domain?.[0] ?? xs[0], props.domain?.[1] ?? xs[1])
  const priceDecimals = props.priceDecimals ?? autoDecimals(d1 - d0)
  const fmtPrice = (v: number) => formatNumber(v, priceDecimals)
  const fmtValue = (v: number) => formatNumber(v, decimals)

  const step = props.step ?? (niceStep(d1 - d0, 100) || 1)
  const start = props.defaultPrice ?? props.reference?.value ?? props.level?.value ?? (d0 + d1) / 2
  const [rawPrice, setPrice] = useControlledPrice(props.price, start, props.onPriceChange)
  const showHandle = !(readOnly && props.price === undefined)
  const price = Math.min(d1, Math.max(d0, rawPrice))
  const at = (p: number) => {
    const withValue = interpolateAt(withData, p)
    const withoutValue = interpolateAt(withoutData, p)
    return { withValue, withoutValue, difference: withValue - withoutValue }
  }
  const now = at(price)
  const state: WithWithoutReadoutState = {
    price,
    ...now,
    direction: direction(now.difference, decimals),
    priceText: fmtPrice(price),
    withText: fmtValue(now.withValue),
    withoutText: fmtValue(now.withoutValue),
    differenceText: formatSigned(now.difference, decimals),
  }

  const height = props.height ?? (width < 360 ? 200 : width < 560 ? 220 : 250)
  const layout = withWithoutLayout({
    width,
    height,
    points,
    domain: [d0, d1],
    level: props.level ? { value: props.level.value, text: props.level.label } : undefined,
    reference: props.reference ? { value: props.reference.value, text: props.reference.label } : undefined,
    withText: withLabel,
    withoutText: withoutLabel,
    price: showHandle ? price : undefined,
    priceText: showHandle ? state.priceText : undefined,
    minText: formatAxis(d0, priceDecimals),
    maxText: formatAxis(d1, priceDecimals),
    measure,
  })

  const { sliderRef, dragging, plotHandlers, onKeyDown } = usePriceSlider({
    plotRef: wrapRef,
    value: price,
    min: d0,
    max: d1,
    step,
    largeStep: props.largeStep,
    onChange: setPrice,
    invert: layout.x.invert,
    magnets: [...(props.level ? [props.level.value] : []), ...(props.reference ? [props.reference.value] : [])],
    pxPerUnit: (layout.plot.right - layout.plot.left) / (d1 - d0 || 1),
    disabled: readOnly,
  })

  const valueText = props.valueText?.(state) ?? `At ${state.priceText}. ${withLabel}: ${state.withText} ${unit}. ${withoutLabel}: ${state.withoutText} ${unit}.`
  const description = props.description ?? sentences(props.level?.label, props.reference?.label, `Solid line: ${withLabel}`, `Dashed line: ${withoutLabel}`)

  const readout =
    props.readout === false ? null : typeof props.readout === 'function' ? (
      props.readout(state)
    ) : props.readout !== undefined ? (
      props.readout
    ) : showHandle ? (
      <div className={css.readoutBlock}>
        <p className={css.readoutLabel}>{asset ? `If ${asset} is at ${state.priceText} at the deadline` : `At ${state.priceText} at the deadline`}</p>
        <dl className={css.pair}>
          <div>
            <dt>{withLabel}</dt>
            <dd>
              {state.withText} <span className={css.readoutUnit}>{unit}</span>
            </dd>
          </div>
          <div>
            <dt>{withoutLabel}</dt>
            <dd data-secondary="true">
              {state.withoutText} <span className={css.readoutUnit}>{unit}</span>
            </dd>
          </div>
        </dl>
        <p className={css.difference} data-direction={state.direction}>
          {state.direction !== 'even' && <SignGlyph direction={state.direction} />}
          <span>
            Difference {state.differenceText} {unit}
          </span>
        </p>
      </div>
    ) : null

  const tablePrices = [...new Set([d0, d1, ...niceTicks(d0, d1, 6), ...(props.level ? [props.level.value] : []), ...(props.reference ? [props.reference.value] : []), ...(showHandle ? [price] : [])])]
    .filter((v) => v >= d0 && v <= d1)
    .sort((a, b) => a - b)
  const rows: TableRow[] = tablePrices.map((p) => {
    const v = at(p)
    return { key: String(p), cells: [fmtPrice(p), fmtValue(v.withValue), fmtValue(v.withoutValue), formatSigned(v.difference, decimals)], current: showHandle && p === price }
  })

  const { plot, handle } = layout
  const hatchId = `${uid}-hatch`
  const labelMask = `${uid}-labels`
  const tintMask = `${uid}-tint`
  const circleMask = `${uid}-circles`
  const descId = `${uid}-desc`
  const knockCircles = handle
    ? [
        { x: handle.x, y: handle.yWith, r: 6.5 },
        { x: handle.x, y: handle.yWithout, r: 4 },
      ]
    : []

  return (
    <figure className={cx(css.figure, props.className)} data-viz="with-without">
      {readout}
      <div
        className={css.plot}
        ref={wrapRef}
        data-interactive={showHandle && !readOnly ? 'true' : undefined}
        data-dragging={dragging ? 'true' : undefined}
        {...(showHandle && !readOnly ? plotHandlers : {})}
      >
        <svg className={css.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} aria-describedby={descId} data-testid="with-without-chart">
          <defs>
            <Hatch id={hatchId} />
            <Knockout id={labelMask} width={width} height={height} boxes={layout.labels.map((l) => l.box)} />
            <Knockout id={tintMask} width={width} height={height} boxes={layout.labels.filter(needsBareGround).map((l) => l.box)} />
            <Knockout id={circleMask} width={width} height={height} circles={knockCircles} />
          </defs>
          <line x1={plot.left} x2={plot.right} y1={layout.axisY} y2={layout.axisY} className={css.axis} />
          <g mask={`url(#${circleMask})`}>
            <g mask={`url(#${tintMask})`}>
              {layout.helps.map((poly, i) => (
                <path key={`h${i}`} d={polygonPath(poly)} className={css.gainArea} />
              ))}
            </g>
            <g mask={`url(#${labelMask})`}>
              {layout.costs.map((poly, i) => (
                <path key={`c${i}`} d={polygonPath(poly)} fill={`url(#${hatchId})`} />
              ))}
              {layout.level && <line x1={layout.level.x} x2={layout.level.x} y1={plot.top} y2={layout.axisY} className={css.dotted} />}
            </g>
            <path d={linePath(layout.withoutLine)} className={css.lineAlt} />
            <path d={linePath(layout.withLine)} className={css.line} />
          </g>
          {handle && (
            <g mask={`url(#${labelMask})`}>
              <line x1={handle.x} x2={handle.x} y1={handle.top} y2={handle.flagTop} className={css.rule} />
            </g>
          )}
          {layout.reference && <line x1={layout.reference.x} x2={layout.reference.x} y1={layout.axisY - 7} y2={layout.axisY + 4} className={css.tick} />}
          {handle && (
            <>
              <circle cx={handle.x} cy={handle.yWithout} r={4} className={css.openDotAlt} />
              <circle cx={handle.x} cy={handle.yWith} r={4} className={css.dot} />
            </>
          )}
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
              {state.priceText}
            </div>
          ) : (
            <div
              ref={sliderRef}
              className={css.handle}
              style={{ left: handle.flagLeft, top: handle.flagTop, width: handle.flagWidth }}
              role="slider"
              tabIndex={0}
              aria-label={props.sliderLabel ?? 'Assumed price at the deadline'}
              aria-orientation="horizontal"
              aria-valuemin={d0}
              aria-valuemax={d1}
              aria-valuenow={price}
              aria-valuetext={valueText}
              onKeyDown={onKeyDown}
            >
              <Grip side="left" />
              {state.priceText}
              <Grip side="right" />
            </div>
          ))}
      </div>
      {layout.keyNeeded && (
        <ul className={css.key}>
          <li>
            <svg className={css.keySwatch} width="20" height="8" viewBox="0 0 20 8" aria-hidden="true" focusable="false">
              <line x1="0" x2="20" y1="4" y2="4" className={css.line} />
            </svg>
            {withLabel}
          </li>
          <li>
            <svg className={css.keySwatch} width="20" height="8" viewBox="0 0 20 8" aria-hidden="true" focusable="false">
              <line x1="0" x2="20" y1="4" y2="4" className={css.lineAlt} />
            </svg>
            {withoutLabel}
          </li>
        </ul>
      )}
      <p className={css.axisTitle}>{props.xLabel ?? (asset ? `${asset} price at the deadline, ${unit} per unit` : `Price at the deadline, ${unit}`)}</p>
      <figcaption className={css.caption}>{caption}</figcaption>
      <p className={css.vh} id={descId}>
        {description}
      </p>
      <DataTable
        caption={props.tableCaption ?? `${title}: sampled points`}
        columns={[
          { header: asset ? `${asset} price (${unit})` : `Price (${unit})`, numeric: true },
          { header: `${withLabel} (${unit})`, numeric: true },
          { header: `${withoutLabel} (${unit})`, numeric: true },
          { header: `Difference (${unit})`, numeric: true },
        ]}
        rows={rows}
        visible={tableVisible}
      />
    </figure>
  )
}
