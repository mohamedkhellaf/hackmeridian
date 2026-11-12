import { describe, expect, it } from 'vitest'
import type { TokenInfo } from '../../core/options/types'
import type { Bid } from '../../core/requests/types'
import type { TokenBalance } from '../../core/stellar/tokens'
import type { ReferencePrice } from '../../core/reference'
import type { ExpiryColumn, GridCell, MarketIndexRow, MarketView } from '../../data'
import { accessCase, assetRequests, choosingSearch, fundingProgress, fundsLead, guidedSearch, indexList, nearReference, needsTestFunds, obviousAsset } from './model'

const token = (code: string): TokenInfo => ({ contractId: `C_${code}`, code, decimals: 7, issuer: 'GISSUER' })
const USDX = token('USDX')
const row = (code: string, isReference: boolean): MarketIndexRow => ({ asset: token(code), isReference }) as MarketIndexRow
const bal = (code: string, balance: bigint | null, status: TokenBalance['status'] = 'ok'): TokenBalance => ({ contractId: `C_${code}`, status, balance })
const byId = (list: TokenBalance[]): Record<string, TokenBalance> => Object.fromEntries(list.map((b) => [b.contractId, b]))

describe('indexList', () => {
  const rows = [row('RWA', true), row('BOND', true), row('B0ND', false)]

  it('lists reference assets by default and counts the rest', () => {
    const list = indexList(rows, false)
    expect(list.rows.map((r) => r.asset.code)).toEqual(['RWA', 'BOND'])
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

describe('nearReference', () => {
  const U = 10_000_000n
  const demo = (perUnit: bigint | null): ReferencePrice => ({ kind: perUnit === null ? 'none' : 'demo', perUnit, label: 'Demo price', note: '', asOf: null })
  const cell = (bestPerUnit: bigint | null): GridCell => ({ bestPerUnit }) as GridCell
  const ladder = [98n * U, 99n * U, 100n * U, 101n * U]
  /** A column with the given best premiums per strike (put, call); `offers` counts the priced cells. */
  const column = (expiry: number, prices: Record<string, [bigint | null, bigint | null]>): ExpiryColumn => {
    const rows = ladder.map((k) => {
      const [put, call] = prices[String(k / U)] ?? [null, null]
      return { strikePerUnit: k, put: cell(put), call: cell(call) }
    })
    const offers = rows.reduce((n, r) => n + Number(r.put.bestPerUnit !== null) + Number(r.call.bestPerUnit !== null), 0)
    return { expiry, rows, offers } as unknown as ExpiryColumn
  }
  const view = (price: bigint | null, columns: ExpiryColumn[]): Pick<MarketView, 'reference' | 'ladder' | 'columns'> => ({ reference: demo(price), ladder, columns })

  it('takes the strike nearest the reference price on the nearest deadline that has offers', () => {
    const v = view((9940n * U) / 100n, [
      column(100, {}),
      column(200, { '98': [U / 100n, null], '99': [18n * (U / 100n), 2n * U], '100': [U, null] }),
      column(300, { '99': [U / 10n, U / 10n] }),
    ])
    expect(nearReference(v)).toEqual({
      put: { perUnit: 18n * (U / 100n), strikePerUnit: 99n * U, expiry: 200 },
      call: { perUnit: 2n * U, strikePerUnit: 99n * U, expiry: 200 },
    })
  })

  it('has nothing for a kind with no offer at that strike, even when another strike has one', () => {
    const v = view(99n * U, [column(200, { '98': [U, U], '99': [U / 2n, null] })])
    expect(nearReference(v)).toEqual({ put: { perUnit: U / 2n, strikePerUnit: 99n * U, expiry: 200 }, call: null })
  })

  it('takes the lower strike on a tie', () => {
    const v = view((995n * U) / 10n, [column(200, { '99': [U, null], '100': [2n * U, null] })])
    expect(nearReference(v).put?.strikePerUnit).toBe(99n * U)
  })

  it('has nothing without a reference price or without any offer', () => {
    expect(nearReference(view(null, [column(200, { '99': [U, U] })]))).toEqual({ put: null, call: null })
    expect(nearReference(view(99n * U, [column(200, {})]))).toEqual({ put: null, call: null })
    expect(nearReference(view(99n * U, []))).toEqual({ put: null, call: null })
  })
})

describe('where an intent leads', () => {
  const rows = [row('RWA', true), row('BOND', true)]

  it('opens the asset page in guided mode with the intent', () => {
    expect(guidedSearch('earn-buy')).toEqual({ mode: 'guided', intent: 'earn-buy' })
  })

  it('keeps "show all" while the asset is being chosen', () => {
    expect(choosingSearch('floor', false)).toEqual({ intent: 'floor' })
    expect(choosingSearch('floor', true)).toEqual({ intent: 'floor', all: '1' })
  })

  it('goes straight to the asset when a single asset is listed', () => {
    expect(obviousAsset('floor', [rows[0]], null)?.asset.code).toBe('RWA')
    expect(obviousAsset('earn-buy', [rows[0]], null)?.asset.code).toBe('RWA')
  })

  it('asks a guest to choose', () => {
    expect(obviousAsset('floor', rows, null)).toBeNull()
  })

  it('goes straight to the one asset the wallet holds, for the intents that start from the asset', () => {
    const balances = byId([bal('RWA', 0n), bal('BOND', 120_000_000n), bal('USDX', 5_000_000_000n)])
    expect(obviousAsset('floor', rows, balances)?.asset.code).toBe('BOND')
    expect(obviousAsset('earn-hold', rows, balances)?.asset.code).toBe('BOND')
  })

  it('still asks when the intent starts from cash, or when the wallet holds several assets or none', () => {
    const one = byId([bal('RWA', 0n), bal('BOND', 1n)])
    expect(obviousAsset('earn-buy', rows, one)).toBeNull()
    expect(obviousAsset('lock-buy', rows, one)).toBeNull()
    expect(obviousAsset('floor', rows, byId([bal('RWA', 1n), bal('BOND', 1n)]))).toBeNull()
    expect(obviousAsset('floor', rows, byId([bal('RWA', 0n), bal('BOND', null, 'no-trustline')]))).toBeNull()
  })
})

describe('needsTestFunds', () => {
  const Q = USDX.contractId

  it('is false until the balances are read', () => {
    expect(needsTestFunds(undefined, Q)).toBe(false)
    expect(needsTestFunds(null, Q)).toBe(false)
    expect(needsTestFunds([], Q)).toBe(false)
  })

  it('is true for a wallet with no quote token: zero, unfunded or without a trustline', () => {
    expect(needsTestFunds([bal('USDX', 0n), bal('RWA', 0n)], Q)).toBe(true)
    expect(needsTestFunds([bal('USDX', null, 'unfunded'), bal('RWA', null, 'unfunded')], Q)).toBe(true)
    expect(needsTestFunds([bal('USDX', null, 'no-trustline'), bal('RWA', 0n)], Q)).toBe(true)
  })

  it('is true for a holder of the asset with no quote token: it cannot pay a premium', () => {
    expect(needsTestFunds([bal('USDX', 0n), bal('RWA', 10n)], Q)).toBe(true)
  })

  it('is false as soon as the wallet holds the quote token', () => {
    expect(needsTestFunds([bal('USDX', 1n), bal('RWA', 0n)], Q)).toBe(false)
  })

  it('is false when the quote balance could not be read: an error is not an empty wallet', () => {
    expect(needsTestFunds([bal('USDX', null, 'error'), bal('RWA', 0n)], Q)).toBe(false)
  })
})

describe('fundsLead', () => {
  const Q = USDX.contractId

  it('says the wallet holds nothing, no quote token, or that the strip was asked for', () => {
    expect(fundsLead([bal('USDX', 0n), bal('RWA', null, 'no-trustline')], Q)).toBe('none')
    expect(fundsLead([bal('USDX', 0n), bal('RWA', 10n)], Q)).toBe('noQuote')
    expect(fundsLead([bal('USDX', 5n), bal('RWA', 10n)], Q)).toBe('asked')
  })
})

describe('fundingProgress', () => {
  it('starts at the first step for an account that does not exist', () => {
    expect(fundingProgress([bal('USDX', null, 'unfunded'), bal('RWA', null, 'unfunded')], USDX.contractId)).toEqual({ fund: 'next', trust: 'later', swap: 'later' })
  })

  it('asks for trustlines until the quote token and one asset can be held', () => {
    expect(fundingProgress([bal('USDX', null, 'no-trustline'), bal('RWA', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
    expect(fundingProgress([bal('USDX', 0n), bal('RWA', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
    expect(fundingProgress([bal('USDX', null, 'no-trustline'), bal('RWA', 0n)], USDX.contractId)).toEqual({ fund: 'done', trust: 'next', swap: 'later' })
  })

  it('ends at the swap once both trustlines exist', () => {
    expect(fundingProgress([bal('USDX', 0n), bal('RWA', 0n), bal('BOND', null, 'no-trustline')], USDX.contractId)).toEqual({ fund: 'done', trust: 'done', swap: 'next' })
  })

  it('claims nothing without balances', () => {
    expect(fundingProgress([], USDX.contractId)).toEqual({ fund: 'next', trust: 'later', swap: 'later' })
  })
})

describe('assetRequests', () => {
  const NOW = 1_000_000
  const RWA = token('RWA')
  const BOND = token('BOND')
  const ME = 'GME'
  let next = 0n
  const bid = (over: Partial<Bid>): Bid => ({
    id: next++,
    buyer: 'GOTHER',
    kind: 'put',
    underlying: RWA,
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
    const rows = assetRequests([low, sameLater, other, high, mid], RWA.contractId, null, NOW)
    expect(rows.map((r) => r.bid.id)).toEqual([high.id, mid.id, low.id, sameLater.id])
    expect(rows.every((r) => r.open && !r.mine)).toBe(true)
  })

  it('marks the wallet own requests', () => {
    const mine = bid({ buyer: ME })
    const rows = assetRequests([mine, bid({})], RWA.contractId, ME, NOW)
    expect(rows.find((r) => r.bid.id === mine.id)?.mine).toBe(true)
    expect(rows.filter((r) => r.mine)).toHaveLength(1)
  })

  it('keeps the wallet own lapsed requests at the end, because cancelling them refunds the premium', () => {
    const lapsedMine = bid({ buyer: ME, expiry: NOW - 10 })
    const expiredMine = bid({ buyer: ME, state: 'expired', expiry: NOW - 20 })
    const lapsedOther = bid({ expiry: NOW - 10 })
    const open = bid({})
    const rows = assetRequests([lapsedMine, expiredMine, lapsedOther, open], RWA.contractId, ME, NOW)
    expect(rows.map((r) => [r.bid.id, r.open])).toEqual([
      [open.id, true],
      [expiredMine.id, false],
      [lapsedMine.id, false],
    ])
  })

  it('never shows filled, cancelled or pruned requests, and treats the expiry second itself as lapsed', () => {
    const rows = assetRequests(
      [bid({ state: 'filled' }), bid({ state: 'cancelled' }), bid({ state: 'pruned', buyer: ME }), bid({ expiry: NOW })],
      RWA.contractId,
      ME,
      NOW,
    )
    expect(rows).toEqual([])
  })
})

describe('accessCase', () => {
  it('says what the wallet itself lacks before anything about authorization', () => {
    expect(accessCase('unfunded', undefined, false)).toBe('unfunded')
    expect(accessCase('no-trustline', undefined, false)).toBe('noTrustline')
    expect(accessCase('ok', 'no-trustline', false)).toBe('noTrustline')
    expect(accessCase(undefined, 'unfunded', undefined)).toBe('unfunded')
  })

  it('tells the issuer, a restricted holder and a refused one apart', () => {
    expect(accessCase('ok', 'issuer', true)).toBe('issuer')
    expect(accessCase('ok', 'maintain-only', false)).toBe('maintainOnly')
    expect(accessCase('not-authorized', undefined, false)).toBe('no')
    expect(accessCase('ok', 'unauthorized', true)).toBe('no')
  })

  it('falls back on the contract: authorized, refused, still checking or not known', () => {
    expect(accessCase('ok', 'authorized', true)).toBe('yes')
    expect(accessCase('mock', undefined, true)).toBe('yes')
    expect(accessCase('ok', undefined, false)).toBe('no')
    expect(accessCase('ok', undefined, undefined)).toBe('checking')
    expect(accessCase('ok', undefined, null)).toBe('error')
  })
})
