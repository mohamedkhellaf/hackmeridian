import { describe, expect, it } from 'vitest'
import { parseAmount } from '../options/format'
import type { Ask, OptionOffer, TokenInfo } from '../options/types'
import type { Bid } from '../requests/types'
import { expiryDay } from '../time'
import { bookRowAction, cellKey, chainCells, isBidOnly, lowestPremiums, parseSeriesKey, prefillFor, prefillForRef, prefillsOf, selectMarket, seriesBook, seriesKeyOf, seriesRefOf } from './selection'
import type { MarketInputs } from './selection'

const U = 10_000_000n
const NOW = Date.UTC(2026, 10, 11, 12) / 1000
const E1 = Date.UTC(2026, 10, 13, 8) / 1000
const E2 = Date.UTC(2026, 10, 20, 8) / 1000
const USDX: TokenInfo = { contractId: 'CQ', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'CF', code: 'FUND', decimals: 7 }
const BOND: TokenInfo = { contractId: 'CB', code: 'BOND', decimals: 7 }
/** Same code as FUND, another contract: a look-alike asset. */
const FAKE: TokenInfo = { contractId: 'CX', code: 'FUND', decimals: 7 }
const ME = 'GME'

let n = 0n
const opt = (o: Partial<OptionOffer> & { strike?: string; premium?: string; lot?: bigint }): OptionOffer => {
  const lot = o.lot ?? 5n
  return {
    id: n++, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: lot * U,
    totalStrike: parseAmount(o.strike ?? '10', 7)! * lot, totalPremium: parseAmount(o.premium ?? '0.40', 7)! * lot,
    expiry: E1, writer: 'GA', holder: null, state: 'offered', ...o,
  }
}
const bid = (o: Partial<Bid> & { strike?: string; premium?: string }): Bid => ({
  id: n++, buyer: 'GBUYER', kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U,
  totalStrike: parseAmount(o.strike ?? '10', 7)! * 5n, totalPremium: parseAmount(o.premium ?? '0.30', 7)! * 5n,
  expiry: E1, state: 'open', optionId: null, ...o,
})

function market(me: string | null = null): MarketInputs & { ids: Record<string, bigint> } {
  n = 0n
  const a = opt({ writer: 'GA', premium: '0.40' })
  const b = opt({ writer: 'GB', premium: '0.36' })
  const call = opt({ kind: 'call', strike: '12', premium: '0.50', writer: 'GA', expiry: E2 })
  const bond = opt({ underlying: BOND, strike: '98', premium: '1.20', lot: 10n, writer: 'GB', expiry: E2 })
  const mine = opt({ writer: ME, premium: '0.45' })
  const held = opt({ writer: 'GB', holder: 'GSELLER', state: 'active', premium: '0.38' })
  const myPosition = opt({ writer: 'GA', holder: ME, state: 'active', strike: '10.2' })
  const fake = opt({ underlying: FAKE, premium: '0.01', writer: 'GEVIL' })
  const options = [a, b, call, bond, mine, held, myPosition, fake]
  const asks: Ask[] = [{ id: held.id, holder: 'GSELLER', askTotal: parseAmount('0.30', 7)! * 5n }]
  const bids: Bid[] = [bid({ premium: '0.30' }), bid({ premium: '0.33', buyer: ME }), bid({ strike: '9.8', premium: '0.10' })]
  return { offers: options.filter((o) => o.state === 'offered'), options, asks, bids, me, nowSec: NOW, ids: { a: a.id, b: b.id, mine: mine.id, held: held.id, call: call.id } }
}

describe('exact series: chainCells and seriesBook', () => {
  const put10 = { underlyingId: FUND.contractId, expiry: E1, kind: 'put' as const, strikePerUnit: 10n * U }

  it('derives the series of an order from its exact terms, or none when the strike per unit is not exact', () => {
    expect(seriesRefOf(opt({ strike: '10' }))).toEqual(put10)
    const odd = { ...opt({}), underlyingQty: 3n * U, totalStrike: 10n * U }
    expect(seriesRefOf(odd)).toBeNull()
    expect(cellKey(put10)).toBe(`${E1}:put:${10n * U}`)
  })

  it('summarises each series: best offer, best bid, makers, counts', () => {
    const m = market()
    const cells = chainCells(m, FUND.contractId)
    const c = cells.get(cellKey(put10))!
    // Offers GA 0.40, GB 0.36, ME 0.45 and the resale listing at 0.30: the listing is the cheapest.
    expect(c.offers).toBe(4)
    expect(c.best?.source).toBe('resale')
    expect(c.makers).toBe(3) // resale sellers are not makers
    expect(c.bids).toBe(2)
    expect(c.bestBid?.bid?.buyer).toBe(ME) // 0.33 beats 0.30
    const bidOnly = cells.get(cellKey({ expiry: E1, kind: 'put', strikePerUnit: (98n * U) / 10n }))!
    expect(bidOnly).toMatchObject({ offers: 0, bids: 1, makers: 0 })
    expect(bidOnly.best).toBeUndefined()
    expect(cells.get(cellKey({ expiry: E2, kind: 'call', strikePerUnit: 12n * U }))?.makers).toBe(1)
    expect(cells.has(cellKey({ expiry: E2, kind: 'put', strikePerUnit: 10n * U }))).toBe(false)
  })

  it('keeps assets apart by contract id: a look-alike code gets its own cells', () => {
    const m = market()
    expect([...chainCells(m, FUND.contractId).values()].some((c) => c.best?.counterparty === 'GEVIL')).toBe(false)
    expect(chainCells(m, FAKE.contractId).size).toBe(1)
    expect(chainCells(m, BOND.contractId).size).toBe(1)
  })

  it('marks what belongs to the connected wallet', () => {
    const cells = chainCells(market(ME), FUND.contractId)
    expect(cells.get(cellKey(put10))).toMatchObject({ mine: true, holding: false, wrote: false })
    // A held position on a series with no order still gets a cell, so the chain can highlight it.
    const position = cells.get(cellKey({ expiry: E1, kind: 'put', strikePerUnit: (102n * U) / 10n }))!
    expect(position).toMatchObject({ holding: true, offers: 0, bids: 0 })
    expect(chainCells(market(null), FUND.contractId).get(cellKey(put10))?.mine).toBe(false)
  })

  it('builds the two-sided book of a series and picks what the wallet can trade against', () => {
    const m = market(ME)
    const book = seriesBook(m, put10)
    expect(book.offers.map((r) => r.source)).toEqual(['resale', 'maker', 'maker', 'maker'])
    expect(book.offers.map((r) => r.counterparty)).toEqual(['GSELLER', 'GB', 'GA', ME])
    expect(book.bids.map((r) => r.counterparty)).toEqual([ME, 'GBUYER'])
    expect(book.bestOffer?.counterparty).toBe('GSELLER')
    expect(book.bestBid?.counterparty).toBe('GBUYER') // not my own bid
    // The writer of the listed option cannot buy it back: their best offer is the next one.
    expect(seriesBook(market('GB'), put10).bestOffer?.counterparty).toBe('GA')
    const empty = seriesBook(m, { ...put10, strikePerUnit: 11n * U })
    expect(empty).toEqual({ bids: [], offers: [], bestOffer: undefined, bestBid: undefined, sample: undefined })
  })

  it('finds the lowest premium per kind and the nearest expiry of an asset for the markets index', () => {
    const m = market()
    const low = lowestPremiums(m.offers, FUND.contractId)
    expect(low.put?.id).toBe(m.ids.b)
    expect(low.call?.id).toBe(m.ids.call)
    expect(low.nearestExpiry).toBe(E1)
    expect(low.count).toBe(4)
    expect(lowestPremiums(m.offers, 'CNONE')).toEqual({ put: null, call: null, nearestExpiry: null, count: 0 })
  })
})

describe('selectMarket: the order-driven view', () => {
  it('opens on the busiest asset, its first expiry day and the series with the most makers', () => {
    const s = selectMarket(market())
    expect(s.assets.map((t) => t.contractId)).toEqual(['CB', 'CF', 'CX'])
    expect(s.asset?.contractId).toBe('CF')
    expect(s.days).toEqual([expiryDay(E1), expiryDay(E2)])
    expect(s.day).toBe(expiryDay(E1))
    expect(s.series).toBe('put:10.00')
    expect(s.kind).toBe('put')
    expect(s.strike).toBe('10.00')
    expect(s.rows.map((r) => r.strike)).toEqual(['10.00', '9.80'])
    expect(s.offerCount).toBe(6)
    expect(s.quoteCode).toBe('USDx')
    expect(s.bidsOn).toBe(true)
    expect(isBidOnly(s, '9.80', 'put')).toBe(true)
    expect(isBidOnly(s, '10.00', 'put')).toBe(false)
  })

  it('honours a pick by contract id or code, a day and a series, and falls back when a pick is unknown', () => {
    const m = market()
    const bond = selectMarket(m, { asset: 'CB' })
    expect(bond.asset?.code).toBe('BOND')
    expect(bond.series).toBe('put:98.00')
    expect(selectMarket(m, { asset: 'BOND' }).asset?.contractId).toBe('CB')
    const later = selectMarket(m, { asset: 'CF', day: expiryDay(E2) })
    expect(later.series).toBe('call:12.00')
    expect(selectMarket(m, { asset: 'CF', series: 'put:9.80' }).series).toBe('put:9.80')
    const lost = selectMarket(m, { asset: 'CNOPE', day: '1999-01-01', series: 'put:77.00' })
    expect([lost.asset?.contractId, lost.day, lost.series]).toEqual(['CF', expiryDay(E1), 'put:10.00'])
  })

  it('is empty, not broken, when there is nothing', () => {
    const s = selectMarket({ offers: [], options: [], asks: null, bids: null, me: null, nowSec: NOW })
    expect(s).toMatchObject({ assets: [], asset: null, days: [], day: '', rows: [], series: null, kind: null, strike: null, orderCount: 0, bidsOn: false })
    expect(s.book.offers).toEqual([])
  })

  it('parses and builds series keys', () => {
    expect(seriesKeyOf('put', '10.00')).toBe('put:10.00')
    expect(parseSeriesKey('call:12.00')).toEqual({ kind: 'call', strike: '12.00' })
    expect(parseSeriesKey('nope')).toBeNull()
    expect(parseSeriesKey(null)).toBeNull()
  })
})

describe('prefill', () => {
  it('fills a form from the series, with the size and premium of the row to match', () => {
    const m = market(ME)
    const book = seriesBook(m, { underlyingId: FUND.contractId, expiry: E1, kind: 'put', strikePerUnit: 10n * U })
    const { buy, sell } = prefillsOf(book)
    // Buy side: post a bid next to the best offer (the listing at 0.30 per unit for 5 units).
    expect(buy).toEqual({ kind: 'put', underlyingId: 'CF', qty: '5', strike: '10', premium: '1.5', expiryMs: E1 * 1000 })
    // Sell side: post an offer next to the best bid that is not mine (0.30 per unit).
    expect(sell).toMatchObject({ qty: '5', strike: '10', premium: '1.5' })
    expect(prefillFor(undefined)).toEqual({})
  })

  it('prefills only the terms for an empty grid cell', () => {
    expect(prefillForRef({ underlyingId: 'CF', expiry: E2, kind: 'call', strikePerUnit: (104n * U) / 10n }, 7)).toEqual({ kind: 'call', underlyingId: 'CF', strike: '10.4', expiryMs: E2 * 1000 })
  })
})

describe('bookRowAction', () => {
  it('decides what each row lets the wallet do', () => {
    const m = market(ME)
    const book = seriesBook(m, { underlyingId: FUND.contractId, expiry: E1, kind: 'put', strikePerUnit: 10n * U })
    const [resale, gb, , mine] = book.offers
    expect(bookRowAction(resale, ME)).toEqual({ kind: 'buy-resale' })
    expect(bookRowAction(resale, 'GSELLER')).toEqual({ kind: 'none', note: 'Yours' })
    expect(bookRowAction(resale, 'GB')).toEqual({ kind: 'none', note: 'Written by you' })
    expect(bookRowAction(gb, ME)).toEqual({ kind: 'buy' })
    expect(bookRowAction(mine, ME)).toEqual({ kind: 'cancel-offer' })
    expect(bookRowAction(book.bids[0], ME)).toEqual({ kind: 'cancel-bid' })
    expect(bookRowAction(book.bids[1], ME)).toEqual({ kind: 'fill' })
    // A guest sees the trade actions and is asked to connect when using them.
    expect(bookRowAction(gb, null)).toEqual({ kind: 'buy' })
    expect(bookRowAction(book.bids[0], null)).toEqual({ kind: 'fill' })
  })
})
