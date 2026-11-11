import { describe, expect, it } from 'vitest'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import type { TokenBalance } from '../../core/stellar/tokens'
import type { MarketIndexRow } from '../../data'
import { assetRequests, choosingSearch, fundingProgress, guidedSearch, indexList, needsTestFunds, obviousAsset } from './model'

const token = (code: string): TokenInfo => ({ contractId: `C_${code}`, code, decimals: 7, issuer: 'GISSUER' })
const USDX = token('USDX')
const row = (code: string, isReference: boolean): MarketIndexRow => ({ asset: token(code), isReference }) as MarketIndexRow
const bal = (code: string, balance: bigint | null, status: TokenBalance['status'] = 'ok'): TokenBalance => ({ contractId: `C_${code}`, status, balance })
const byId = (list: TokenBalance[]): Record<string, TokenBalance> => Object.fromEntries(list.map((b) => [b.contractId, b]))

describe('indexList', () => {
  const rows = [row('FUND', true), row('BOND', true), row('B0ND', false)]

  it('lists reference assets by default and counts the rest', () => {
    const list = indexList(rows, false)
    expect(list.rows.map((r) => r.asset.code)).toEqual(['FUND', 'BOND'])
    expect(list.hidden).toBe(1)
    expect(list.all).toBe(false)
  })

  it('lists every asset with all', () => {
    const list = indexList(rows, true)
    expect(list.rows).toHaveLength(3)
    expect(list.hidden).toBe(0)
    expect(list.all).toBe(true)
  })

  it('lists everything when the contract has no reference asset, so the page is never empty by convention', () => {
    const list = indexList([row('XYZ', false)], false)
    expect(list.rows.map((r) => r.asset.code)).toEqual(['XYZ'])
    expect(list.all).toBe(true)
  })

  it('is empty for an empty contract', () => {
    expect(indexList([], false)).toEqual({ rows: [], hidden: 0, all: true })
  })
})

describe('where an intent leads', () => {
  const rows = [row('FUND', true), row('BOND', true)]

  it('opens the asset page in guided mode with the intent', () => {
    expect(guidedSearch('earn-buy')).toEqual({ mode: 'guided', intent: 'earn-buy' })
  })

  it('keeps "show all" while the asset is being chosen', () => {
    expect(choosingSearch('floor', false)).toEqual({ intent: 'floor' })
    expect(choosingSearch('floor', true)).toEqual({ intent: 'floor', all: '1' })
  })

  it('goes straight to the asset when a single asset is listed', () => {
    expect(obviousAsset('floor', [rows[0]], null)?.asset.code).toBe('FUND')
    expect(obviousAsset('earn-buy', [rows[0]], null)?.asset.code).toBe('FUND')
  })

  it('asks a guest to choose', () => {
    expect(obviousAsset('floor', rows, null)).toBeNull()
  })

  it('goes straight to the one asset the wallet holds, for the intents that start from the asset', () => {
    const balances = byId([bal('FUND', 0n), bal('BOND', 120_000_000n), bal('USDX', 5_000_000_000n)])
    expect(obviousAsset('floor', rows, balances)?.asset.code).toBe('BOND')
    expect(obviousAsset('earn-hold', rows, balances)?.asset.code).toBe('BOND')
  })

  it('still asks when the intent starts from cash, or when the wallet holds several assets or none', () => {
    const one = byId([bal('FUND', 0n), bal('BOND', 1n)])
    expect(obviousAsset('earn-buy', rows, one)).toBeNull()
    expect(obviousAsset('lock-buy', rows, one)).toBeNull()
    expect(obviousAsset('floor', rows, byId([bal('FUND', 1n), bal('BOND', 1n)]))).toBeNull()
    expect(obviousAsset('floor', rows, byId([bal('FUND', 0n), bal('BOND', null, 'no-trustline')]))).toBeNull()
  })
})

describe('needsTestFunds', () => {
  it('is false until the balances are read', () => {
    expect(needsTestFunds(undefined)).toBe(false)
    expect(needsTestFunds(null)).toBe(false)
    expect(needsTestFunds([])).toBe(false)
  })

  it('is true for a wallet that holds nothing: zero, unfunded or without trustlines', () => {
    expect(needsTestFunds([bal('USDX', 0n), bal('FUND', 0n)])).toBe(true)
    expect(needsTestFunds([bal('USDX', null, 'unfunded'), bal('FUND', null, 'unfunded')])).toBe(true)
    expect(needsTestFunds([bal('USDX', 0n), bal('FUND', null, 'no-trustline')])).toBe(true)
  })

  it('is false as soon as the wallet holds any token', () => {
    expect(needsTestFunds([bal('USDX', 1n), bal('FUND', 0n)])).toBe(false)
    expect(needsTestFunds([bal('USDX', 0n), bal('FUND', 10n)])).toBe(false)
  })

  it('is false when a balance could not be read: an error is not an empty wallet', () => {
    expect(needsTestFunds([bal('USDX', null, 'error'), bal('FUND', 0n)])).toBe(false)
  })
})

describe('fundingProgress', () => {
  it('starts at the first step for an account that does not exist', () => {
    expect(fundingProgress([bal('USDX', null, 'unfunded'), bal('FUND', null, 'unfunded')], USDX.contractId)).toEqual({ fund: 'next', trust: 'later', swap: 'later' })
  })

  it('asks for trustlines until the quote token and one asset can be held', () => {
    expect(fundingProgress([bal('USDX', null, 'no-trustline'), bal('FUND', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
    expect(fundingProgress([bal('USDX', 0n), bal('FUND', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
    expect(fundingProgress([bal('USDX', null, 'no-trustline'), bal('FUND', 0n)], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
  })

  it('ends at the swap once both trustlines exist', () => {
    expect(fundingProgress([bal('USDX', 0n), bal('FUND', 0n), bal('BOND', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'done', swap: 'next' })
  })

  it('claims nothing without balances', () => {
    expect(fundingProgress([], USDX.contractId)).toEqual({ fund: 'next', trust: 'later', swap: 'later' })
  })
})

describe('assetRequests', () => {
  const NOW = 1_000_000
  const FUND = token('FUND')
  const BOND = token('BOND')
  const ME = 'GME'
  let next = 0n
  const bid = (over: Partial<Bid>): Bid => ({
    id: next++,
    buyer: 'GOTHER',
    kind: 'put',
    underlying: FUND,
    quote: USDX,
    underlyingQty: 10_000_000n,
    totalStrike: 100_000_000n,
    totalPremium: 5_000_000n,
    expiry: NOW + 86_400,
    state: 'open',
    optionId: null,
    ...over,
  })

  it('lists the open requests of the asset only, highest premium per unit first, then soonest expiry', () => {
    const low = bid({ totalPremium: 2_000_000n })
    const high = bid({ totalPremium: 9_000_000n })
    // 18 for 4 units is 4.5 per unit: between the two, although its total is the largest.
    const mid = bid({ totalPremium: 18_000_000n, underlyingQty: 40_000_000n })
    const sameLater = bid({ totalPremium: 2_000_000n, expiry: NOW + 2 * 86_400 })
    const other = bid({ underlying: BOND })
    const rows = assetRequests([low, sameLater, other, high, mid], FUND.contractId, null, NOW)
    expect(rows.map((r) => r.bid.id)).toEqual([high.id, mid.id, low.id, sameLater.id])
    expect(rows.every((r) => r.open && !r.mine)).toBe(true)
  })

  it('marks the wallet own requests', () => {
    const mine = bid({ buyer: ME })
    const rows = assetRequests([mine, bid({})], FUND.contractId, ME, NOW)
    expect(rows.find((r) => r.bid.id === mine.id)?.mine).toBe(true)
    expect(rows.filter((r) => r.mine)).toHaveLength(1)
  })

  it('keeps the wallet own lapsed requests at the end, because cancelling them refunds the premium', () => {
    const lapsedMine = bid({ buyer: ME, expiry: NOW - 10 })
    const expiredMine = bid({ buyer: ME, state: 'expired', expiry: NOW - 20 })
    const lapsedOther = bid({ expiry: NOW - 10 })
    const open = bid({})
    const rows = assetRequests([lapsedMine, expiredMine, lapsedOther, open], FUND.contractId, ME, NOW)
    expect(rows.map((r) => [r.bid.id, r.open])).toEqual([
      [open.id, true],
      [expiredMine.id, false],
      [lapsedMine.id, false],
    ])
  })

  it('never shows filled, cancelled or pruned requests, and treats the expiry second itself as lapsed', () => {
    const rows = assetRequests(
      [bid({ state: 'filled' }), bid({ state: 'cancelled' }), bid({ state: 'pruned', buyer: ME }), bid({ expiry: NOW })],
      FUND.contractId,
      ME,
      NOW,
    )
    expect(rows).toEqual([])
  })
})
