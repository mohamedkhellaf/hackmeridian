import { hashKey, matchQuery, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { MOCK_SCOPE, idKey, keys, makeKeys, tokensKey } from './keys'
import { hashQueryKey } from './queryClient'

const CONTRACT = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'
const ME = 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG'
const k = makeKeys(CONTRACT)

/** Every key the factory can produce, with bigint ids where it takes one. */
const every = (f: ReturnType<typeof makeKeys>): (readonly unknown[])[] => [
  f.root(),
  f.assets(),
  f.options(),
  f.optionAll(),
  f.option(12n),
  f.asks(),
  f.askAll(),
  f.ask(12n),
  f.bids(),
  f.bidAll(),
  f.bid(3n),
  f.collateral(),
  f.health(),
  f.balances(),
  f.balancesOf(ME),
  f.balancesFor(ME),
  f.balancesFor(ME, ['C_B', 'C_A']),
  f.eligibility('C_A', ME),
  f.eligibilityAll(),
  f.writerOpenCountAll(),
  f.writerOpenCount(ME),
  f.buyerOpenCountAll(),
  f.buyerOpenCount(ME),
  f.ledger(),
  f.assetFacts('C_A'),
]

const hasBigint = (v: unknown): boolean => (typeof v === 'bigint' ? true : Array.isArray(v) ? v.some(hasBigint) : false)

describe('query keys', () => {
  it('never holds a bigint, so the library can hash every key', () => {
    for (const key of every(k)) {
      expect(hasBigint(key)).toBe(false)
      expect(() => hashKey(key)).not.toThrow()
    }
    // The reason the factory exists: the library throws on a raw bigint.
    expect(() => hashKey(['option', 12n])).toThrow()
  })

  it('writes ids as decimal text, whatever type they come in', () => {
    expect(idKey(12n)).toBe('12')
    expect(idKey(12)).toBe('12')
    expect(idKey('12')).toBe('12')
    expect(k.option(12n)).toEqual(k.option(12))
    expect(k.option(12n)).toEqual(['covered', CONTRACT, 'option', '12'])
    // Ids beyond the safe integer range keep every digit.
    expect(k.option(2n ** 64n)[3]).toBe('18446744073709551616')
  })

  it('puts the contract id in every Covered key', () => {
    const covered = every(k).filter((key) => key[0] === 'covered')
    expect(covered.length).toBe(every(k).length - 2)
    for (const key of covered) expect(key[1]).toBe(CONTRACT)
    // Another contract, or the mock, never shares a key.
    const other = new Set(every(makeKeys('C_OTHER')).map((key) => hashKey(key)))
    for (const key of covered) expect(other.has(hashKey(key))).toBe(false)
    expect(makeKeys(undefined).options()).toEqual(['covered', MOCK_SCOPE, 'options'])
    expect(makeKeys('').options()).toEqual(['covered', MOCK_SCOPE, 'options'])
  })

  it('uses the mock scope in unit tests, where no contract id is set', () => {
    expect(keys.options()).toEqual(['covered', MOCK_SCOPE, 'options'])
  })

  it('gives every resource its own key', () => {
    const hashes = every(k).map((key) => hashKey(key))
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('makes one token set one key, whatever the order', () => {
    expect(tokensKey(undefined)).toBe('all')
    expect(tokensKey(['C_B', 'C_A', 'C_B'])).toBe('C_A,C_B')
    expect(tokensKey([{ contractId: 'C_B' }, { contractId: 'C_A' }])).toBe('C_A,C_B')
    expect(k.balancesFor(ME, ['C_B', 'C_A'])).toEqual(k.balancesFor(ME, ['C_A', 'C_B']))
    expect(k.balancesFor(ME)).not.toEqual(k.balancesFor(ME, ['C_A']))
  })

  it('is hierarchical: a prefix invalidates everything under it and nothing beside it', () => {
    const qc = new QueryClient()
    const seed = (key: readonly unknown[]) => {
      qc.setQueryData(key, 1)
      return qc.getQueryCache().find({ queryKey: key })!
    }
    const mine = seed(k.balancesFor(ME))
    const mineSome = seed(k.balancesFor(ME, ['C_A']))
    const theirs = seed(k.balancesFor('GOTHER'))
    const option = seed(k.option(12n))
    const options = seed(k.options())
    const ask = seed(k.ask(12n))
    const ledger = seed(k.ledger())

    const under = (prefix: readonly unknown[], q: typeof mine) => matchQuery({ queryKey: prefix }, q)
    expect(under(k.balancesOf(ME), mine)).toBe(true)
    expect(under(k.balancesOf(ME), mineSome)).toBe(true)
    expect(under(k.balancesOf(ME), theirs)).toBe(false)
    expect(under(k.balances(), theirs)).toBe(true)
    expect(under(k.optionAll(), option)).toBe(true)
    // 'option' and 'options' are different resources: one is not a prefix of the other.
    expect(under(k.optionAll(), options)).toBe(false)
    expect(under(k.options(), option)).toBe(false)
    expect(under(k.askAll(), ask)).toBe(true)
    expect(under(k.asks(), ask)).toBe(false)
    expect(under(k.root(), option)).toBe(true)
    expect(under(k.root(), ledger)).toBe(false)
  })
})

describe('hashQueryKey', () => {
  it('matches the library for keys without a bigint', () => {
    for (const key of every(k)) expect(hashQueryKey(key)).toBe(hashKey(key))
    expect(hashQueryKey(['x', { b: 1, a: 2 }])).toBe(hashKey(['x', { a: 2, b: 1 }]))
  })

  it('does not throw on a stray bigint', () => {
    expect(hashQueryKey(['option', 12n])).toBe('["option","12n"]')
    expect(hashQueryKey(['x', { id: 5n }])).toBe('["x",{"id":"5n"}]')
  })
})
