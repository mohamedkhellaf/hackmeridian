import { describe, expect, it } from 'vitest'
import {
  boxIsFree,
  cornerBox,
  estimateTextWidth,
  inflate,
  pickBox,
  placeLane,
  polylineHitsRect,
  rectInside,
  rectsOverlap,
  segmentHitsRect,
  spreadLane,
} from './labels.ts'
import type { LanePlacement, Rect } from './labels.ts'

const box = (x: number, y: number, width = 40, height = 12): Rect => ({ x, y, width, height })

const touching = (placed: LanePlacement[], gap: number) => {
  const sorted = [...placed].sort((a, b) => a.left - b.left)
  return sorted.some((p, i) => i > 0 && p.left < sorted[i - 1].right + gap - 1e-9)
}

describe('rectangles', () => {
  it('detects overlap, with an optional clear space', () => {
    expect(rectsOverlap(box(0, 0), box(30, 0))).toBe(true)
    expect(rectsOverlap(box(0, 0), box(40, 0))).toBe(false)
    expect(rectsOverlap(box(0, 0), box(42, 0), 4)).toBe(true)
    expect(rectsOverlap(box(0, 0), box(0, 20))).toBe(false)
  })
  it('knows when one box is inside another', () => {
    expect(rectInside(box(5, 5, 10, 10), box(0, 0, 100, 100))).toBe(true)
    expect(rectInside(box(95, 5, 10, 10), box(0, 0, 100, 100))).toBe(false)
  })
  it('grows a box on every side', () => {
    expect(inflate(box(10, 10, 20, 10), 2)).toEqual({ x: 8, y: 8, width: 24, height: 14 })
  })
})

describe('segmentHitsRect', () => {
  const r = box(10, 10, 20, 10)
  it('catches a segment that crosses the box without an end inside it', () => {
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 40, y: 30 }, r)).toBe(true)
  })
  it('catches a segment that ends inside the box', () => {
    expect(segmentHitsRect({ x: 0, y: 15 }, { x: 15, y: 15 }, r)).toBe(true)
  })
  it('lets a segment pass beside the box', () => {
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 40, y: 5 }, r)).toBe(false)
    expect(segmentHitsRect({ x: 35, y: 0 }, { x: 35, y: 40 }, r)).toBe(false)
  })
  it('respects the padding', () => {
    expect(segmentHitsRect({ x: 32, y: 0 }, { x: 32, y: 40 }, r)).toBe(false)
    expect(segmentHitsRect({ x: 32, y: 0 }, { x: 32, y: 40 }, r, 3)).toBe(true)
  })
  it('handles horizontal, vertical and zero-length segments', () => {
    expect(segmentHitsRect({ x: 0, y: 15 }, { x: 50, y: 15 }, r)).toBe(true)
    expect(segmentHitsRect({ x: 20, y: 0 }, { x: 20, y: 50 }, r)).toBe(true)
    expect(segmentHitsRect({ x: 15, y: 15 }, { x: 15, y: 15 }, r)).toBe(true)
    expect(segmentHitsRect({ x: 5, y: 5 }, { x: 5, y: 5 }, r)).toBe(false)
  })
  it('checks every segment of a polyline', () => {
    const line = [
      { x: 0, y: 40 },
      { x: 5, y: 40 },
      { x: 25, y: 0 },
    ]
    expect(polylineHitsRect(line, r)).toBe(true)
    expect(polylineHitsRect(line.slice(0, 2), r)).toBe(false)
  })
})

describe('pickBox', () => {
  const bounds = box(0, 0, 200, 100)
  // A put payoff in pixels: down from the top left to a flat stretch.
  const line = [
    { x: 0, y: 10 },
    { x: 100, y: 80 },
    { x: 200, y: 80 },
  ]
  it('takes the first candidate that is free', () => {
    const at = { x: 90, y: 70, width: 44, height: 12 }
    const candidates = [
      cornerBox({ at, width: 44, height: 12 }, 'below-left'),
      cornerBox({ at, width: 44, height: 12 }, 'above-right'),
    ]
    // Below and left of the breakeven the payoff line is far above: free.
    expect(pickBox(candidates, { bounds, lines: [line] })).toBe(0)
  })
  it('skips a candidate that sits on the line', () => {
    const at = { x: 50, y: 45 }
    const onLine = cornerBox({ at, width: 44, height: 12, offset: 0 }, 'above')
    const beside = cornerBox({ at, width: 44, height: 12, offset: 8 }, 'above-right')
    expect(pickBox([onLine, beside], { bounds, lines: [line] })).toBe(1)
  })
  it('skips a candidate that leaves the bounds or touches a placed label', () => {
    const placed = [box(120, 40, 50, 12)]
    const outside = box(180, 40, 44, 12)
    const touchingPlaced = box(100, 44, 44, 12)
    const free = box(20, 60, 44, 12)
    expect(pickBox([outside, touchingPlaced, free], { bounds, rects: placed })).toBe(2)
  })
  it('returns −1 when nothing fits', () => {
    expect(pickBox([box(190, 0)], { bounds })).toBe(-1)
    expect(boxIsFree(box(190, 0), { bounds })).toBe(false)
  })
})

describe('cornerBox', () => {
  const at = { x: 100, y: 50 }
  it('places the box around the point', () => {
    expect(cornerBox({ at, width: 40, height: 12, offset: 6 }, 'above-right')).toEqual({ x: 106, y: 32, width: 40, height: 12 })
    expect(cornerBox({ at, width: 40, height: 12, offset: 6 }, 'below-left')).toEqual({ x: 54, y: 56, width: 40, height: 12 })
    expect(cornerBox({ at, width: 40, height: 12, offset: 6 }, 'above')).toEqual({ x: 80, y: 32, width: 40, height: 12 })
  })
})

describe('placeLane (labels dropped by priority)', () => {
  const lane = { min: 0, max: 320, gap: 4 }
  it('keeps labels that have room', () => {
    const placed = placeLane(
      [
        { id: 'min', x: 0, width: 26, anchor: 'start' },
        { id: 'strike', x: 160, width: 44, priority: 2 },
        { id: 'max', x: 320, width: 30, anchor: 'end' },
      ],
      lane,
    )
    expect(placed.map((p) => p.id)).toEqual(['min', 'strike', 'max'])
    expect(placed[1]).toMatchObject({ left: 138, right: 182 })
    expect(placed[2]).toMatchObject({ left: 290, right: 320 })
  })
  it('drops the lower priority label of a colliding pair', () => {
    // The price flag (priority 3) passes over the strike label (priority 2).
    const placed = placeLane(
      [
        { id: 'strike', x: 160, width: 44, priority: 2 },
        { id: 'price', x: 170, width: 40, priority: 3 },
      ],
      lane,
    )
    expect(placed.map((p) => p.id)).toEqual(['price'])
  })
  it('treats labels closer than the gap as colliding', () => {
    const near = [
      { id: 'a', x: 100, width: 40, anchor: 'start' as const, priority: 1 },
      { id: 'b', x: 142, width: 40, anchor: 'start' as const },
    ]
    expect(placeLane(near, lane).map((p) => p.id)).toEqual(['a'])
    expect(placeLane(near, { ...lane, gap: 2 }).map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('slides a label back inside the lane', () => {
    const [p] = placeLane([{ id: 'price', x: 318, width: 40 }], lane)
    expect(p).toMatchObject({ left: 280, right: 320 })
    const [q] = placeLane([{ id: 'price', x: 3, width: 40 }], lane)
    expect(q).toMatchObject({ left: 0, right: 40 })
  })
  it('drops a fixed label that sticks out, and a label wider than the lane', () => {
    expect(placeLane([{ id: 'k', x: 318, width: 40, fixed: true }], lane)).toEqual([])
    expect(placeLane([{ id: 'wide', x: 100, width: 400 }], lane)).toEqual([])
  })
  it('never returns two labels that touch, whatever comes in', () => {
    // A phone-width lane with everything crowded around the strike: the collision of the research mock.
    const crowded = [
      { id: 'min', x: 0, width: 28, anchor: 'start' as const },
      { id: 'be', x: 150, width: 46, priority: 1 },
      { id: 'strike', x: 160, width: 48, priority: 2 },
      { id: 'ref', x: 156, width: 96, priority: 1 },
      { id: 'price', x: 140, width: 42, priority: 3 },
      { id: 'max', x: 280, width: 34, anchor: 'end' as const },
    ]
    for (let x = 0; x <= 280; x += 7) {
      const items = crowded.map((c) => (c.id === 'price' ? { ...c, x } : c))
      const placed = placeLane(items, { min: 0, max: 280, gap: 4 })
      expect(touching(placed, 4)).toBe(false)
      expect(placed.some((p) => p.id === 'price')).toBe(true)
      for (const p of placed) {
        expect(p.left).toBeGreaterThanOrEqual(0)
        expect(p.right).toBeLessThanOrEqual(280)
      }
    }
  })
  it('keeps the earlier of two labels with the same priority', () => {
    const placed = placeLane(
      [
        { id: 'first', x: 100, width: 40 },
        { id: 'second', x: 110, width: 40 },
      ],
      lane,
    )
    expect(placed.map((p) => p.id)).toEqual(['first'])
  })
})

describe('spreadLane (labels pushed apart, none dropped)', () => {
  const lane = { min: 0, max: 300, gap: 6 }
  it('leaves labels alone when they do not touch', () => {
    const placed = spreadLane(
      [
        { id: 'mm', x: 100, width: 60, anchor: 'end' },
        { id: 'im', x: 200, width: 60, anchor: 'start' },
      ],
      lane,
    )
    expect(placed).toEqual([
      { id: 'mm', left: 40, right: 100, x: 40 },
      { id: 'im', left: 200, right: 260, x: 200 },
    ])
  })
  it('pushes neighbours apart and keeps their order', () => {
    const placed = spreadLane(
      [
        { id: 'margin', x: 0, width: 110, anchor: 'start' },
        { id: 'vault', x: 90, width: 80, anchor: 'start' },
        { id: 'deficit', x: 120, width: 90, anchor: 'start' },
      ],
      lane,
    )
    expect(placed).not.toBeNull()
    expect(placed!.map((p) => p.id)).toEqual(['margin', 'vault', 'deficit'])
    expect(touching(placed!, 6)).toBe(false)
    expect(placed![2].right).toBeLessThanOrEqual(300)
  })
  it('pulls labels back from the right edge', () => {
    const placed = spreadLane(
      [
        { id: 'a', x: 250, width: 60, anchor: 'start' },
        { id: 'b', x: 280, width: 60, anchor: 'start' },
      ],
      lane,
    )
    expect(placed).toEqual([
      { id: 'a', left: 174, right: 234, x: 174 },
      { id: 'b', left: 240, right: 300, x: 240 },
    ])
  })
  it('returns null when the row is too narrow, so the caller can stack', () => {
    expect(
      spreadLane(
        [
          { id: 'a', x: 0, width: 160, anchor: 'start' },
          { id: 'b', x: 100, width: 160, anchor: 'start' },
        ],
        lane,
      ),
    ).toBeNull()
  })
  it('accepts an empty row', () => {
    expect(spreadLane([], lane)).toEqual([])
  })
})

describe('estimateTextWidth', () => {
  it('scales with the font size and the text length', () => {
    expect(estimateTextWidth('K 10.00', 12)).toBeGreaterThan(estimateTextWidth('K 10', 12))
    expect(estimateTextWidth('K 10.00', 14)).toBeGreaterThan(estimateTextWidth('K 10.00', 12))
    expect(estimateTextWidth('', 12)).toBe(0)
  })
  it('stays close to a measured label', () => {
    // "Max loss −1.80" measures about 78 px at 12 px in Instrument Sans with tabular figures.
    const w = estimateTextWidth('Max loss −1.80', 12)
    expect(w).toBeGreaterThan(60)
    expect(w).toBeLessThan(100)
  })
})
