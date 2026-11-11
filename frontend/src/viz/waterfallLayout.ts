import { spreadLane } from './labels.ts'
import { clamp } from './scales.ts'

export interface WaterfallBar {
  id: string
  x: number
  width: number
  kind: 'paid' | 'deficit'
  /** Position among the paid segments: 0 is drawn in ink, 1 in the mid tone, 2 in the light tone. */
  order: number
}

export interface WaterfallLayout {
  bars: WaterfallBar[]
  /** x of the line between what was paid and what was not, or null when there is no deficit. */
  paidX: number | null
  /** Labels under the bar, each starting under its segment, or null when they do not fit on one row. */
  labels: Array<{ id: string; x: number }> | null
  paidLabelX: number | null
}

export interface WaterfallLayoutInput {
  width: number
  segments: ReadonlyArray<{ id: string; value: number; kind?: 'paid' | 'deficit' }>
  max?: number
  /** Width of each label under the bar, swatch included. */
  labelWidths: readonly number[]
  paidLabelWidth?: number
  gap?: number
}

const SEGMENT_GAP = 2

/** Pure layout: segment widths with 2 px gaps, and one row of labels pushed apart until none touches. */
export function waterfallLayout({ width, segments, max, labelWidths, paidLabelWidth = 0, gap = 14 }: WaterfallLayoutInput): WaterfallLayout {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const top = Math.max(max ?? total, total) || 1
  const drawn = segments.filter((s) => s.value > 0)
  const usable = Math.max(0, width - SEGMENT_GAP * Math.max(0, drawn.length - 1))
  const bars: WaterfallBar[] = []
  const starts = new Map<string, number>()
  let cursor = 0
  let order = 0
  let paidX: number | null = null
  for (const s of segments) {
    const kind = s.kind ?? 'paid'
    starts.set(s.id, cursor)
    if (!(s.value > 0)) continue
    const w = (s.value / top) * usable
    if (kind === 'deficit' && paidX === null) paidX = Math.max(0, cursor - SEGMENT_GAP / 2)
    bars.push({ id: s.id, x: cursor, width: w, kind, order: kind === 'paid' ? order++ : 0 })
    cursor += w + SEGMENT_GAP
  }
  const spread = spreadLane(
    segments.map((s, i) => ({ id: s.id, x: starts.get(s.id) ?? 0, width: labelWidths[i] ?? 0, anchor: 'start' as const })),
    { min: 0, max: width, gap },
  )
  const paidLabelX = paidX === null || paidLabelWidth <= 0 || paidLabelWidth > width ? null : clamp(paidX - paidLabelWidth, 0, width - paidLabelWidth)
  return { bars, paidX, labels: spread ? spread.map((p) => ({ id: p.id, x: p.x })) : null, paidLabelX }
}
