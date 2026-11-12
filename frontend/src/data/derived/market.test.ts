import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cellKey, seriesRefOf } from '../../core/market/selection'
import type { SeriesRef } from '../../core/market/selection'
import { DEMO_HEDGERS, DEMO_MAKERS, DEMO_WALLETS } from '../../core/options/demoAccounts'
import { demoStrikes } from '../../core/options/mockSeed'
import type { OptionOffer } from '../../core/options/types'
import { noReference } from '../../core/reference'
import { isStandardExpiry, standardExpiries } from '../../core/series'
import { FIXED_MS, FIXED_SEC, demoWorld } from './demoSource.testhelper'
import type { DemoWorld } from './demoSource.testhelper'
import { LADDER_ROWS, buildBook, buildMarket, buildMarketIndex, marketInputs } from './market'

const A = DEMO_WALLETS.a
const units = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n // 7 decimals

let w: DemoWorld
beforeAll(async () => {
  vi.useFakeTimers({ now: FIXED_MS, toFake: ['Date'] })
  w = await demoWorld()
})
afterAll(() => vi.useRealTimers())

const perUnit = (o: { totalPremium: bigint; underlyingQty: bigint }) => (o.totalPremium * 10n ** 7n) / o.underlyingQty
const openOffers = (src: { options: OptionOffer[] }, id: string) => src.options.filter((o) => o.state === 'offered' && o.underlying.contractId === id)

describe('buildMarket: the standard grid over the demo market', () => {
  it('lists the standard expiries and a 1-2-5 ladder around the reference', () => {
    const m = buildMarket(w.source(null), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    expect(m.expiries).toEqual(standardExpiries(FIXED_SEC))
    expect(m.expiries).toHaveLength(5)
    expect(m.expiries.every(isStandardExpiry)).toBe(true)
    expect(m.columns.map((c) => c.day)).toEqual(['2026-11-13', '2026-11-20', '2026-11-27', '2026-12-25', '2027-01-29'])
    expect(m.columns.map((c) => c.cycle)).toEqual(['weekly', 'weekly', 'monthly', 'monthly', 'monthly'])
    expect(m.columns[0].secondsLeft).toBe(44 * 3600)
    // RWA demo price 10.20: step 0.20, nine strikes centred on 10.20.
    expect(m.ladder).toHaveLength(LADDER_ROWS)
    expect(m.ladder).toEqual([9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0].map(units))
    for (const c of m.columns) expect(c.rows.map((r) => r.strikePerUnit)).toEqual(m.ladder)
    // The reference sits exactly on the 10.20 strike: four strikes are below it.
    expect(m.referenceRule).toEqual({ below: 4, at: 4 })
  })

  it('prices each cell from the cheapest standard offer of exactly that series and counts its makers', () => {
    const src = w.source(null)
    const m = buildMarket(src, w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    let priced = 0
    for (const column of m.columns)
      for (const row of column.rows)
        for (const kind of ['call', 'put'] as const) {
          const cell = row[kind]
          const same = (o: { kind: string; expiry: number; totalStrike: bigint; underlyingQty: bigint }) =>
            o.kind === kind && o.expiry === column.expiry && (o.totalStrike * 10n ** 7n) / o.underlyingQty === row.strikePerUnit
          const offers = openOffers(src, w.assets.RWA.contractId).filter(same)
          const listing = (src.asks ?? []).map((a) => ({ ask: a, option: src.options.find((o) => o.id === a.id)! })).filter((x) => same(x.option))
          const prices = [...offers.map(perUnit), ...listing.map((x) => perUnit({ totalPremium: x.ask.askTotal, underlyingQty: x.option.underlyingQty }))]
          expect(cell.offers).toBe(prices.length)
          expect(cell.makers).toBe(new Set(offers.map((o) => o.writer)).size)
          expect(cell.empty).toBe(prices.length === 0)
          if (prices.length === 0) {
            expect(cell.best).toBeNull()
            expect(cell.bestPerUnit).toBeNull()
          } else {
            priced++
            expect(cell.bestPerUnit).toBe(prices.reduce((min, p) => (p < min ? p : min)))
          }
          expect(m.cells.get(cell.key)).toBe(cell)
          expect(cell.key).toBe(cellKey(cell.ref))
        }
    // The demo quotes three expiries; the two far month-ends are empty columns.
    expect(priced).toBeGreaterThan(10)
    expect(m.columns[3].offers + m.columns[4].offers).toBe(0)
    expect(m.cells.size).toBe(5 * LADDER_ROWS * 2)
  })

  it('has every strike the demo makers quote on the ladder of each asset, and only the two seeded orders off it', () => {
    const src = w.source(null)
    const others: Record<string, number> = {}
    for (const asset of [w.assets.RWA, w.assets.BOND, w.assets.EQTY]) {
      const m = buildMarket(src, asset, w.quote, w.reference(asset))
      expect(m.ladder).toHaveLength(LADDER_ROWS)
      // The five strikes the demo quotes are the five central rows; two empty rows frame them on each side.
      expect(demoStrikes(asset)).toEqual(m.ladder.slice(2, 7))
      const onGrid = [...m.cells.values()].reduce((n, c) => n + c.offers, 0)
      const open = openOffers(src, asset.contractId).length + (src.asks ?? []).filter((a) => src.options.find((o) => o.id === a.id)?.underlying.contractId === asset.contractId).length
      expect(onGrid + m.other.filter((o) => o.row.source !== 'bid').length).toBe(open)
      others[asset.code] = m.other.length
      // The outer rows are empty in the demo: they offer "Request".
      for (const c of m.columns) for (const r of [c.rows[0], c.rows[1], c.rows[7], c.rows[8]]) expect(r.call.empty && r.put.empty).toBe(true)
    }
    expect(others).toEqual({ RWA: 1, BOND: 0, EQTY: 1 })
  })

  it('keeps off-grid orders out of the grid and lists them with the reason', () => {
    const fund = buildMarket(w.source(null), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    expect(fund.other).toHaveLength(1)
    expect(fund.other[0].reason).toBe('non-standard expiry')
    expect(fund.other[0].row.counterparty).toBe(DEMO_MAKERS.d)
    expect(fund.other[0].action).toEqual({ kind: 'buy' })
    expect(fund.otherCounts['non-standard expiry']).toBe(1)
    expect(fund.otherExpiries).toEqual([fund.expiries[0] + 2 * 86_400])
    // The off-grid offer is on a ladder strike but prices no cell, and is not among any cell's makers.
    for (const cell of fund.cells.values()) expect(cell.best?.counterparty === DEMO_MAKERS.d && cell.best.expiry === fund.other[0].row.expiry).toBe(false)

    const eqty = buildMarket(w.source(null), w.assets.EQTY, w.quote, w.reference(w.assets.EQTY))
    expect(eqty.other.map((o) => o.reason)).toEqual(['off-grid strike'])
    expect(eqty.otherExpiries).toEqual([])
    expect(eqty.ladder).not.toContain(seriesRefOf(eqty.other[0].row)!.strikePerUnit)
  })

  it('does not let a dust lot or an odd premium price a cell', () => {
    const src = w.source(null)
    const base = openOffers(src, w.assets.RWA.contractId)[0]
    const ref = seriesRefOf(base)!
    const before = buildMarket(src, w.assets.RWA, w.quote, w.reference(w.assets.RWA)).cells.get(cellKey(ref))!
    // Same series, one thousandth of a unit, at a give-away price per unit.
    const dust: OptionOffer = { ...base, id: 9_001n, writer: 'GSPAMMER', underlyingQty: base.underlyingQty / 1000n / (base.underlyingQty / 10n ** 7n), totalStrike: ref.strikePerUnit / 1000n, totalPremium: 1n }
    // Same series, a whole lot, premium off the 0.01 tick.
    const odd: OptionOffer = { ...base, id: 9_002n, writer: 'GSPAMMER', totalPremium: 12_345n }
    const after = buildMarket({ ...src, options: [...src.options, dust, odd] }, w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    const cell = after.cells.get(cellKey(ref))!
    expect(cell.bestPerUnit).toBe(before.bestPerUnit)
    expect(cell.makers).toBe(before.makers)
    expect(cell.offers).toBe(before.offers)
    expect(after.other.filter((o) => o.row.counterparty === 'GSPAMMER').map((o) => o.reason).sort()).toEqual(['lot below 1 unit', 'premium off the 0.01 tick'])
    // The index's "lowest premium" ignores them too.
    expect(after.summary.lowestPutPerUnit).toBe(buildMarket(src, w.assets.RWA, w.quote, w.reference(w.assets.RWA)).summary.lowestPutPerUnit)
  })

  it('marks the cells where the wallet has an order or a position', () => {
    const m = buildMarket(w.source(A), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    const cell = (expiry: number, kind: 'put' | 'call', strike: number) => m.cells.get(cellKey({ expiry, kind, strikePerUnit: units(strike) }))!
    // Option 6: its open put offer at 9.80 on the third expiry.
    expect(cell(m.expiries[2], 'put', 9.8).mine).toBe(true)
    // Option 0: the put it holds at 10.60 on the first expiry.
    expect(cell(m.expiries[0], 'put', 10.6).holding).toBe(true)
    expect(cell(m.expiries[0], 'put', 10.6).wrote).toBe(false)
    // A guest sees none of it.
    const guest = buildMarket(w.source(null), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    expect([...guest.cells.values()].some((c) => c.mine || c.holding || c.wrote)).toBe(false)
  })

  it('gives each cell its moneyness at the reference, and says unknown without one', () => {
    const m = buildMarket(w.source(null), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    const row = (strike: number) => m.columns[0].rows.find((r) => r.strikePerUnit === units(strike))!
    expect(row(9.8).put.moneyness).toBe('out')
    expect(row(9.8).call.moneyness).toBe('in')
    expect(row(10.2).put.moneyness).toBe('at')
    expect(row(10.6).put.moneyness).toBe('in')
    expect(row(10.6).call.moneyness).toBe('out')
    const blind = buildMarket(w.source(null), w.assets.RWA, w.quote, noReference())
    expect(blind.referenceRule).toBeNull()
    expect([...blind.cells.values()].every((c) => c.moneyness === 'unknown')).toBe(true)
    // Without a reference the ladder comes from the strikes that exist.
    expect(blind.ladder.length).toBeGreaterThan(0)
    const existing = new Set([...openOffers(w.source(null), w.assets.RWA.contractId), ...(w.source(null).bids ?? [])].map((o) => seriesRefOf(o)?.strikePerUnit))
    expect(blind.ladder.every((k) => existing.has(k))).toBe(true)
  })

  it('shows a bid on a series nobody quotes, and lists the asset bids best first', () => {
    const m = buildMarket(w.source(null), w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    // Request 2: a put at 10.40 on the second expiry, by a hedger, with no offer beside it.
    const cell = m.cells.get(cellKey({ expiry: m.expiries[1], kind: 'put', strikePerUnit: units(10.4) }))!
    expect(cell.bids).toBe(1)
    expect(cell.bestBid?.counterparty).toBe(DEMO_HEDGERS.a)
    expect(cell.empty).toBe(true)
    expect(m.bids).toHaveLength(2)
    expect(m.summary.bids).toBe(2)
    for (let i = 1; i < m.bids.length; i++) expect(perUnit(m.bids[i - 1]) >= perUnit(m.bids[i])).toBe(true)
  })

  it('leaves out an offer whose deadline has passed since the last read', () => {
    const src = w.source(null)
    const later = { ...src, nowSec: standardExpiries(FIXED_SEC)[0] + 1 }
    expect(marketInputs(later).offers.some((o) => o.expiry <= later.nowSec)).toBe(false)
    const m = buildMarket(later, w.assets.RWA, w.quote, w.reference(w.assets.RWA))
    expect(m.expiries).not.toContain(standardExpiries(FIXED_SEC)[0])
  })
})

describe('buildBook: one exact series', () => {
  const market = () => buildMarket(w.source(A), w.assets.RWA, w.quote, w.reference(w.assets.RWA))

  it('sorts both sides, labels the rows and picks what the wallet can take', () => {
    const m = market()
    const busiest = [...m.cells.values()].filter((c) => c.makers >= 2).sort((a, b) => b.offers - a.offers)[0]
    const book = buildBook(w.source(A), busiest.ref, w.quote, m.ladder, m.expiries)
    expect(book.onGrid).toBe(true)
    expect(book.offers).toHaveLength(busiest.offers)
    for (let i = 1; i < book.offers.length; i++) expect(book.offers[i - 1].perUnit! <= book.offers[i].perUnit!).toBe(true)
    expect(book.bestOffer).toBe(book.offers[0].row)
    expect(book.offers.every((e) => e.reason === null && e.action.kind === 'buy' && !e.mine)).toBe(true)
    expect(book.empty).toBe(false)
    expect(book.prefill.buy.kind).toBe(busiest.ref.kind)
    expect(book.prefill.buy.underlyingId).toBe(w.assets.RWA.contractId)
  })

  it('never offers the wallet its own row as the best, and lets it cancel that row', () => {
    const m = market()
    const ref: SeriesRef = { underlyingId: w.assets.RWA.contractId, expiry: m.expiries[2], kind: 'put', strikePerUnit: units(9.8) }
    const book = buildBook(w.source(A), ref, w.quote, m.ladder, m.expiries)
    const own = book.offers.filter((e) => e.mine)
    expect(own).toHaveLength(1)
    expect(own[0].action).toEqual({ kind: 'cancel-offer' })
    expect(book.bestOffer?.counterparty).not.toBe(A)
    // The same book for a guest: every row can be bought.
    const guest = buildBook(w.source(null), ref, w.quote, m.ladder, m.expiries)
    expect(guest.offers.every((e) => e.action.kind === 'buy' && !e.mine)).toBe(true)
  })

  it('joins a resale listing as an offer with its own source', () => {
    const m = market()
    // Option 9: a call at 10.40 on the second expiry, listed by its holder.
    const ref: SeriesRef = { underlyingId: w.assets.RWA.contractId, expiry: m.expiries[1], kind: 'call', strikePerUnit: units(10.4) }
    const book = buildBook(w.source(A), ref, w.quote, m.ladder, m.expiries)
    const resale = book.offers.filter((e) => e.row.source === 'resale')
    expect(resale).toHaveLength(1)
    expect(resale[0].row.counterparty).toBe(DEMO_HEDGERS.a)
    expect(resale[0].action).toEqual({ kind: 'buy-resale' })
  })

  it('gives an empty series a prefill of its terms only', () => {
    const m = market()
    const ref: SeriesRef = { underlyingId: w.assets.RWA.contractId, expiry: m.expiries[4], kind: 'call', strikePerUnit: units(10.8) }
    const book = buildBook(w.source(A), ref, w.quote, m.ladder, m.expiries)
    expect(book.empty).toBe(true)
    expect(book.bestOffer).toBeNull()
    expect(book.bestBid).toBeNull()
    expect(book.prefill.buy).toEqual({ kind: 'call', underlyingId: w.assets.RWA.contractId, strike: '10.8', expiryMs: m.expiries[4] * 1000 })
    expect(book.prefill.sell).toEqual(book.prefill.buy)
  })

  it('opens an off-grid series as a book of its own', () => {
    const m = market()
    const off = m.other[0].row
    const book = buildBook(w.source(A), seriesRefOf(off)!, w.quote, m.ladder, m.expiries)
    expect(book.onGrid).toBe(false)
    expect(book.offers).toHaveLength(1)
    expect(book.offers[0].reason).toBe('non-standard expiry')
    // Off the grid there is no standard order to prefer: the row is still the one to take.
    expect(book.bestOffer).toBe(book.offers[0].row)
  })
})

describe('buildMarketIndex', () => {
  it('has one row per listed asset, reference assets first, with exact lowest premiums', () => {
    const src = w.source(null)
    const rows = buildMarketIndex(src, [w.assets.EQTY, w.assets.RWA, w.assets.BOND], w.quote, 'mock', w.reference)
    expect(rows.map((r) => r.asset.code)).toEqual(['RWA', 'BOND', 'EQTY'])
    for (const r of rows) {
      expect(r.tier).toBe('Reference')
      expect(r.isReference).toBe(true)
      expect(r.path).toBe(`/markets/${r.asset.code.toLowerCase()}`)
      expect(r.similar).toBeNull()
      expect(r.reference.kind).toBe('demo')
      expect(r.summary.offers).toBe(openOffers(src, r.asset.contractId).length)
      expect(r.summary.nearestExpiry).toBe(standardExpiries(FIXED_SEC)[0])
      expect(r.summary.lowestPutPerUnit).not.toBeNull()
      expect(r.summary.lowestCallPerUnit).not.toBeNull()
    }
    expect(rows.map((r) => r.typeLabel)).toEqual(['Fund share', 'Bond', 'Equity'])
    expect(rows.map((r) => r.otherOrders)).toEqual([1, 0, 1])
  })

  it('puts an asset outside the reference list after it, with its tier in words', () => {
    const stranger = { contractId: 'C_MOCK_B0ND', code: 'B0ND', decimals: 7 }
    const rows = buildMarketIndex(w.source(null), [stranger, w.assets.RWA], w.quote, 'mock', w.reference)
    expect(rows.map((r) => r.asset.code)).toEqual(['RWA', 'B0ND'])
    expect(rows[1].isReference).toBe(false)
    expect(rows[1].tier).toBe('No domain link')
    expect(rows[1].typeLabel).toBeNull()
    expect(rows[1].reference.kind).toBe('none')
    expect(rows[1].similar?.level).toBe('same')
    expect(rows[1].summary.offers).toBe(0)
    expect(rows[1].summary.nearestExpiry).toBeNull()
  })
})

describe('request and resale support', () => {
  it('reads support from the source: null lists mean the contract has neither, the hook flags win when given', async () => {
    const { buildMarket } = await import('./market')
    const { MOCK_QUOTE, MOCK_UNDERLYINGS } = await import('../../core/options/mockSeed')
    const { noReference } = await import('../../core/reference')
    const NO_REFERENCE = noReference()
    const asset = MOCK_UNDERLYINGS[0]
    const base = { options: [], me: null, nowSec: 1_800_000_000 }
    const old = buildMarket({ ...base, asks: null, bids: null }, asset, MOCK_QUOTE, NO_REFERENCE)
    expect([old.bidsOn, old.resaleOn]).toEqual([false, false])
    const current = buildMarket({ ...base, asks: [], bids: [] }, asset, MOCK_QUOTE, NO_REFERENCE)
    expect([current.bidsOn, current.resaleOn]).toEqual([true, true])
    // While the two reads are still running the lists are null, but support is not known to be missing.
    const loading = buildMarket({ ...base, asks: null, bids: null, bidsOn: true, resaleOn: true }, asset, MOCK_QUOTE, NO_REFERENCE)
    expect([loading.bidsOn, loading.resaleOn]).toEqual([true, true])
  })
})
