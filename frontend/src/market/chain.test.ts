import { describe, expect, it } from 'vitest'
import type { OptionOffer } from '../options/types'
import { assetCodes, buildChain, defaultAsset, defaultSeries, expiryDays, inColumn, premiumUnit, rankOffers, seriesOffers } from './chain'

const tok = (code: string) => ({ contractId: code, code, decimals: 7 })
const U = 10_000_000n
const DAY = 86400
const T0 = Date.UTC(2026, 9, 29, 12) / 1000

let n = 0n
const offer = (o: Partial<OptionOffer> & { strike?: bigint; premium?: bigint }): OptionOffer => ({
  id: ++n,
  kind: 'put',
  underlying: tok('FUND'),
  quote: tok('USDx'),
  underlyingQty: 5n * U,
  totalStrike: (o.strike ?? 10n) * 5n * U,
  totalPremium: (o.premium ?? 2n) * U,
  expiry: T0,
  writer: 'GA',
  holder: null,
  state: 'offered',
  ...o,
})

describe('chain', () => {
  const offers = [
    offer({ writer: 'GA', premium: 2n }),
    offer({ writer: 'GB', premium: 1n }),
    offer({ kind: 'call', strike: 12n, premium: 3n }),
    offer({ underlying: tok('BOND'), expiry: T0 + 14 * DAY }),
  ]
  const fundCol = () => inColumn(offers, 'FUND', expiryDays(offers, 'FUND')[0])

  it('opens on the asset with the most offers', () => {
    expect(defaultAsset(offers)).toBe('FUND')
    expect(defaultAsset([])).toBe('')
  })

  it('lists assets and expiry days from the offers', () => {
    expect(assetCodes(offers)).toEqual(['BOND', 'FUND'])
    expect(expiryDays(offers, 'FUND')).toHaveLength(1)
    expect(expiryDays(offers, 'BOND')).toHaveLength(1)
  })

  it('builds rows by strike, highest first, with best premium and maker count per side', () => {
    const rows = buildChain(fundCol())
    expect(rows.map((r) => r.strike)).toEqual(['12.00', '10.00'])
    expect(rows[0].put).toBeUndefined()
    expect(rows[0].call?.makers).toBe(1)
    expect(rows[1].call).toBeUndefined()
    expect(rows[1].put?.makers).toBe(2)
    expect(premiumUnit(rows[1].put!.best)).toBe('0.20')
  })

  it('ranks the cheapest premium per unit first', () => {
    const [a, b] = rankOffers(offers.slice(0, 2))
    expect(a.writer).toBe('GB')
    expect(b.writer).toBe('GA')
  })

  it('counts a maker once even with several offers', () => {
    const rows = buildChain([offer({ writer: 'GA' }), offer({ writer: 'GA', premium: 3n })])
    expect(rows[0].put?.makers).toBe(1)
    expect(rows[0].put?.offers).toHaveLength(2)
  })

  it('picks the series with most makers as the default', () => {
    expect(defaultSeries(buildChain(fundCol()))).toBe('put:10.00')
    expect(defaultSeries([])).toBeNull()
  })

  it('returns one series best first', () => {
    expect(seriesOffers(fundCol(), 'put:10.00').map((o) => o.writer)).toEqual(['GB', 'GA'])
    expect(seriesOffers(fundCol(), 'call:10.00')).toEqual([])
  })
})
