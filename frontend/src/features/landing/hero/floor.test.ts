import { describe, expect, it } from 'vitest'
import { RECORDED_PUT } from '../recorded'
import { floorFigure, floorOutcome } from './floor'

describe('floorFigure', () => {
  const figure = floorFigure(RECORDED_PUT)

  it('prints the exact terms of the recorded put', () => {
    expect(figure.text).toEqual({ qty: '5.00', strike: '10.00', premium: '1.00', premiumPerUnit: '0.20', collateral: '50.00' })
  })

  it('centres the axis on the floor and starts the handle under it', () => {
    expect(figure.strike).toBe(10)
    expect(figure.domain[0]).toBeLessThan(8)
    expect(figure.domain[1]).toBeGreaterThan(12)
    expect(figure.startPrice).toBe(8)
    expect(figure.step).toBe(0.1)
    expect(figure.largeStep).toBeCloseTo(1, 9)
  })

  it('samples the two lines at both ends and at the kink, in order', () => {
    const xs = figure.points.map((p) => p.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(xs[0]).toBe(figure.domain[0])
    expect(xs.at(-1)).toBe(figure.domain[1])
    expect(xs).toContain(10)
    // With the put: 5 x max(S, 10) less the 1.00 paid. Without: 5 x S.
    for (const p of figure.points) {
      expect(p.with).toBeCloseTo(5 * Math.max(p.x, 10) - 1, 9)
      expect(p.without).toBeCloseTo(5 * p.x, 9)
    }
  })

  it('keeps the reference price inside the axis', () => {
    const wide = floorFigure(RECORDED_PUT, 160_000_000n)
    expect(wide.domain[1]).toBeGreaterThan(16)
  })
})

describe('floorOutcome', () => {
  const figure = floorFigure(RECORDED_PUT)

  it('below the floor the holder sells at the floor, less the premium', () => {
    expect(floorOutcome(figure, 8)).toEqual({
      price: 8,
      priceText: '8.00',
      withText: '49.00',
      withoutText: '40.00',
      differenceText: '9.00',
      direction: 'more',
      exercised: true,
    })
  })

  it('above the floor the put only cost its premium', () => {
    const o = floorOutcome(figure, 12)
    expect([o.withText, o.withoutText, o.differenceText, o.direction, o.exercised]).toEqual(['59.00', '60.00', '1.00', 'less', false])
  })

  it('at the breakeven the two are the same', () => {
    const o = floorOutcome(figure, 9.8)
    expect([o.withText, o.withoutText, o.differenceText, o.direction]).toEqual(['49.00', '49.00', '0.00', 'same'])
  })

  it('never reads a price outside the axis', () => {
    expect(floorOutcome(figure, 1000).price).toBe(figure.domain[1])
    expect(floorOutcome(figure, -5).price).toBe(figure.domain[0])
  })
})
