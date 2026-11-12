import { describe, expect, it } from 'vitest'
import { clamp, extent, linearScale, niceDomain, niceStep, niceTicks, padDomain, priceDomain, stepDecimals } from './scales.ts'

describe('clamp', () => {
  it('keeps a value inside the bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
  it('accepts the bounds in either order', () => {
    expect(clamp(11, 10, 0)).toBe(10)
    expect(clamp(-3, 10, 0)).toBe(0)
  })
  it('sends NaN to the lower bound instead of spreading it', () => {
    expect(clamp(Number.NaN, 2, 8)).toBe(2)
  })
})

describe('linearScale', () => {
  it('maps the domain onto the range and back', () => {
    const x = linearScale([6, 14], [20, 340])
    expect(x(6)).toBe(20)
    expect(x(14)).toBe(340)
    expect(x(10)).toBe(180)
    expect(x.invert(180)).toBe(10)
    expect(x.invert(x(9.64))).toBeCloseTo(9.64, 12)
  })
  it('handles a descending range, as the y axis of an SVG', () => {
    const y = linearScale([-2, 18], [200, 0])
    expect(y(-2)).toBe(200)
    expect(y(18)).toBe(0)
    expect(y(0)).toBe(180)
    expect(y.invert(180)).toBeCloseTo(0, 12)
  })
  it('extrapolates outside the domain (the caller clamps)', () => {
    const x = linearScale([0, 10], [0, 100])
    expect(x(12)).toBe(120)
    expect(x(-1)).toBe(-10)
  })
  it('puts every value in the middle when the domain has no width', () => {
    const x = linearScale([5, 5], [0, 100])
    expect(x(5)).toBe(50)
    expect(x(999)).toBe(50)
    expect(x.invert(73)).toBe(5)
  })
  it('exposes its domain and range', () => {
    const x = linearScale([1, 2], [3, 4])
    expect(x.domain).toEqual([1, 2])
    expect(x.range).toEqual([3, 4])
  })
})

describe('extent', () => {
  it('ignores values that are not finite', () => {
    expect(extent([3, Number.NaN, -1, Infinity, 7])).toEqual([-1, 7])
  })
  it('is null when nothing is finite', () => {
    expect(extent([])).toBeNull()
    expect(extent([Number.NaN, Infinity])).toBeNull()
  })
})

describe('niceStep', () => {
  it('picks 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(8, 5)).toBe(2)
    expect(niceStep(100, 5)).toBe(20)
    expect(niceStep(1, 5)).toBe(0.2)
    expect(niceStep(0.08, 8)).toBe(0.01)
    expect(niceStep(7, 10)).toBe(0.5)
    expect(niceStep(2_500_000, 5)).toBe(500_000)
  })
  it('is 0 when there is no span', () => {
    expect(niceStep(0, 5)).toBe(0)
    expect(niceStep(Number.NaN, 5)).toBe(0)
  })
})

describe('niceTicks', () => {
  it('returns round values inside the domain', () => {
    expect(niceTicks(6, 14, 4)).toEqual([6, 8, 10, 12, 14])
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(niceTicks(-1.8, 18.2, 4)).toEqual([0, 5, 10, 15])
  })
  it('carries no floating-point noise', () => {
    const ticks = niceTicks(0, 0.5, 5)
    expect(ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    for (const t of ticks) expect(String(t).length).toBeLessThanOrEqual(3)
  })
  it('handles very small and very large domains', () => {
    expect(niceTicks(0.00012, 0.00019, 4)).toEqual([0.00012, 0.00014, 0.00016, 0.00018])
    expect(niceTicks(1_000_000, 5_000_000, 4)).toEqual([1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000])
  })
  it('accepts a reversed domain and a single value', () => {
    expect(niceTicks(14, 6, 4)).toEqual([6, 8, 10, 12, 14])
    expect(niceTicks(3, 3, 4)).toEqual([3])
  })
  it('never returns negative zero', () => {
    const ticks = niceTicks(-1, 1, 4)
    expect(ticks.some((t) => Object.is(t, -0))).toBe(false)
    expect(ticks).toContain(0)
  })
  it('is empty for a domain that is not finite', () => {
    expect(niceTicks(0, Infinity)).toEqual([])
  })
})

describe('niceDomain and padDomain', () => {
  it('widens outward to round bounds', () => {
    expect(niceDomain(6.3, 13.8, 4)).toEqual([6, 14])
    expect(niceDomain(0.11, 0.49, 4)).toEqual([0.1, 0.5])
  })
  it('keeps bounds that are already round', () => {
    expect(niceDomain(6, 14, 4)).toEqual([6, 14])
  })
  it('pads by a fraction of the span', () => {
    expect(padDomain([0, 10], 0.1)).toEqual([-1, 11])
    expect(padDomain([0, 10], 0.1, 'max')).toEqual([0, 11])
    expect(padDomain([0, 10], 0.1, 'min')).toEqual([-1, 10])
  })
})

describe('stepDecimals', () => {
  it('counts the decimals a step needs', () => {
    expect(stepDecimals(1)).toBe(0)
    expect(stepDecimals(20)).toBe(0)
    expect(stepDecimals(0.5)).toBe(1)
    expect(stepDecimals(0.05)).toBe(2)
    expect(stepDecimals(0.0000001)).toBe(7)
    expect(stepDecimals(0)).toBe(0)
  })
})

describe('priceDomain', () => {
  it('centres on the reference price, plus and minus 40 %', () => {
    expect(priceDomain({ center: 10 })).toEqual([6, 14])
  })
  it('widens to keep the strike and breakeven visible, with room beside them', () => {
    const [lo, hi] = priceDomain({ center: 10, include: [16, 15.2], nice: false })
    expect(lo).toBe(6)
    expect(hi).toBeGreaterThan(16)
    expect(hi).toBeCloseTo(16.5, 6)
    expect(priceDomain({ center: 10, include: [16, 15.2] })).toEqual([6, 16.6])
  })
  it('rounds the ends outward to a round step, unless told not to', () => {
    expect(priceDomain({ center: 9.82 })).toEqual([5.8, 13.8])
    const [lo, hi] = priceDomain({ center: 9.82, nice: false })
    expect(lo).toBeCloseTo(5.892, 9)
    expect(hi).toBeCloseTo(13.748, 9)
    expect(priceDomain({ center: 0.000118 })).toEqual([0.00007, 0.000166])
  })
  it('never goes below zero', () => {
    const [lo] = priceDomain({ center: 10, range: 1.5, include: [0] })
    expect(lo).toBe(0)
  })
  it('does not move for prices already inside', () => {
    expect(priceDomain({ center: 10, include: [9.64, 10, 8] })).toEqual([6, 14])
  })
  it('falls back to a usable domain when the centre is missing', () => {
    const [lo, hi] = priceDomain({ center: Number.NaN })
    expect(hi).toBeGreaterThan(lo)
  })
})
