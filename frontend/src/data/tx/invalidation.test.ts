import { describe, expect, it } from 'vitest'
import { makeKeys } from '../keys'
import { COVERED_ACTIONS, bidSubject, keysAfterMargin, keysToInvalidate, optionSubject, subjectIds } from './invalidation'

const k = makeKeys('C_CONTRACT')
const has = (list: (readonly unknown[])[], key: readonly unknown[]) => list.some((x) => JSON.stringify(x) === JSON.stringify(key))

describe('keysToInvalidate', () => {
  it('never invalidates what a trade cannot change', () => {
    for (const action of COVERED_ACTIONS) {
      const list = keysToInvalidate(k, action, { optionId: 12n, bidId: 3n })
      for (const never of [k.assets(), k.eligibilityAll(), k.ledger(), k.assetFacts('C_A'), k.root()]) expect(has(list, never)).toBe(false)
      // Every key is a Covered key of this contract, and none holds a bigint.
      for (const key of list) {
        expect(key.slice(0, 2)).toEqual(['covered', 'C_CONTRACT'])
        expect(() => JSON.stringify(key)).not.toThrow()
      }
    }
  })

  it('refreshes balances after everything that moves tokens, and not after a listing', () => {
    const moves = COVERED_ACTIONS.filter((a) => a !== 'list-for-sale' && a !== 'cancel-sale')
    for (const action of moves) expect(has(keysToInvalidate(k, action), k.balances())).toBe(true)
    for (const action of ['list-for-sale', 'cancel-sale']) {
      expect(keysToInvalidate(k, action, { optionId: 12n })).toEqual([k.asks(), k.ask(12n)])
    }
  })

  it('names the one option or bid when it is known, and the whole family when it is not', () => {
    expect(has(keysToInvalidate(k, 'exercise', { optionId: 12n }), k.option(12n))).toBe(true)
    expect(has(keysToInvalidate(k, 'exercise', { optionId: 12n }), k.optionAll())).toBe(false)
    expect(has(keysToInvalidate(k, 'exercise'), k.optionAll())).toBe(true)
    expect(has(keysToInvalidate(k, 'cancel-bid', { bidId: 3n }), k.bid(3n))).toBe(true)
    expect(has(keysToInvalidate(k, 'cancel-bid'), k.bidAll())).toBe(true)
  })

  it('follows what each contract call changes', () => {
    const of = (action: string) => keysToInvalidate(k, action, { optionId: 12n, bidId: 3n })
    // Buying turns an open offer into an active option: the list, the reserves split, the writer's open count.
    expect(of('buy')).toEqual([k.options(), k.option(12n), k.collateral(), k.health(), k.balances(), k.writerOpenCountAll()])
    // An exercised option is no longer for sale.
    expect(has(of('exercise'), k.asks())).toBe(true)
    expect(has(of('exercise'), k.ask(12n))).toBe(true)
    expect(has(of('exercise'), k.bids())).toBe(false)
    // A claim and a reclaim leave the book alone.
    for (const a of ['claim-delivery', 'reclaim']) {
      expect(of(a)).toEqual([k.options(), k.option(12n), k.collateral(), k.health(), k.balances()])
    }
    // A request escrows a premium in the contract: reserves move, the option list does not.
    expect(has(of('create-bid'), k.bids())).toBe(true)
    expect(has(of('create-bid'), k.collateral())).toBe(true)
    expect(has(of('create-bid'), k.options())).toBe(false)
    expect(has(of('create-bid'), k.buyerOpenCountAll())).toBe(true)
    // Filling a request creates an option.
    expect(has(of('fill-bid'), k.options())).toBe(true)
    expect(has(of('fill-bid'), k.bid(3n))).toBe(true)
    // Resale changes the holder, not the collateral.
    expect(has(of('buy-resale'), k.collateral())).toBe(false)
    expect(has(of('buy-resale'), k.options())).toBe(true)
    expect(has(of('write-offer'), k.writerOpenCountAll())).toBe(true)
    expect(has(of('cancel-offer'), k.writerOpenCountAll())).toBe(true)
  })

  it('invalidates every Covered read for an action it does not know', () => {
    expect(keysToInvalidate(k, 'other')).toEqual([k.root()])
  })

  it('only touches balances after a Margin call', () => {
    expect(keysAfterMargin(k)).toEqual([k.balances()])
  })
})

describe('subjects', () => {
  it('round-trips option and bid ids', () => {
    expect(optionSubject(12n)).toBe('option:12')
    expect(bidSubject(3n)).toBe('bid:3')
    expect(subjectIds(optionSubject(2n ** 64n))).toEqual({ optionId: 2n ** 64n })
    expect(subjectIds('bid:3')).toEqual({ bidId: 3n })
  })

  it('reads nothing from anything else', () => {
    for (const s of [null, undefined, '', 'series:4', 'option:', 'option:1x', 'option:-1']) expect(subjectIds(s)).toEqual({})
  })
})
