import { describe, expect, it } from 'vitest'
import type { OptionOffer } from '../options/types'
import { lowestOpenInSeries } from '../maker/lowestOffer'
import { expiryDay } from '../time'
import { assetCodes, buildChain, defaultAsset, defaultSeries, expiryDays, inColumn, premiumUnit, rankOffers, seriesOffers } from './chain'

const tok = (code: string) => ({ contractId: code, code, decimals: 7 })
const U = 10_000_000n
const DAY = 86400
const T0 = Date.UTC(2026, 9, 29, 12) / 1000

let n = 0n
const offer = (o: Partial<OptionOffer> & { strike?: bigint; premium?: bigint }): OptionOffer => ({
  id: ++n,
  kind: 'put',
  underlying: tok('RWA'),
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
  const fundCol = () => inColumn(offers, 'RWA', expiryDays(offers, 'RWA')[0])

  it('opens on the asset with the most offers', () => {
    expect(defaultAsset(offers)).toBe('RWA')
    expect(defaultAsset([])).toBe('')
  })

  it('lists assets and expiry days from the offers', () => {
    expect(assetCodes(offers)).toEqual(['BOND', 'RWA'])
    expect(expiryDays(offers, 'RWA')).toHaveLength(1)
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

describe('expiry day: one UTC key for the chain and for "lowest offer in this series"', () => {
  // 23:30 UTC on 29 Oct and 00:30 UTC on 30 Oct are the same local day in some zones and different days in others.
  const lateUtc = Date.UTC(2026, 9, 29, 23, 30) / 1000
  const earlyUtc = Date.UTC(2026, 9, 30, 0, 30) / 1000

  it('groups by the UTC day', () => {
    expect(expiryDay(lateUtc)).toBe('2026-10-29')
    expect(expiryDay(earlyUtc)).toBe('2026-10-30')
    const offers = [offer({ expiry: lateUtc }), offer({ expiry: earlyUtc })]
    expect(expiryDays(offers, 'RWA')).toEqual(['2026-10-29', '2026-10-30'])
    expect(inColumn(offers, 'RWA', '2026-10-29')).toHaveLength(1)
  })

  it('the chain column and the lowest-offer lookup always agree on the series', () => {
    const offers = [offer({ expiry: lateUtc, premium: 1n }), offer({ expiry: earlyUtc, premium: 2n })]
    for (const o of offers) {
      const column = inColumn(offers, 'RWA', expiryDay(o.expiry))
      const draft = { kind: o.kind, underlying: o.underlying, underlyingQty: o.underlyingQty, totalStrike: o.totalStrike, totalPremium: 9n * U, expiry: o.expiry + 60 }
      const lowest = lowestOpenInSeries(offers, draft, o.quote)
      expect(lowest?.id).toBe(o.id)
      expect(column.map((x) => x.id)).toEqual([o.id])
    }
  })
})

describe('strike order is exact', () => {
  it('orders strikes that a float division cannot tell apart', () => {
    // Whole-unit tokens: 2^53 and 2^53 + 1 are different strikes and the same double.
    const whole = (code: string) => ({ contractId: code, code, decimals: 0 })
    const big = 2n ** 53n
    const terms = { underlying: whole('RWA'), quote: whole('USDx'), underlyingQty: 1n }
    const low = offer({ ...terms, totalStrike: big })
    const high = offer({ ...terms, totalStrike: big + 1n })
    expect(Number(low.totalStrike) / Number(low.underlyingQty)).toBe(Number(high.totalStrike) / Number(high.underlyingQty))
    const rows = buildChain([low, high])
    expect(rows).toHaveLength(2)
    expect(rows[0].put?.best.id).toBe(high.id) // highest strike first
    expect(buildChain([high, low])[0].put?.best.id).toBe(high.id)
  })

  it('keeps highest strike first for ordinary strikes', () => {
    const rows = buildChain([offer({ strike: 9n }), offer({ strike: 12n }), offer({ strike: 10n })])
    expect(rows.map((r) => r.strike)).toEqual(['12.00', '10.00', '9.00'])
  })
})
