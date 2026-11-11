import { describe, expect, it } from 'vitest'
import { longCall, longPut, shortCall, shortPut } from '../../../../packages/payoff/src/index.ts'
import { NO_REFERENCE, U, opt, reference } from './fixtures.testhelper'
import { breakevenText, drawsPayoff, makerPayoff, positionPayoff } from './payoff'

// A put and a call on 5.00 FUND at 10.00 for a premium of 1.80: the leg the package computes.
const LEG = { qty: 5, strikeTotal: 50, premiumTotal: 1.8 }
const PRICES = [0, 6, 9.64, 10, 10.36, 12, 20]

describe('positionPayoff', () => {
  it('draws the holder of a put as the long put of the payoff package', () => {
    const m = positionPayoff(opt(), reference(982))!
    expect(m.side).toBe('long')
    expect(m.title).toBe('Payoff at the deadline, long put on 5.00 FUND')
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(longPut(LEG, s).total, 9)
    expect(m.strike).toEqual({ value: 10, label: '10.00' })
    expect(m.breakevens).toEqual([{ value: expect.closeTo(9.64, 9), label: '9.64' }])
    expect(m.maxLoss).toEqual({ value: 1.8, label: '1.80' })
    expect(m.maxGain).toEqual({ value: expect.closeTo(48.2, 9), label: '48.20', at: 0 })
    expect(m.reference).toEqual({ value: 9.82, label: 'Demo price 9.82' })
    expect(m.defaultPrice).toBe(9.82)
    expect(m.premium).toBe(1.8)
    expect(m.unit).toBe('USDx')
    expect(m.asset).toBe('FUND')
  })

  it('says what exercising pays at a price, premium not counted', () => {
    const m = positionPayoff(opt(), reference(982))!
    for (const s of PRICES) expect(m.exerciseAt(s)).toBeCloseTo(longPut({ ...LEG, premiumTotal: 0 }, s).total, 9)
    expect(m.exerciseAt(9)).toBeCloseTo(5, 9)
    expect(m.exerciseAt(11)).toBe(0)
  })

  it('draws the holder of a call with no largest gain', () => {
    const m = positionPayoff(opt({ kind: 'call' }), reference(982))!
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(longCall(LEG, s).total, 9)
    expect(m.maxGain).toEqual({ value: Infinity })
    expect(m.maxLoss).toEqual({ value: 1.8, label: '1.80' })
    expect(m.breakevens[0].label).toBe('10.36')
  })

  it('leaves the original premium out for a holder who bought from a holder: no breakeven and no loss from it', () => {
    const m = positionPayoff(opt(), reference(982), { withoutPremium: true })!
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(longPut({ ...LEG, premiumTotal: 0 }, s).total, 9)
    expect(m.breakevens).toEqual([])
    expect(m.maxLoss).toBeUndefined()
    expect(m.premium).toBe(0)
  })

  it('centres on the strike and marks no reference when there is none', () => {
    const m = positionPayoff(opt(), NO_REFERENCE)!
    expect(m.reference).toBeUndefined()
    expect(m.defaultPrice).toBe(10)
    expect(m.domain[0]).toBeLessThan(9.64)
    expect(m.domain[1]).toBeGreaterThan(10)
  })

  it('keeps the strike, the breakeven and the reference inside the plotted range, with the kink sampled exactly', () => {
    const m = positionPayoff(opt(), reference(1300))!
    expect(m.domain[0]).toBeLessThanOrEqual(9.64)
    expect(m.domain[1]).toBeGreaterThanOrEqual(13)
    expect(m.points.some((p) => p.x === 10)).toBe(true)
    expect(m.points[0].x).toBe(m.domain[0])
    expect(m.points.at(-1)!.x).toBe(m.domain[1])
  })

  it('draws nothing for terms that cannot be drawn', () => {
    expect(positionPayoff(opt({ underlyingQty: 0n }), reference(982))).toBeNull()
    expect(positionPayoff(opt({ totalStrike: 0n }), reference(982))).toBeNull()
  })

  it('prints no largest gain for a put whose premium is at least its strike', () => {
    const m = positionPayoff(opt({ totalPremium: 60n * U }), reference(982))!
    expect(m.maxGain).toBeUndefined()
    expect(m.breakevens).toEqual([])
  })
})

describe('makerPayoff', () => {
  it('draws a written put as the guided "earn while waiting to buy": the cash set aside with the agreement and without', () => {
    const m = makerPayoff(opt(), reference(982))!
    expect(m.intent).toBe('earn-buy')
    expect(m.level).toEqual({ value: 10, label: 'Buy at 10.00' })
    // Without the agreement the cash stays 50.00; with it, the premium is kept and the put is assigned below 10.00.
    for (const p of m.points) {
      expect(p.without).toBeCloseTo(50, 9)
      expect(p.with - p.without).toBeCloseTo(shortPut(LEG, p.x).total, 9)
    }
    expect(m.reference).toEqual({ value: 9.82, label: 'Demo price 9.82' })
  })

  it('draws a written call as the guided "earn on what you hold": the rise above the strike is given up, not lost', () => {
    const m = makerPayoff(opt({ kind: 'call' }), reference(982))!
    expect(m.intent).toBe('earn-hold')
    expect(m.level.label).toBe('Sell at 10.00')
    for (const p of m.points) {
      expect(p.without).toBeCloseTo(5 * p.x, 9)
      expect(p.with - p.without).toBeCloseTo(shortCall(LEG, p.x).total, 9)
      // What the maker holds with the agreement never falls below what the asset alone is worth plus the premium, up to the strike.
      if (p.x <= 10) expect(p.with).toBeCloseTo(5 * p.x + 1.8, 9)
    }
  })

  it('draws nothing for terms that cannot be drawn', () => {
    expect(makerPayoff(opt({ underlyingQty: 0n }), reference(982))).toBeNull()
  })
})

describe('drawsPayoff', () => {
  it('draws a figure for an option that is still live only', () => {
    expect(drawsPayoff(opt())).toBe(true)
    expect(drawsPayoff(opt({ state: 'offered' }))).toBe(true)
    for (const state of ['exercised', 'settled', 'expired', 'reclaimed', 'cancelled'] as const) expect(drawsPayoff(opt({ state }))).toBe(false)
  })
})

describe('breakevenText', () => {
  it('is the strike less the premium per unit for a put and plus it for a call, truncated', () => {
    expect(breakevenText(opt())).toBe('9.64')
    expect(breakevenText(opt({ kind: 'call' }))).toBe('10.36')
    // 50 - 1.80 over 3 units is 16.0666...: never rounded up.
    expect(breakevenText(opt({ underlyingQty: 30_000_000n }))).toBe('16.06')
    expect(breakevenText(opt({ totalPremium: 60n * U }))).toBeNull()
  })
})
