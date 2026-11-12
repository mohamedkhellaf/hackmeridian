import { describe, expect, it } from 'vitest'
import type { TokenInfo } from '../../core/options/types'
import { noReference } from '../../core/reference'
import type { ReferencePrice } from '../../core/reference'
import { legNumbers, payoffModel } from './payoff'
import type { Leg } from './terms'

const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
const u = (n: number) => BigInt(Math.round(n * 1e7))
const leg = (kind: 'put' | 'call'): Leg => ({ kind, underlying: BOND, quote: USDX, underlyingQty: u(5), totalStrike: u(50), totalPremium: u(1.8), expiry: 1_800_000_000 })
const demo: ReferencePrice = { kind: 'demo', perUnit: u(9.82), label: 'Demo price', note: 'Chosen by the team for this demo. Not a market.', asOf: null }

describe('payoffModel', () => {
  it('draws a long put: capped loss at the premium, the gain reached at a price of zero', () => {
    const m = payoffModel(leg('put'), 'long', demo)!
    expect(m.strike).toEqual({ value: 10, label: '10.00' })
    expect(m.breakevens).toEqual([{ value: 9.64, label: '9.64' }])
    expect(m.maxLoss).toEqual({ value: 1.8, label: '1.80' })
    expect(m.maxGain).toEqual({ value: 48.2, label: '48.20', at: 0 })
    expect(m.pnl(8)).toBeCloseTo(8.2, 9)
    expect(m.pnl(12)).toBeCloseTo(-1.8, 9)
  })

  it('draws a short put as its mirror', () => {
    const long = payoffModel(leg('put'), 'long', demo)!
    const short = payoffModel(leg('put'), 'short', demo)!
    expect(short.maxGain).toEqual({ value: 1.8, label: '1.80' })
    expect(short.maxLoss).toEqual({ value: 48.2, label: '48.20', at: 0 })
    for (const s of [0, 5, 9.64, 10, 14]) expect(short.pnl(s)).toBeCloseTo(-long.pnl(s), 9)
  })

  it('leaves the open side of a call unlimited', () => {
    expect(payoffModel(leg('call'), 'long', demo)!.maxGain.value).toBe(Number.POSITIVE_INFINITY)
    expect(payoffModel(leg('call'), 'short', demo)!.maxLoss.value).toBe(Number.POSITIVE_INFINITY)
    expect(payoffModel(leg('call'), 'long', demo)!.breakevens[0]).toEqual({ value: 10.36, label: '10.36' })
  })

  it('samples the corner at the strike exactly and spans the reference, the strike and the breakeven', () => {
    const m = payoffModel(leg('put'), 'long', demo)!
    expect(m.points.some((p) => p.x === 10 && Math.abs(p.y + 1.8) < 1e-9)).toBe(true)
    expect(m.domain[0]).toBeLessThan(9.64)
    expect(m.domain[1]).toBeGreaterThan(10)
    expect(m.points[0].x).toBe(m.domain[0])
    expect(m.points[m.points.length - 1].x).toBe(m.domain[1])
  })

  it('starts the handle at the reference price and labels it with its source', () => {
    const m = payoffModel(leg('put'), 'long', demo)!
    expect(m.defaultPrice).toBe(9.82)
    expect(m.reference).toEqual({ value: 9.82, label: 'Demo price 9.82' })
  })

  it('centres on the strike and marks no reference when the asset has none', () => {
    const m = payoffModel(leg('call'), 'long', noReference())!
    expect(m.reference).toBeUndefined()
    expect(m.defaultPrice).toBe(10)
    expect(payoffModel(leg('call'), 'long', null)!.defaultPrice).toBe(10)
  })

  it('formats the labels from the exact integers, truncated, never from the floats', () => {
    // 1 / 3 per unit: the float is 0.3333..., the label is cut at two decimals.
    const odd: Leg = { ...leg('put'), underlyingQty: u(3), totalStrike: u(30), totalPremium: u(1) }
    const m = payoffModel(odd, 'long', null)!
    expect(m.breakevens[0].label).toBe('9.66')
    expect(m.maxLoss.label).toBe('1.00')
  })

  it('draws nothing for terms that are not an option', () => {
    expect(payoffModel({ ...leg('put'), underlyingQty: 0n }, 'long', demo)).toBeNull()
    expect(payoffModel({ ...leg('put'), totalStrike: 0n }, 'long', demo)).toBeNull()
  })

  it('sizes the axis from the option, not a fixed share of the price', () => {
    // A 99.00 put at 0.21 per unit with the demo price at 99.40: a ±40 % axis would put the strike, the breakeven
    // and the reference on a few pixels.
    const bond: Leg = { kind: 'put', underlying: BOND, quote: USDX, underlyingQty: u(1), totalStrike: u(99), totalPremium: u(0.21), expiry: 1_800_000_000 }
    const m = payoffModel(bond, 'long', { ...demo, perUnit: u(99.4) })!
    expect(m.domain[0]).toBeLessThan(98.79)
    expect(m.domain[1]).toBeGreaterThan(99.4)
    expect(m.domain[1] - m.domain[0]).toBeLessThan(10)
    expect(m.step).toBeGreaterThanOrEqual(0.01)
    expect(m.step).toBeLessThanOrEqual((m.domain[1] - m.domain[0]) / 100)
  })

  it('labels the open side of a written call as what it gives up, never as an unlimited loss', () => {
    const m = payoffModel(leg('call'), 'short', demo)!
    expect(m.labels).toEqual({ maxLoss: 'Gives up the rise above', unlimited: '10.00' })
    expect(m.description).toContain('Gives up the rise above 10.00')
    expect(m.description).not.toMatch(/unlimited|loss/i)
    expect(payoffModel(leg('put'), 'short', demo)!.labels).toBeUndefined()
  })

  it('converts exact terms to the numbers packages/payoff takes', () => {
    expect(legNumbers(leg('put'))).toEqual({ qty: 5, strikeTotal: 50, premiumTotal: 1.8 })
  })
})
