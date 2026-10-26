import { describe, expect, it } from 'vitest'
import {
  cashSecuredPut,
  collar,
  coveredCall,
  guaranteedCoverPrice,
  longCall,
  longPut,
  protectivePut,
  proHolderPayout,
  shortCall,
  shortPut,
  toNumber,
  toUnits,
} from './index.ts'

// 10 units, total strike 1000 (K = 100/unit), total premium 40.
const call = { qty: 10, strikeTotal: 1000, premiumTotal: 40 }
const holding = { qty: 10, entryPrice: 100 }

describe('units', () => {
  it('converts 7-decimal units', () => {
    expect(toNumber(10_000_000n, 7)).toBe(1)
    expect(toNumber(-15_000_000n, 7)).toBe(-1.5)
    expect(toNumber(123_456_789n, 7)).toBeCloseTo(12.3456789, 12)
  })

  it('round-trips integers without loss at 7 decimals', () => {
    for (const u of [0n, 1n, 9_999_999n, 123_456_789n, 10_000_000_000n, 987_654_321_012n]) {
      expect(toUnits(toNumber(u, 7), 7)).toBe(u)
    }
  })

  it('rejects bad decimals', () => {
    expect(() => toNumber(1n, -1)).toThrow(RangeError)
    expect(() => toUnits(Number.NaN, 7)).toThrow(RangeError)
  })
})

describe('legs', () => {
  it('long/short call', () => {
    expect(longCall(call, 130)).toEqual({ label: 'hypothetical', perUnit: 26, total: 260 })
    expect(shortCall(call, 130).total).toBe(-260)
    expect(longCall(call, 80).total).toBe(-40)
    expect(shortCall(call, 80).perUnit).toBe(4)
  })

  it('long/short put', () => {
    expect(longPut(call, 70).total).toBe(260)
    expect(shortPut(call, 70).total).toBe(-260)
    expect(shortPut(call, 120).total).toBe(40)
  })

  it('long and short are exact mirrors', () => {
    for (const s of [0, 50, 96, 100, 104, 130, 500]) {
      expect(longCall(call, s).total + shortCall(call, s).total).toBeCloseTo(0, 12)
      expect(longPut(call, s).total + shortPut(call, s).total).toBeCloseTo(0, 12)
    }
  })

  it('rejects invalid legs', () => {
    expect(() => longCall({ ...call, qty: 0 }, 100)).toThrow(RangeError)
    expect(() => shortPut({ ...call, strikeTotal: 0 }, 100)).toThrow(RangeError)
  })
})

describe('strategies', () => {
  it('covered call Q=10 K=100 premium 40', () => {
    const s = coveredCall(holding, call)
    expect(s.label).toBe('hypothetical')
    expect(s.pnl(80)).toBe(-160)
    expect(s.pnl(100)).toBe(40)
    expect(s.pnl(130)).toBe(40)
    expect(s.maxGain).toBe(40)
    expect(s.maxLoss).toBe(960)
    expect(s.breakevens).toHaveLength(1)
    expect(s.breakevens[0]).toBeCloseTo(96, 9)
    expect(s.capitalLocked).toBe(1000)
  })

  it('cash-secured put', () => {
    const s = cashSecuredPut(call)
    expect(s.pnl(70)).toBe(-260)
    expect(s.pnl(120)).toBe(40)
    expect(s.maxGain).toBe(40)
    expect(s.maxLoss).toBe(960)
    expect(s.breakevens[0]).toBeCloseTo(96, 9)
    expect(s.capitalLocked).toBe(1000)
  })

  it('protective put (K=90, premium 30)', () => {
    const s = protectivePut(holding, { qty: 10, strikeTotal: 900, premiumTotal: 30 })
    expect(s.pnl(70)).toBe(-130)
    expect(s.pnl(120)).toBe(170)
    expect(s.maxLoss).toBe(130)
    expect(s.maxGain).toBe(Infinity)
    expect(s.breakevens[0]).toBeCloseTo(103, 9)
    expect(s.capitalLocked).toBe(1030)
  })

  it('collar (put K=90 premium 30, call K=110 premium 40)', () => {
    const s = collar(
      holding,
      { qty: 10, strikeTotal: 900, premiumTotal: 30 },
      { qty: 10, strikeTotal: 1100, premiumTotal: 40 },
    )
    expect(s.pnl(80)).toBe(-90)
    expect(s.pnl(100)).toBe(10)
    expect(s.pnl(120)).toBe(110)
    expect(s.maxLoss).toBe(90)
    expect(s.maxGain).toBe(110)
    expect(s.breakevens).toHaveLength(1)
    expect(s.breakevens[0]).toBeCloseTo(99, 9)
    expect(s.capitalLocked).toBe(1030)
  })

  it('samples a curve', () => {
    const pts = coveredCall(holding, call).curve({ from: 80, to: 130, steps: 5 })
    expect(pts).toHaveLength(6)
    expect(pts[0]).toEqual({ s: 80, pnl: -160 })
    expect(pts[5]).toEqual({ s: 130, pnl: 40 })
  })

  it('rejects mismatched quantities', () => {
    expect(() => coveredCall({ qty: 5, entryPrice: 100 }, call)).toThrow(RangeError)
  })
})

describe('pro', () => {
  it('pays min(due, margin + vault) and reports the deficit', () => {
    // qty 10, K 100, S_T 145 -> due 450; margin 300, vault 100.
    expect(proHolderPayout(10, 100, 145, 300, 100)).toEqual({
      label: 'hypothetical',
      due: 450,
      paid: 400,
      deficit: 50,
    })
  })

  it('pays in full when covered and nothing when out of the money', () => {
    expect(proHolderPayout(10, 100, 130, 300, 100)).toMatchObject({ due: 300, paid: 300, deficit: 0 })
    expect(proHolderPayout(10, 100, 90, 300, 100)).toMatchObject({ due: 0, paid: 0, deficit: 0 })
  })

  it('guaranteed cover price', () => {
    expect(guaranteedCoverPrice(10, 100, 300, 100)).toBe(140)
  })
})
