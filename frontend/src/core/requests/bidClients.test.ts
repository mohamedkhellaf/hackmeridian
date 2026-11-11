import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOptionsClient } from '../options/mockClient'
import { SorobanOptionsClient } from '../options/sorobanClient'
import { OPTIONS_ERRORS } from '../stellar/errors'
import type { AbiBid } from './abi'
import { fillBlockReason, fillCollateral, marketBids, myOpenBids, perUnit } from './requests'
import type { NewBid } from './types'

const UNIT = 10_000_000n
const A = 'GBUYERA'
const B = 'GMAKERB'

describe('MockOptionsClient bids (v1.5 rules)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function run<T>(p: Promise<T>): Promise<T> {
    const settled = p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e }),
    )
    await vi.advanceTimersByTimeAsync(1000)
    const r = await settled
    if (!r.ok) throw r.e
    return r.v
  }

  async function setup() {
    const c = new MockOptionsClient()
    const fund = (await c.supportedAssets()).underlyings[0]
    const bid = (over: Partial<NewBid> = {}): NewBid => ({
      kind: 'put', underlying: fund, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT,
      totalPremium: 2n * UNIT, expiry: Math.floor(Date.now() / 1000) + 3600, ...over,
    })
    return { c, bid }
  }

  it('create -> fill: the bid is Filled and an Active option exists with holder = buyer, writer = filler', async () => {
    const { c, bid } = await setup()
    const before = (await run(c.listOptions())).length
    const { id } = await run(c.createBid(bid(), A))
    expect((await c.getBid(id)).state).toBe('open')
    expect(await c.buyerOpenCount(A)).toBe(1)
    const { optionId } = await run(c.fillBid(id, B))
    expect(optionId).toBe(BigInt(before))
    const b = await c.getBid(id)
    expect(b.state).toBe('filled')
    expect(b.optionId).toBe(optionId)
    const o = await c.getOption(optionId)
    expect(o).toMatchObject({ state: 'active', holder: A, writer: B, kind: 'put', totalStrike: 50n * UNIT, totalPremium: 2n * UNIT })
    expect(await c.buyerOpenCount(A)).toBe(0)
  })

  it('double fill fails with BidNotOpen (122)', async () => {
    const { c, bid } = await setup()
    const { id } = await run(c.createBid(bid(), A))
    await run(c.fillBid(id, B))
    await expect(run(c.fillBid(id, 'GTHIRD'))).rejects.toThrow(OPTIONS_ERRORS[122])
  })

  it('filling your own request fails with SelfTrade (111)', async () => {
    const { c, bid } = await setup()
    const { id } = await run(c.createBid(bid(), A))
    await expect(run(c.fillBid(id, A))).rejects.toThrow(OPTIONS_ERRORS[111])
  })

  it("cancelling someone else's request fails with NotBidder (123); the buyer can cancel once, then 122", async () => {
    const { c, bid } = await setup()
    const { id } = await run(c.createBid(bid(), A))
    await expect(run(c.cancelBid(id, B))).rejects.toThrow(OPTIONS_ERRORS[123])
    await run(c.cancelBid(id, A))
    expect((await c.getBid(id)).state).toBe('cancelled')
    await expect(run(c.cancelBid(id, A))).rejects.toThrow(OPTIONS_ERRORS[122])
    await expect(run(c.fillBid(id, B))).rejects.toThrow(OPTIONS_ERRORS[122])
  })

  it('fill after expiry fails with Expired (109); the bid reads as expired and can still be cancelled', async () => {
    const { c, bid } = await setup()
    const { id } = await run(c.createBid(bid({ expiry: Math.floor(Date.now() / 1000) + 120 }), A))
    await vi.advanceTimersByTimeAsync(200_000)
    expect((await c.getBid(id)).state).toBe('expired')
    await expect(run(c.fillBid(id, B))).rejects.toThrow(OPTIONS_ERRORS[109])
    await run(c.cancelBid(id, A))
  })

  it('rejects bad terms (102), tenor over 2 years (119) and a 51st open request on one asset (125)', async () => {
    const { c, bid } = await setup()
    await expect(run(c.createBid(bid({ totalPremium: 0n }), A))).rejects.toThrow(OPTIONS_ERRORS[102])
    await expect(run(c.createBid(bid({ expiry: Math.floor(Date.now() / 1000) + 3 * 365 * 86400 }), A))).rejects.toThrow(OPTIONS_ERRORS[119])
    for (let i = 0; i < 50; i++) await run(c.createBid(bid(), A))
    await expect(run(c.createBid(bid(), A))).rejects.toThrow(OPTIONS_ERRORS[125])
  })
})

describe('request helpers', () => {
  const fund = { contractId: 'CF', code: 'FUND', decimals: 7 }
  const usdx = { contractId: 'CU', code: 'USDx', decimals: 7 }
  const mk = (id: bigint, over = {}) => ({
    id, buyer: A, kind: 'put' as const, underlying: fund, quote: usdx, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT,
    totalPremium: 2n * UNIT, expiry: 1000, state: 'open' as const, optionId: null, ...over,
  })

  it('fill collateral: PUT locks the total strike in USDx, CALL locks the underlying', () => {
    expect(fillCollateral(mk(0n))).toEqual({ token: usdx, amount: 50n * UNIT })
    expect(fillCollateral(mk(0n, { kind: 'call' }))).toEqual({ token: fund, amount: 5n * UNIT })
  })

  it('per-unit strike and premium', () => {
    expect(perUnit(50n * UNIT, mk(0n))).toBe('10.00')
    expect(perUnit(2n * UNIT, mk(0n))).toBe('0.40')
  })

  it('fill is blocked for the buyer, a visitor and a non-open or expired request', () => {
    expect(fillBlockReason(mk(0n), B, 10)).toBeNull()
    expect(fillBlockReason(mk(0n), A, 10)).toMatch(/own request/)
    expect(fillBlockReason(mk(0n), null, 10)).toMatch(/Connect/)
    expect(fillBlockReason(mk(0n, { state: 'filled' }), B, 10)).toMatch(/no longer open/)
    expect(fillBlockReason(mk(0n), B, 1000)).toMatch(/no longer open/)
  })

  it('market list hides cancelled/pruned, open first; my open requests include unrefunded expired ones', () => {
    const bids = [mk(0n, { state: 'filled' }), mk(1n, { state: 'cancelled' }), mk(2n), mk(3n, { state: 'expired', buyer: B }), mk(4n, { state: 'pruned' })]
    expect(marketBids(bids).map((b) => b.id)).toEqual([2n, 3n, 0n])
    expect(myOpenBids(bids, A).map((b) => b.id)).toEqual([2n])
    expect(myOpenBids(bids, B).map((b) => b.id)).toEqual([3n])
    expect(myOpenBids(bids, null)).toEqual([])
  })
})

// SorobanOptionsClient with its bound contract client replaced by a fake: no network.
type Fake = Record<string, unknown>
const tx = <T,>(result: T) => Promise.resolve({ result, simulation: undefined })
const RWA = { contractId: 'CRWA', code: 'RWA', decimals: 7 }
const USDX = { contractId: 'CUSDX', code: 'USDx', decimals: 7 }

function clientWith(fake: Fake) {
  const c = new SorobanOptionsClient('CFAKE', { address: 'GME', sign: async (x: string) => x, signAuthEntry: async (x: string) => x })
  const internals = c as unknown as {
    client: () => Promise<Fake>
    write: (call: (b: Fake) => Promise<{ result: unknown }>) => Promise<{ hash: string; result: unknown }>
    tokenMap: () => Promise<Map<string, unknown>>
    config: () => Promise<{ quote: string; underlyings: string[] }>
  }
  internals.client = async () => fake
  internals.write = async (call) => ({ hash: 'h'.repeat(64), result: (await call(fake)).result })
  internals.tokenMap = async () => new Map([[RWA.contractId, RWA], [USDX.contractId, USDX]])
  internals.config = async () => ({ quote: USDX.contractId, underlyings: [RWA.contractId] })
  return c
}

const rawBid = (id: number): AbiBid => ({
  id, buyer: 'GB', kind: { tag: 'Put', values: undefined }, underlying: RWA.contractId, quote: USDX.contractId,
  qty: UNIT, strike_total: 10n * UNIT, premium_total: UNIT, expiry: 4_000_000_000n, state: { tag: 'Open', values: undefined }, option_id: undefined,
})

function v15(n: number) {
  const calls: { from: number; limit: number }[] = []
  const fake: Fake = {
    bid_count: () => tx(n),
    get_bids: ({ from, limit }: { from: number; limit: number }) => {
      calls.push({ from, limit })
      const out: AbiBid[] = []
      for (let id = from; id < Math.min(from + Math.min(limit, 50), n); id++) out.push(rawBid(id))
      return tx(out)
    },
  }
  return { fake, calls }
}

describe('SorobanOptionsClient.listBids', () => {
  it.each([
    [0, []],
    [50, [0]],
    [51, [0, 50]],
  ])('bid_count %i pages get_bids from %j (limit 50)', async (n, froms) => {
    const { fake, calls } = v15(n)
    const bids = await clientWith(fake).listBids()
    expect(calls.map((x) => x.from)).toEqual(froms)
    expect(calls.every((x) => x.limit === 50)).toBe(true)
    expect(bids?.map((b) => b.id)).toEqual(Array.from({ length: n }, (_, i) => BigInt(i)))
    if (n) expect(bids?.[0]).toMatchObject({ kind: 'put', state: 'open', underlying: RWA, quote: USDX, optionId: null })
  })

  it('returns null on a contract without bids (before v1.5), without reading anything; writes refuse', async () => {
    let reads = 0
    const fake: Fake = { option_count: () => ((reads += 1), tx(3)), list_asks: () => ((reads += 1), tx([])) }
    const c = clientWith(fake)
    expect(await c.listBids()).toBeNull()
    expect(await c.buyerOpenCount('GB')).toBeNull()
    expect(reads).toBe(0)
    await expect(c.fillBid(1n, 'GW')).rejects.toThrow(/needs v1\.5/)
    await expect(c.cancelBid(1n, 'GB')).rejects.toThrow(/needs v1\.5/)
  })

  it('writes pass the ABI argument names; create_bid sends the configured quote token', async () => {
    const seen: Record<string, unknown> = {}
    const fake: Fake = {
      bid_count: () => tx(0),
      create_bid: (a: unknown) => ((seen.create = a), tx(7)),
      fill_bid: (a: unknown) => ((seen.fill = a), tx(12)),
      cancel_bid: (a: unknown) => ((seen.cancel = a), tx(null)),
      prune_bids: (a: unknown) => ((seen.prune = a), tx(2)),
    }
    const c = clientWith(fake)
    const created = await c.createBid({ kind: 'call', underlying: RWA, underlyingQty: UNIT, totalStrike: 10n * UNIT, totalPremium: UNIT, expiry: 4_000_000_000 }, 'GB')
    expect(created.id).toBe(7n)
    expect((await c.fillBid(7n, 'GW')).optionId).toBe(12n)
    await c.cancelBid(7n, 'GB')
    expect((await c.pruneBids([1n, 2n], 'GP')).pruned).toBe(2)
    expect(seen).toEqual({
      create: {
        buyer: 'GB', kind: { tag: 'Call', values: undefined }, underlying: RWA.contractId, quote: USDX.contractId,
        qty: UNIT, strike_total: 10n * UNIT, premium_total: UNIT, expiry: 4_000_000_000n,
      },
      fill: { writer: 'GW', id: 7 },
      cancel: { buyer: 'GB', id: 7 },
      prune: { pruner: 'GP', ids: [1, 2] },
    })
  })
})
