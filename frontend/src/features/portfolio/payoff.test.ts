import { describe, expect, it } from 'vitest'
import { longCall, longPut, shortCall, shortPut } from '../../../../packages/payoff/src/index.ts'
import { NO_REFERENCE, U, opt, reference } from './fixtures.testhelper'
import { breakevenText, positionPayoff } from './payoff'

// A put and a call on 5.00 FUND at 10.00 for a premium of 1.80: the leg the package computes.
const LEG = { qty: 5, strikeTotal: 50, premiumTotal: 1.8 }
const PRICES = [0, 6, 9.64, 10, 10.36, 12, 20]

describe('positionPayoff', () => {
  it('draws the holder of a put as the long put of the payoff package', () => {
    const m = positionPayoff(opt(), 'holder', reference(982))!
    expect(m.side).toBe('long')
    expect(m.title).toBe('Payoff at expiry, long put on 5.00 FUND')
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(longPut(LEG, s).total, 9)
    expect(m.strike).toEqual({ value: 10, label: '10.00' })
    expect(m.breakevens).toEqual([{ value: expect.closeTo(9.64, 9), label: '9.64' }])
    expect(m.maxLoss).toEqual({ value: 1.8, label: '1.80' })
    expect(m.maxGain).toEqual({ value: expect.closeTo(48.2, 9), label: '48.20', at: 0 })
    expect(m.reference).toEqual({ value: 9.82, label: 'Demo price 9.82' })
    expect(m.defaultPrice).toBe(9.82)
    expect(m.unit).toBe('USDx')
    expect(m.asset).toBe('FUND')
  })

  it('draws the holder of a call with no largest gain', () => {
    const m = positionPayoff(opt({ kind: 'call' }), 'holder', reference(982))!
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(longCall(LEG, s).total, 9)
    expect(m.maxGain).toEqual({ value: Infinity })
    expect(m.maxLoss).toEqual({ value: 1.8, label: '1.80' })
    expect(m.breakevens[0].label).toBe('10.36')
  })

  it('draws the writer of a put as the short put: the premium at most, the strike less the premium at worst', () => {
    const m = positionPayoff(opt(), 'writer', reference(982))!
    expect(m.side).toBe('short')
    expect(m.title).toBe('Payoff at expiry, short put on 5.00 FUND')
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(shortPut(LEG, s).total, 9)
    expect(m.maxGain).toEqual({ value: 1.8, label: '1.80' })
    expect(m.maxLoss).toEqual({ value: expect.closeTo(48.2, 9), label: '48.20', at: 0 })
  })

  it('draws the writer of a call as the short call and prints no largest loss: the note says what is given up', () => {
    const m = positionPayoff(opt({ kind: 'call' }), 'writer', reference(982))!
    for (const s of PRICES) expect(m.pnlAt(s)).toBeCloseTo(shortCall(LEG, s).total, 9)
    expect(m.maxGain).toEqual({ value: 1.8, label: '1.80' })
    expect(m.maxLoss).toBeUndefined()
  })

  it('is the mirror of the other side: what the holder gains, the writer loses', () => {
    const long = positionPayoff(opt(), 'holder', reference(982))!
    const short = positionPayoff(opt(), 'writer', reference(982))!
    for (const s of PRICES) expect(long.pnlAt(s) + short.pnlAt(s)).toBeCloseTo(0, 9)
  })

  it('shows a viewer with no side the holder figure', () => {
    expect(positionPayoff(opt(), null, reference(982))!.side).toBe('long')
  })

  it('centres on the strike and marks no reference when there is none', () => {
    const m = positionPayoff(opt(), 'holder', NO_REFERENCE)!
    expect(m.reference).toBeUndefined()
    expect(m.defaultPrice).toBe(10)
    expect(m.domain[0]).toBeLessThan(9.64)
    expect(m.domain[1]).toBeGreaterThan(10)
  })

  it('keeps the strike, the breakeven and the reference inside the plotted range, with the kink sampled exactly', () => {
    const m = positionPayoff(opt(), 'holder', reference(1300))!
    expect(m.domain[0]).toBeLessThanOrEqual(9.64)
    expect(m.domain[1]).toBeGreaterThanOrEqual(13)
    expect(m.points.some((p) => p.x === 10)).toBe(true)
    expect(m.points[0].x).toBe(m.domain[0])
    expect(m.points.at(-1)!.x).toBe(m.domain[1])
  })

  it('draws nothing for terms that cannot be drawn', () => {
    expect(positionPayoff(opt({ underlyingQty: 0n }), 'holder', reference(982))).toBeNull()
    expect(positionPayoff(opt({ totalStrike: 0n }), 'holder', reference(982))).toBeNull()
  })

  it('prints no largest gain for a put whose premium is at least its strike', () => {
    const m = positionPayoff(opt({ totalPremium: 60n * U }), 'holder', reference(982))!
    expect(m.maxGain).toBeUndefined()
    expect(m.breakevens).toEqual([])
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
