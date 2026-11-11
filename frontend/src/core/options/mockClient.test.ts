import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOptionsClient } from './mockClient'
import type { NewOffer } from './types'

const UNIT = 10_000_000n
const W = 'GWRITER'
const B = 'GBUYER'
const X = 'GOTHER'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

// Runs an async client call while advancing the fake clock past its internal delays.
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
const advanceDays = (d: number) => vi.advanceTimersByTimeAsync(d * 86400 * 1000)

async function setup() {
  const c = new MockOptionsClient()
  const assets = await c.supportedAssets()
  const fund = assets.underlyings[0]
  const offer = (over: Partial<NewOffer> = {}): NewOffer => ({
    kind: 'put', underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT,
    totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 3600, ...over,
  })
  return { c, assets, fund, offer }
}

describe('MockOptionsClient lifecycle', () => {
  it('create -> buy -> exercise', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    expect((await c.getOption(id)).state).toBe('offered')
    const tx = await run(c.buy(id, B))
    expect(tx.hash).toMatch(/^[0-9a-f]{64}$/)
    let o = await c.getOption(id)
    expect(o).toMatchObject({ state: 'active', holder: B, writer: W })
    await run(c.exercise(id, B))
    o = await c.getOption(id)
    expect(o.state).toBe('exercised')
  })

  it('assigns sequential ids and lists the new offer', async () => {
    const { c, offer } = await setup()
    const before = (await run(c.listOptions())).length
    const { id } = await run(c.createOffer(offer(), W))
    expect(id).toBe(BigInt(before))
    expect(await run(c.listOptions())).toHaveLength(before + 1)
  })

  it('rejects invalid offers', async () => {
    const { c, offer } = await setup()
    await expect(run(c.createOffer(offer({ underlyingQty: 0n }), W))).rejects.toThrow('positive')
    await expect(run(c.createOffer(offer({ totalStrike: 0n }), W))).rejects.toThrow('positive')
    await expect(run(c.createOffer(offer({ totalPremium: 0n }), W))).rejects.toThrow('positive')
    await expect(run(c.createOffer(offer({ expiry: Math.floor(Date.now() / 1000) - 1 }), W))).rejects.toThrow('future')
  })

  it('cancel by writer only, and only while offered', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await expect(run(c.cancelOffer(id, X))).rejects.toThrow('Only the writer')
    await run(c.cancelOffer(id, W))
    expect((await c.getOption(id)).state).toBe('cancelled')
    await expect(run(c.cancelOffer(id, W))).rejects.toThrow('open offers')
    await expect(run(c.buy(id, B))).rejects.toThrow('no longer available')

    const b = await run(c.createOffer(offer(), W))
    await run(c.buy(b.id, B))
    await expect(run(c.cancelOffer(b.id, W))).rejects.toThrow('open offers')
  })

  it('cannot buy a non-offered option', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await run(c.buy(id, B))
    await expect(run(c.buy(id, X))).rejects.toThrow('no longer available')
  })

  it('only the holder can exercise, and only if active', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await expect(run(c.exercise(id, B))).rejects.toThrow('Only the holder')
    await run(c.buy(id, B))
    await expect(run(c.exercise(id, W))).rejects.toThrow('Only the holder')
    await expect(run(c.exercise(id, X))).rejects.toThrow('Only the holder')
    await run(c.exercise(id, B))
    await expect(run(c.exercise(id, B))).rejects.toThrow('not active')
  })

  it('cannot exercise after expiry', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await run(c.buy(id, B))
    await advanceDays(1)
    expect((await c.getOption(id)).state).toBe('expired')
    await expect(run(c.exercise(id, B))).rejects.toThrow('expired')
  })

  it('cannot buy after expiry', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await advanceDays(1)
    await expect(run(c.buy(id, B))).rejects.toThrow(/no longer available|expired/)
  })

  it('reclaim: writer only, only after expiry, only once', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await run(c.buy(id, B))
    await expect(run(c.reclaim(id, W))).rejects.toThrow('not expired')
    await advanceDays(1)
    await expect(run(c.reclaim(id, B))).rejects.toThrow('Only the writer')
    await run(c.reclaim(id, W))
    expect((await c.getOption(id)).state).toBe('reclaimed')
    await expect(run(c.reclaim(id, W))).rejects.toThrow('Nothing to reclaim')
  })

  it('reclaim works on an unsold expired offer; cannot reclaim exercised/cancelled', async () => {
    const { c, offer } = await setup()
    const a = await run(c.createOffer(offer(), W))
    const b = await run(c.createOffer(offer(), W))
    const d = await run(c.createOffer(offer(), W))
    await run(c.buy(b.id, B))
    await run(c.exercise(b.id, B))
    await run(c.cancelOffer(d.id, W))
    await advanceDays(1)
    await run(c.reclaim(a.id, W))
    await expect(run(c.reclaim(b.id, W))).rejects.toThrow('Nothing to reclaim')
    await expect(run(c.reclaim(d.id, W))).rejects.toThrow('Nothing to reclaim')
  })

  it('throws for unknown ids', async () => {
    const { c } = await setup()
    await expect(c.getOption(999n)).rejects.toThrow('not found')
  })

  it('getOption returns a copy, not live state', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    const o = await c.getOption(id)
    o.state = 'exercised'
    expect((await c.getOption(id)).state).toBe('offered')
  })
})

describe('openCollateral accounting', () => {
  // Seed offers are in 'offered' state; measure deltas against that baseline.
  type Lines = Awaited<ReturnType<MockOptionsClient['openCollateral']>>
  const line = (lines: Lines, id: string) =>
    lines.find((l) => l.token.contractId === id) ?? { offered: 0n, active: 0n, pendingReclaim: 0n, unclaimed: 0n }
  const delta = (lines: Lines, base: ReturnType<typeof line>, id: string) => {
    const l = line(lines, id)
    return [l.offered - base.offered, l.active - base.active, l.pendingReclaim - base.pendingReclaim]
  }

  it('put counts in quote token, call counts in underlying', async () => {
    const { c, assets, fund, offer } = await setup()
    const q = assets.quote.contractId
    const u = fund.contractId
    const base = await c.openCollateral()
    await run(c.createOffer(offer({ kind: 'put' }), W))
    await run(c.createOffer(offer({ kind: 'call' }), W))
    const now = await c.openCollateral()
    expect(line(now, q).offered - line(base, q).offered).toBe(20n * UNIT)
    expect(line(now, u).offered - line(base, u).offered).toBe(2n * UNIT)
  })

  it('moves collateral offered -> active -> pendingReclaim -> gone, with no double counting', async () => {
    const { c, assets, offer } = await setup()
    const q = assets.quote.contractId
    const base = line(await c.openCollateral(), q)
    const amt = 20n * UNIT

    const { id } = await run(c.createOffer(offer(), W))
    expect(delta(await c.openCollateral(), base, q)).toEqual([amt, 0n, 0n])

    await run(c.buy(id, B))
    expect(delta(await c.openCollateral(), base, q)).toEqual([0n, amt, 0n])

    await advanceDays(1) // seeds expire in >= 3 days, so only our option moves
    expect(delta(await c.openCollateral(), base, q)).toEqual([0n, 0n, amt])

    await run(c.reclaim(id, W))
    expect(delta(await c.openCollateral(), base, q)).toEqual([0n, 0n, 0n])
  })

  it('does not count exercised or cancelled options', async () => {
    const { c, assets, offer } = await setup()
    const q = assets.quote.contractId
    const base = line(await c.openCollateral(), q)
    const a = await run(c.createOffer(offer(), W))
    const b = await run(c.createOffer(offer(), W))
    await run(c.buy(a.id, B))
    await run(c.exercise(a.id, B))
    await run(c.cancelOffer(b.id, W))
    expect(line(await c.openCollateral(), q)).toEqual(base)
  })

  it('an unsold offer past expiry counts as pendingReclaim, not offered', async () => {
    const { c, assets, offer } = await setup()
    const q = assets.quote.contractId
    const base = line(await c.openCollateral(), q)
    await run(c.createOffer(offer(), W))
    await advanceDays(1)
    expect(delta(await c.openCollateral(), base, q)).toEqual([0n, 0n, 20n * UNIT])
  })

  it('sums multiple options per token into a single line', async () => {
    const { c, assets, offer } = await setup()
    const q = assets.quote.contractId
    const lines = await c.openCollateral()
    expect(lines.filter((l) => l.token.contractId === q)).toHaveLength(1)
    const base = line(lines, q)
    await run(c.createOffer(offer(), W))
    await run(c.createOffer(offer({ totalStrike: 5n * UNIT }), W))
    expect(delta(await c.openCollateral(), base, q)).toEqual([25n * UNIT, 0n, 0n])
  })
})
