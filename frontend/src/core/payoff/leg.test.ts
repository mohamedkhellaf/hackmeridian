import { describe, expect, it } from 'vitest'
import { longCall, longPut, shortCall, shortPut } from '../../../../packages/payoff/src/index.ts'
import type { TokenInfo } from '../options/types'
import { breakevenPerUnit, givesUp, legNumbers, legPnl, legPnlOf, mostYouCanGain, mostYouCanLose, premiumPerUnit, strikePerUnit, toNumber } from './leg'
import type { Leg } from './leg'

const BOND: TokenInfo = { code: 'BOND', contractId: 'C-BOND', decimals: 7 }
const USDX: TokenInfo = { code: 'USDx', contractId: 'C-USDX', decimals: 7 }
const U = 10_000_000n

/** 5 BOND at a strike of 10.00 USDx each, for a premium of 1.80 USDx in all. */
const leg = (kind: 'put' | 'call'): Leg => ({ kind, underlying: BOND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 18n * (U / 10n), expiry: 1_800_000_000 })

describe('exact figures of a leg', () => {
  it('gives strike, premium and breakeven per whole unit, truncated', () => {
    expect(strikePerUnit(leg('put'))).toBe(10n * U)
    expect(premiumPerUnit(leg('put'))).toBe(3_600_000n)
    expect(breakevenPerUnit(leg('put'))).toBe(96_400_000n)
    expect(breakevenPerUnit(leg('call'))).toBe(103_600_000n)
  })

  it('never puts the breakeven of a put below zero', () => {
    expect(breakevenPerUnit({ ...leg('put'), totalPremium: 60n * U })).toBe(0n)
  })

  it('caps each side by the premium or by the strike less the premium; a written call has no loss figure', () => {
    expect(mostYouCanLose(leg('put'), 'long')?.amount).toBe(18_000_000n)
    expect(mostYouCanGain(leg('put'), 'short')?.amount).toBe(18_000_000n)
    expect(mostYouCanGain(leg('put'), 'long')?.amount).toBe(482_000_000n)
    expect(mostYouCanLose(leg('put'), 'short')?.amount).toBe(482_000_000n)
    expect(mostYouCanGain(leg('call'), 'long')).toBeNull()
    expect(mostYouCanLose(leg('call'), 'short')).toBeNull()
  })

  it('says what a written call gives up instead: the rise above the strike, owing at most the underlying locked (E14)', () => {
    expect(givesUp(leg('call'), 'short')).toEqual({ abovePerUnit: 10n * U, locked: { token: BOND, amount: 5n * U } })
    expect(givesUp(leg('call'), 'long')).toBeNull()
    expect(givesUp(leg('put'), 'short')).toBeNull()
    expect(givesUp(leg('put'), 'long')).toBeNull()
  })
})

describe('payoff of a leg (display numbers)', () => {
  const PACKAGE = { long: { put: longPut, call: longCall }, short: { put: shortPut, call: shortCall } } as const

  it('is the package function for each of the four sides', () => {
    for (const kind of ['put', 'call'] as const) {
      for (const side of ['long', 'short'] as const) {
        const numbers = legNumbers(leg(kind))
        for (const price of [0, 5, 9.64, 10, 10.36, 12, 40]) {
          expect(legPnl(leg(kind), side, price)).toBe(PACKAGE[side][kind](numbers, price).total)
          expect(legPnlOf(numbers, kind, side, price)).toBe(PACKAGE[side][kind](numbers, price).total)
        }
      }
    }
  })

  it('crosses zero at the exact breakeven, on both sides', () => {
    for (const kind of ['put', 'call'] as const) {
      const be = toNumber(breakevenPerUnit(leg(kind)) ?? 0n, USDX.decimals)
      expect(legPnl(leg(kind), 'long', be)).toBeCloseTo(0, 9)
      expect(legPnl(leg(kind), 'short', be)).toBeCloseTo(0, 9)
    }
  })

  it('is a zero-sum between the two sides', () => {
    for (const price of [0, 7.5, 10, 13]) expect(legPnl(leg('put'), 'long', price) + legPnl(leg('put'), 'short', price)).toBeCloseTo(0, 9)
  })
})
