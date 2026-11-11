import { describe, expect, it } from 'vitest'
import { DAY, FUND, MAKER, ME, NOW, U, USDX, bid, buildPositions, opt } from './fixtures.testhelper'
import { portfolioTotals, requestExpired } from './totals'

const sum = (list: { token: { code: string }; amount: bigint }[]) => Object.fromEntries(list.map((m) => [m.token.code, m.amount]))

describe('portfolioTotals', () => {
  it('splits what is locked now from what one action takes back now', () => {
    const options = [
      opt({ id: 1n, writer: ME, holder: MAKER, state: 'active' }), // put sold: 50.00 USDx locked
      opt({ id: 2n, writer: ME, holder: null, state: 'offered' }), // open offer: 50.00 USDx locked, a cancel returns it
      opt({ id: 3n, kind: 'call', writer: ME, holder: MAKER, state: 'exercised' }), // 50.00 USDx to claim
      opt({ id: 4n, writer: ME, holder: MAKER, state: 'expired', expiry: NOW - DAY }), // 50.00 USDx to reclaim
      opt({ id: 5n, kind: 'call', writer: ME, holder: MAKER, state: 'active' }), // 5.00 FUND locked
      opt({ id: 6n, writer: MAKER, holder: ME, state: 'active' }), // held: nothing of the wallet's is locked
    ]
    const bids = [bid({ id: 1n }), bid({ id: 2n, expiry: NOW - 60 }), bid({ id: 3n, state: 'filled', optionId: 9n })]
    const view = buildPositions({ options, asks: [], bids, me: ME, nowSec: NOW })
    const t = portfolioTotals(view, NOW)
    expect(sum(t.locked)).toEqual({ USDx: 100n * U + 2n * U, FUND: 5n * U })
    expect(sum(t.readyBack)).toEqual({ USDx: 50n * U + 50n * U + 2n * U })
    expect(t.locked.find((m) => m.token.code === 'FUND')?.token).toBe(FUND)
    expect(t.readyBack[0].token).toBe(USDX)
  })

  it('has nothing to take back when nothing waits', () => {
    const view = buildPositions({ options: [opt()], asks: [], bids: [], me: ME, nowSec: NOW })
    expect(portfolioTotals(view, NOW)).toEqual({ locked: [], readyBack: [] })
  })

  it('treats an open request past its deadline as expired: its premium waits for a cancel', () => {
    expect(requestExpired(bid({ expiry: NOW - 1 }), NOW)).toBe(true)
    expect(requestExpired(bid({ state: 'expired' }), NOW)).toBe(true)
    expect(requestExpired(bid(), NOW)).toBe(false)
    expect(requestExpired(bid({ state: 'filled', expiry: NOW - 1 }), NOW)).toBe(false)
  })
})
