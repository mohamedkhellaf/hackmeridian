import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { cellKey } from '../../core/market/selection'
import { DEMO_HEDGERS, DEMO_WALLETS } from '../../core/options/demoAccounts'
import type { OptionOffer } from '../../core/options/types'
import { FIXED_MS, demoWorld } from './demoSource.testhelper'
import type { DemoWorld } from './demoSource.testhelper'
import { matchGuided } from './guided'
import { buildMarket } from './market'

const A = DEMO_WALLETS.a
const B = DEMO_WALLETS.b
const units = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n
const perUnit = (o: { totalPremium: bigint; underlyingQty: bigint }) => (o.totalPremium * 10n ** 7n) / o.underlyingQty

let w: DemoWorld
beforeAll(async () => {
  vi.useFakeTimers({ now: FIXED_MS, toFake: ['Date'] })
  w = await demoWorld()
})
afterAll(() => vi.useRealTimers())

const fund = () => w.assets.FUND
const match = (me: string | null, terms: Parameters<typeof matchGuided>[4], limit?: number) => matchGuided(w.source(me), fund(), w.quote, w.reference(fund()), terms, limit)
/** A put series of FUND that at least two makers quote, with the lot they quote. */
const busyPut = () => {
  const m = buildMarket(w.source(null), fund(), w.quote, w.reference(fund()))
  const cell = [...m.cells.values()].filter((c) => c.ref.kind === 'put' && c.makers >= 2)[0]
  return { ref: cell.ref, best: cell.best!, market: m }
}

describe('matchGuided: buying intents match funded offers', () => {
  it('finds the cheapest offer for exactly these terms and this quantity', () => {
    const { ref, best } = busyPut()
    const sameLot = w.source(null).options.filter((o) => o.state === 'offered' && o.kind === 'put' && o.expiry === ref.expiry && perUnitStrike(o) === ref.strikePerUnit && o.underlyingQty === best.underlyingQty)
    const m = match(B, { intent: 'floor', qty: best.underlyingQty, strikePerUnit: ref.strikePerUnit, expiry: ref.expiry })
    expect(m.side).toBe('buy')
    expect(m.kind).toBe('put')
    expect(m.against).toBe('offers')
    expect(m.fallback).toBe('post-bid')
    expect(m.ref).toEqual(ref)
    expect(m.exact).not.toBeNull()
    expect(m.exactPerUnit).toBe(sameLot.map(perUnit).reduce((min, p) => (p < min ? p : min)))
    expect(m.exact!.underlyingQty).toBe(best.underlyingQty)
    // Other lots of the same series are alternatives, never the exact match.
    expect(m.sameSeries.every((a) => a.differs.qty && !a.differs.strike && !a.differs.expiry)).toBe(true)
  })

  it('does not swap in another quantity: a different lot is only suggested', () => {
    const { ref, best } = busyPut()
    const odd = best.underlyingQty + 10n ** 7n
    const m = match(B, { intent: 'floor', qty: odd, strikePerUnit: ref.strikePerUnit, expiry: ref.expiry })
    expect(m.exact).toBeNull()
    expect(m.exactPerUnit).toBeNull()
    expect(m.sameSeries.length).toBeGreaterThan(0)
    expect(m.sameSeries.every((a) => a.differs.qty)).toBe(true)
    // Nearest quantity first.
    const gaps = m.sameSeries.map((a) => (a.row.underlyingQty > odd ? a.row.underlyingQty - odd : odd - a.row.underlyingQty))
    expect([...gaps].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))).toEqual(gaps)
  })

  it('suggests the nearest funded terms when the series is empty', () => {
    const { market } = busyPut()
    // A far month-end nobody quotes.
    const expiry = market.expiries[4]
    const m = match(B, { intent: 'floor', qty: 5n * 10n ** 7n, strikePerUnit: units(10.2), expiry }, 4)
    expect(m.exact).toBeNull()
    expect(m.sameSeries).toEqual([])
    expect(m.nearby.length).toBeGreaterThan(0)
    expect(m.nearby.length).toBeLessThanOrEqual(4)
    expect(m.nearby.every((a) => a.row.kind === 'put' && a.row.source !== 'bid' && a.differs.expiry)).toBe(true)
    // Nearest first: the total distance in ladder steps and listed dates never decreases.
    const distance = m.nearby.map((a) => a.strikeSteps + a.expirySteps)
    expect([...distance].sort((x, y) => x - y)).toEqual(distance)
    // The closest suggestion is on the nearest quoted date (the third listed expiry), two dates away.
    expect(m.nearby[0].expirySteps).toBe(2)
    expect(m.fundedExpiries.has(expiry)).toBe(false)
  })

  it('marks the chips that have something funded behind them', () => {
    const { ref, market } = busyPut()
    const m = match(B, { intent: 'floor', qty: null, strikePerUnit: null, expiry: ref.expiry })
    const expected = market.columns.find((c) => c.expiry === ref.expiry)!.rows.filter((r) => !r.put.empty).map((r) => r.strikePerUnit)
    expect([...m.fundedStrikes].sort((x, y) => (x < y ? -1 : 1))).toEqual(expected)
    expect(m.funded.has(cellKey(ref))).toBe(true)
    // Without a strike, an expiry is funded when any strike is.
    expect([...m.fundedExpiries].sort()).toEqual(market.columns.filter((c) => c.rows.some((r) => !r.put.empty)).map((c) => c.expiry))
    // Terms are incomplete: there is no series yet, so nothing is "exact".
    expect(m.ref).toBeNull()
    expect(m.exact).toBeNull()
  })

  it('never matches the wallet against its own offer', () => {
    const own = w.source(A).options.find((o) => o.id === 6n)!
    const terms = { intent: 'floor' as const, qty: own.underlyingQty, strikePerUnit: perUnitStrike(own), expiry: own.expiry }
    const mine = match(A, terms)
    expect(mine.exact?.offer?.id).not.toBe(6n)
    expect([...mine.sameSeries, ...mine.nearby].some((a) => a.row.offer?.id === 6n)).toBe(false)
    // Another wallet can be matched to it.
    const theirs = match(B, terms)
    const candidates = [theirs.exact, ...theirs.sameSeries.map((a) => a.row)].filter((r) => r !== null)
    expect(candidates.some((r) => r.offer?.id === 6n)).toBe(true)
  })

  it('leaves off-grid offers out: the guided chips come from the standard grid', () => {
    const off = w.source(null).options.find((o) => o.state === 'offered' && o.underlying.code === 'FUND' && o.expiry % 604_800 !== 115_200)!
    const m = match(B, { intent: 'floor', qty: off.underlyingQty, strikePerUnit: perUnitStrike(off), expiry: off.expiry })
    expect(m.exact).toBeNull()
    expect([...m.sameSeries, ...m.nearby].some((a) => a.row.offer?.id === off.id)).toBe(false)
  })

  it('matches calls for the buy-price intent, and counts a resale listing as an offer', () => {
    const listing = w.source(null).options.find((o) => o.id === 9n)!
    const m = match(B, { intent: 'lock-buy', qty: listing.underlyingQty, strikePerUnit: perUnitStrike(listing), expiry: listing.expiry })
    expect(m.kind).toBe('call')
    const rows = [m.exact, ...m.sameSeries.map((a) => a.row)].filter((r) => r !== null)
    expect(rows.some((r) => r.source === 'resale' && r.counterparty === DEMO_HEDGERS.a)).toBe(true)
  })
})

describe('matchGuided: earning intents match funded bids', () => {
  it('finds the buyer who has escrowed a premium for exactly these terms', () => {
    // Request 2: a put on 10 FUND at 10.40, second expiry, escrowed by a hedger.
    const bid = w.source(null).bids!.find((b) => b.id === 2n)!
    const m = match(A, { intent: 'earn-buy', qty: bid.underlyingQty, strikePerUnit: units(10.4), expiry: bid.expiry })
    expect(m.side).toBe('write')
    expect(m.kind).toBe('put')
    expect(m.against).toBe('bids')
    expect(m.fallback).toBe('write-offer')
    expect(m.exact?.bid?.id).toBe(2n)
    expect(m.exact?.totalPremium).toBe(bid.totalPremium)
    expect(m.exactPerUnit).toBe(perUnit(bid))
  })

  it('offers the other open bids as alternatives and never the wallet its own', () => {
    // Wallet B has request 1 (a put at 10.00, third expiry). Asking as B for those terms finds nothing exact.
    const own = w.source(null).bids!.find((b) => b.id === 1n)!
    const terms = { intent: 'earn-buy' as const, qty: own.underlyingQty, strikePerUnit: perUnitStrike(own), expiry: own.expiry }
    const asB = match(B, terms)
    expect(asB.exact).toBeNull()
    expect(asB.nearby.map((a) => a.row.bid?.id)).toEqual([2n])
    expect(asB.nearby[0].differs).toEqual({ qty: true, strike: true, expiry: true })
    const asA = match(A, terms)
    expect(asA.exact?.bid?.id).toBe(1n)
  })

  it('has no call bid on FUND: the fallback is to post an offer', () => {
    const m = match(A, { intent: 'earn-hold', qty: 5n * 10n ** 7n, strikePerUnit: units(10.4), expiry: busyPut().market.expiries[1] })
    expect(m.kind).toBe('call')
    expect(m.exact).toBeNull()
    expect(m.sameSeries).toEqual([])
    expect(m.nearby).toEqual([])
    expect(m.funded.size).toBe(0)
    expect(m.fallback).toBe('write-offer')
  })
})

function perUnitStrike(o: Pick<OptionOffer, 'totalStrike' | 'underlyingQty'>): bigint {
  return (o.totalStrike * 10n ** 7n) / o.underlyingQty
}
