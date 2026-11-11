import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { DEMO_WALLETS } from '../core/options/demoAccounts'
import { MockOptionsClient } from '../core/options/mockClient'
import { demoSeed } from '../core/options/mockSeed'
import { preTrade, readPreTradeFacts } from '../core/options/preTrade'
import type { PreTradeAction } from '../core/options/preTrade'
import type { OptionOffer } from '../core/options/types'
import { FIXED_MS, FIXED_SEC } from './derived/demoSource.testhelper'
import { keys } from './keys'
import { createQueryClient } from './queryClient'
import { factOf, needsEligibility, optionIdOf, readFreshFacts, underlyingOf } from './usePreTrade'

const A = DEMO_WALLETS.a
const B = DEMO_WALLETS.b

let client: MockOptionsClient
let qc: QueryClient
let options: OptionOffer[]
const getClient = async () => client

async function flush<T>(p: Promise<T>): Promise<T> {
  let done = false
  p.then(
    () => (done = true),
    () => (done = true),
  )
  while (!done) await vi.advanceTimersByTimeAsync(50)
  return p
}

beforeAll(() => vi.useFakeTimers({ now: FIXED_MS }))
afterAll(() => vi.useRealTimers())
beforeEach(async () => {
  vi.setSystemTime(FIXED_MS)
  client = new MockOptionsClient(demoSeed(FIXED_SEC))
  qc = createQueryClient(true)
  options = await flush(client.listOptions())
})

describe('factOf', () => {
  const q = <T>(data: T | undefined, isError = false, isPlaceholderData = false) => ({ data, isError, isPlaceholderData })
  it('is undefined for a fact the action does not need', () => {
    expect(factOf(q(5), false)).toBeUndefined()
  })
  it('is undefined while the read is running, also while a placeholder from the list is shown', () => {
    expect(factOf(q(undefined), true)).toBeUndefined()
    expect(factOf(q(5, false, true), true)).toBeUndefined()
  })
  it('is unknown when the read failed, even with an older answer in hand', () => {
    expect(factOf(q(undefined, true), true)).toBe('unknown')
    expect(factOf(q(5, true), true)).toBe('unknown')
  })
  it('is the value once read, including null and false', () => {
    expect(factOf(q(5), true)).toBe(5)
    expect(factOf(q<bigint | null>(null), true)).toBeNull()
    expect(factOf(q(false), true)).toBe(false)
  })
})

describe('action helpers', () => {
  it('name the option, the underlying and the eligibility need of each action', () => {
    const offer = options[6]
    const buy: PreTradeAction = { type: 'buy', offer }
    const exercise: PreTradeAction = { type: 'exercise', option: options[0] }
    const write: PreTradeAction = { type: 'write-offer', offer: { ...offer }, quote: offer.quote }
    expect(optionIdOf(buy)).toBe(6n)
    expect(optionIdOf(exercise)).toBe(0n)
    expect(optionIdOf(write)).toBeNull()
    expect(underlyingOf(buy).code).toBe('FUND')
    expect(needsEligibility(buy)).toBe(true)
    expect(needsEligibility(exercise)).toBe(false)
    expect(needsEligibility({ type: 'list-for-sale', option: options[0], askTotal: 1n })).toBe(false)
  })
})

describe('readFreshFacts: the pre-trade re-check through the cache', () => {
  const maker = () => options.find((o) => o.state === 'offered' && o.writer !== A && o.writer !== B && o.underlying.code === 'FUND' && o.kind === 'put')!

  it('reads the same facts as core readPreTradeFacts and reaches the same verdict', async () => {
    const action: PreTradeAction = { type: 'buy', offer: maker() }
    const viaCache = await flush(readFreshFacts(qc, getClient, action, B, FIXED_SEC))
    const direct = await flush(readPreTradeFacts(client, action, B, FIXED_SEC))
    expect(viaCache).toEqual(direct)
    const result = preTrade(action, viaCache)
    expect(result.blocked).toBe(false)
    expect(result.pending).toBe(false)
    expect(result.state).toMatchObject({ status: 'ok', text: 'Open' })
    expect(result.account?.status).toBe('ok')
    expect(result.funds?.status).toBe('ok')
    expect(result.pays).toEqual({ token: action.offer.quote, amount: action.offer.totalPremium })
  })

  it('writes what it read into the cache, so the hooks that show it update too', async () => {
    const offer = maker()
    await flush(readFreshFacts(qc, getClient, { type: 'buy', offer }, B, FIXED_SEC))
    expect(qc.getQueryData<OptionOffer>(keys.option(offer.id))?.id).toBe(offer.id)
    expect(qc.getQueryData(keys.eligibility(offer.underlying.contractId, B))).toBe(true)
    expect(qc.getQueryData(keys.health())).toBeDefined()
    expect(qc.getQueryData(keys.balancesFor(B, [offer.quote, offer.underlying]))).toBeDefined()
  })

  it('never serves a stale answer: an offer bought meanwhile is seen as gone', async () => {
    const offer = maker()
    const action: PreTradeAction = { type: 'buy', offer }
    const before = preTrade(action, await flush(readFreshFacts(qc, getClient, action, B, FIXED_SEC)))
    expect(before.blocked).toBe(false)
    // Someone else buys it; the cache still holds the open offer.
    await flush(client.buy(offer.id, A))
    expect(qc.getQueryData<OptionOffer>(keys.option(offer.id))?.state).toBe('offered')
    const after = preTrade(action, await flush(readFreshFacts(qc, getClient, action, B, FIXED_SEC)))
    expect(after.blocked).toBe(true)
    expect(after.issues[0]).toMatchObject({ level: 'block', code: 'gone', what: 'offer' })
    expect(after.state).toMatchObject({ status: 'fail', text: 'No longer open' })
    expect(qc.getQueryData<OptionOffer>(keys.option(offer.id))?.state).toBe('active')
  })

  it('reads only what a guest needs, and never blocks a guest on an unread balance', async () => {
    const action: PreTradeAction = { type: 'buy', offer: maker() }
    const facts = await flush(readFreshFacts(qc, getClient, action, null, FIXED_SEC))
    expect(facts.me).toBeNull()
    expect(facts.eligible).toBeUndefined()
    expect(facts.balances).toBeUndefined()
    expect(facts.option).toBeDefined()
    const result = preTrade(action, facts)
    expect(result.blocked).toBe(false)
    expect(result.pending).toBe(false)
    expect(result.funds?.text).toBe('Connect a wallet to check')
  })

  it('marks a failed read unknown instead of throwing, and unknown never blocks', async () => {
    const offer = maker()
    const broken = Object.create(client) as MockOptionsClient
    broken.getOption = () => Promise.reject(new Error('RPC 503'))
    broken.isEligible = () => Promise.reject(new Error('RPC 503'))
    broken.balances = () => Promise.reject(new Error('RPC 503'))
    broken.collateralHealth = () => Promise.reject(new Error('RPC 503'))
    const action: PreTradeAction = { type: 'buy', offer }
    const facts = await flush(readFreshFacts(qc, async () => broken, action, B, FIXED_SEC))
    expect(facts.option).toBe('unknown')
    expect(facts.eligible).toBe('unknown')
    expect(facts.balances).toEqual({})
    expect(facts.health).toEqual([])
    const result = preTrade(action, facts)
    expect(result.blocked).toBe(false)
    expect(result.state?.status).toBe('unknown')
  })

  it('reads the caps and the open offers for a new offer, and the live ask for a resale', async () => {
    const offer = options[6]
    const write: PreTradeAction = { type: 'write-offer', offer: { kind: offer.kind, underlying: offer.underlying, underlyingQty: offer.underlyingQty, totalStrike: offer.totalStrike, totalPremium: offer.totalPremium, expiry: offer.expiry }, quote: offer.quote }
    const facts = await flush(readFreshFacts(qc, getClient, write, A, FIXED_SEC))
    expect(facts.writerOpenCount).toBe(1)
    expect(facts.openOffers!.length).toBeGreaterThan(50)
    expect(facts.openOffers!.every((o) => o.state === 'offered')).toBe(true)
    expect(facts.option).toBeUndefined()

    const listed = options[9]
    const ask = (await flush(client.listAsks()))![0]
    const resale = await flush(readFreshFacts(qc, getClient, { type: 'buy-resale', option: listed, ask }, B, FIXED_SEC))
    expect(resale.liveAsk).toBe(ask.askTotal)
    expect(preTrade({ type: 'buy-resale', option: listed, ask }, resale).state).toMatchObject({ status: 'ok', text: 'For sale' })
  })
})
