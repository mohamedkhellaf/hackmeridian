// Layout of the "with and without" figure: the value of a holding at the deadline with the option (solid) and
// without it (dashed). Pure; the label rules are covered by unit tests.

import { bandsBetween, clipLine, crisp, interpolateAt, project, rangeWithin, sortPoints } from './geometry.ts'
import type { Point } from './geometry.ts'
import { boxIsFree, placeLane } from './labels.ts'
import type { Rect } from './labels.ts'
import { FLAG_EXTRA, LANE_H } from './payoffLayout.ts'
import type { LaneLabel } from './payoffLayout.ts'
import { TEXT_H, placed, plain, richWidth } from './richLabel.ts'
import type { Measure, PlacedLabel, RichLabel } from './richLabel.ts'
import { clamp, extent, linearScale } from './scales.ts'
import type { LinearScale } from './scales.ts'

const PAD_TOP = 4
const PAD_SIDE = 6
const HEAD = 24
const FOOT = 12

export interface WithWithoutPoint {
  /** Price of the underlying at the deadline. */
  x: number
  /** Value held with the option. */
  with: number
  /** Value held without it. */
  without: number
}

export interface WithWithoutLayoutInput {
  width: number
  height: number
  points: readonly WithWithoutPoint[]
  domain: readonly [number, number]
  /** The floor or the cap: a dotted rule with its label, for example "Floor 10.00". */
  level?: { value: number; text: string }
  reference?: { value: number; text: string }
  withText: string
  withoutText: string
  price?: number
  priceText?: string
  minText: string
  maxText: string
  measure: Measure
}

export interface WithWithoutLayout {
  width: number
  height: number
  x: LinearScale
  y: LinearScale
  plot: { left: number; right: number; top: number; bottom: number }
  axisY: number
  laneBaseline: number
  withLine: Point[]
  withoutLine: Point[]
  /** Areas where the option leaves the holder with more, and with less. */
  helps: Point[][]
  costs: Point[][]
  level: { x: number; value: number } | null
  reference: { x: number; value: number } | null
  labels: PlacedLabel[]
  /** True when a series label found no room: the caller then shows a key under the plot. */
  keyNeeded: boolean
  lane: LaneLabel[]
  /** The assumed price: a dot on each line, a drop line from `top` down to the flag under the axis. */
  handle: { x: number; value: number; yWith: number; yWithout: number; top: number; flagLeft: number; flagWidth: number; flagTop: number } | null
}

/** Label boxes hugging one side of a line, stepping inward from one end of the plot. */
function along(line: readonly Point[], width: number, side: 'above' | 'below', from: 'left' | 'right', left: number, right: number): Rect[] {
  const out: Rect[] = []
  const room = right - left - width - 4
  if (room < 0) return out
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * 0.85
    const x0 = from === 'left' ? left + 2 + t * room : right - 2 - width - t * room
    const [lo, hi] = rangeWithin(line, x0 - 3, x0 + width + 3)
    out.push({ x: x0, y: side === 'above' ? lo - 5 - TEXT_H : hi + 5, width, height: TEXT_H })
  }
  return out
}

export function withWithoutLayout(input: WithWithoutLayoutInput): WithWithoutLayout {
  const { width, height, measure } = input
  const d0 = Math.min(input.domain[0], input.domain[1])
  const d1 = Math.max(input.domain[0], input.domain[1])
  const withData = clipLine(sortPoints(input.points.map((p) => ({ x: p.x, y: p.with }))), d0, d1)
  const withoutData = clipLine(sortPoints(input.points.map((p) => ({ x: p.x, y: p.without }))), d0, d1)

  const left = PAD_SIDE
  const right = width - PAD_SIDE
  const laneTop = height - LANE_H
  const top = PAD_TOP
  const axisY = crisp(laneTop)
  const x = linearScale([d0, d1], [left, right])
  const ys = extent([...withData, ...withoutData].map((p) => p.y)) ?? [0, 1]
  let [yLo, yHi] = ys
  if (yHi - yLo === 0) {
    yLo -= 1
    yHi += 1
  }
  const y = linearScale([yLo, yHi], [axisY - FOOT, top + HEAD])
  const withLine = project(withData, x, y)
  const withoutLine = project(withoutData, x, y)
  const bands = bandsBetween(withData, withoutData)
  const helps = bands.filter((b) => b.sign === 1).map((b) => project(b.points, x, y))
  const costs = bands.filter((b) => b.sign === -1).map((b) => project(b.points, x, y))

  const inside = (v: number) => Number.isFinite(v) && v >= d0 && v <= d1
  const level = input.level && inside(input.level.value) ? { ...input.level, x: crisp(x(input.level.value)) } : null
  const reference = input.reference && inside(input.reference.value) ? { ...input.reference, x: crisp(x(input.reference.value)) } : null

  // ---- Labels inside the plot --------------------------------------------------------------------------
  const bounds: Rect = { x: left, y: 0, width: right - left, height: axisY - 3 }
  const lines = [withLine, withoutLine]
  const levelRule: Point[][] = level
    ? [
        [
          { x: level.x, y: top },
          { x: level.x, y: axisY },
        ],
      ]
    : []
  const labels: PlacedLabel[] = []
  const tryPlace = (id: string, label: RichLabel, candidates: readonly Rect[], avoidRule: boolean): boolean => {
    for (const box of candidates) {
      if (boxIsFree(box, { bounds, rects: labels.map((l) => l.box), lines: avoidRule ? [...lines, ...levelRule] : lines, gap: 4, linePad: 3 })) {
        labels.push(placed(id, label, box, measure))
        return true
      }
    }
    return false
  }

  if (level) {
    const label = plain(level.text)
    const w = richWidth(label, measure)
    const candidates: Rect[] = []
    for (const rowY of [top, top + TEXT_H + 4, top + 2 * (TEXT_H + 4)]) {
      candidates.push({ x: level.x + 6, y: rowY, width: w, height: TEXT_H })
      candidates.push({ x: level.x - 6 - w, y: rowY, width: w, height: TEXT_H })
    }
    tryPlace('level', label, candidates, false)
  }

  // Series labels go where the two lines are furthest apart, each on the outer side of its own line.
  const gapAt = (v: number) => Math.abs(interpolateAt(withData, v) - interpolateAt(withoutData, v))
  const from: 'left' | 'right' = gapAt(d0) >= gapAt(d1) ? 'left' : 'right'
  const other = from === 'left' ? 'right' : 'left'
  const end = from === 'left' ? d0 : d1
  const withAbove = interpolateAt(withData, end) >= interpolateAt(withoutData, end)
  const series = (id: string, text: string, line: Point[], strong: boolean, outer: 'above' | 'below'): boolean => {
    const label = plain(text, strong ? 'ink' : 'label', strong)
    const w = richWidth(label, measure)
    const inner = outer === 'above' ? 'below' : 'above'
    const candidates = [...along(line, w, outer, from, left, right), ...along(line, w, inner, from, left, right), ...along(line, w, outer, other, left, right), ...along(line, w, inner, other, left, right)]
    return tryPlace(id, label, candidates, true) || tryPlace(id, label, candidates, false)
  }
  const withPlaced = series('with', input.withText, withLine, true, withAbove ? 'above' : 'below')
  const withoutPlaced = series('without', input.withoutText, withoutLine, false, withAbove ? 'below' : 'above')
  const keyNeeded = !(withPlaced && withoutPlaced)
  if (keyNeeded) {
    // A key under the plot names both lines; a single direct label beside it would only confuse.
    for (let i = labels.length - 1; i >= 0; i--) if (labels[i].id === 'with' || labels[i].id === 'without') labels.splice(i, 1)
  }

  // Reference price: just above the axis, beside its tick. The row under the axis is the fallback.
  let referenceInLane = false
  if (reference) {
    const label = plain(reference.text)
    const w = richWidth(label, measure)
    const rowY = axisY - 4 - TEXT_H
    const slide = (v: number) => clamp(v, left, Math.max(left, right - w))
    const candidates: Rect[] = [
      { x: reference.x + 6, y: rowY, width: w, height: TEXT_H },
      { x: reference.x - 6 - w, y: rowY, width: w, height: TEXT_H },
      // Near an edge: slid back inside and lifted clear of the tick.
      { x: slide(reference.x + 6), y: rowY - 6, width: w, height: TEXT_H },
      { x: slide(reference.x - 6 - w), y: rowY - 6, width: w, height: TEXT_H },
      { x: slide(reference.x - w / 2), y: rowY - 6, width: w, height: TEXT_H },
    ]
    const inPlot: Rect = { ...bounds, height: axisY - bounds.y }
    const free = (avoidRule: boolean) =>
      candidates.find((box) => boxIsFree(box, { bounds: inPlot, rects: labels.map((l) => l.box), lines: avoidRule ? [...lines, ...levelRule] : lines, gap: 4, linePad: 3 }))
    const box = free(true) ?? free(false)
    if (box) labels.push(placed('reference', label, box, measure))
    else referenceInLane = true
  }

  // ---- The row under the axis ---------------------------------------------------------------------------
  const laneBaseline = laneTop + 4 + 14
  const hasHandle = input.price !== undefined && input.priceText !== undefined
  const priceValue = hasHandle ? clamp(input.price as number, d0, d1) : 0
  const priceX = crisp(x(priceValue))
  const flagWidth = hasHandle ? Math.ceil(measure(input.priceText as string, true)) + FLAG_EXTRA : 0
  const laneItems = [
    { id: 'min', x: left, width: measure(input.minText), anchor: 'start' as const, priority: 0 },
    { id: 'max', x: right, width: measure(input.maxText), anchor: 'end' as const, priority: 0 },
    ...(reference && referenceInLane ? [{ id: 'reference', x: reference.x, width: measure(reference.text), anchor: 'middle' as const, priority: 1 }] : []),
    ...(hasHandle ? [{ id: 'flag', x: priceX, width: flagWidth, anchor: 'middle' as const, priority: 3 }] : []),
  ]
  const lanePlaced = placeLane(laneItems, { min: 0, max: width, gap: 6 })
  const texts: Record<string, { text: string; tone: 'muted' | 'label' }> = {
    min: { text: input.minText, tone: 'muted' },
    max: { text: input.maxText, tone: 'muted' },
  }
  if (reference) texts.reference = { text: reference.text, tone: 'label' }
  const lane: LaneLabel[] = lanePlaced.filter((p) => p.id !== 'flag').map((p) => ({ id: p.id, x: p.x, ...texts[p.id] }))
  const flag = lanePlaced.find((p) => p.id === 'flag')

  return {
    width,
    height,
    x,
    y,
    plot: { left, right, top, bottom: axisY },
    axisY,
    laneBaseline,
    withLine,
    withoutLine,
    helps,
    costs,
    level: level ? { x: level.x, value: level.value } : null,
    reference: reference ? { x: reference.x, value: reference.value } : null,
    labels,
    keyNeeded,
    lane,
    handle:
      hasHandle && flag
        ? {
            x: priceX,
            value: priceValue,
            yWith: y(interpolateAt(withData, priceValue)),
            yWithout: y(interpolateAt(withoutData, priceValue)),
            top: Math.min(y(interpolateAt(withData, priceValue)), y(interpolateAt(withoutData, priceValue))),
            flagLeft: flag.left,
            flagWidth,
            flagTop: laneTop + 4,
          }
        : null,
  }
}
