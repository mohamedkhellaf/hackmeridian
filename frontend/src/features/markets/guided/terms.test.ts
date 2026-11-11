import { describe, expect, it } from 'vitest'
import type { BookRow } from '../../../core/market/book'
import { cellKey } from '../../../core/market/selection'
import type { OptionOffer, TokenInfo } from '../../../core/options/types'
import type { Bid } from '../../../core/requests/types'
import {
  MIN_DEFAULT_LEAD_SECONDS,
  defaultSeries,
  distanceWords,
  expiryPreference,
  inputAmount,
  maxQuantity,
  normalizeDecimal,
  ownIntent,
  parsePositive,
  pinnedSeries,
  premiumAt,
  scenarioPrices,
  strikePreference,
  takeIntent,
  totalStrike,
} from './terms'
import type { Grid } from './terms'

const D = 7
const q = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n
const NOW = Date.UTC(2026, 10, 11, 12, 0, 0) / 1000
const FRI_13 = Date.UTC(2026, 10, 13, 8, 0, 0) / 1000
const FRI_20 = Date.UTC(2026, 10, 20, 8, 0, 0) / 1000
const FRI_27 = Date.UTC(2026, 10, 27, 8, 0, 0) / 1000
const ladder = [96, 97, 98, 99, 100, 101, 102].map(q)
const grid: Grid = { ladder, expiries: [FRI_13, FRI_20, FRI_27], reference: q(99.4), nowSec: NOW }
const funded = (...cells: [number, 'put' | 'call', number][]) => new Set(cells.map(([expiry, kind, strike]) => cellKey({ expiry, kind, strikePerUnit: q(strike) })))

describe('pinnedSeries', () => {
  it('reads a strike and a day that are on the grid', () => {
    expect(pinnedSeries({ strike: '99.00', expiry: '2026-11-20' }, grid, D)).toEqual({ strike: q(99), expiry: FRI_20 })
    expect(pinnedSeries({ strike: '99', expiry: '2026-11-20' }, grid, D).strike).toBe(q(99))
  })

  it('drops what is off the grid, missing or not a value', () => {
    expect(pinnedSeries({ strike: '98.5', expiry: '2026-11-21' }, grid, D)).toEqual({ strike: null, expiry: null })
    expect(pinnedSeries({}, grid, D)).toEqual({ strike: null, expiry: null })
    expect(pinnedSeries({ strike: 'abc', expiry: 'soon' }, grid, D)).toEqual({ strike: null, expiry: null })
  })
})

describe('strikePreference', () => {
  it('starts a put at or below the reference and moves down', () => {
    const order = strikePreference('put', ladder, q(99.4))
    expect(order.preferred).toEqual([99, 98, 97, 96].map(q))
    expect(order.rest).toEqual([100, 101, 102].map(q))
  })

  it('starts a call at or above the reference and moves up', () => {
    const order = strikePreference('call', ladder, q(99.4))
    expect(order.preferred).toEqual([100, 101, 102].map(q))
    expect(order.rest).toEqual([99, 98, 97, 96].map(q))
  })

  it('counts a strike equal to the reference on both sides', () => {
    expect(strikePreference('put', ladder, q(99)).preferred[0]).toBe(q(99))
    expect(strikePreference('call', ladder, q(99)).preferred[0]).toBe(q(99))
  })

  it('leads with the middle of the ladder when there is no reference', () => {
    const order = strikePreference('put', ladder, null)
    expect(order.preferred[0]).toBe(q(99))
    expect(order.preferred).toHaveLength(ladder.length)
    expect(order.rest).toEqual([])
  })
})

describe('expiryPreference', () => {
  it('puts deadlines at least 48 hours away first', () => {
    expect(FRI_13 - NOW).toBeLessThan(MIN_DEFAULT_LEAD_SECONDS)
    expect(expiryPreference([FRI_13, FRI_20, FRI_27], NOW)).toEqual([FRI_20, FRI_27, FRI_13])
  })
})

describe('defaultSeries', () => {
  const none = { strike: null, expiry: null }

  it('takes the soonest comfortable deadline with something funded on the natural side, nearest the reference', () => {
    const set = funded([FRI_13, 'put', 99], [FRI_20, 'put', 97], [FRI_20, 'put', 98], [FRI_20, 'put', 101], [FRI_27, 'put', 99])
    expect(defaultSeries('put', grid, set, none)).toEqual({ strike: q(98), expiry: FRI_20 })
  })

  it('prefers a later deadline on the natural side to the other side of the reference', () => {
    const set = funded([FRI_20, 'call', 99], [FRI_27, 'call', 101])
    expect(defaultSeries('call', grid, set, none)).toEqual({ strike: q(101), expiry: FRI_27 })
  })

  it('falls back to the other side of the reference when nothing else is funded', () => {
    expect(defaultSeries('put', grid, funded([FRI_27, 'put', 101]), none)).toEqual({ strike: q(101), expiry: FRI_27 })
  })

  it('only reads series of its own kind', () => {
    expect(defaultSeries('put', grid, funded([FRI_20, 'call', 99]), none)).toEqual({ strike: q(99), expiry: FRI_20 })
  })

  it('with nothing funded, gives the nearest strike on the natural side and the soonest comfortable deadline', () => {
    expect(defaultSeries('put', grid, new Set(), none)).toEqual({ strike: q(99), expiry: FRI_20 })
    expect(defaultSeries('call', grid, new Set(), none)).toEqual({ strike: q(100), expiry: FRI_20 })
  })

  it('keeps what is pinned and completes the rest around it', () => {
    const set = funded([FRI_20, 'put', 98], [FRI_27, 'put', 97])
    expect(defaultSeries('put', grid, set, { strike: q(97), expiry: null })).toEqual({ strike: q(97), expiry: FRI_27 })
    expect(defaultSeries('put', grid, set, { strike: null, expiry: FRI_27 })).toEqual({ strike: q(97), expiry: FRI_27 })
    expect(defaultSeries('put', grid, set, { strike: q(101), expiry: FRI_13 })).toEqual({ strike: q(101), expiry: FRI_13 })
  })

  it('returns nulls for an empty grid', () => {
    expect(defaultSeries('put', { ladder: [], expiries: [], reference: null, nowSec: NOW }, new Set(), none)).toEqual(none)
  })
})

describe('amount text', () => {
  it('parses only positive amounts', () => {
    expect(parsePositive('2.5', D)).toBe(25_000_000n)
    expect(parsePositive('0', D)).toBeNull()
    expect(parsePositive('', D)).toBeNull()
    expect(parsePositive('1.12345678', D)).toBeNull()
  })

  it('normalises what is typed into a link value', () => {
    expect(normalizeDecimal('5')).toBe('5')
    expect(normalizeDecimal('5.')).toBe('5')
    expect(normalizeDecimal('.5')).toBe('0.5')
    expect(normalizeDecimal('12.250')).toBe('12.250')
    expect(normalizeDecimal(' 7 ')).toBe('7')
    expect(normalizeDecimal('')).toBeUndefined()
    expect(normalizeDecimal('.')).toBeUndefined()
    expect(normalizeDecimal('1,5')).toBeUndefined()
    expect(normalizeDecimal('1.12345678')).toBeUndefined()
  })

  it('shows an amount in an input with two decimals, or every digit it has', () => {
    expect(inputAmount(20_000_000n, D)).toBe('2.00')
    expect(inputAmount(25_000_000n, D)).toBe('2.50')
    expect(inputAmount(21_250_000n, D)).toBe('2.125')
    expect(inputAmount(12_000_000_000n, D)).toBe('1200.00')
    expect(parsePositive(inputAmount(21_250_001n, D), D)).toBe(21_250_001n)
    expect(inputAmount(5n, 0)).toBe('5')
  })
})

describe('totalStrike', () => {
  it('multiplies out exactly or not at all', () => {
    expect(totalStrike(q(99), 20_000_000n, D)).toBe(q(198))
    expect(totalStrike(q(99.01), 1n, D)).toBeNull()
  })
})

describe('maxQuantity', () => {
  it('is the asset held for the intents that start from the asset', () => {
    expect(maxQuantity('floor', { asset: 120_000_000n, quote: 1n }, q(99), D)).toBe(120_000_000n)
    expect(maxQuantity('earn-hold', { asset: 0n, quote: 1n }, q(99), D)).toBeNull()
    expect(maxQuantity('floor', { asset: null, quote: 1n }, q(99), D)).toBeNull()
  })

  it('is what the quote balance pays for at the strike, cut to two decimals', () => {
    // 2,500 USDx at 98 per unit pays for 25.5102..., shown as 25.51.
    const max = maxQuantity('earn-buy', { asset: null, quote: q(2500) }, q(98), D)
    expect(max).toBe(255_100_000n)
    expect(totalStrike(q(98), max!, D)! <= q(2500)).toBe(true)
    expect(maxQuantity('earn-buy', { asset: null, quote: q(0.5) }, q(98), D)).toBeNull()
  })

  it('has no cap for a locked buy price', () => {
    expect(maxQuantity('lock-buy', { asset: 1n, quote: q(2500) }, q(98), D)).toBeNull()
  })
})

describe('premiumAt', () => {
  it('scales a per-unit price to a quantity and cuts it to the tick', () => {
    expect(premiumAt(q(0.52), 20_000_000n, D, D)).toBe(q(1.04))
    expect(premiumAt(q(0.33), 15_000_000n, D, D)).toBe(q(0.49))
  })
})

describe('tickets', () => {
  const token = (code: string): TokenInfo => ({ contractId: `C_${code}`, code, decimals: D })
  const base = { kind: 'put' as const, underlying: token('BOND'), quote: token('USDx'), underlyingQty: 20_000_000n, totalStrike: q(198), totalPremium: q(1.36), expiry: FRI_20 }
  const offer = { ...base, id: 58n, writer: 'GMAKER', holder: null, state: 'offered' } as OptionOffer
  const maker: BookRow = { ...base, key: 'o58', source: 'maker', counterparty: 'GMAKER', offer }
  const resale: BookRow = { ...base, key: 'r9', source: 'resale', counterparty: 'GHOLDER', offer: { ...offer, id: 9n, holder: 'GHOLDER', state: 'active' }, ask: { id: 9n, holder: 'GHOLDER', askTotal: q(1) } }
  const bid: BookRow = { ...base, key: 'b3', source: 'bid', counterparty: 'GBUYER', bid: { ...base, id: 3n, buyer: 'GBUYER', state: 'open', optionId: null } as Bid }

  it('takes an order as it stands', () => {
    expect(takeIntent(maker, null)).toEqual({ mode: 'buy', offerId: 58n })
    expect(takeIntent(resale, 'GME')).toEqual({ mode: 'buy-resale', optionId: 9n })
    expect(takeIntent(bid, 'GME')).toEqual({ mode: 'fill', bidId: 3n })
  })

  it('never takes an order of the wallet itself', () => {
    expect(takeIntent(maker, 'GMAKER')).toBeNull()
    expect(takeIntent(bid, 'GBUYER')).toBeNull()
  })

  it('posts terms of the user: a request for a buyer, an offer for a seller', () => {
    const terms = { assetId: 'C_BOND', kind: 'call' as const, strike: '101', qty: '2.00', expiry: FRI_20 }
    expect(ownIntent('buy', { ...terms, premium: '1.04' })).toEqual({ mode: 'bid', assetId: 'C_BOND', kind: 'call', strike: '101', expiry: FRI_20, qty: '2.00', premium: '1.04' })
    expect(ownIntent('write', terms)).toEqual({ mode: 'write', assetId: 'C_BOND', kind: 'call', strike: '101', expiry: FRI_20, qty: '2.00' })
  })
})

describe('distanceWords', () => {
  it('says how far and on which side', () => {
    expect(distanceWords(-0.4)).toEqual({ short: '0.4% below', side: 'below' })
    expect(distanceWords(1)).toEqual({ short: '1% above', side: 'above' })
    expect(distanceWords(2.61)).toEqual({ short: '2.6% above', side: 'above' })
    expect(distanceWords(-0.04)).toEqual({ short: '0.04% below', side: 'below' })
    expect(distanceWords(0)).toEqual({ short: 'at the price', side: 'at' })
    expect(distanceWords(null)).toBeNull()
  })
})

describe('scenarioPrices', () => {
  it('gives round prices on both sides of the strike, the breakeven and the reference', () => {
    expect(scenarioPrices(99, 99.4, 98.32)).toEqual({ low: 95, mid: 99.4, high: 105 })
    expect(scenarioPrices(10, 10.2, 9.9)).toEqual({ low: 9, mid: 10.2, high: 11 })
    expect(scenarioPrices(25, 24.6, 25.4)).toEqual({ low: 22, mid: 24.6, high: 26 })
  })

  it('moves a price outward until it clears the strike and the breakeven', () => {
    // A deep floor: the low card must still sit below the breakeven.
    const far = scenarioPrices(80, 100, 78)
    expect(far.low).toBeLessThan(78)
    expect(far.high).toBeGreaterThan(100)
    const high = scenarioPrices(120, 100, 123)
    expect(high.high).toBeGreaterThan(123)
  })

  it('centres on the strike when there is no reference', () => {
    const s = scenarioPrices(10, null, 9.64)
    expect(s.mid).toBe(10)
    expect(s.low).toBeLessThan(9.64)
    expect(s.high).toBeGreaterThan(10)
  })
})
