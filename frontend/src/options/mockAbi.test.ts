import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOptionsClient } from './mockClient'
import type { NewOffer } from './types'

const UNIT = 10_000_000n
const W = 'GWRITER'
const B = 'GBUYER'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

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
  const fund = (await c.supportedAssets()).underlyings[0]
  const offer = (over: Partial<NewOffer> = {}): NewOffer => ({
    kind: 'put', underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT,
    totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 3600, ...over,
  })
  return { c, fund, offer }
}

// Behaviour added to match docs/contract-abi.md.
describe('MockOptionsClient ABI alignment', () => {
  it('exercised -> claimDelivery -> settled; writer only, once', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await run(c.buy(id, B))
    await expect(run(c.claimDelivery(id, W))).rejects.toThrow('Nothing to claim')
    await run(c.exercise(id, B))
    await expect(run(c.claimDelivery(id, B))).rejects.toThrow('Only the writer')
    await run(c.claimDelivery(id, W))
    expect((await c.getOption(id)).state).toBe('settled')
    await expect(run(c.claimDelivery(id, W))).rejects.toThrow('Nothing to claim')
    await expect(run(c.reclaim(id, W))).rejects.toThrow()
  })

  it('exercised proceeds count as unclaimed until claimed', async () => {
    const { c, fund, offer } = await setup()
    const get = async () =>
      (await c.openCollateral()).find((l) => l.token.contractId === fund.contractId)?.unclaimed ?? 0n
    const base = await get()
    const { id } = await run(c.createOffer(offer({ kind: 'put' }), W))
    await run(c.buy(id, B))
    await run(c.exercise(id, B))
    expect((await get()) - base).toBe(2n * UNIT) // put: writer receives the underlying qty
    await run(c.claimDelivery(id, W))
    expect(await get()).toBe(base)
  })

  it('writer cannot buy their own offer', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await expect(run(c.buy(id, W))).rejects.toThrow('own offer')
  })

  it('unsold offer can be cancelled after expiry (and reclaimed instead)', async () => {
    const { c, offer } = await setup()
    const a = await run(c.createOffer(offer(), W))
    const b = await run(c.createOffer(offer(), W))
    await advanceDays(1)
    expect((await c.getOption(a.id)).state).toBe('expired')
    await run(c.cancelOffer(a.id, W))
    expect((await c.getOption(a.id)).state).toBe('cancelled')
    await run(c.reclaim(b.id, W))
    expect((await c.getOption(b.id)).state).toBe('reclaimed')
  })

  it('collateralHealth reports reserved == held and isEligible is true', async () => {
    const { c, offer } = await setup()
    await run(c.createOffer(offer(), W))
    const health = await c.collateralHealth()
    expect(health.length).toBeGreaterThan(0)
    for (const h of health) expect(h.held).toBe(h.reserved)
    expect(await c.isEligible('C_MOCK_FUND', W)).toBe(true)
  })
})
