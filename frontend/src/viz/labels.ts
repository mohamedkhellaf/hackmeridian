// Label placement. Charts in this kit label their marks directly, so every label is placed by rule and a label
// that would touch another one is moved or dropped, never drawn on top. Pure functions; widths come from the
// caller (measured text in the browser, an estimate in tests).

import type { Point } from './geometry.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type Anchor = 'start' | 'middle' | 'end'

/** True when the rectangles are closer than `gap` on both axes (they overlap, or nearly touch). */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap
}

/** True when `inner` lies entirely inside `outer`. */
export function rectInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - 1e-9 &&
    inner.y >= outer.y - 1e-9 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-9 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-9
  )
}

export function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + 2 * by, height: r.height + 2 * by }
}

/** True when the segment p-q passes through the rectangle grown by `pad` (Liang-Barsky clipping). */
export function segmentHitsRect(p: Point, q: Point, rect: Rect, pad = 0): boolean {
  const r = pad ? inflate(rect, pad) : rect
  const dx = q.x - p.x
  const dy = q.y - p.y
  let t0 = 0
  let t1 = 1
  const edges: Array<[number, number]> = [
    [-dx, p.x - r.x],
    [dx, r.x + r.width - p.x],
    [-dy, p.y - r.y],
    [dy, r.y + r.height - p.y],
  ]
  for (const [den, num] of edges) {
    if (den === 0) {
      if (num < 0) return false
      continue
    }
    const t = num / den
    if (den < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return t0 <= t1
}

/** True when any segment of the polyline passes through the rectangle grown by `pad`. */
export function polylineHitsRect(points: readonly Point[], rect: Rect, pad = 0): boolean {
  for (let i = 0; i + 1 < points.length; i++) if (segmentHitsRect(points[i], points[i + 1], rect, pad)) return true
  return points.length === 1 ? segmentHitsRect(points[0], points[0], rect, pad) : false
}

export interface Obstacles {
  /** The label must stay inside this box. */
  bounds?: Rect
  /** Labels and marks already placed. */
  rects?: readonly Rect[]
  /** Lines the label must not sit on (in pixels). */
  lines?: ReadonlyArray<readonly Point[]>
  /** Clear space kept around other labels. */
  gap?: number
  /** Clear space kept around lines. */
  linePad?: number
}

/** True when a label box is inside the bounds and touches none of the obstacles. */
export function boxIsFree(box: Rect, { bounds, rects = [], lines = [], gap = 3, linePad = 2 }: Obstacles): boolean {
  if (bounds && !rectInside(box, bounds)) return false
  for (const r of rects) if (rectsOverlap(box, r, gap)) return false
  for (const line of lines) if (polylineHitsRect(line, box, linePad)) return false
  return true
}

/** Index of the first candidate box that is free, or −1. Candidates are listed in order of preference. */
export function pickBox(candidates: readonly Rect[], obstacles: Obstacles): number {
  for (let i = 0; i < candidates.length; i++) if (boxIsFree(candidates[i], obstacles)) return i
  return -1
}

export interface LaneItem {
  id: string
  /** Where the label wants to be anchored, in pixels. */
  x: number
  width: number
  anchor?: Anchor
  /** Higher wins a collision. Equal priorities keep the earlier item. */
  priority?: number
  /** A fixed label is never shifted to fit the lane; it is dropped if it sticks out. */
  fixed?: boolean
}

export interface LanePlacement {
  id: string
  /** Left and right edge of the text after placement. */
  left: number
  right: number
  /** x for an SVG text element with `text-anchor: start`. */
  x: number
}

export interface LaneOptions {
  min: number
  max: number
  /** Clear space between two labels. Research rule: under 4 px apart counts as a collision. */
  gap?: number
}

function span(item: LaneItem): [number, number] {
  const anchor = item.anchor ?? 'middle'
  const left = anchor === 'start' ? item.x : anchor === 'end' ? item.x - item.width : item.x - item.width / 2
  return [left, left + item.width]
}

/**
 * One row of labels along an axis. Each label is slid inside [min, max], then labels are placed by priority and
 * one that would come within `gap` of a placed label is dropped. The result keeps the input order.
 */
export function placeLane(items: readonly LaneItem[], { min, max, gap = 4 }: LaneOptions): LanePlacement[] {
  const order = items.map((item, index) => ({ item, index })).sort((a, b) => (b.item.priority ?? 0) - (a.item.priority ?? 0) || a.index - b.index)
  const placed: Array<LanePlacement & { index: number }> = []
  for (const { item, index } of order) {
    if (!(item.width > 0) || item.width > max - min) continue
    let [left, right] = span(item)
    if (left < min || right > max) {
      if (item.fixed) continue
      const shift = left < min ? min - left : max - right
      left += shift
      right += shift
    }
    if (placed.some((p) => left < p.right + gap && p.left < right + gap)) continue
    placed.push({ id: item.id, left, right, x: left, index })
  }
  return placed.sort((a, b) => a.index - b.index).map(({ id, left, right, x }) => ({ id, left, right, x }))
}

/**
 * One row in which every label must stay: labels keep their left-to-right order and are pushed apart until
 * none touches. Returns null when the row is too narrow for all of them (the caller then stacks them).
 */
export function spreadLane(items: readonly LaneItem[], { min, max, gap = 4 }: LaneOptions): LanePlacement[] | null {
  if (items.length === 0) return []
  const order = items.map((item, index) => ({ item, index, left: span(item)[0] })).sort((a, b) => a.left - b.left || a.index - b.index)
  const total = order.reduce((sum, o) => sum + o.item.width, 0) + gap * (order.length - 1)
  if (total > max - min + 1e-9) return null

  const lefts: number[] = []
  for (let i = 0; i < order.length; i++) {
    const wanted = Math.max(min, order[i].left)
    lefts.push(i === 0 ? wanted : Math.max(wanted, lefts[i - 1] + order[i - 1].item.width + gap))
  }
  let limit = max
  for (let i = order.length - 1; i >= 0; i--) {
    lefts[i] = Math.min(lefts[i], limit - order[i].item.width)
    limit = lefts[i] - gap
  }
  if (lefts[0] < min - 1e-9) return null

  const out = order.map((o, i) => ({ id: o.item.id, left: lefts[i], right: lefts[i] + o.item.width, x: lefts[i], index: o.index }))
  return out.sort((a, b) => a.index - b.index).map(({ id, left, right, x }) => ({ id, left, right, x }))
}

/**
 * Rough width of a label when the browser cannot measure it (tests, the very first paint). Digits are tabular
 * in this kit, so they count for more than narrow letters and punctuation.
 */
export function estimateTextWidth(text: string, fontSize = 12): number {
  let em = 0
  for (const ch of text) {
    if (ch === ' ' || ch === ' ' || ch === ' ') em += 0.26
    else if (/[0-9+−=]/.test(ch)) em += 0.6
    else if (/[.,:;'|!il]/.test(ch)) em += 0.28
    else if (/[A-Z]/.test(ch)) em += 0.66
    else if (/[mwMW]/.test(ch)) em += 0.84
    else em += 0.54
  }
  return em * fontSize
}

export interface BoxAround {
  /** The marked point, in pixels. */
  at: Point
  width: number
  height: number
  /** Distance between the mark and the label. */
  offset?: number
}

export type Corner = 'above-right' | 'above-left' | 'below-right' | 'below-left' | 'above' | 'below'

/** The label box at one of the corners around a point. */
export function cornerBox({ at, width, height, offset = 6 }: BoxAround, corner: Corner): Rect {
  const above = corner.startsWith('above')
  const y = above ? at.y - offset - height : at.y + offset
  const x = corner.endsWith('right') ? at.x + offset : corner.endsWith('left') ? at.x - offset - width : at.x - width / 2
  return { x, y, width, height }
}
