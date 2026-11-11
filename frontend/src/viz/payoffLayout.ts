// Layout of the payoff figure: scales, areas and, above all, where every label goes. Pure, so the rule
// "labels never collide" is checked by unit tests over many widths and handle positions.

import { bandsBetween, clipLine, crisp, interpolateAt, levelLine, project, sortPoints } from './geometry.ts'
import type { Point } from './geometry.ts'
import { boxIsFree, cornerBox, placeLane } from './labels.ts'
import type { Anchor, Corner, Rect } from './labels.ts'
import { TEXT_H, placed, plain, richWidth } from './richLabel.ts'
import type { Measure, PlacedLabel, RichLabel } from './richLabel.ts'
import { clamp, extent, linearScale } from './scales.ts'
import type { LinearScale } from './scales.ts'

export const LANE_H = 28
export const FLAG_H = 20
/** Text plus padding and the two grips of the flag. */
export const FLAG_EXTRA = 28

const PAD_TOP = 4
const PAD_RIGHT = 6
const HEAD = 22
const FOOT = 22

export interface ExtremeAnchor {
  /** Data coordinates of the point the label is attached to. */
  x: number
  y: number
  align: Anchor
  /** True when the extreme itself lies outside the plotted range. */
  offScale: boolean
}

export interface ExtremeSpec {
  id: string
  kind: 'max' | 'min'
  anchor: ExtremeAnchor
  /** Longest first; the first variant that fits is used. */
  variants: readonly RichLabel[]
}

export interface PayoffLayoutInput {
  width: number
  height: number
  /** Payoff against price, in data units. */
  points: readonly Point[]
  domain: readonly [number, number]
  strikes?: ReadonlyArray<{ value: number; text: string }>
  breakevens?: ReadonlyArray<{ value: number; text: string }>
  reference?: { value: number; text: string }
  extremes?: readonly ExtremeSpec[]
  /** The assumed price and the text on its flag. Left out for a static figure. */
  price?: number
  priceText?: string
  minText: string
  maxText: string
  zeroText?: string
  measure: Measure
}

export interface LaneLabel {
  id: string
  x: number
  text: string
  tone: 'muted' | 'label'
}

export interface PayoffLayout {
  width: number
  height: number
  x: LinearScale
  y: LinearScale
  plot: { left: number; right: number; top: number; bottom: number }
  zeroY: number
  laneBaseline: number
  line: Point[]
  gain: Point[][]
  loss: Point[][]
  strikes: Array<{ x: number; value: number }>
  breakevens: Array<{ x: number; value: number }>
  reference: { x: number; value: number } | null
  /** Labels inside the plot. */
  labels: PlacedLabel[]
  /** Labels in the row under the plot. */
  lane: LaneLabel[]
  zeroLabel: { x: number; y: number; text: string }
  /** The assumed price: a dot on the line, a drop line from `top` down to the flag under the plot. */
  handle: { x: number; y: number; top: number; value: number; flagLeft: number; flagWidth: number; flagTop: number } | null
}

/** Where the label of a maximum or minimum attaches: the outer end of a flat stretch, or the visible end nearest an extreme that is off the chart. */
export function extremeAnchor(
  points: readonly Point[],
  domain: readonly [number, number],
  kind: 'max' | 'min',
  extreme: { value: number; at?: number },
): ExtremeAnchor | null {
  const [d0, d1] = domain
  const visible = clipLine(sortPoints(points), d0, d1)
  if (visible.length === 0) return null
  const first = visible[0]
  const last = visible[visible.length - 1]
  const better = (a: number, b: number) => (kind === 'max' ? a > b : a < b)
  if (extreme.at !== undefined && Number.isFinite(extreme.at) && (extreme.at < d0 || extreme.at > d1)) {
    return extreme.at < d0 ? { x: first.x, y: first.y, align: 'start', offScale: true } : { x: last.x, y: last.y, align: 'end', offScale: true }
  }
  if (!Number.isFinite(extreme.value)) {
    return better(first.y, last.y) ? { x: first.x, y: first.y, align: 'start', offScale: true } : { x: last.x, y: last.y, align: 'end', offScale: true }
  }
  let target = visible[0].y
  for (const p of visible) if (better(p.y, target)) target = p.y
  const scale = Math.max(1, ...visible.map((p) => Math.abs(p.y)))
  const eps = scale * 1e-9
  const at = visible.filter((p) => Math.abs(p.y - target) <= eps)
  const xa = at[0].x
  const xb = at[at.length - 1].x
  const signed = kind === 'max' ? extreme.value : -Math.abs(extreme.value)
  const offScale = Math.abs(target - signed) > Math.max(scale * 1e-6, 5e-8)
  if (xa <= first.x) return { x: first.x, y: target, align: 'start', offScale }
  if (xb >= last.x) return { x: last.x, y: target, align: 'end', offScale }
  return { x: (xa + xb) / 2, y: target, align: 'middle', offScale }
}

function alignedLeft(x: number, width: number, align: Anchor): number {
  return align === 'start' ? x : align === 'end' ? x - width : x - width / 2
}

export function payoffLayout(input: PayoffLayoutInput): PayoffLayout {
  const { width, height, measure } = input
  const d0 = Math.min(input.domain[0], input.domain[1])
  const d1 = Math.max(input.domain[0], input.domain[1])
  const visible = clipLine(sortPoints(input.points), d0, d1)

  const zeroText = input.zeroText ?? '0'
  const left = Math.ceil(measure(zeroText) + 8)
  const right = width - PAD_RIGHT
  const laneTop = height - LANE_H
  const top = PAD_TOP
  const bottom = laneTop
  const x = linearScale([d0, d1], [left, right])

  const ys = extent(visible.map((p) => p.y)) ?? [0, 0]
  let yLo = Math.min(ys[0], 0)
  let yHi = Math.max(ys[1], 0)
  if (yHi - yLo === 0) {
    yLo = -1
    yHi = 1
  } else if (ys[1] - ys[0] <= (yHi - yLo) * 1e-9) {
    // A flat line (an option far out of the money) would otherwise fill the whole plot with one band:
    // a small premium must not be drawn as a wall of hatching. Give it a third of the height.
    const span = yHi - yLo
    yLo -= span
    yHi += span
  }
  const y = linearScale([yLo, yHi], [bottom - FOOT, top + HEAD])
  const zeroY = crisp(y(0))
  const line = project(visible, x, y)
  const bands = bandsBetween(visible, levelLine(visible, 0))
  const gain = bands.filter((b) => b.sign === 1).map((b) => project(b.points, x, y))
  const loss = bands.filter((b) => b.sign === -1).map((b) => project(b.points, x, y))

  const inside = (v: number) => Number.isFinite(v) && v >= d0 && v <= d1
  const strikes = (input.strikes ?? []).filter((s) => inside(s.value)).map((s) => ({ ...s, x: crisp(x(s.value)) }))
  const breakevens = (input.breakevens ?? []).filter((b) => inside(b.value)).map((b) => ({ ...b, x: x(b.value) }))
  const reference = input.reference && inside(input.reference.value) ? { ...input.reference, x: crisp(x(input.reference.value)) } : null

  // ---- Labels inside the plot --------------------------------------------------------------------------
  const bounds: Rect = { x: 0, y: 0, width, height: laneTop - 1 }
  const zeroSegment: Point[] = [
    { x: left, y: zeroY },
    { x: right, y: zeroY },
  ]
  const strikeRules = strikes.map((s): Point[] => [
    { x: s.x, y: top },
    { x: s.x, y: bottom },
  ])
  const obstacleLines = (avoidRules: boolean) => (avoidRules ? [line, zeroSegment, ...strikeRules] : [line, zeroSegment])

  // One pass over every label, in order of how fixed its place is. `levels` picks the wording of each maximum
  // or minimum label: 0 is the full label, 1 the short one.
  const placeAll = (levels: readonly number[]) => {
    const labels: PlacedLabel[] = []
    let dropped = 0
    const strikesInLane: number[] = []
    let referenceInLane = false
    const tryPlace = (id: string, label: RichLabel, candidates: readonly Rect[], avoidRules: boolean): boolean => {
      for (const box of candidates) {
        if (boxIsFree(box, { bounds, rects: labels.map((l) => l.box), lines: obstacleLines(avoidRules), gap: 4, linePad: 3 })) {
          labels.push(placed(id, label, box, measure))
          return true
        }
      }
      return false
    }

    // Maximum and minimum: a gain label above the highest point, a loss label below the lowest, where the
    // line can never be in the way. A gain figure for a line that is under zero goes above the zero line
    // (and the reverse), so it never sits in the hatching.
    for (const [index, spec] of (input.extremes ?? []).entries()) {
      const px = x(spec.anchor.x)
      const py = y(spec.anchor.y)
      const aligns: Anchor[] = [spec.anchor.align, ...(['start', 'end', 'middle'] as const).filter((a) => a !== spec.anchor.align)]
      const variants = spec.variants.slice(Math.min(levels[index] ?? 0, spec.variants.length - 1))
      let done = false
      for (const variant of variants) {
        const w = richWidth(variant, measure)
        const atPoint = spec.kind === 'max' ? py - 5 - TEXT_H : py + 5
        const atZero = spec.kind === 'max' ? zeroY - 5 - TEXT_H : zeroY + 5
        const wrongSide = spec.kind === 'max' ? py > zeroY + 1 : py < zeroY - 1
        const rows = wrongSide ? [atZero, atPoint] : [atPoint, atZero]
        const candidates: Rect[] = []
        for (const rowY of rows) {
          for (const align of aligns) {
            const lx = clamp(alignedLeft(px, w, align), left, Math.max(left, right - w))
            candidates.push({ x: lx, y: rowY, width: w, height: TEXT_H })
          }
        }
        done = w <= right - left && (tryPlace(spec.id, variant, candidates, true) || tryPlace(spec.id, variant, candidates, false))
        if (done) break
      }
      if (!done) dropped += 1
    }

    // Breakeven: under the zero line on the side where the payoff is a gain, where the line is out of the way.
    for (const [i, be] of breakevens.entries()) {
      const label = plain(be.text)
      const w = richWidth(label, measure)
      const gainLeft = interpolateAt(visible, be.value - (d1 - d0) * 0.01) > 0
      const order: Corner[] = gainLeft ? ['below-left', 'above-right', 'below-right', 'above-left'] : ['below-right', 'above-left', 'below-left', 'above-right']
      const at = { x: be.x, y: zeroY }
      const corners = order.map((corner) => cornerBox({ at, width: w, height: TEXT_H, offset: 5 }, corner))
      // Next to an edge of the plot the same boxes are slid back inside, so a breakeven close to the edge keeps its label.
      const candidates = [...corners, ...corners.map((box) => ({ ...box, x: clamp(box.x, left, Math.max(left, right - w)) }))]
      if (!(tryPlace(`be-${i}`, label, candidates, true) || tryPlace(`be-${i}`, label, candidates, false))) dropped += 1
    }

    // Strike: at the head of its dotted rule, on whichever side is free; then at its foot, on the side that is
    // not hatched first. The row under the plot is the last resort.
    for (const [i, s] of strikes.entries()) {
      const label = plain(s.text)
      const w = richWidth(label, measure)
      const footY = bottom - TEXT_H - 3
      const inLoss = (box: Rect) => {
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        const lineY = y(interpolateAt(visible, x.invert(cx)))
        return lineY > zeroY && cy > zeroY && cy < lineY
      }
      const foot: Rect[] = [
        { x: s.x + 6, y: footY, width: w, height: TEXT_H },
        { x: s.x - 6 - w, y: footY, width: w, height: TEXT_H },
      ].sort((a, b) => Number(inLoss(a)) - Number(inLoss(b)))
      const candidates: Rect[] = [{ x: s.x + 6, y: top, width: w, height: TEXT_H }, { x: s.x - 6 - w, y: top, width: w, height: TEXT_H }, ...foot]
      if (!tryPlace(`strike-${i}`, label, candidates, false)) strikesInLane.push(i)
    }

    // Reference price: beside its tick on the zero line. Nearest first: next to the tick and across a dotted
    // rule (which is then interrupted behind the text) beats a clear spot further away, because a label that
    // drifts from its mark stops being a direct label.
    if (reference) {
      const label = plain(reference.text)
      const w = richWidth(label, measure)
      const at = { x: reference.x, y: zeroY }
      const rows: Rect[][] = []
      for (const offset of [6, 6 + TEXT_H + 3]) {
        const corners = (['above-right', 'above-left', 'below-right', 'below-left'] as const).map((corner) => cornerBox({ at, width: w, height: TEXT_H, offset }, corner))
        // Near an edge of the plot the same boxes are slid back inside, so the label stays by its tick.
        rows.push([...corners, ...corners.map((box) => ({ ...box, x: clamp(box.x, left, Math.max(left, right - w)) }))])
      }
      const fits = w <= right - left && rows.some((row) => tryPlace('reference', label, row, true) || tryPlace('reference', label, row, false))
      if (!fits) referenceInLane = true
    }
    return { labels, dropped: dropped + strikesInLane.length + (referenceInLane ? 1 : 0), strikesInLane, referenceInLane }
  }

  // Full wording first. If something had to give, shorten the maximum and minimum labels one at a time and
  // keep the least shortened combination that loses the fewest labels.
  const count = (input.extremes ?? []).length
  const combos: number[][] = []
  for (let mask = 0; mask < 1 << Math.min(count, 4); mask++) combos.push(Array.from({ length: count }, (_, i) => (mask >> i) & 1))
  combos.sort((p, q) => p.reduce((sum, v) => sum + v, 0) - q.reduce((sum, v) => sum + v, 0))
  let result = placeAll(combos[0])
  for (const levels of combos.slice(1)) {
    if (result.dropped === 0) break
    const next = placeAll(levels)
    if (next.dropped < result.dropped) result = next
  }
  const { labels, strikesInLane, referenceInLane } = result

  // ---- The row under the plot: axis ends, strike, the price flag ----------------------------------------
  const laneBaseline = laneTop + 4 + 14
  const minW = measure(input.minText)
  const maxW = measure(input.maxText)
  const hasHandle = input.price !== undefined && input.priceText !== undefined
  const priceValue = hasHandle ? clamp(input.price as number, d0, d1) : 0
  const priceX = crisp(x(priceValue))
  const flagWidth = hasHandle ? Math.ceil(measure(input.priceText as string, true)) + FLAG_EXTRA : 0

  const laneItems = [
    { id: 'min', x: left, width: minW, anchor: 'start' as const, priority: 0 },
    { id: 'max', x: right, width: maxW, anchor: 'end' as const, priority: 0 },
    ...strikesInLane.map((i) => ({ id: `strike-${i}`, x: strikes[i].x, width: measure(strikes[i].text), anchor: 'middle' as const, priority: 2 })),
    ...(reference && referenceInLane ? [{ id: 'reference', x: reference.x, width: measure(reference.text), anchor: 'middle' as const, priority: 1 }] : []),
    ...(hasHandle ? [{ id: 'flag', x: priceX, width: flagWidth, anchor: 'middle' as const, priority: 3 }] : []),
  ]
  const lanePlaced = placeLane(laneItems, { min: 0, max: width, gap: 6 })
  const texts: Record<string, { text: string; tone: 'muted' | 'label' }> = {
    min: { text: input.minText, tone: 'muted' },
    max: { text: input.maxText, tone: 'muted' },
  }
  strikes.forEach((s, i) => {
    texts[`strike-${i}`] = { text: s.text, tone: 'label' }
  })
  if (reference) texts.reference = { text: reference.text, tone: 'label' }
  const lane: LaneLabel[] = lanePlaced.filter((p) => p.id !== 'flag').map((p) => ({ id: p.id, x: p.x, ...texts[p.id] }))
  const flag = lanePlaced.find((p) => p.id === 'flag')

  return {
    width,
    height,
    x,
    y,
    plot: { left, right, top, bottom },
    zeroY,
    laneBaseline,
    line,
    gain,
    loss,
    strikes: strikes.map((s) => ({ x: s.x, value: s.value })),
    breakevens: breakevens.map((b) => ({ x: b.x, value: b.value })),
    reference: reference ? { x: reference.x, value: reference.value } : null,
    labels,
    lane,
    zeroLabel: { x: left - 6, y: zeroY + 4, text: zeroText },
    handle:
      hasHandle && flag
        ? {
            x: priceX,
            y: y(interpolateAt(visible, priceValue)),
            top: Math.min(y(interpolateAt(visible, priceValue)), zeroY),
            value: priceValue,
            flagLeft: flag.left,
            flagWidth,
            flagTop: laneTop + 4,
          }
        : null,
  }
}
