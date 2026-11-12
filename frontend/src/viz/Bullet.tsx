import { useId } from 'react'
import { crisp } from './geometry.ts'
import { Hatch } from './parts.tsx'
import { bulletGeometry } from './bulletGeometry.ts'
import { useChartWidth } from './useChartWidth.ts'
import css from './Bullet.module.css'

export interface BulletProps {
  value: number
  /** The amount the bar is measured against, drawn as a tick. */
  target?: number
  /** Value at the right end of the scale. */
  max: number
  /** How the part beyond the target is drawn: a gain (outcome bars) or neutral (reserves are never coloured "good"). */
  excess?: 'gain' | 'neutral'
  height?: number
  /** Accessible name. Without it the drawing is hidden from assistive technology. */
  label?: string
}

/**
 * A bar against a target tick. A shortfall is hatched and outlined, so it reads without colour; what exceeds
 * the target continues past the tick.
 */
export function Bullet({ value, target, max, excess = 'neutral', height = 16, label }: BulletProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [ref, width] = useChartWidth<HTMLDivElement>(160, 24)
  const inner = Math.max(1, width - 2)
  const g = bulletGeometry(value, target, max, inner)
  const mid = height / 2
  const barH = 6
  return (
    <div className={css.bullet} ref={ref}>
      <svg className={css.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
        <defs>
          <Hatch id={`${uid}-hatch`} period={4} />
        </defs>
        <g transform="translate(1 0)">
          <line x1={0} x2={inner} y1={crisp(mid + barH / 2)} y2={crisp(mid + barH / 2)} className={css.track} />
          {g.bar > 0 && <rect x={0} y={mid - barH / 2} width={g.bar} height={barH} className={css.bar} />}
          {g.excess && <rect x={g.excess[0] + 1.5} y={mid - barH / 2} width={Math.max(0, g.excess[1] - g.excess[0] - 1.5)} height={barH} className={excess === 'gain' ? css.gain : css.neutral} />}
          {g.shortfall && (
            <>
              <rect x={g.shortfall[0]} y={mid - barH / 2} width={g.shortfall[1] - g.shortfall[0]} height={barH} fill={`url(#${uid}-hatch)`} />
              <rect x={g.shortfall[0] + 0.5} y={mid - barH / 2 + 0.5} width={Math.max(0, g.shortfall[1] - g.shortfall[0] - 1)} height={barH - 1} className={css.shortfall} />
            </>
          )}
          {g.tick !== null && <line x1={g.tick} x2={g.tick} y1={1} y2={height - 1} className={css.tick} />}
        </g>
      </svg>
    </div>
  )
}
