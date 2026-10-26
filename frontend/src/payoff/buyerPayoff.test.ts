import { describe, expect, it } from 'vitest'
import { longCall, longPut } from '../../../packages/payoff/src/index.ts'
import type { OptionOffer } from '../options/types'
import { buyerPnl, chartModel, legOf, riskLines } from './buyerPayoff'

const USDX = { contractId: 'CU', code: 'USDx', decimals: 7 }
const FUND = { contractId: 'CF', code: 'FUND', decimals: 7 }
const u = (n: number) => BigInt(Math.round(n * 1e7))

// PRODUCT_SPEC section 5 worked check: PUT, qty 10, strike 1,000 total (K = 100), premium 40.
const put: OptionOffer = {
  id: 1n,
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: u(10),
  totalStrike: u(1000),
  totalPremium: u(40),
  expiry: 2_000_000_000,
  writer: 'GW',
  holder: null,
  state: 'offered',
}
const call: OptionOffer = { ...put, kind: 'call' }

describe('buyer payoff adapter', () => {
  it('matches the spec worked check for the put', () => {
    const r = riskLines(put, 70)
    expect(r.breakeven).toBeCloseTo(96)
    expect(r.maxLoss).toBe(40)
    expect(r.pnlAtAssumed).toBeCloseTo(260)
    expect(r.maxGain).toBeCloseTo(960)
  })
  it('call: breakeven K + premium/qty, unlimited gain', () => {
    const r = riskLines(call, 100)
    expect(r.breakeven).toBeCloseTo(104)
    expect(r.maxGain).toBeNull()
    expect(r.pnlAtAssumed).toBeCloseTo(-40)
  })
  it('breakeven is a zero of the package leg payoff', () => {
    expect(longPut(legOf(put), riskLines(put, 100).breakeven).total).toBeCloseTo(0)
    expect(longCall(legOf(call), riskLines(call, 100).breakeven).total).toBeCloseTo(0)
  })
  it('uses the package for every curve point', () => {
    const m = chartModel(put, 100)
    expect(m.points.every((p) => p.pnl === buyerPnl(put, p.s))).toBe(true)
    expect(m.minPnl).toBeCloseTo(-40)
  })
  it('widens the domain to include a far assumed price', () => {
    const m = chartModel(put, 300)
    expect(m.to).toBeGreaterThan(300)
  })
})
