import { describe, expect, it } from 'vitest'
import {
  bandsBetween,
  clipLine,
  crisp,
  crossingsAt,
  interpolateAt,
  levelLine,
  linePath,
  magnet,
  polygonPath,
  project,
  rangeWithin,
  samplePiecewise,
  snapToStep,
  sortPoints,
  trianglePath,
} from './geometry.ts'
import type { Point } from './geometry.ts'

// A long put on 5 units, strike 10, premium 1.80 in total: breakeven 9.64.
const put = (s: number) => 5 * Math.max(10 - s, 0) - 1.8
const putLine = samplePiecewise(put, [6, 14], [10])

const area = (points: Point[]) => {
  let twice = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

describe('linePath and polygonPath', () => {
  it('writes move and line commands', () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 20, y: 10 },
        { x: 40, y: 0 },
      ]),
    ).toBe('M0 10L20 10L40 0')
  })
  it('rounds to a hundredth of a pixel and never prints negative zero', () => {
    expect(
      linePath([
        { x: 1.23456, y: -0.001 },
        { x: 2.999, y: 3.005 },
      ]),
    ).toBe('M1.23 0L3 3.01')
  })
  it('is empty for no points', () => {
    expect(linePath([])).toBe('')
  })
  it('closes a polygon and refuses fewer than three points', () => {
    expect(
      polygonPath([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ]),
    ).toBe('M0 0L4 0L4 3Z')
    expect(polygonPath([{ x: 0, y: 0 }])).toBe('')
  })
})

describe('samplePiecewise', () => {
  it('samples the ends and the kinks only', () => {
    expect(putLine).toEqual([
      { x: 6, y: 18.2 },
      { x: 10, y: -1.8 },
      { x: 14, y: -1.8 },
    ])
  })
  it('ignores kinks outside the domain and sorts the rest', () => {
    const pts = samplePiecewise((x) => x, [0, 10], [12, 7, -1, 3])
    expect(pts.map((p) => p.x)).toEqual([0, 3, 7, 10])
  })
  it('adds evenly spaced samples on request', () => {
    expect(samplePiecewise((x) => x * x, [0, 4], [], 4).map((p) => p.x)).toEqual([0, 1, 2, 3, 4])
  })
  it('accepts a reversed domain', () => {
    expect(samplePiecewise((x) => x, [4, 0]).map((p) => p.x)).toEqual([0, 4])
  })
})

describe('interpolateAt', () => {
  it('is exact on a piecewise-linear payoff', () => {
    expect(interpolateAt(putLine, 8)).toBeCloseTo(put(8), 12)
    expect(interpolateAt(putLine, 9.64)).toBeCloseTo(0, 12)
    expect(interpolateAt(putLine, 12)).toBeCloseTo(-1.8, 12)
  })
  it('returns the end values outside the sampled range', () => {
    expect(interpolateAt(putLine, 0)).toBe(18.2)
    expect(interpolateAt(putLine, 99)).toBe(-1.8)
  })
  it('is NaN for no points', () => {
    expect(interpolateAt([], 1)).toBeNaN()
  })
})

describe('clipLine and rangeWithin', () => {
  it('cuts a polyline at both bounds', () => {
    const part = clipLine(putLine, 8, 12)
    expect(part.map((p) => p.x)).toEqual([8, 10, 12])
    expect(part[0].y).toBeCloseTo(8.2, 12)
  })
  it('is empty outside the line', () => {
    expect(clipLine(putLine, 20, 30)).toEqual([])
  })
  it('gives the low and high of a stretch', () => {
    const [lo, hi] = rangeWithin(putLine, 9, 11)
    expect(lo).toBeCloseTo(-1.8, 12)
    expect(hi).toBeCloseTo(3.2, 12)
  })
})

describe('crossingsAt', () => {
  it('finds the breakeven of the put', () => {
    const xs = crossingsAt(putLine, 0)
    expect(xs).toHaveLength(1)
    expect(xs[0]).toBeCloseTo(9.64, 12)
  })
  it('does not report a flat stretch that lies on the level', () => {
    const free = samplePiecewise((s) => 5 * Math.max(10 - s, 0), [6, 14], [10])
    expect(crossingsAt(free, 0)).toEqual([])
  })
  it('reports a touch once', () => {
    const tent: Point[] = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 2, y: -1 },
    ]
    expect(crossingsAt(tent, 0)).toEqual([1])
  })
})

describe('bandsBetween', () => {
  it('splits a payoff into a gain area and a loss area at the breakeven', () => {
    const bands = bandsBetween(putLine, levelLine(putLine, 0))
    expect(bands.map((b) => b.sign)).toEqual([1, -1])
    const [gain, loss] = bands
    // Triangle from 6 to 9.64 under 18.2, then a trapezoid down to −1.8 out to 14.
    expect(area(gain.points)).toBeCloseTo((3.64 * 18.2) / 2, 9)
    expect(area(loss.points)).toBeCloseTo((0.36 * 1.8) / 2 + 4 * 1.8, 9)
    expect(gain.points.some((p) => Math.abs(p.x - 9.64) < 1e-9 && Math.abs(p.y) < 1e-9)).toBe(true)
  })
  it('gives no loss area when the premium is zero', () => {
    const free = samplePiecewise((s) => 5 * Math.max(10 - s, 0), [6, 14], [10])
    const bands = bandsBetween(free, levelLine(free, 0))
    expect(bands.map((b) => b.sign)).toEqual([1])
    expect(Math.max(...bands[0].points.map((p) => p.x))).toBe(10)
  })
  it('handles two lines with different sample points (with and without a put)', () => {
    const withPut = samplePiecewise((s) => 5 * Math.max(s, 10) - 1.8, [6, 14], [10])
    const without = samplePiecewise((s) => 5 * s, [6, 14])
    const bands = bandsBetween(withPut, without)
    expect(bands.map((b) => b.sign)).toEqual([1, -1])
    // The option helps below 9.64 and costs the premium above it.
    const crossing = Math.max(...bands[0].points.map((p) => p.x))
    expect(crossing).toBeCloseTo(9.64, 9)
    expect(area(bands[1].points)).toBeCloseTo((0.36 * 1.8) / 2 + 4 * 1.8, 9)
  })
  it('returns nothing for identical lines or lines that share no range', () => {
    expect(bandsBetween(putLine, putLine)).toEqual([])
    expect(
      bandsBetween(putLine, [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ]),
    ).toEqual([])
  })
  it('alternates through several crossings', () => {
    const zig: Point[] = [
      { x: 0, y: 1 },
      { x: 1, y: -1 },
      { x: 2, y: 1 },
      { x: 3, y: -1 },
    ]
    const bands = bandsBetween(zig, levelLine(zig, 0))
    expect(bands.map((b) => b.sign)).toEqual([1, -1, 1, -1])
    expect(area(bands[1].points)).toBeCloseTo(0.5, 9)
  })
  it('produces outlines without repeated points', () => {
    for (const band of bandsBetween(putLine, levelLine(putLine, 0))) {
      band.points.forEach((p, i) => {
        const q = band.points[(i + 1) % band.points.length]
        expect(p.x === q.x && p.y === q.y).toBe(false)
      })
    }
  })
})

describe('project and sortPoints', () => {
  it('maps points through two scales', () => {
    expect(
      project(
        [{ x: 1, y: 2 }],
        (v) => v * 10,
        (v) => 100 - v,
      ),
    ).toEqual([{ x: 10, y: 98 }])
  })
  it('sorts by x and drops duplicates and broken values', () => {
    expect(
      sortPoints([
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: Number.NaN, y: 0 },
      ]),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
  })
})

describe('snapToStep and magnet', () => {
  it('snaps to the grid without a floating-point tail', () => {
    expect(snapToStep(8.13, 0.1)).toBe(8.1)
    expect(snapToStep(8.16, 0.1)).toBe(8.2)
    expect(snapToStep(0.30000000000000004, 0.1)).toBe(0.3)
    expect(snapToStep(1234.4, 5)).toBe(1235)
  })
  it('leaves the value alone without a step', () => {
    expect(snapToStep(8.13, 0)).toBe(8.13)
  })
  it('pulls onto the closest target within the tolerance', () => {
    expect(magnet(9.6, [9.64, 10], 0.1)).toBe(9.64)
    expect(magnet(9.9, [9.64, 10], 0.15)).toBe(10)
    expect(magnet(9.3, [9.64, 10], 0.1)).toBe(9.3)
  })
})

describe('trianglePath and crisp', () => {
  it('points up or down', () => {
    expect(trianglePath(10, 10, 6, 'up')).toBe('M6.52 13L10 7L13.48 13Z')
    expect(trianglePath(10, 10, 6, 'down')).toBe('M6.52 7L10 13L13.48 7Z')
  })
  it('puts a 1 px rule on the half pixel', () => {
    expect(crisp(10.2)).toBe(10.5)
    expect(crisp(10.9)).toBe(10.5)
    expect(crisp(11)).toBe(11.5)
  })
})
