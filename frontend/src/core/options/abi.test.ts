import { describe, expect, it } from 'vitest'
import { assertI128, collateralLines, expiryToU64, idToU32, kindFromAbi, kindToAbi, optionFromAbi, stateFromAbi } from './abi'
import type { AbiOptionData } from './abi'
import type { OptionOffer, TokenInfo } from './types'
import { unwrap } from './sorobanClient'

const UNIT = 10_000_000n
const USDX: TokenInfo = { contractId: 'CUSDX', code: 'USDx', decimals: 7 }
const RWA: TokenInfo = { contractId: 'CRWA', code: 'RWA', decimals: 7 }
const tokens = new Map([USDX, RWA].map((t) => [t.contractId, t]))

const raw = (over: Partial<AbiOptionData> = {}): AbiOptionData => ({
  id: 3,
  underlying: 'CRWA',
  quote: 'CUSDX',
  option_type: { tag: 'Put', values: undefined },
  qty: 2n * UNIT,
  strike_total: 20n * UNIT,
  premium_total: UNIT,
  expiry: 2000n,
  writer: 'GW',
  holder: undefined,
  state: { tag: 'Offered', values: undefined },
  ...over,
})

describe('stateFromAbi', () => {
  it('derives expired for Offered/Active at or past expiry', () => {
    expect(stateFromAbi('Offered', 2000, 1999)).toBe('offered')
    expect(stateFromAbi('Offered', 2000, 2000)).toBe('expired')
    expect(stateFromAbi('Active', 2000, 1999)).toBe('active')
    expect(stateFromAbi('Active', 2000, 5000)).toBe('expired')
  })
  it('maps terminal and exercised states regardless of time', () => {
    expect(stateFromAbi('Exercised', 2000, 5000)).toBe('exercised')
    expect(stateFromAbi('Settled', 2000, 5000)).toBe('settled')
    expect(stateFromAbi('Expired', 2000, 5000)).toBe('reclaimed')
    expect(stateFromAbi('Cancelled', 2000, 1)).toBe('cancelled')
  })
})

describe('conversions', () => {
  it('option type round trip', () => {
    expect(kindFromAbi(kindToAbi('put'))).toBe('put')
    expect(kindFromAbi(kindToAbi('call'))).toBe('call')
  })
  it('range checks', () => {
    expect(idToU32(4294967295n)).toBe(4294967295)
    expect(() => idToU32(4294967296n)).toThrow()
    expect(() => idToU32(-1n)).toThrow()
    expect(expiryToU64(5)).toBe(5n)
    expect(() => expiryToU64(1.5)).toThrow()
    expect(assertI128(2n ** 127n - 1n)).toBe(2n ** 127n - 1n)
    expect(() => assertI128(2n ** 127n)).toThrow()
  })
  it('unwrap handles plain values and Ok/Err wrappers', () => {
    expect(unwrap(7)).toBe(7)
    expect(unwrap({ isErr: () => false, unwrap: () => 9 })).toBe(9)
    expect(() => unwrap({ isErr: () => true, unwrapErr: () => ({ message: 'boom' }) })).toThrow('boom')
  })
})

describe('optionFromAbi', () => {
  it('maps fields, holder and state', () => {
    const o = optionFromAbi(raw({ holder: 'GB', state: { tag: 'Active', values: undefined } }), tokens, 1000)
    expect(o).toMatchObject({
      id: 3n, kind: 'put', underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT, totalPremium: UNIT,
      expiry: 2000, writer: 'GW', holder: 'GB', state: 'active',
    })
    expect(o.underlying).toBe(RWA)
    expect(optionFromAbi(raw(), tokens, 1000).holder).toBeNull()
  })
  it('rejects unknown tokens', () => {
    expect(() => optionFromAbi(raw({ underlying: 'CXXX' }), tokens, 1000)).toThrow('unknown token')
  })
})

describe('collateralLines', () => {
  const opt = (over: Partial<OptionOffer>): OptionOffer => ({
    id: 0n, kind: 'put', underlying: RWA, quote: USDX, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT,
    totalPremium: UNIT, expiry: 2000, writer: 'GW', holder: null, state: 'offered', ...over,
  })
  const get = (lines: ReturnType<typeof collateralLines>, id: string) => lines.find((l) => l.token.contractId === id)

  it('splits by state and token', () => {
    const lines = collateralLines([
      opt({ state: 'offered' }),
      opt({ state: 'active' }),
      opt({ state: 'expired' }),
      opt({ kind: 'call', state: 'offered' }),
    ])
    expect(get(lines, 'CUSDX')).toMatchObject({ offered: 20n * UNIT, active: 20n * UNIT, pendingReclaim: 20n * UNIT, unclaimed: 0n })
    expect(get(lines, 'CRWA')).toMatchObject({ offered: 2n * UNIT })
  })
  it('exercised proceeds are unclaimed in the delivery token; terminal states hold nothing', () => {
    const lines = collateralLines([
      opt({ state: 'exercised' }), // put: writer receives underlying qty
      opt({ kind: 'call', state: 'exercised' }), // call: writer receives quote strike
      opt({ state: 'settled' }),
      opt({ state: 'reclaimed' }),
      opt({ state: 'cancelled' }),
    ])
    expect(get(lines, 'CRWA')).toMatchObject({ unclaimed: 2n * UNIT, offered: 0n })
    expect(get(lines, 'CUSDX')).toMatchObject({ unclaimed: 20n * UNIT })
  })
})
