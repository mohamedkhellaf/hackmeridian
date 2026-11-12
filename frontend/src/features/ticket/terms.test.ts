import { describe, expect, it } from 'vitest'
import { cashSecuredPut, longCall, longPut, shortCall, shortPut, toNumber } from '../../../../packages/payoff/src/index.ts'
import type { TokenInfo } from '../../core/options/types'
import { breakevenPerUnit, exerciseGives, exerciseReceives, glyphOf, mostYouCanGain, mostYouCanLose, positionWords, premiumPerUnit, serialOf, strikePerUnit } from './terms'
import type { Leg } from './terms'

const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
const u = (n: number) => BigInt(Math.round(n * 1e7))

const leg = (kind: 'put' | 'call', qty: number, strikeTotal: number, premiumTotal: number): Leg => ({
  kind,
  underlying: BOND,
  quote: USDX,
  underlyingQty: u(qty),
  totalStrike: u(strikeTotal),
  totalPremium: u(premiumTotal),
  expiry: 1_800_000_000,
})

describe('per-unit figures', () => {
  it('reads strike and premium per unit, truncated', () => {
    const l = leg('put', 5, 50, 1.8)
    expect(strikePerUnit(l)).toBe(u(10))
    expect(premiumPerUnit(l)).toBe(u(0.36))
    // 1 / 3 does not end: the figure is cut, never rounded up.
    expect(premiumPerUnit(leg('put', 3, 30, 1))).toBe(3_333_333n)
  })

  it('has none for a zero quantity', () => {
    const l = { ...leg('put', 5, 50, 1.8), underlyingQty: 0n }
    expect(strikePerUnit(l)).toBeNull()
    expect(breakevenPerUnit(l)).toBeNull()
  })
})

describe('breakeven', () => {
  it('is strike minus premium per unit for a put and strike plus premium per unit for a call', () => {
    expect(breakevenPerUnit(leg('put', 5, 50, 1.8))).toBe(u(9.64))
    expect(breakevenPerUnit(leg('call', 5, 50, 1.8))).toBe(u(10.36))
  })

  it('never goes below zero when the premium exceeds the strike', () => {
    expect(breakevenPerUnit(leg('put', 5, 50, 60))).toBe(0n)
  })

  it('is where the payoff of packages/payoff crosses zero, on both sides', () => {
    for (const [kind, long, short] of [
      ['put', longPut, shortPut],
      ['call', longCall, shortCall],
    ] as const) {
      const l = leg(kind, 5, 50, 1.8)
      const numbers = { qty: 5, strikeTotal: 50, premiumTotal: 1.8 }
      const be = toNumber(breakevenPerUnit(l)!, 7)
      expect(long(numbers, be).total).toBeCloseTo(0, 9)
      expect(short(numbers, be).total).toBeCloseTo(0, 9)
    }
  })
})

describe('most you can lose and gain', () => {
  it('caps the buyer at the premium', () => {
    expect(mostYouCanLose(leg('put', 5, 50, 1.8), 'long')).toEqual({ token: USDX, amount: u(1.8) })
    expect(mostYouCanLose(leg('call', 5, 50, 1.8), 'long')).toEqual({ token: USDX, amount: u(1.8) })
  })

  it('caps a put writer at the strike less the premium, as packages/payoff does', () => {
    const worst = mostYouCanLose(leg('put', 5, 50, 1.8), 'short')
    expect(worst).toEqual({ token: USDX, amount: u(48.2) })
    expect(toNumber(worst!.amount, 7)).toBeCloseTo(cashSecuredPut({ qty: 5, strikeTotal: 50, premiumTotal: 1.8 }).maxLoss, 9)
  })

  it('has no cap for a call writer, and none on the gain of a call buyer', () => {
    expect(mostYouCanLose(leg('call', 5, 50, 1.8), 'short')).toBeNull()
    expect(mostYouCanGain(leg('call', 5, 50, 1.8), 'long')).toBeNull()
  })

  it('gives the writer the premium at most, and a put buyer the strike less the premium', () => {
    expect(mostYouCanGain(leg('put', 5, 50, 1.8), 'short')).toEqual({ token: USDX, amount: u(1.8) })
    expect(mostYouCanGain(leg('call', 5, 50, 1.8), 'short')).toEqual({ token: USDX, amount: u(1.8) })
    expect(mostYouCanGain(leg('put', 5, 50, 1.8), 'long')).toEqual({ token: USDX, amount: u(48.2) })
    expect(toNumber(u(48.2), 7)).toBeCloseTo(longPut({ qty: 5, strikeTotal: 50, premiumTotal: 1.8 }, 0).total, 9)
  })

  it('floors at zero when the premium is at least the strike', () => {
    expect(mostYouCanLose(leg('put', 5, 50, 60), 'short')?.amount).toBe(0n)
    expect(mostYouCanGain(leg('put', 5, 50, 60), 'long')?.amount).toBe(0n)
  })
})

describe('exercise legs', () => {
  it('a put holder delivers the underlying and receives the strike; a call holder the reverse', () => {
    const put = leg('put', 5, 50, 1.8)
    expect(exerciseGives(put)).toEqual({ token: BOND, amount: u(5) })
    expect(exerciseReceives(put)).toEqual({ token: USDX, amount: u(50) })
    const call = leg('call', 5, 50, 1.8)
    expect(exerciseGives(call)).toEqual({ token: USDX, amount: u(50) })
    expect(exerciseReceives(call)).toEqual({ token: BOND, amount: u(5) })
  })
})

describe('names', () => {
  it('names the glyph, the position and the serial', () => {
    expect(glyphOf('long', 'put')).toBe('long-put')
    expect(glyphOf('short', 'call')).toBe('short-call')
    expect(positionWords('short', 'put')).toBe('Short put')
    expect(serialOf(184n)).toBe('184')
    expect(serialOf(0n)).toBe('0')
    expect(serialOf(12_345_678n)).toBe('12345678')
  })
})
