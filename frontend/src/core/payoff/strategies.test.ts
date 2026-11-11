import { describe, expect, it } from 'vitest'
import { cashSecuredPut, coveredCall, longCall, longPut, protectivePut, shortCall, shortPut } from '../../../../packages/payoff/src/index.ts'
import type { OptionLeg } from '../../../../packages/payoff/src/index.ts'
import { findBannedWords } from '../disclosures'
import {
  earnOnHolding,
  earnWhileWaiting,
  GUIDED_INTENTS,
  guidedOutcome,
  guidedTermsOf,
  intentFor,
  intentInfo,
  lockBuyPrice,
  setFloor,
} from './strategies'
import type { GuidedIntent, GuidedTerms } from './strategies'

// The worked example of the guided flow: 5 units, strike 10.00, premium 1.80 in total (0.36 per unit).
const T: GuidedTerms = { qty: 5, strike: 10, premiumTotal: 1.8 }
const LEG: OptionLeg = { qty: 5, strikeTotal: 50, premiumTotal: 1.8 }
const PRICES = [0, 2.5, 7, 9.63, 9.64, 9.65, 9.99, 10, 10.01, 10.35, 10.36, 10.37, 12, 25, 1000]
const INTENTS: GuidedIntent[] = ['floor', 'earn-hold', 'earn-buy', 'lock-buy']

describe('intents', () => {
  it('lists the four intents of the brief, the three main ones first', () => {
    expect(GUIDED_INTENTS.map((i) => [i.id, i.name, i.optionKind, i.side, i.starts, i.main])).toEqual([
      ['floor', 'Set a floor', 'put', 'buy', 'asset', true],
      ['earn-hold', 'Earn on what you hold', 'call', 'write', 'asset', true],
      ['earn-buy', 'Earn while waiting to buy', 'put', 'write', 'cash', true],
      ['lock-buy', 'Lock a buy price', 'call', 'buy', 'cash', false],
    ])
  })

  it('names no intent with a banned word', () => {
    for (const i of GUIDED_INTENTS) expect(findBannedWords(i.name), i.name).toEqual([])
  })

  it('maps an option kind and a side to its intent and back', () => {
    expect(intentFor('put', 'buy')).toBe('floor')
    expect(intentFor('call', 'write')).toBe('earn-hold')
    expect(intentFor('put', 'write')).toBe('earn-buy')
    expect(intentFor('call', 'buy')).toBe('lock-buy')
    for (const i of GUIDED_INTENTS) expect(intentInfo(intentFor(i.optionKind, i.side))).toBe(i)
    expect(() => intentInfo('hedge' as GuidedIntent)).toThrow(RangeError)
  })
})

describe('set a floor (hold the asset, buy a put)', () => {
  it('reproduces the worked example: at 7.00, 35.00 without and 48.20 with', () => {
    const o = setFloor(T, 7)
    expect(o.withoutValue).toBeCloseTo(35, 9)
    expect(o.withValue).toBeCloseTo(48.2, 9)
    expect(o.difference).toBeCloseTo(13.2, 9)
    expect(o.exercised).toBe(true)
    expect(o.breakeven).toBeCloseTo(9.64, 9)
    expect(o.premiumPerUnit).toBeCloseTo(0.36, 9)
    expect(o.label).toBe('hypothetical')
    expect(o.intent).toBe('floor')
    expect(o.s).toBe(7)
  })

  it('costs the premium when the price stays above the floor', () => {
    const o = setFloor(T, 12)
    expect(o.withoutValue).toBeCloseTo(60, 9)
    expect(o.withValue).toBeCloseTo(58.2, 9)
    expect(o.difference).toBeCloseTo(-1.8, 9)
    expect(o.exercised).toBe(false)
  })

  it('never falls below the floor value, and has no cap', () => {
    const o = setFloor(T, 7)
    expect(o.floorValue).toBeCloseTo(48.2, 9) // 5 x 10.00 - 1.80
    expect(o.capValue).toBeNull()
    expect(o.maxGain).toBeNull()
    for (const s of PRICES) expect(setFloor(T, s).withValue).toBeGreaterThanOrEqual(48.2 - 1e-9)
  })

  it('measures the most you can lose from the entry price', () => {
    expect(setFloor(T, 7).maxLoss).toBeCloseTo(1.8, 9) // from the strike: the premium
    expect(setFloor({ ...T, entryPrice: 10.5 }, 7).maxLoss).toBeCloseTo(4.3, 9) // 0.50 x 5 + 1.80
    expect(setFloor({ ...T, entryPrice: 9.5 }, 7).maxLoss).toBeCloseTo(0, 9) // floor above today's price, net of the premium
    expect(setFloor({ ...T, entryPrice: 10.5 }, 7).maxLoss).toBeCloseTo(protectivePut({ qty: 5, entryPrice: 10.5 }, LEG).maxLoss, 12)
  })

  it('does not let the entry price change what you would hold', () => {
    for (const s of PRICES) {
      expect(setFloor({ ...T, entryPrice: 10.5 }, s).withValue).toBeCloseTo(setFloor(T, s).withValue, 9)
      expect(setFloor({ ...T, entryPrice: 3 }, s).withoutValue).toBeCloseTo(setFloor(T, s).withoutValue, 9)
    }
  })
})

describe('earn on what you hold (hold the asset, write a call)', () => {
  it('adds the premium below the strike and caps the value above it', () => {
    const low = earnOnHolding(T, 9)
    expect(low.withoutValue).toBeCloseTo(45, 9)
    expect(low.withValue).toBeCloseTo(46.8, 9)
    expect(low.exercised).toBe(false)
    const high = earnOnHolding(T, 12)
    expect(high.withoutValue).toBeCloseTo(60, 9)
    expect(high.withValue).toBeCloseTo(51.8, 9) // sold at 10.00, plus the premium
    expect(high.difference).toBeCloseTo(-8.2, 9)
    expect(high.exercised).toBe(true)
  })

  it('reports the cap, the breakeven above the strike and what is given up', () => {
    const o = earnOnHolding(T, 12)
    expect(o.capValue).toBeCloseTo(51.8, 9)
    expect(o.floorValue).toBeCloseTo(1.8, 9) // the asset at zero, the premium kept
    expect(o.breakeven).toBeCloseTo(10.36, 9)
    expect(o.maxGain).toBeCloseTo(1.8, 9) // from the strike: the premium
    expect(o.maxLoss).toBeCloseTo(48.2, 9) // 5 x 10.00 falling to zero, less the premium
    for (const s of PRICES) expect(earnOnHolding(T, s).withValue).toBeLessThanOrEqual(51.8 + 1e-9)
  })

  it('measures gain and loss from the entry price', () => {
    const o = earnOnHolding({ ...T, entryPrice: 9.5 }, 12)
    expect(o.maxGain).toBeCloseTo(4.3, 9) // (10.00 - 9.50) x 5 + 1.80
    expect(o.maxLoss).toBeCloseTo(45.7, 9) // 9.50 x 5 - 1.80
    const p = coveredCall({ qty: 5, entryPrice: 9.5 }, LEG)
    expect(o.maxGain).toBeCloseTo(p.maxGain, 12)
    expect(o.maxLoss).toBeCloseTo(p.maxLoss, 12)
  })
})

describe('earn while waiting to buy (set cash aside, write a put)', () => {
  it('keeps the cash and the premium above the strike, and buys at the strike below it', () => {
    const high = earnWhileWaiting(T, 12)
    expect(high.withoutValue).toBeCloseTo(50, 9) // the cash set aside
    expect(high.withValue).toBeCloseTo(51.8, 9)
    expect(high.exercised).toBe(false)
    const low = earnWhileWaiting(T, 7)
    expect(low.withoutValue).toBeCloseTo(50, 9)
    expect(low.withValue).toBeCloseTo(36.8, 9) // 5 units worth 7.00 each, plus the premium
    expect(low.difference).toBeCloseTo(-13.2, 9)
    expect(low.exercised).toBe(true)
  })

  it('reports breakeven, cap and worst case from the package', () => {
    const o = earnWhileWaiting(T, 12)
    const p = cashSecuredPut(LEG)
    expect(o.breakeven).toBeCloseTo(9.64, 9)
    expect(o.breakeven).toBeCloseTo(p.breakevens[0], 9)
    expect(o.maxGain).toBeCloseTo(1.8, 9)
    expect(o.maxLoss).toBeCloseTo(48.2, 9)
    expect(o.maxGain).toBeCloseTo(p.maxGain, 12)
    expect(o.maxLoss).toBeCloseTo(p.maxLoss, 12)
    expect(o.capValue).toBeCloseTo(51.8, 9)
    expect(o.floorValue).toBeCloseTo(1.8, 9)
  })

  it('ignores the entry price: the starting point is the cash', () => {
    for (const s of PRICES) {
      const a = earnWhileWaiting(T, s)
      const b = earnWhileWaiting({ ...T, entryPrice: 10.5 }, s)
      expect(b.withValue).toBeCloseTo(a.withValue, 9)
      expect(b.maxLoss).toBeCloseTo(a.maxLoss, 9)
      expect(b.maxGain).toBeCloseTo(a.maxGain!, 9)
    }
  })
})

describe('lock a buy price (set cash aside, buy a call)', () => {
  it('costs the premium below the strike and follows the price above it', () => {
    const low = lockBuyPrice(T, 9)
    expect(low.withoutValue).toBeCloseTo(50, 9)
    expect(low.withValue).toBeCloseTo(48.2, 9)
    expect(low.exercised).toBe(false)
    const high = lockBuyPrice(T, 12)
    expect(high.withoutValue).toBeCloseTo(50, 9)
    expect(high.withValue).toBeCloseTo(58.2, 9) // 5 units worth 12.00, bought for 50.00, less the premium
    expect(high.difference).toBeCloseTo(8.2, 9)
    expect(high.exercised).toBe(true)
  })

  it('can lose the premium at most and has no cap', () => {
    const o = lockBuyPrice(T, 12)
    expect(o.maxLoss).toBeCloseTo(1.8, 9)
    expect(o.maxGain).toBeNull()
    expect(o.capValue).toBeNull()
    expect(o.floorValue).toBeCloseTo(48.2, 9)
    expect(o.breakeven).toBeCloseTo(10.36, 9)
  })
})

describe('every intent', () => {
  // "With" minus "without" is exactly the option leg seen from the user's side, as the package computes it.
  const legPnl: Record<GuidedIntent, (s: number) => number> = {
    floor: (s) => longPut(LEG, s).total,
    'earn-hold': (s) => shortCall(LEG, s).total,
    'earn-buy': (s) => shortPut(LEG, s).total,
    'lock-buy': (s) => longCall(LEG, s).total,
  }

  it.each(INTENTS)('%s: with minus without equals the package leg at every price', (intent) => {
    for (const s of PRICES) {
      const o = guidedOutcome(intent, T, s)
      expect(o.difference, `at ${s}`).toBeCloseTo(legPnl[intent](s), 9)
      expect(o.difference).toBeCloseTo(o.withValue - o.withoutValue, 12)
    }
  })

  it.each(INTENTS)('%s: with equals without at the breakeven, and the sign flips around it', (intent) => {
    const be = guidedOutcome(intent, T, 10).breakeven
    expect(guidedOutcome(intent, T, be).difference).toBeCloseTo(0, 9)
    const below = guidedOutcome(intent, T, be - 0.5).difference
    const above = guidedOutcome(intent, T, be + 0.5).difference
    expect(Math.sign(below)).toBe(-Math.sign(above))
    // buying a put or writing a call pays off below its breakeven; the other two above
    expect(below > 0).toBe(intent === 'floor' || intent === 'earn-hold')
  })

  it.each(INTENTS)('%s: floor and cap bound the curve at every price', (intent) => {
    const ref = guidedOutcome(intent, T, 10)
    for (const s of PRICES) {
      const v = guidedOutcome(intent, T, s).withValue
      expect(v).toBeGreaterThanOrEqual(ref.floorValue - 1e-9)
      if (ref.capValue !== null) expect(v).toBeLessThanOrEqual(ref.capValue + 1e-9)
    }
    // the bound is reached
    expect(Math.min(guidedOutcome(intent, T, 0).withValue, guidedOutcome(intent, T, 10).withValue)).toBeCloseTo(ref.floorValue, 9)
    expect(ref.capValue === null).toBe(ref.maxGain === null)
  })

  it.each(INTENTS)('%s: exercised follows the option kind', (intent) => {
    const put = intentInfo(intent).optionKind === 'put'
    expect(guidedOutcome(intent, T, 9.99).exercised).toBe(put)
    expect(guidedOutcome(intent, T, 10.01).exercised).toBe(!put)
    expect(guidedOutcome(intent, T, 10).exercised).toBe(false) // at the strike nothing is gained by exercising
  })

  it.each(INTENTS)('%s: the curve is ascending, covers the price and samples strike and breakeven exactly', (intent) => {
    const o = guidedOutcome(intent, T, 7)
    const xs = o.curve.map((p) => p.s)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    expect(new Set(xs).size).toBe(xs.length)
    expect(xs[0]).toBeLessThanOrEqual(5)
    expect(xs[xs.length - 1]).toBeGreaterThanOrEqual(15)
    expect(xs).toContain(10)
    expect(xs).toContain(o.breakeven)
    expect(xs.length).toBeGreaterThanOrEqual(61)
    for (const p of o.curve) {
      const at = guidedOutcome(intent, T, p.s)
      expect(p.withValue).toBeCloseTo(at.withValue, 12)
      expect(p.withoutValue).toBeCloseTo(at.withoutValue, 12)
    }
  })

  it('widens the default range to include the price and the entry price', () => {
    const far = guidedOutcome('floor', T, 30)
    expect(far.curve[far.curve.length - 1].s).toBeGreaterThanOrEqual(30)
    const low = guidedOutcome('floor', T, 1)
    expect(low.curve[0].s).toBeLessThanOrEqual(1)
    const entry = guidedOutcome('floor', { ...T, entryPrice: 40 }, 10)
    expect(entry.curve[entry.curve.length - 1].s).toBeGreaterThanOrEqual(40)
  })

  it('takes an explicit range and step count', () => {
    const o = guidedOutcome('earn-hold', T, 10, { from: 8, to: 12, steps: 4 })
    expect(o.curve.map((p) => p.s)).toEqual([8, 9, 10, 10.36, 11, 12])
    expect(guidedOutcome('earn-hold', T, 10, { from: 11, to: 12, steps: 1 }).curve.map((p) => p.s)).toEqual([11, 12]) // kinks outside the range are left out
    expect(guidedOutcome('floor', T, 10, { from: -5, to: 5, steps: 5 }).curve[0].s).toBe(0) // prices are never negative
    expect(() => guidedOutcome('floor', T, 10, { steps: 0 })).toThrow(RangeError)
    expect(() => guidedOutcome('floor', T, 10, { steps: 2.5 })).toThrow(RangeError)
  })

  it('handles a free option and a premium larger than the strike', () => {
    const free = guidedOutcome('floor', { ...T, premiumTotal: 0 }, 7)
    expect(free.breakeven).toBe(10)
    expect(free.maxLoss).toBe(0)
    const dear = guidedOutcome('floor', { ...T, premiumTotal: 80 }, 7)
    expect(dear.breakeven).toBe(0) // never below zero: this put can never pay for itself
    expect(guidedOutcome('earn-buy', { ...T, premiumTotal: 80 }, 7).maxLoss).toBe(0)
  })

  it('refuses terms and prices that are not usable numbers', () => {
    for (const bad of [{ qty: 0 }, { qty: -1 }, { qty: NaN }, { strike: 0 }, { strike: Infinity }, { premiumTotal: -1 }, { premiumTotal: NaN }, { entryPrice: 0 }, { entryPrice: -3 }]) {
      for (const intent of INTENTS) expect(() => guidedOutcome(intent, { ...T, ...bad }, 10), JSON.stringify(bad)).toThrow(RangeError)
    }
    for (const price of [-1, NaN, Infinity]) expect(() => guidedOutcome('floor', T, price)).toThrow(RangeError)
    expect(() => guidedOutcome('collar' as GuidedIntent, T, 10)).toThrow(RangeError)
  })
})

describe('guidedTermsOf', () => {
  const USDX = { decimals: 7 }
  const FUND = { decimals: 7 }
  const u = (n: number) => BigInt(Math.round(n * 1e7))

  it('converts exact terms to display numbers', () => {
    const exact = { underlying: FUND, quote: USDX, underlyingQty: u(5), totalStrike: u(50), totalPremium: u(1.8) }
    expect(guidedTermsOf(exact)).toEqual({ qty: 5, strike: 10, premiumTotal: 1.8 })
    expect(guidedTermsOf(exact, u(10.2))).toEqual({ qty: 5, strike: 10, premiumTotal: 1.8, entryPrice: 10.2 })
    expect(guidedTermsOf(exact, null)).toEqual({ qty: 5, strike: 10, premiumTotal: 1.8 })
    expect(guidedTermsOf(exact, 0n)).toEqual({ qty: 5, strike: 10, premiumTotal: 1.8 })
  })

  it('respects the decimals of each token', () => {
    const cents = { underlying: { decimals: 2 }, quote: USDX, underlyingQty: 250n, totalStrike: u(245), totalPremium: u(3) }
    expect(guidedTermsOf(cents)).toEqual({ qty: 2.5, strike: 98, premiumTotal: 3 })
  })

  it('feeds the outcome functions', () => {
    const exact = { underlying: FUND, quote: USDX, underlyingQty: u(5), totalStrike: u(50), totalPremium: u(1.8) }
    const o = setFloor(guidedTermsOf(exact, u(10.5)), 7)
    expect(o.withValue).toBeCloseTo(48.2, 9)
    expect(o.maxLoss).toBeCloseTo(4.3, 9)
  })
})

describe('the value of the asset lot at a price', () => {
  it('is quantity times price for every intent, also where "without" is cash', async () => {
    const { guidedOutcome } = await import('./strategies')
    const terms = { qty: 5, strike: 10, premiumTotal: 1.8, entryPrice: 10 }
    for (const intent of ['floor', 'earn-hold', 'earn-buy', 'lock-buy'] as const) {
      expect(guidedOutcome(intent, terms, 9.4, { steps: 1 }).assetValue).toBeCloseTo(47, 9)
      expect(guidedOutcome(intent, terms, 0, { steps: 1 }).assetValue).toBe(0)
    }
  })
})
