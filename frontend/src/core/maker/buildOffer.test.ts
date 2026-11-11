import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildOffer } from './buildOffer'
import type { SupportedAssets } from '../options/types'

const UNIT = 10_000_000n
const assets: SupportedAssets = {
  quote: { contractId: 'CQ', code: 'USDx', decimals: 7 },
  underlyings: [
    { contractId: 'CF', code: 'FUND', decimals: 7 },
    { contractId: 'CB', code: 'BOND', decimals: 2 },
  ],
}
const NOW = new Date('2026-10-25T12:00:00Z')
const future = new Date(NOW.getTime() + 86400_000).toISOString()
const form = (over: Partial<Parameters<typeof buildOffer>[1]> = {}) => ({
  kind: 'put' as const, underlyingId: 'CF', qty: '5', strike: '10', premium: '2', expiry: future, ...over,
})
const err = (d: ReturnType<typeof buildOffer>) => ('error' in d ? d.error : null)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('buildOffer', () => {
  it('computes exact totals', () => {
    const d = buildOffer(assets, form())
    expect(d).toEqual({
      offer: {
        kind: 'put', underlying: assets.underlyings[0], underlyingQty: 5n * UNIT,
        totalStrike: 50n * UNIT, totalPremium: 2n * UNIT, expiry: Math.floor(new Date(future).getTime() / 1000),
      },
    })
  })

  it('handles fractional strike when product is exact', () => {
    const d = buildOffer(assets, form({ qty: '4', strike: '2.5' }))
    expect('offer' in d && d.offer.totalStrike).toBe(10n * UNIT)
  })

  it('rejects non-exact strike x quantity', () => {
    // 0.0000001 * 0.5 = 0.00000005 -> not a whole quote unit
    expect(err(buildOffer(assets, form({ qty: '0.5', strike: '0.0000001' })))).toMatch(/not an exact/)
  })

  it('uses underlying decimals for exactness (BOND has 2 decimals)', () => {
    // qty 1.25 BOND = 125 units, strike 1 unit -> 125 / 100 is not an integer
    expect(err(buildOffer(assets, form({ underlyingId: 'CB', qty: '1.25', strike: '0.0000001' })))).toMatch(/not an exact/)
    const ok = buildOffer(assets, form({ underlyingId: 'CB', qty: '1.25', strike: '4' }))
    expect('offer' in ok && ok.offer.totalStrike).toBe(5n * UNIT)
    expect('offer' in ok && ok.offer.underlyingQty).toBe(125n)
  })

  it('rejects past, near-future (<60s) and invalid expiry', () => {
    expect(err(buildOffer(assets, form({ expiry: '2026-10-24T12:00:00Z' })))).toMatch(/future/)
    expect(err(buildOffer(assets, form({ expiry: new Date(NOW.getTime() + 30_000).toISOString() })))).toMatch(/future/)
    expect(err(buildOffer(assets, form({ expiry: '' })))).toMatch(/future/)
    expect(err(buildOffer(assets, form({ expiry: 'garbage' })))).toMatch(/future/)
  })

  it('rejects unknown underlying, zero or malformed amounts', () => {
    expect(err(buildOffer(assets, form({ underlyingId: 'nope' })))).toMatch(/underlying/)
    expect(err(buildOffer(assets, form({ qty: '0' })))).toMatch(/Quantity/)
    expect(err(buildOffer(assets, form({ qty: 'x' })))).toMatch(/Quantity/)
    expect(err(buildOffer(assets, form({ strike: '0' })))).toMatch(/Strike/)
    expect(err(buildOffer(assets, form({ premium: '0' })))).toMatch(/Premium/)
    expect(err(buildOffer(assets, form({ premium: '1.00000001' })))).toMatch(/Premium/)
  })

  it('rejects expiry beyond the 2 year tenor cap', () => {
    const far = new Date(NOW.getTime() + 2 * 365 * 86400_000 + 3600_000).toISOString()
    expect(err(buildOffer(assets, form({ expiry: far })))).toMatch(/2 years/)
    const ok = new Date(NOW.getTime() + 700 * 86400_000).toISOString()
    expect(err(buildOffer(assets, form({ expiry: ok })))).toBeNull()
  })

  it('supports calls', () => {
    const d = buildOffer(assets, form({ kind: 'call' }))
    expect('offer' in d && d.offer.kind).toBe('call')
  })
})
