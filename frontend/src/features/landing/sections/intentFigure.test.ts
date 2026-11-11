import { describe, expect, it } from 'vitest'
import { RECORDED_CALL, RECORDED_PUT } from '../recorded'
import { intentFigure } from './intentFigure'

describe('intentFigure', () => {
  it('set a floor: the holding never falls under the floor, less the premium', () => {
    const f = intentFigure('floor', RECORDED_PUT)
    expect(f.strikeText).toBe('10.00')
    for (const p of f.points) {
      expect(p.with).toBeCloseTo(5 * Math.max(p.x, 10) - 1, 9)
      expect(p.without).toBeCloseTo(5 * p.x, 9)
    }
    expect(f.points.map((p) => p.x)).toContain(10)
  })

  it('earn on what you hold: the premium is kept and the rise is capped at the strike', () => {
    const f = intentFigure('earn-hold', RECORDED_CALL)
    expect(f.strikeText).toBe('10.00')
    for (const p of f.points) {
      expect(p.with).toBeCloseTo(3 * Math.min(p.x, 10) + 0.5, 9)
      expect(p.without).toBeCloseTo(3 * p.x, 9)
    }
  })

  it('earn while waiting to buy: the cash set aside is the comparison', () => {
    const f = intentFigure('earn-buy', RECORDED_PUT)
    for (const p of f.points) {
      expect(p.with).toBeCloseTo(5 * Math.min(p.x, 10) + 1, 9)
      expect(p.without).toBe(50)
    }
  })

  it('keeps the strike and both ends of the axis as sampled points', () => {
    const f = intentFigure('earn-buy', RECORDED_PUT)
    const xs = f.points.map((p) => p.x)
    expect(xs[0]).toBe(f.domain[0])
    expect(xs.at(-1)).toBe(f.domain[1])
    expect(xs).toContain(f.strike)
  })
})
