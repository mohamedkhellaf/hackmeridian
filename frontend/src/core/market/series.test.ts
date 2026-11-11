import { describe, expect, it } from 'vitest'
import type { OptionOffer } from '../options/types'
import { filterOffers, formatCountdown, sameSeries, sortOffers } from './series'

const NOW = 1_000_000 * 1000
const tok = (code: string) => ({ contractId: code, code, decimals: 7 })
const offer = (code: string, kind: 'put' | 'call'): OptionOffer => ({
  id: 1n,
  kind,
  underlying: tok(code),
  quote: tok('USDx'),
  underlyingQty: 1n,
  totalStrike: 1n,
  totalPremium: 1n,
  expiry: 0,
  writer: 'G',
  holder: null,
  state: 'offered',
})

describe('formatCountdown', () => {
  it('formats days and hours', () => expect(formatCountdown(1_000_000 + 3 * 86400, NOW)).toBe('3d 0h'))
  it('formats hours and minutes', () => expect(formatCountdown(1_000_000 + 5 * 3600 + 12 * 60, NOW)).toBe('5h 12m'))
  it('never shows 0m while open', () => expect(formatCountdown(1_000_000 + 20, NOW)).toBe('1m'))
  it('reports expired', () => expect(formatCountdown(1_000_000 - 1, NOW)).toBe('expired'))
})

describe('filterOffers', () => {
  const all = [offer('FUND', 'put'), offer('FUND', 'call'), offer('BOND', 'put')]
  it('passes everything with all/all', () => expect(filterOffers(all, 'all', 'all')).toHaveLength(3))
  it('filters by asset', () => expect(filterOffers(all, 'BOND', 'all')).toHaveLength(1))
  it('filters by kind', () => expect(filterOffers(all, 'all', 'put')).toHaveLength(2))
  it('combines', () => expect(filterOffers(all, 'FUND', 'call')).toHaveLength(1))
})

describe('sortOffers', () => {
  const o = (id: bigint, code: string, kind: 'put' | 'call', premium: bigint): OptionOffer => ({
    ...offer(code, kind),
    id,
    underlyingQty: 10n,
    totalStrike: 100n,
    totalPremium: premium,
    expiry: 5,
  })
  it('keeps competing makers on one series adjacent, cheapest first', () => {
    const rows = sortOffers([o(1n, 'FUND', 'put', 4n), o(2n, 'BOND', 'put', 1n), o(3n, 'FUND', 'call', 2n), o(4n, 'FUND', 'put', 3n)])
    expect(rows.map((r) => r.id)).toEqual([2n, 3n, 4n, 1n])
    expect(sameSeries(rows[2], rows[3])).toBe(true)
    expect(sameSeries(rows[1], rows[2])).toBe(false)
  })
})
