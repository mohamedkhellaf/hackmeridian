import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPTIONS_ERRORS } from '../stellar/errors'
import { MockOptionsClient } from './mockClient'
import type { NewOffer } from './types'

const UNIT = 10_000_000n
const W = 'GWRITER'
const H = 'GHOLDER'
const B = 'GBUYER'
const C = 'GTHIRD'

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

// One active option: written by W, held by H, expiring in an hour.
async function setup() {
  const c = new MockOptionsClient()
  const fund = (await c.supportedAssets()).underlyings[0]
  const offer: NewOffer = {
    kind: 'put', underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT,
    totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 3600,
  }
  const { id } = await run(c.createOffer(offer, W))
  await run(c.buy(id, H))
  return { c, id }
}

describe('MockOptionsClient resale (v1.4 rules)', () => {
  it('list -> buy_resale moves the holder and clears the ask', async () => {
    const { c, id } = await setup()
    expect(await run(c.listAsks())).toEqual([])
    await run(c.listForSale(id, H, 3n * UNIT))
    expect(await run(c.listAsks())).toEqual([{ id, holder: H, askTotal: 3n * UNIT }])
    expect(await c.getAsk(id)).toBe(3n * UNIT)
    const tx = await run(c.buyResale(id, B))
    expect(tx.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await c.getOption(id)).toMatchObject({ holder: B, writer: W, state: 'active' })
    expect(await c.getAsk(id)).toBeNull()
    expect(await run(c.listAsks())).toEqual([])
  })

  it('second buyer gets NoAsk (120)', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.buyResale(id, B))
    await expect(run(c.buyResale(id, C))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('re-listing overwrites the ask', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.listForSale(id, H, 5n * UNIT))
    expect(await run(c.listAsks())).toEqual([{ id, holder: H, askTotal: 5n * UNIT }])
  })

  it('only the holder of an active, unexpired option can list, with a positive ask', async () => {
    const { c, id } = await setup()
    await expect(run(c.listForSale(id, W, UNIT))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.listForSale(id, B, UNIT))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.listForSale(id, H, 0n))).rejects.toThrow(OPTIONS_ERRORS[102])
    await expect(run(c.listForSale(id, H, -1n))).rejects.toThrow(OPTIONS_ERRORS[102])
    // An unsold offer has no holder: not listable.
    const fund = (await c.supportedAssets()).underlyings[0]
    const { id: open } = await run(
      c.createOffer({ kind: 'call', underlying: fund, underlyingQty: UNIT, totalStrike: UNIT, totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 600 }, W),
    )
    await expect(run(c.listForSale(open, W, UNIT))).rejects.toThrow()
    // Expired.
    await vi.advanceTimersByTimeAsync(3600 * 1000)
    await expect(run(c.listForSale(id, H, UNIT))).rejects.toThrow(OPTIONS_ERRORS[109])
  })

  it('seller and writer cannot buy (SelfTrade 111)', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await expect(run(c.buyResale(id, H))).rejects.toThrow(OPTIONS_ERRORS[111])
    await expect(run(c.buyResale(id, W))).rejects.toThrow(OPTIONS_ERRORS[111])
    expect(await c.getAsk(id)).toBe(UNIT)
  })

  it('cancel_sale: holder only; then NoAsk on buy and on a second cancel', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await expect(run(c.cancelSale(id, B))).rejects.toThrow(OPTIONS_ERRORS[108])
    await run(c.cancelSale(id, H))
    expect(await c.getAsk(id)).toBeNull()
    await expect(run(c.buyResale(id, B))).rejects.toThrow(OPTIONS_ERRORS[120])
    await expect(run(c.cancelSale(id, H))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('the ask disappears on exercise and on expiry', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.exercise(id, H))
    expect(await run(c.listAsks())).toEqual([])
    await expect(run(c.buyResale(id, B))).rejects.toThrow(OPTIONS_ERRORS[120])

    const s = await setup()
    await run(s.c.listForSale(s.id, H, UNIT))
    await vi.advanceTimersByTimeAsync(3600 * 1000)
    expect(await run(s.c.listAsks())).toEqual([])
    await expect(run(s.c.buyResale(s.id, B))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('the new holder can exercise and re-list; the old holder cannot', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.buyResale(id, B))
    await expect(run(c.listForSale(id, H, UNIT))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.exercise(id, H))).rejects.toThrow()
    await run(c.listForSale(id, B, 2n * UNIT))
    expect(await c.getAsk(id)).toBe(2n * UNIT)
    await run(c.exercise(id, B))
    expect((await c.getOption(id)).state).toBe('exercised')
  })
})
