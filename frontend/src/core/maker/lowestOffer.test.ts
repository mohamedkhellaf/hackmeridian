import { describe, expect, it } from 'vitest'
import type { NewOffer, OptionOffer, TokenInfo } from '../options/types'
import { lowestOpenInSeries, premiumPerUnitText } from './lowestOffer'

const U = 10_000_000n
const USDX: TokenInfo = { contractId: 'Q', code: 'USDx', decimals: 7 }
const RWA: TokenInfo = { contractId: 'F', code: 'RWA', decimals: 7 }
const T = 2_000_000_000
const offer = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n, kind: 'put', underlying: RWA, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U,
  expiry: T, writer: 'GA', holder: null, state: 'offered', ...over,
})
const draft: NewOffer = { kind: 'put', underlying: RWA, underlyingQty: 10n * U, totalStrike: 100n * U, totalPremium: 3n * U, expiry: T + 3600 }

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
      offer({ underlying: { ...RWA, contractId: 'F2' } }),
    ]
    expect(lowestOpenInSeries(others, draft, USDX)).toBeNull()
  })
})

describe('premiumPerUnitText', () => {
  it('shows two decimals', () => {
    expect(premiumPerUnitText({ totalPremium: 2n * U, underlyingQty: 5n * U, underlying: RWA }, 7)).toBe('0.40')
    expect(premiumPerUnitText({ totalPremium: (18n * U) / 10n, underlyingQty: 5n * U, underlying: RWA }, 7)).toBe('0.36')
  })
})

describe('lowestOpenInSeries groups by the UTC expiry day', () => {
  it('matches an offer on the same UTC day and ignores one on the next UTC day', () => {
    const day = Date.UTC(2026, 10, 13, 8) / 1000
    const d: NewOffer = { ...draft, expiry: day }
    const sameDay = offer({ id: 5n, expiry: Date.UTC(2026, 10, 13, 23, 59) / 1000 })
    const nextDay = offer({ id: 6n, expiry: Date.UTC(2026, 10, 14, 0, 1) / 1000, totalPremium: U })
    expect(lowestOpenInSeries([sameDay, nextDay], d, USDX)?.id).toBe(5n)
  })
  it('compares premiums per unit exactly across different lot sizes', () => {
    const a = offer({ id: 1n, underlyingQty: 3n * U, totalStrike: 30n * U, totalPremium: U }) // 0.3333... per unit
    const b = offer({ id: 2n, underlyingQty: 6n * U, totalStrike: 60n * U, totalPremium: 2n * U - 1n }) // a hair cheaper per unit
    expect(lowestOpenInSeries([a, b], { ...draft, expiry: T }, USDX)?.id).toBe(2n)
  })
})

describe('lowestOpenInSeriesOf', () => {
  it('finds the cheapest offer of a series named by its terms, before any quantity', async () => {
    const { lowestOpenInSeriesOf } = await import('./lowestOffer')
    const a = offer({ id: 1n, totalPremium: 2n * U })
    const b = offer({ id: 2n, totalPremium: (18n * U) / 10n })
    const call = offer({ id: 3n, kind: 'call', totalPremium: U / 10n })
    const series = { underlying: RWA, kind: 'put' as const, strikePerUnit: 10n * U, expiry: T + 3600 }
    expect(lowestOpenInSeriesOf([a, b, call], series, USDX)?.id).toBe(2n)
    expect(lowestOpenInSeriesOf([a, b, call], { ...series, strikePerUnit: 11n * U }, USDX)).toBeNull()
    expect(lowestOpenInSeriesOf([a, b, call], { ...series, kind: 'call' }, USDX)?.id).toBe(3n)
  })
})
