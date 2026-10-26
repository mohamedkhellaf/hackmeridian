import { describe, expect, it } from 'vitest'
import type { Ask, OptionOffer, TokenInfo } from '../options/types'
import { askPerUnit, canList, formatAskPerUnit, resaleRows, selfTradeReason } from './resale'

const UNIT = 10_000_000n
const USDX: TokenInfo = { contractId: 'CUSDX', code: 'USDx', decimals: 7 }
const FUND: TokenInfo = { contractId: 'CFUND', code: 'FUND', decimals: 7 }
const T = 1_000_000

const opt = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n, kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT,
  totalPremium: 2n * UNIT, expiry: T + 3600, writer: 'GW', holder: 'GH', state: 'active', ...over,
})

describe('askPerUnit', () => {
  it('divides the total ask by the quantity in exact units', () => {
    expect(askPerUnit(opt(), 3n * UNIT)).toBe(6_000_000n) // 3 USDx / 5 FUND = 0.6
    expect(formatAskPerUnit(opt(), 3n * UNIT)).toBe('0.60')
  })
  it('floors and handles mixed decimals', () => {
    const o = opt({ underlying: { ...FUND, decimals: 2 }, underlyingQty: 300n }) // 3.00 units
    expect(askPerUnit(o, 10n * UNIT)).toBe(33_333_333n) // 3.3333333 USDx
  })
  it('returns null for zero quantity', () => {
    expect(askPerUnit(opt({ underlyingQty: 0n }), UNIT)).toBeNull()
    expect(formatAskPerUnit(opt({ underlyingQty: 0n }), UNIT)).toBe('–')
  })
})

describe('canList', () => {
  it('only the holder of an active, unexpired option', () => {
    expect(canList(opt(), 'GH', T)).toBe(true)
    expect(canList(opt(), 'GW', T)).toBe(false)
    expect(canList(opt(), null, T)).toBe(false)
    expect(canList(opt({ state: 'exercised' }), 'GH', T)).toBe(false)
    expect(canList(opt(), 'GH', T + 3600)).toBe(false)
  })
})

describe('resaleRows', () => {
  const ask = (id: bigint, holder = 'GH'): Ask => ({ id, holder, askTotal: UNIT })
  it('joins asks with live options held by the lister, sorted by id', () => {
    const options = [opt({ id: 2n }), opt({ id: 1n }), opt({ id: 3n, state: 'exercised' }), opt({ id: 4n, holder: 'GX' })]
    const rows = resaleRows(options, [ask(2n), ask(1n), ask(3n), ask(4n), ask(9n)], T)
    expect(rows.map((r) => r.option.id)).toEqual([1n, 2n])
  })
  it('drops expired options and handles a contract without resale', () => {
    expect(resaleRows([opt()], [ask(1n)], T + 3600)).toEqual([])
    expect(resaleRows([opt()], null, T)).toEqual([])
  })
})

describe('selfTradeReason', () => {
  const a: Ask = { id: 1n, holder: 'GH', askTotal: UNIT }
  it('blocks the seller and the writer, allows anyone else', () => {
    expect(selfTradeReason(opt(), a, 'GH')).toMatch(/your listing/)
    expect(selfTradeReason(opt(), a, 'GW')).toMatch(/wrote this option/)
    expect(selfTradeReason(opt(), a, 'GB')).toBeNull()
    expect(selfTradeReason(opt(), a, null)).toBeNull()
  })
})
