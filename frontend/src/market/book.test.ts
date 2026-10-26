import { describe, expect, it } from 'vitest'
import { bookRows, sortBook } from './book'
import type { Ask, OptionOffer, TokenInfo } from '../options/types'
import type { Bid } from '../requests/types'

const U = { code: 'FUND', contractId: 'CU', decimals: 7 } as TokenInfo
const Q = { code: 'USDx', contractId: 'CQ', decimals: 7 } as TokenInfo
const E = 2_000_000_000
const opt = (id: bigint, qty: bigint, prem: bigint, state = 'offered', holder: string | null = null) =>
  ({ id, kind: 'put', underlying: U, quote: Q, underlyingQty: qty, totalStrike: qty * 10n, totalPremium: prem, expiry: E, writer: `W${id}`, holder, state }) as unknown as OptionOffer
const bid = (id: bigint, qty: bigint, prem: bigint, state: Bid['state'] = 'open'): Bid => ({
  id,
  buyer: `B${id}`,
  kind: 'put',
  underlying: U,
  quote: Q,
  underlyingQty: qty,
  totalStrike: qty * 10n,
  totalPremium: prem,
  expiry: E,
  state,
  optionId: null,
})

describe('sortBook', () => {
  it('orders bids by premium per unit descending and merges resale into offers ascending, exactly', () => {
    // Per unit: offer 1 = 0.40, offer 2 = 0.333…, resale 9 = 0.35; bid 2 beats bid 1 by one stroop in total.
    const offers = [opt(1n, 5n, 2n * 10n ** 7n), opt(2n, 3n, 10n ** 7n)]
    const resold = opt(9n, 2n, 0n, 'active', 'H')
    const ask = { id: 9n, holder: 'H', askTotal: 7n * 10n ** 6n } as Ask
    const bids = [bid(1n, 10n, 3n * 10n ** 7n), bid(2n, 10n, 3n * 10n ** 7n + 1n), bid(3n, 1n, 10n ** 9n, 'filled')]
    const { bids: b, offers: o } = sortBook(bookRows(offers, [{ option: resold, ask }], bids, 0))
    expect(b.map((r) => r.key)).toEqual(['b2', 'b1'])
    expect(o.map((r) => r.key)).toEqual(['o2', 'r9', 'o1'])
    expect(o[1].source).toBe('resale')
    expect(o[1].counterparty).toBe('H')
  })

  it('drops expired bids', () => {
    expect(sortBook(bookRows([], [], [bid(1n, 1n, 1n)], E)).bids).toHaveLength(0)
  })
})
