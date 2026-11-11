import { describe, expect, it } from 'vitest'
import { chainCells, cellKey, seriesRefOf } from '../market/selection'
import { todoItems } from '../portfolio/positions'
import { demoReference } from '../reference/providers'
import { optionMoneyness } from '../reference/moneyness'
import { classifyOffer, isStandardExpiry, standardExpiries, strikeLadder } from '../series/standard'
import { perUnit } from '../units'
import { collateralLines, reservedOf } from './abi'
import { DEMO_HEDGERS, DEMO_MAKERS, DEMO_WALLETS } from './demoAccounts'
import { MOCK_QUOTE, MOCK_UNDERLYINGS, bareSeed, demoExpiries, demoPremiumPerUnit, demoSeed, demoStrikes } from './mockSeed'
import { MAX_OPEN_PER_WRITER } from './types'
import type { OptionOffer } from './types'

// The demo market is computed from the clock. Check it at several moments: a plain weekday, a Friday shortly
// before and after 08:00 UTC, a month end and a year end.
const MOMENTS = [
  Date.UTC(2026, 10, 11, 2, 30) / 1000, // Wednesday
  Date.UTC(2026, 10, 12, 12, 0) / 1000, // Thursday: the first expiry is 20 hours away
  Date.UTC(2026, 10, 13, 6, 30) / 1000, // Friday 06:30 UTC: today's expiry is still listed
  Date.UTC(2026, 10, 13, 7, 30) / 1000, // Friday 07:30 UTC: it no longer is
  Date.UTC(2026, 10, 13, 9, 0) / 1000, // Friday after the expiry
  Date.UTC(2026, 10, 27, 23, 59) / 1000, // the last Friday of the month
  Date.UTC(2026, 11, 31, 23, 0) / 1000, // year end
  Date.UTC(2027, 1, 28, 0, 0) / 1000,
]

const makers = Object.values(DEMO_MAKERS) as string[]
const refOf = (o: OptionOffer) => demoReference(o.underlying)
const live = (o: OptionOffer, at: number): OptionOffer => ((o.state === 'offered' || o.state === 'active') && o.expiry <= at ? { ...o, state: 'expired' } : o)

describe.each(MOMENTS)('demoSeed at %i', (at) => {
  const seed = demoSeed(at)
  const options = seed.options.map((o) => live(o, at))
  const open = options.filter((o) => o.state === 'offered')
  const expiries = standardExpiries(at)
  const ladderOf = (o: OptionOffer) => strikeLadder(demoReference(o.underlying).perUnit, MOCK_QUOTE.decimals)

  it('lists FUND, BOND and EQTY against USDx', () => {
    expect(seed.underlyings.map((t) => t.code)).toEqual(['FUND', 'BOND', 'EQTY'])
    expect(seed.quote.code).toBe('USDx')
    for (const t of [seed.quote, ...seed.underlyings]) expect(t.contractId).toMatch(/^C_MOCK_/)
  })

  it('numbers options and requests 0..n-1, the order the mock continues from', () => {
    seed.options.forEach((o, i) => expect(o.id).toBe(BigInt(i)))
    seed.bids.forEach((b, i) => expect(b.id).toBe(BigInt(i)))
  })

  it('has four makers quoting both kinds of every asset, each within the per-writer cap', () => {
    const makerOffers = open.filter((o) => makers.includes(o.writer))
    expect(new Set(makerOffers.map((o) => o.writer)).size).toBe(4)
    for (const m of makers) {
      const n = makerOffers.filter((o) => o.writer === m).length
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThanOrEqual(MAX_OPEN_PER_WRITER)
    }
    for (const t of MOCK_UNDERLYINGS)
      for (const kind of ['put', 'call'] as const) expect(makerOffers.some((o) => o.underlying.contractId === t.contractId && o.kind === kind)).toBe(true)
  })

  it('quotes 3 expiries and 5 ladder strikes per asset, all on the standard grid', () => {
    const quoted = demoExpiries(at)
    expect(quoted).toHaveLength(3)
    expect(quoted).toEqual(expiries.slice(0, 3))
    for (const t of MOCK_UNDERLYINGS) {
      const mine = open.filter((o) => o.underlying.contractId === t.contractId && makers.includes(o.writer))
      const standard = mine.filter((o) => classifyOffer(o, ladderOf(o), expiries).standard)
      expect(new Set(standard.map((o) => o.expiry)).size).toBe(3)
      const strikes = new Set(standard.map((o) => perUnit(o.totalStrike, o)!))
      expect(strikes.size).toBeGreaterThanOrEqual(3)
      expect(strikes.size).toBeLessThanOrEqual(5)
      expect(demoStrikes(t)).toHaveLength(5)
      for (const k of strikes) expect(demoStrikes(t)).toContain(k)
    }
  })

  it('keeps every maker offer standard except the two that are off the grid on purpose', () => {
    const classes = open.filter((o) => makers.includes(o.writer)).map((o) => classifyOffer(o, ladderOf(o), expiries))
    const other = classes.filter((c) => !c.standard).map((c) => (c.standard ? '' : c.reason))
    expect(other.sort()).toEqual(['non-standard expiry', 'off-grid strike'])
  })

  it('prices consistently: for one maker and expiry, calls get cheaper and puts dearer as the strike rises', () => {
    for (const t of MOCK_UNDERLYINGS)
      for (const expiry of demoExpiries(at))
        for (const kind of ['put', 'call'] as const) {
          const prices = demoStrikes(t).map((k) => demoPremiumPerUnit(kind, t, k, expiry, at))
          for (let i = 1; i < prices.length; i++) {
            if (kind === 'call') expect(prices[i]).toBeLessThanOrEqual(prices[i - 1])
            else expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
          }
          // The far in-the-money strike is strictly dearer than the far out-of-the-money one.
          const [low, high] = [prices[0], prices[prices.length - 1]]
          if (kind === 'call') expect(low).toBeGreaterThan(high)
          else expect(high).toBeGreaterThan(low)
        }
  })

  it('prices consistently: a longer-dated option is never cheaper, and the furthest is dearer at the money', () => {
    const [e0, , e2] = demoExpiries(at)
    for (const t of MOCK_UNDERLYINGS)
      for (const kind of ['put', 'call'] as const) {
        demoStrikes(t).forEach((k) => {
          const near = demoPremiumPerUnit(kind, t, k, e0, at)
          const far = demoPremiumPerUnit(kind, t, k, e2, at)
          expect(far).toBeGreaterThanOrEqual(near)
        })
        const atm = demoStrikes(t)[2]
        expect(demoPremiumPerUnit(kind, t, atm, e2, at)).toBeGreaterThan(demoPremiumPerUnit(kind, t, atm, e0, at))
      }
  })

  it('never prices below intrinsic value, and stays on the 0.01 tick', () => {
    const tick = 10n ** BigInt(MOCK_QUOTE.decimals - 2)
    for (const o of open) {
      const premium = perUnit(o.totalPremium, o)!
      const strike = perUnit(o.totalStrike, o)!
      const price = demoReference(o.underlying).perUnit!
      const intrinsic = o.kind === 'put' ? strike - price : price - strike
      expect(premium).toBeGreaterThanOrEqual(intrinsic > 0n ? intrinsic : tick)
      expect(o.totalPremium % tick).toBe(0n)
      expect(o.totalPremium).toBeLessThan(o.totalStrike)
    }
  })

  it('competing makers on one series ask different premiums per unit', () => {
    const groups = new Map<string, Set<string>>()
    for (const o of open) {
      const ref = seriesRefOf(o)!
      const k = `${ref.underlyingId}:${cellKey(ref)}`
      const set = groups.get(k) ?? new Set<string>()
      set.add(`${o.writer}:${perUnit(o.totalPremium, o)}`)
      groups.set(k, set)
    }
    const crowded = [...groups.values()].filter((s) => s.size >= 2)
    expect(crowded.length).toBeGreaterThan(5)
    expect([...groups.values()].some((s) => s.size >= 3)).toBe(true)
  })

  it('has a few open requests below the makers, one of them on a series nobody quotes', () => {
    expect(seed.bids.length).toBeGreaterThanOrEqual(3)
    for (const b of seed.bids) {
      expect(b.state).toBe('open')
      expect(b.expiry).toBeGreaterThan(at)
      expect(b.totalPremium).toBeGreaterThan(0n)
    }
    expect(seed.bids.some((b) => b.buyer === DEMO_WALLETS.a)).toBe(true)
    expect(seed.bids.some((b) => b.buyer === DEMO_WALLETS.b)).toBe(true)
    const input = { offers: open, options, asks: seed.asks, bids: seed.bids, me: null, nowSec: at }
    const cells = MOCK_UNDERLYINGS.flatMap((t) => [...chainCells(input, t.contractId).values()])
    expect(cells.some((c) => c.bids > 0 && c.offers === 0)).toBe(true)
    // Where a bid and an offer meet, the bid is lower: nobody is giving money away.
    for (const c of cells) if (c.best && c.bestBid) expect(perUnit(c.bestBid.totalPremium, c.bestBid)!).toBeLessThan(perUnit(c.best.totalPremium, c.best)!)
  })

  it('has one resale listing on an active option, held by a third party', () => {
    expect(seed.asks).toHaveLength(1)
    const [ask] = seed.asks
    const o = options.find((x) => x.id === ask.id)!
    expect(o.state).toBe('active')
    expect(o.holder).toBe(ask.holder)
    expect(ask.holder).toBe(DEMO_HEDGERS.a)
    expect(o.expiry).toBeGreaterThan(at)
    expect(ask.askTotal).toBeGreaterThan(0n)
  })

  it('gives the default test wallet the five positions the portfolio needs', () => {
    const me = DEMO_WALLETS.a
    const held = options.filter((o) => o.holder === me)
    const written = options.filter((o) => o.writer === me)

    const soonItm = held.find((o) => o.state === 'active' && o.kind === 'put' && o.expiry - at <= 48 * 3600)
    expect(soonItm).toBeDefined()
    expect(soonItm!.expiry - at).toBeGreaterThanOrEqual(3600)
    expect(optionMoneyness(soonItm!, refOf(soonItm!))).toBe('in')

    const otm = held.find((o) => o.state === 'active' && o.kind === 'put' && o !== soonItm)
    expect(otm && optionMoneyness(otm, refOf(otm))).toBe('out')

    expect(written.some((o) => o.kind === 'call' && o.state === 'active' && o.holder !== null)).toBe(true)
    expect(written.some((o) => o.state === 'exercised')).toBe(true)
    expect(written.some((o) => o.state === 'expired')).toBe(true)

    const todo = todoItems(options, me, at, refOf)
    expect(todo.filter((t) => t.actionable).map((t) => t.kind)).toEqual(['exercise', 'claim', 'reclaim'])
    expect(todo.filter((t) => t.kind === 'exercise' && !t.actionable)).toHaveLength(1)
    expect(todo.some((t) => t.kind === 'expired-unexercised')).toBe(true)
  })

  it('gives the second test wallet one or two positions', () => {
    const mine = options.filter((o) => o.holder === DEMO_WALLETS.b || o.writer === DEMO_WALLETS.b)
    expect(mine.length).toBeGreaterThanOrEqual(1)
    expect(mine.length).toBeLessThanOrEqual(2)
  })

  it('places open offers on listed Fridays and never in the past', () => {
    for (const o of open) expect(o.expiry).toBeGreaterThan(at)
    for (const e of demoExpiries(at)) expect(isStandardExpiry(e)).toBe(true)
  })

  it('gives the test wallets balances that cover what their open positions need', () => {
    const a = seed.balances[DEMO_WALLETS.a]
    const exercise = options.find((o) => o.holder === DEMO_WALLETS.a && o.state === 'active' && o.expiry - at <= 48 * 3600)!
    expect(a[exercise.underlying.contractId]).toBeGreaterThanOrEqual(exercise.underlyingQty)
    for (const t of [seed.quote, ...seed.underlyings]) {
      expect(a[t.contractId]).toBeGreaterThan(0n)
      expect(seed.balances[DEMO_WALLETS.b][t.contractId]).toBeGreaterThan(0n)
      expect(seed.defaultBalances[t.contractId]).toBeGreaterThan(0n)
    }
  })

  it('reserves something in every token, requests included', () => {
    const lines = collateralLines(options, seed.bids)
    expect(lines).toHaveLength(4)
    for (const l of lines) expect(reservedOf(l)).toBeGreaterThan(0n)
    expect(lines.find((l) => l.token.contractId === seed.quote.contractId)!.escrowed).toBeGreaterThan(0n)
  })
})

describe('bareSeed', () => {
  it('is an empty contract with the three assets listed', () => {
    const s = bareSeed()
    expect(s.options).toEqual([])
    expect(s.bids).toEqual([])
    expect(s.asks).toEqual([])
    expect(s.underlyings).toHaveLength(3)
  })
})
