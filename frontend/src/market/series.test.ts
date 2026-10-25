import { describe, expect, it } from 'vitest'
import type { OptionOffer } from '../options/types'
import { filterOffers, formatCountdown } from './series'

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
  it('formats days and hours', () => expect(formatCountdown(1_000_000 + 3 * 86400, NOW)).toBe('in 3d 0h'))
  it('formats hours and minutes', () => expect(formatCountdown(1_000_000 + 5 * 3600 + 12 * 60, NOW)).toBe('in 5h 12m'))
  it('never shows 0m while open', () => expect(formatCountdown(1_000_000 + 20, NOW)).toBe('in 1m'))
  it('reports expired', () => expect(formatCountdown(1_000_000 - 1, NOW)).toBe('expired'))
})

describe('filterOffers', () => {
  const all = [offer('FUND', 'put'), offer('FUND', 'call'), offer('BOND', 'put')]
  it('passes everything with all/all', () => expect(filterOffers(all, 'all', 'all')).toHaveLength(3))
  it('filters by asset', () => expect(filterOffers(all, 'BOND', 'all')).toHaveLength(1))
  it('filters by kind', () => expect(filterOffers(all, 'all', 'put')).toHaveLength(2))
  it('combines', () => expect(filterOffers(all, 'FUND', 'call')).toHaveLength(1))
})
