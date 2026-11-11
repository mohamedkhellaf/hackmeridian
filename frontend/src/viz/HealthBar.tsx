import { useId } from 'react'
import type { ReactNode } from 'react'
import { sentences } from './a11y.ts'
import { cx } from './cx.ts'
import { crisp, trianglePath } from './geometry.ts'
import { ROW_H, healthLayout, healthState } from './healthLayout.ts'
import type { HealthState } from './healthLayout.ts'
import { Hatch } from './parts.tsx'
import { clamp, linearScale } from './scales.ts'
import { useChartWidth } from './useChartWidth.ts'
import { useTextMeasure } from './measure.ts'
import shared from './viz.module.css'
import css from './HealthBar.module.css'

const STATE_WORDS: Record<HealthState, string> = {
  liquidatable: 'Liquidatable',
  restricted: 'Below opening margin',
  open: 'Above opening margin',
  unknown: 'Requirement unavailable',
}

export interface HealthBarProps {
  /** Net liquidation value of the account. */
  nlv: number
  /** Maintenance margin: below it the account can be liquidated. */
  mm: number
  /** Initial margin: below it no new position can be opened. */
  im: number
  /** Exact, caller-formatted labels: "Account value 23,507.59". */
  nlvLabel: string
  /** "Liquidation (MM) 43,945.44" */
  mmLabel: string
  /** "Opening (IM) 54,931.80" */
  imLabel: string
  /** Used when the long labels do not fit: "MM 43,945.44". */
  mmShortLabel?: string
  imShortLabel?: string
  /** The word for the state. Defaults to Liquidatable, Below opening margin, Above opening margin. */
  stateLabel?: string
  /** The sentence that states the distance to liquidation in exact figures. */
  status?: ReactNode
  /** `compact` is a 64 px meter for table cells: no labels, the name carries the figures. */
  variant?: 'full' | 'compact'
  /** Accessible name of the drawing. Defaults to the three labels and the state. */
  label?: string
  className?: string
}

/**
 * Margin account health as a linear bar: account value against the liquidation and opening requirements.
 * The liquidation zone is hatched and every state has a word. There is no "healthy" zone on purpose.
 */
export function HealthBar(props: HealthBarProps) {
  const { nlv, mm, im, nlvLabel, mmLabel, imLabel, variant = 'full' } = props
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [ref, width] = useChartWidth<HTMLDivElement>(variant === 'compact' ? 64 : 420, variant === 'compact' ? 40 : 160)
  const measureText = useTextMeasure()
  const measure = (text: string, strong = false) => measureText(text, strong ? shared.tStrong : shared.t)
  const state = healthState(nlv, mm, im)
  const word = props.stateLabel ?? STATE_WORDS[state]
  const name = props.label ?? sentences(nlvLabel, mmLabel, imLabel, word)
  const hatchId = `${uid}-hatch`

  if (variant === 'compact') {
    const h = 12
    const w = width
    const max = Math.max(1.5 * im, 1.1 * nlv, mm, 1e-9)
    const s = linearScale([0, max], [1, w - 1])
    const known = state !== 'unknown'
    const xm = known ? clamp(s(mm), 1, w - 1) : 1
    const xi = known ? clamp(s(im), 1, w - 1) : 1
    const xn = known ? clamp(s(Math.max(0, nlv)), 1, w - 1) : 1
    return (
      <span className={cx(css.compact, props.className)} ref={ref} data-state={state}>
        <svg className={shared.svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={name}>
          <defs>
            <Hatch id={hatchId} period={4} />
          </defs>
          <rect x={1.5} y={3.5} width={Math.max(0, w - 3)} height={5} className={css.trackBox} />
          {known && (
            <>
              <rect x={1} y={3} width={Math.max(0, xm - 1)} height={6} fill={`url(#${hatchId})`} />
              <rect x={xm} y={3} width={Math.max(0, xi - xm)} height={6} className={css.zoneWarn} />
              <line x1={crisp(xm)} x2={crisp(xm)} y1={2} y2={10} className={css.threshold} />
              <line x1={crisp(xi)} x2={crisp(xi)} y1={2} y2={10} className={css.threshold} />
              <line x1={xn} x2={xn} y1={0} y2={h} className={css.marker} />
            </>
          )}
        </svg>
      </span>
    )
  }

  const known = state !== 'unknown'
  const layout = healthLayout({
    width,
    nlv: known ? nlv : 0,
    mm: known ? mm : 0,
    im: known ? im : 1,
    nlvText: nlvLabel,
    mmTexts: props.mmShortLabel ? [mmLabel, props.mmShortLabel] : [mmLabel],
    imTexts: props.imShortLabel ? [imLabel, props.imShortLabel] : [imLabel],
    measure,
  })
  const { track, x } = layout
  const trackBottom = track.top + track.height
  const labelBase = trackBottom + 8 + 11

  return (
    <div className={cx(css.health, props.className)} data-state={state}>
      <div className={shared.plot} ref={ref}>
        <svg className={shared.svg} width={width} height={known ? layout.height : trackBottom + 4} viewBox={`0 0 ${width} ${known ? layout.height : trackBottom + 4}`} role="img" aria-label={name}>
          <defs>
            <Hatch id={hatchId} />
          </defs>
          {known && (
            <>
              <rect x={track.left} y={track.top} width={Math.max(0, x.mm - track.left)} height={track.height} className={css.zoneLiquidation} />
              <rect x={track.left} y={track.top} width={Math.max(0, x.mm - track.left)} height={track.height} fill={`url(#${hatchId})`} />
              <rect x={x.mm} y={track.top} width={Math.max(0, x.im - x.mm)} height={track.height} className={css.zoneWarn} />
            </>
          )}
          <rect x={track.left + 0.5} y={track.top + 0.5} width={Math.max(0, track.right - track.left - 1)} height={track.height - 1} className={css.trackBox} />
          {known && (
            <>
              <line x1={crisp(x.mm)} x2={crisp(x.mm)} y1={track.top - 2} y2={trackBottom + 5} className={css.threshold} />
              <line x1={crisp(x.im)} x2={crisp(x.im)} y1={track.top - 2} y2={trackBottom + 5} className={css.threshold} />
              {mm > 0 && Math.abs(x.nlv - x.mm) > 6 && <line x1={x.nlv} x2={x.mm} y1={track.top + track.height / 2} y2={track.top + track.height / 2} className={css.distance} />}
              <line x1={x.nlv} x2={x.nlv} y1={track.top - 4} y2={trackBottom + 2} className={css.marker} />
              <path d={trianglePath(x.nlv, track.top - 7, 7, 'down')} className={shared.inkMark} />
              <text x={layout.nlvLabel.x} y={12} className={cx(shared.tStrong, shared.ink)}>
                {layout.nlvLabel.text}
              </text>
              {layout.thresholds.map((t) => (
                <text key={t.id} x={t.x} y={labelBase + t.row * ROW_H} className={shared.t}>
                  {t.text}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>
      <p className={css.status}>
        <strong className={css.state}>{word}.</strong>
        {props.status && <> {props.status}</>}
      </p>
    </div>
  )
}
