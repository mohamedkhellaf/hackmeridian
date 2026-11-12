import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import { trianglePath } from './geometry.ts'
import type { Point } from './geometry.ts'
import type { Rect } from './labels.ts'
import { BASELINE, SPAN_GAP, TRIANGLE, TRIANGLE_W } from './richLabel.ts'
import type { PlacedLabel, Tone } from './richLabel.ts'
import css from './viz.module.css'

const toneClass: Record<Tone, string> = {
  label: '',
  muted: css.muted,
  ink: css.ink,
  gain: css.gain,
  loss: css.loss,
}

const markClass: Record<'gain' | 'loss' | 'ink', string> = {
  gain: css.gainMark,
  loss: css.lossMark,
  ink: css.inkMark,
}

export function VisuallyHidden({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span className={css.vh} id={id}>
      {children}
    </span>
  )
}

/** The 45 degree hatch of the loss area (and of anything that is a shortfall or a deficit). One per chart. */
export function Hatch({ id, tone = 'loss', period = 5 }: { id: string; tone?: 'loss' | 'ink'; period?: number }) {
  return (
    <pattern id={id} width={period} height={period} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="1.1" height={period} className={tone === 'loss' ? css.hatchStripe : css.hatchStripeInk} />
    </pattern>
  )
}

/**
 * A mask that is white everywhere except the given boxes and circles. Rules and hatching drawn through it stop
 * short of the labels, and open circles stay open on any ground.
 */
export function Knockout({
  id,
  width,
  height,
  boxes = [],
  circles = [],
}: {
  id: string
  width: number
  height: number
  boxes?: readonly Rect[]
  circles?: ReadonlyArray<Point & { r: number }>
}) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={-8} y={-8} width={width + 16} height={height + 16}>
      <rect x={-8} y={-8} width={width + 16} height={height + 16} fill="#fff" />
      {boxes.map((b, i) => (
        <rect key={`b${i}`} x={b.x - 2} y={b.y - 1} width={b.width + 4} height={b.height + 2} fill="#000" />
      ))}
      {circles.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r} fill="#000" />
      ))}
    </mask>
  )
}

export function Triangle({ x, y, direction, tone, size = TRIANGLE }: { x: number; y: number; direction: 'up' | 'down'; tone: 'gain' | 'loss' | 'ink'; size?: number }) {
  return <path d={trianglePath(x, y, size, direction)} className={markClass[tone]} />
}

/** A placed direct label: text spans in their tones, then the triangle that goes with a gain or loss figure. */
export function SvgLabel({ label }: { label: PlacedLabel }) {
  let cursor = label.box.x
  const baseline = label.box.y + BASELINE
  const nodes: ReactNode[] = []
  label.spans.forEach((span, i) => {
    if (span.triangle) {
      const tone = span.tone === 'gain' || span.tone === 'loss' ? span.tone : 'ink'
      nodes.push(<Triangle key={i} x={cursor + TRIANGLE_W / 2} y={label.box.y + label.box.height / 2 + 0.5} direction={span.triangle} tone={tone} />)
    } else {
      nodes.push(
        <text key={i} x={cursor} y={baseline} className={cx(span.strong ? css.tStrong : css.t, toneClass[span.tone ?? 'label'])}>
          {span.text}
        </text>,
      )
    }
    cursor += label.spanWidths[i] + SPAN_GAP
  })
  return <g data-label={label.id}>{nodes}</g>
}

export interface TableColumn {
  header: string
  numeric?: boolean
}

export interface TableRow {
  key: string
  cells: readonly string[]
  current?: boolean
}

/**
 * The table twin of a chart: the same values as text, for screen readers and for anyone who cannot use the
 * drawing. Hidden visually by default.
 */
export function DataTable({ caption, columns, rows, visible = false }: { caption: string; columns: readonly TableColumn[]; rows: readonly TableRow[]; visible?: boolean }) {
  return (
    <div className={visible ? css.tableWrap : css.vh}>
      <table className={css.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" data-numeric={c.numeric ? 'true' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} aria-current={row.current ? 'true' : undefined}>
              {row.cells.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" data-numeric={columns[i]?.numeric ? 'true' : undefined}>
                    {cell}
                  </th>
                ) : (
                  <td key={i} data-numeric={columns[i]?.numeric ? 'true' : undefined}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The flag of the price handle: an ink tag with two small grips, positioned under the plot. */
export function Grip({ side }: { side: 'left' | 'right' }) {
  return (
    <svg className={css.grip} viewBox="0 0 4 8" aria-hidden="true" focusable="false">
      <path d={side === 'left' ? 'M4 0L0 4L4 8Z' : 'M0 0L4 4L0 8Z'} />
    </svg>
  )
}
