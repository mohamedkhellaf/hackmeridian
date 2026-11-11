import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEMO_HEDGERS, DEMO_WALLETS } from '../../core/options/demoAccounts'
import type { OptionOffer } from '../../core/options/types'
import { standardExpiries } from '../../core/series'
import { FIXED_MS, FIXED_SEC, demoWorld } from './demoSource.testhelper'
import type { DemoWorld } from './demoSource.testhelper'
import { buildKpis, buildPositions, buildTodo, countActionsWaiting, positionView } from './positions'
import type { ReferenceOf } from './positions'

const A = DEMO_WALLETS.a
const B = DEMO_WALLETS.b
const usdx = (n: number) => BigInt(Math.round(n * 100)) * 10n ** 5n

let w: DemoWorld
let referenceOf: ReferenceOf
beforeAll(async () => {
  vi.useFakeTimers({ now: FIXED_MS, toFake: ['Date'] })
  w = await demoWorld()
  referenceOf = (o) => w.reference(o.underlying)
})
afterAll(() => vi.useRealTimers())

const ids = (rows: { option: OptionOffer }[]) => rows.map((r) => r.option.id)

describe('buildPositions', () => {
  it('splits the default wallet into holding, written and orders, open rows only', () => {
    const p = buildPositions({ ...w.source(A), referenceOf })
    // 0: in-the-money put, deadline in 44 h; 1: out-of-the-money put.
    expect(ids(p.holding)).toEqual([0n, 1n])
    // 3: exercised, claim waiting; 2: sold covered call; 4: expired, collateral to reclaim. Soonest deadline first.
    expect(ids(p.written).sort()).toEqual([2n, 3n, 4n])
    // 6: its open offer; request 0 is its bid.
    expect(ids(p.orders.offers)).toEqual([6n])
    expect(p.orders.requests.map((b) => b.id)).toEqual([0n])
    expect(p.orders.listings).toEqual([])
    expect(p.counts).toEqual({ holding: 2, written: 3, orders: 2, closed: 1 })
  })

  it('adds the closed rows on request', () => {
    const p = buildPositions({ ...w.source(A), referenceOf }, true)
    // 5: a call that expired unexercised. Closed rows come last.
    expect(ids(p.holding)).toEqual([0n, 1n, 5n])
    expect(p.holding[2].closed).toBe(true)
    expect(p.holding[2].status.label).toBe('Expired unexercised')
  })

  it('describes each row: status, action, counterparty, collateral, deadline and moneyness', () => {
    const p = buildPositions({ ...w.source(A), referenceOf })
    const [itm, otm] = p.holding
    expect(itm.role).toBe('holder')
    expect(itm.action).toBe('exercise')
    expect(itm.status.label).toBe('Active · exercisable')
    expect(itm.counterparty).toMatch(/^Maker GMAK/)
    expect(itm.secondsLeft).toBe(44 * 3600)
    expect(itm.urgency).toBe('within48h')
    expect(itm.moneyness).toBe('in')
    // 10 FUND put at 10.60 against the demo price 10.20: exercising is worth 4.00 USDx more than not exercising.
    expect(itm.exerciseValue).toBe(usdx(4))
    expect(itm.reference?.label).toBe('Demo price')
    expect(itm.series).toBe('FUND-20261113-10.6-P')
    expect(otm.moneyness).toBe('out')
    expect(otm.urgency).toBe('far')
    expect(otm.exerciseValue! < 0n).toBe(true)

    const by = (id: bigint) => p.written.find((r) => r.option.id === id)!
    expect(by(3n).action).toBe('claim')
    // A call writer claims the strike the holder paid: 1 BOND at 98.00.
    expect(by(3n).claim).toEqual({ token: w.quote, amount: usdx(98) })
    expect(by(3n).moneyness).toBeNull()
    expect(by(3n).secondsLeft).toBeNull()
    expect(by(4n).action).toBe('reclaim')
    expect(by(4n).status.label).toBe('Collateral reclaimable')
    // A put locks the total strike: 2 EQTY at 24.00.
    expect(by(4n).collateral).toEqual({ token: w.quote, amount: usdx(48) })
    expect(by(2n).action).toBeNull()
    expect(by(2n).counterparty).toMatch(/^Buyer GHED/)
    expect(by(2n).collateral.token.code).toBe('EQTY')

    expect(p.orders.offers[0].action).toBe('cancel')
    expect(p.orders.offers[0].counterparty).toBe('Listed in Markets')
  })

  it('shows a holder its own resale listing', () => {
    const p = buildPositions({ ...w.source(DEMO_HEDGERS.a), referenceOf })
    expect(p.orders.listings).toHaveLength(1)
    expect(p.orders.listings[0].position.option.id).toBe(9n)
    expect(p.orders.listings[0].ask.holder).toBe(DEMO_HEDGERS.a)
    // Nobody else sees a listing on that position.
    expect(positionView(w.source(A).options[9], { ...w.source(A), referenceOf })).toBeNull()
  })

  it('is empty for a guest and for a wallet with no positions', () => {
    for (const me of [null, 'GNOBODY']) {
      const p = buildPositions({ ...w.source(me), referenceOf }, true)
      expect(p.counts).toEqual({ holding: 0, written: 0, orders: 0, closed: 0 })
    }
  })

  it('keeps the second wallet separate', () => {
    const p = buildPositions({ ...w.source(B), referenceOf })
    expect(ids(p.holding)).toEqual([7n])
    expect(ids(p.written)).toEqual([8n])
    expect(p.orders.requests.map((b) => b.id)).toEqual([1n])
  })
})

describe('buildTodo', () => {
  it('lists real actions first and marks an exercise urgent only when it is in the money', () => {
    const todo = buildTodo(w.source(A).options, A, FIXED_SEC, referenceOf)
    expect(todo.map((t) => `${t.kind}:${t.option.id}:${t.tone}`)).toEqual([
      'exercise:0:urgent',
      'claim:3:action',
      'reclaim:4:action',
      'exercise:1:neutral',
      'expired-unexercised:5:info',
    ])
    const [urgent, claim, reclaim, reminder, info] = todo
    expect(urgent.urgency).toBe('within48h')
    expect(urgent.moneyness).toBe('in')
    expect(urgent.exerciseValue).toBe(usdx(4))
    expect(urgent.reference?.label).toBe('Demo price')
    expect(urgent.deadline).toBe(standardExpiries(FIXED_SEC)[0])
    expect(urgent.key).toBe('exercise:0')
    expect(claim.amount).toEqual({ token: w.quote, amount: usdx(98) })
    expect(claim.urgency).toBeNull()
    expect(reclaim.amount).toEqual({ token: w.quote, amount: usdx(48) })
    expect(reminder.actionable).toBe(false)
    expect(reminder.moneyness).toBe('out')
    expect(info.actionable).toBe(false)
    expect(countActionsWaiting(w.source(A).options, A, FIXED_SEC, referenceOf)).toBe(3)
  })

  it('never calls an exercise urgent without a reference price', () => {
    const todo = buildTodo(w.source(A).options, A, FIXED_SEC)
    const exercises = todo.filter((t) => t.kind === 'exercise')
    expect(exercises.map((t) => t.tone)).toEqual(['neutral', 'neutral'])
    expect(exercises.every((t) => t.moneyness === 'unknown' && t.exerciseValue === null)).toBe(true)
    // Claims and reclaims do not depend on a price.
    expect(countActionsWaiting(w.source(A).options, A, FIXED_SEC)).toBe(2)
  })

  it('treats an in-the-money exercise far from its deadline as an action, not as urgent', () => {
    const far = w.source(A).options.map((o) => (o.id === 0n ? { ...o, expiry: FIXED_SEC + 10 * 86_400 } : o))
    const first = buildTodo(far, A, FIXED_SEC, referenceOf)[0]
    expect(first.option.id).toBe(0n)
    expect(first.tone).toBe('action')
    expect(first.urgency).toBe('far')
  })

  it('has nothing for a guest', () => {
    expect(buildTodo(w.source(null).options, null, FIXED_SEC, referenceOf)).toEqual([])
    expect(countActionsWaiting(w.source(null).options, null, FIXED_SEC, referenceOf)).toBe(0)
  })
})

describe('buildKpis', () => {
  it('sums exact amounts per token and values nothing', () => {
    const k = buildKpis(w.source(A).options, A)
    // Open: 0, 1 (held), 2, 3, 4 (written), 6 (offer). Option 5 is closed.
    expect(k.open).toBe(6)
    expect(k.unclaimed).toEqual([{ token: w.quote, amount: usdx(98) }])
    const locked = Object.fromEntries(k.locked.map((m) => [m.token.code, m.amount]))
    // EQTY: the 4 units behind the covered call. USDx: the expired put (48.00) and the open put offer (5 x 9.80).
    expect(locked.EQTY).toBe(4n * 10n ** 7n)
    expect(locked.USDx).toBe(usdx(48) + usdx(49))
    expect(k.premiumPaid).toHaveLength(1)
    expect(k.premiumEarned).toHaveLength(1)
    expect(k.premiumPaid[0].amount > 0n && k.premiumEarned[0].amount > 0n).toBe(true)
  })
})
