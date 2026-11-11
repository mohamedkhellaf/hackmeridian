import { describe, expect, it } from 'vitest'
import type { OptionOffer, TokenInfo } from '../options/types'
import {
  ACTION_LABEL,
  actionKindOf,
  actionLabel,
  actionsWaiting,
  claimAmount,
  computeKpis,
  counterpartyLine,
  countdown,
  filterPositions,
  money,
  portfolioSummary,
  premiumOf,
  roleOf,
  statusOf,
  todoItems,
  waitingActions,
} from './positions'
import type { RowAction } from './positions'

const U = 10_000_000n
const USDX: TokenInfo = { contractId: 'Q', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'F', code: 'FUND', decimals: 7 }
const ME = 'GME'
const OTHER = 'GOTHER'
const opt = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U,
  expiry: 2_000_000_000, writer: ME, holder: null, state: 'offered', ...over,
})

describe('money', () => {
  it('pads to two decimals and keeps up to four', () => {
    expect(money(5n * U, 7)).toBe('5.00')
    expect(money(1_250n * U, 7)).toBe('1,250.00')
    expect(money((18n * U) / 10n, 7)).toBe('1.80')
    expect(money(123_456n, 7)).toBe('0.0123')
    expect(money(5n, 0)).toBe('5')
  })
})

describe('roleOf / statusOf', () => {
  it('roles', () => {
    expect(roleOf(opt(), ME)).toBe('writer')
    expect(roleOf(opt({ writer: OTHER, holder: ME }), ME)).toBe('holder')
    expect(roleOf(opt({ writer: OTHER }), ME)).toBeNull()
    expect(roleOf(opt(), null)).toBeNull()
  })
  it('human labels by state and role', () => {
    expect(statusOf(opt({ state: 'active', holder: OTHER }), 'holder').label).toBe('Active · exercisable')
    expect(statusOf(opt({ state: 'exercised' }), 'writer').label).toBe('Awaiting your claim')
    expect(statusOf(opt({ state: 'expired' }), 'writer').label).toBe('Collateral reclaimable')
    expect(statusOf(opt({ state: 'offered' }), 'writer').label).toBe('Open offer')
    expect(statusOf(opt({ state: 'settled' }), 'writer')).toMatchObject({ label: 'Settled', closed: true })
    expect(statusOf(opt({ state: 'reclaimed' }), 'writer').label).toBe('Reclaimed')
    expect(statusOf(opt({ state: 'cancelled' }), 'writer').label).toBe('Cancelled')
    expect(statusOf(opt({ state: 'expired', holder: ME }), 'holder').closed).toBe(true)
  })
})

describe('actions', () => {
  it('kinds', () => {
    expect(actionKindOf(opt({ state: 'active' }), 'holder')).toBe('exercise')
    expect(actionKindOf(opt({ state: 'exercised' }), 'writer')).toBe('claim')
    expect(actionKindOf(opt({ state: 'expired' }), 'writer')).toBe('reclaim')
    expect(actionKindOf(opt({ state: 'offered' }), 'writer')).toBe('cancel')
    expect(actionKindOf(opt({ state: 'active' }), 'writer')).toBeNull()
  })
  it('labels carry the exact payout', () => {
    expect(actionLabel(opt(), 'claim')).toBe('Claim 5.00 FUND') // put writer receives the underlying
    expect(actionLabel(opt({ kind: 'call' }), 'claim')).toBe('Claim 50.00 USDx') // call writer receives the strike
    expect(actionLabel(opt(), 'reclaim')).toBe('Reclaim 50.00 USDx')
    expect(actionLabel(opt({ kind: 'call' }), 'reclaim')).toBe('Reclaim 5.00 FUND')
    expect(actionLabel(opt(), 'exercise')).toBe('Exercise')
  })
})

describe('premiumOf', () => {
  it('is signed by role', () => {
    expect(premiumOf(opt({ writer: OTHER, holder: ME, state: 'active' }), 'holder')).toEqual({ text: '2.00 USDx original premium (paid to the writer)', tone: 'muted' })
    expect(premiumOf(opt({ holder: OTHER, state: 'active' }), 'writer')).toEqual({ text: '+2.00 USDx', tone: 'pos' })
    expect(premiumOf(opt(), 'writer')).toEqual({ text: '2.00 USDx ask', tone: 'ask' })
    expect(premiumOf(opt({ state: 'expired' }), 'writer')).toEqual({ text: '–', tone: 'muted' })
  })
})

describe('counterpartyLine', () => {
  it('describes the other side', () => {
    expect(counterpartyLine(opt({ writer: 'GMAKERAAAAAAAA', holder: ME }), 'holder')).toBe('Maker GMAK…AAAA')
    expect(counterpartyLine(opt(), 'writer')).toBe('Listed in Markets')
    expect(counterpartyLine(opt({ state: 'expired' }), 'writer')).toBe('No buyer')
  })
})

describe('countdown', () => {
  it('formats', () => {
    const now = 1_000_000 * 1000
    expect(countdown(1_000_000 + 2 * 86400 + 23 * 3600 + 59, now)).toBe('in 2d 23h')
    expect(countdown(1_000_000 + 5 * 3600 + 600, now)).toBe('in 5h 10m')
    expect(countdown(1_000_000 + 30, now)).toBe('in 1m')
    expect(countdown(1_000_000 - 1, now)).toBe('expired')
  })
})

describe('computeKpis', () => {
  const rows = [
    opt({ id: 1n, state: 'offered' }),
    opt({ id: 2n, state: 'active', holder: OTHER }),
    opt({ id: 3n, state: 'expired' }),
    opt({ id: 4n, state: 'exercised', holder: OTHER }),
    opt({ id: 5n, state: 'settled', holder: OTHER }),
    opt({ id: 6n, kind: 'call', state: 'offered' }),
    opt({ id: 7n, writer: OTHER, holder: ME, state: 'active' }),
    opt({ id: 8n, writer: OTHER, holder: OTHER, state: 'active' }),
  ]
  it("counts and sums only the wallet's own positions", () => {
    const k = computeKpis(rows, ME)
    expect(k.holding).toBe(1)
    expect(k.writing).toBe(5) // 1,2,3,4,6; settled is closed
    // put collateral 3 x 50 USDx (offered, active, expired); call collateral 5 FUND
    expect(k.locked.find((l) => l.token.code === 'USDx')?.amount).toBe(150n * U)
    expect(k.locked.find((l) => l.token.code === 'FUND')?.amount).toBe(5n * U)
    expect(k.premium?.amount).toBe(6n * U) // sold: 2, 4, 5
  })
  it('is empty without a wallet', () => {
    expect(computeKpis(rows, null)).toEqual({ holding: 0, writing: 0, locked: [], premium: null })
  })
})

describe('filterPositions / waitingActions', () => {
  const rows = [
    opt({ id: 1n, state: 'offered' }),
    opt({ id: 2n, state: 'cancelled' }),
    opt({ id: 3n, writer: OTHER, holder: ME, state: 'active' }),
    opt({ id: 4n, state: 'exercised', holder: OTHER }),
    opt({ id: 5n, writer: OTHER }),
  ]
  it('filters by role and closed', () => {
    expect(filterPositions(rows, ME, 'all', false).map((o) => o.id)).toEqual([1n, 3n, 4n])
    expect(filterPositions(rows, ME, 'all', true).map((o) => o.id)).toEqual([1n, 2n, 3n, 4n])
    expect(filterPositions(rows, ME, 'holding', true).map((o) => o.id)).toEqual([3n])
    expect(filterPositions(rows, ME, 'writing', false).map((o) => o.id)).toEqual([1n, 4n])
  })
  it('lists exercise, claim and reclaim but not cancel', () => {
    expect(waitingActions(rows, ME, 0)).toEqual(['exercise your put on 5.00 FUND', 'claim 5.00 FUND from an exercised put'])
    expect(waitingActions([opt({ state: 'expired' })], ME, 0)).toEqual(['reclaim 50.00 USDx from an expired offer'])
  })
})

describe('claim delivery applies to puts and calls alike', () => {
  const exercisedPut = opt({ id: 10n, kind: 'put', state: 'exercised', holder: OTHER })
  const exercisedCall = opt({ id: 11n, kind: 'call', state: 'exercised', holder: OTHER })

  it('both writers have a claim action', () => {
    expect(actionKindOf(exercisedPut, 'writer')).toBe('claim')
    expect(actionKindOf(exercisedCall, 'writer')).toBe('claim')
    expect(statusOf(exercisedCall, 'writer').label).toBe('Awaiting your claim')
    expect(ACTION_LABEL.claim).toBe('Claim delivery')
  })

  it('a put writer claims the delivered underlying, a call writer the strike paid', () => {
    expect(claimAmount(exercisedPut)).toEqual({ token: FUND, amount: 5n * U })
    expect(claimAmount(exercisedCall)).toEqual({ token: USDX, amount: 50n * U })
    expect(actionLabel(exercisedPut, 'claim')).toBe('Claim 5.00 FUND')
    expect(actionLabel(exercisedCall, 'claim')).toBe('Claim 50.00 USDx')
  })

  it('both show up as waiting actions and as unclaimed proceeds', () => {
    expect(waitingActions([exercisedPut, exercisedCall], ME, 0)).toEqual(['claim 5.00 FUND from an exercised put', 'claim 50.00 USDx from an exercised call'])
    const s = portfolioSummary([exercisedPut, exercisedCall], ME)
    expect(s.unclaimed).toEqual([
      { token: FUND, amount: 5n * U },
      { token: USDX, amount: 50n * U },
    ])
  })

  it('a row action carries its kind', () => {
    const a: RowAction = { kind: 'claim', label: ACTION_LABEL.claim, onClick: () => {} }
    expect(a.kind).toBe('claim')
  })
})

describe('todoItems', () => {
  const NOW = 1_900_000_000
  const DAY = 86_400
  // Strike per unit is 10.00 for every option below.
  const heldPut = (id: bigint, expiry: number) => opt({ id, writer: OTHER, holder: ME, state: 'active', expiry })
  const priceBelow = () => 9n * U // a put struck at 10 is in the money
  const priceAbove = () => 11n * U // out of the money

  it('an in-the-money exercise is an action; an out-of-the-money one is only a reminder of the deadline', () => {
    const itm = todoItems([heldPut(1n, NOW + DAY)], ME, NOW, priceBelow)
    expect(itm).toHaveLength(1)
    expect(itm[0]).toMatchObject({ kind: 'exercise', actionable: true, moneyness: 'in', deadline: NOW + DAY, secondsLeft: DAY })
    expect(itm[0].amount).toEqual({ token: USDX, amount: 50n * U })
    const otm = todoItems([heldPut(1n, NOW + DAY)], ME, NOW, priceAbove)
    expect(otm[0]).toMatchObject({ kind: 'exercise', actionable: false, moneyness: 'out' })
    expect(actionsWaiting(itm)).toBe(1)
    expect(actionsWaiting(otm)).toBe(0)
  })

  it('without a reference price an exercise is listed but never pushed', () => {
    const items = todoItems([heldPut(1n, NOW + DAY)], ME, NOW)
    expect(items[0]).toMatchObject({ kind: 'exercise', actionable: false, moneyness: 'unknown' })
  })

  it('claims and reclaims are always actions, for puts and calls', () => {
    const items = todoItems(
      [opt({ id: 1n, state: 'exercised', holder: OTHER, kind: 'call' }), opt({ id: 2n, state: 'exercised', holder: OTHER }), opt({ id: 3n, state: 'expired', holder: OTHER }), opt({ id: 4n, state: 'expired' })],
      ME,
      NOW,
    )
    expect(items.map((t) => [t.kind, t.actionable])).toEqual([['claim', true], ['claim', true], ['reclaim', true], ['reclaim', true]])
    expect(items[0].amount).toEqual({ token: USDX, amount: 50n * U }) // the call writer claims the strike
    expect(items[1].amount).toEqual({ token: FUND, amount: 5n * U }) // the put writer claims the underlying
    expect(items[2].amount).toEqual({ token: USDX, amount: 50n * U }) // collateral of a put
    expect(actionsWaiting(items)).toBe(4)
  })

  it('orders by urgency: in-the-money exercises by deadline, claims, reclaims, reminders, then expired', () => {
    const options = [
      opt({ id: 1n, writer: OTHER, holder: ME, state: 'expired', expiry: NOW - DAY }),
      heldPut(2n, NOW + 5 * DAY),
      opt({ id: 3n, state: 'expired' }),
      opt({ id: 4n, state: 'exercised', holder: OTHER }),
      heldPut(5n, NOW + 2 * DAY),
      opt({ id: 6n, kind: 'call', writer: OTHER, holder: ME, state: 'active', expiry: NOW + DAY }),
    ]
    // At 9.00 the puts are in the money and the call (strike 10) is out of the money.
    const items = todoItems(options, ME, NOW, priceBelow)
    expect(items.map((t) => [t.option.id, t.kind])).toEqual([
      [5n, 'exercise'],
      [2n, 'exercise'],
      [4n, 'claim'],
      [3n, 'reclaim'],
      [6n, 'exercise'],
      [1n, 'expired-unexercised'],
    ])
    expect(actionsWaiting(items)).toBe(4)
  })

  it('leaves out cancellable offers, options of other accounts, and old expiries', () => {
    const items = todoItems(
      [opt({ id: 1n }), opt({ id: 2n, writer: OTHER, holder: 'GX', state: 'active' }), opt({ id: 3n, writer: OTHER, holder: ME, state: 'expired', expiry: NOW - 30 * DAY }), heldPut(4n, NOW - 1)],
      ME,
      NOW,
    )
    expect(items).toEqual([])
    expect(todoItems([opt({ id: 5n, state: 'exercised', holder: OTHER })], null, NOW)).toEqual([])
  })
})

describe('portfolioSummary', () => {
  it('sums exact figures per token and leaves resale purchases out of premium paid', () => {
    const options = [
      opt({ id: 1n, writer: OTHER, holder: ME, state: 'active' }), // paid 2
      opt({ id: 2n, writer: OTHER, holder: ME, state: 'active', totalPremium: 3n * U }), // bought on resale
      opt({ id: 3n, holder: OTHER, state: 'active' }), // earned 2, locks 50 USDx
      opt({ id: 4n, kind: 'call', state: 'offered' }), // locks 5 FUND, nothing earned yet
      opt({ id: 5n, state: 'settled', holder: OTHER }), // earned 2, closed
      opt({ id: 6n, writer: OTHER, holder: 'GX' }), // not mine
    ]
    const s = portfolioSummary(options, ME, new Set([2n]))
    expect(s.open).toBe(4)
    expect(s.premiumPaid).toEqual([{ token: USDX, amount: 2n * U }])
    expect(s.premiumEarned).toEqual([{ token: USDX, amount: 4n * U }])
    expect(s.locked).toEqual([
      { token: USDX, amount: 50n * U },
      { token: FUND, amount: 5n * U },
    ])
    expect(s.unclaimed).toEqual([])
    expect(portfolioSummary(options, null).open).toBe(0)
  })
})
