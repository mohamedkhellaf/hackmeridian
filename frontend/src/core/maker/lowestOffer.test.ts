import { describe, expect, it } from 'vitest'
import type { NewOffer, OptionOffer, TokenInfo } from '../options/types'
import { lowestOpenInSeries, premiumPerUnitText } from './lowestOffer'

const U = 10_000_000n
const USDX: TokenInfo = { contractId: 'Q', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'F', code: 'FUND', decimals: 7 }
const T = 2_000_000_000
const offer = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U,
  expiry: T, writer: 'GA', holder: null, state: 'offered', ...over,
})
const draft: NewOffer = { kind: 'put', underlying: FUND, underlyingQty: 10n * U, totalStrike: 100n * U, totalPremium: 3n * U, expiry: T + 3600 }

describe('lowestOpenInSeries', () => {
  it('picks the cheapest per unit among open offers of the same series', () => {
    const a = offer({ id: 1n, totalPremium: 2n * U }) // 0.40 / unit
    const b = offer({ id: 2n, totalPremium: (18n * U) / 10n }) // 0.36 / unit
    expect(lowestOpenInSeries([a, b], draft, USDX)?.id).toBe(2n)
  })
  it('ignores other series, sold and closed offers', () => {
    const others = [
      offer({ kind: 'call' }),
      offer({ totalStrike: 60n * U }), // other strike
      offer({ expiry: T + 3 * 86400 }), // other day
      offer({ state: 'active', holder: 'GB' }),
      offer({ underlying: { ...FUND, contractId: 'F2' } }),
    ]
    expect(lowestOpenInSeries(others, draft, USDX)).toBeNull()
  })
})

describe('premiumPerUnitText', () => {
  it('shows two decimals', () => {
    expect(premiumPerUnitText({ totalPremium: 2n * U, underlyingQty: 5n * U, underlying: FUND }, 7)).toBe('0.40')
    expect(premiumPerUnitText({ totalPremium: (18n * U) / 10n, underlyingQty: 5n * U, underlying: FUND }, 7)).toBe('0.36')
  })
})
