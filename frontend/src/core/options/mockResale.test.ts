import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPTIONS_ERRORS } from '../stellar/errors'
import { MockOptionsClient } from './mockClient'
import type { NewOffer } from './types'

const UNIT = 10_000_000n
const W = 'GWRITER'
const H = 'GHOLDER'
const B = 'GBUYER'
const C = 'GTHIRD'
const MAX = 1_000n * UNIT

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
  return { c, id, fund }
}

describe('MockOptionsClient resale (v1.4 rules)', () => {
  it('list -> buy_resale moves the holder and clears the ask', async () => {
    const { c, id } = await setup()
    expect(await run(c.listAsks())).toEqual([])
    await run(c.listForSale(id, H, 3n * UNIT))
    expect(await run(c.listAsks())).toEqual([{ id, holder: H, askTotal: 3n * UNIT }])
    expect(await c.getAsk(id)).toBe(3n * UNIT)
    const tx = await run(c.buyResale(id, B, 3n * UNIT))
    expect(tx.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await c.getOption(id)).toMatchObject({ holder: B, writer: W, state: 'active' })
    expect(await c.getAsk(id)).toBeNull()
    expect(await run(c.listAsks())).toEqual([])
  })

  it('second buyer gets NoAsk (120)', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.buyResale(id, B, UNIT))
    await expect(run(c.buyResale(id, C, MAX))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('PriceMoved (121) when the ask is above max_total; at or below it succeeds', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, 2n * UNIT))
    await run(c.listForSale(id, H, 3n * UNIT)) // re-priced after the buyer saw 2
    await expect(run(c.buyResale(id, B, 2n * UNIT))).rejects.toThrow(OPTIONS_ERRORS[121])
    expect((await c.getOption(id)).holder).toBe(H)
    await run(c.listForSale(id, H, UNIT)) // lowered: still within the buyer's max
    await run(c.buyResale(id, B, 2n * UNIT))
    expect((await c.getOption(id)).holder).toBe(B)
  })

  it('re-listing overwrites the ask', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.listForSale(id, H, 5n * UNIT))
    expect(await run(c.listAsks())).toEqual([{ id, holder: H, askTotal: 5n * UNIT }])
  })

  it('list_for_sale check order: NotFound -> WrongState -> NotHolder -> Expired -> InvalidArgs', async () => {
    const { c, id, fund } = await setup()
    await expect(run(c.listForSale(99n, H, 0n))).rejects.toThrow(OPTIONS_ERRORS[101])
    // An unsold offer is in the wrong state, whoever asks and whatever the price.
    const { id: open } = await run(
      c.createOffer({ kind: 'call', underlying: fund, underlyingQty: UNIT, totalStrike: UNIT, totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 7200 }, W),
    )
    await expect(run(c.listForSale(open, B, 0n))).rejects.toThrow(OPTIONS_ERRORS[106])
    await expect(run(c.listForSale(id, W, 0n))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.listForSale(id, B, UNIT))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.listForSale(id, H, 0n))).rejects.toThrow(OPTIONS_ERRORS[102])
    await expect(run(c.listForSale(id, H, -1n))).rejects.toThrow(OPTIONS_ERRORS[102])
    await vi.advanceTimersByTimeAsync(3600 * 1000)
    await expect(run(c.listForSale(id, H, 0n))).rejects.toThrow(OPTIONS_ERRORS[109])
  })

  it('seller and writer cannot buy (SelfTrade 111)', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await expect(run(c.buyResale(id, H, MAX))).rejects.toThrow(OPTIONS_ERRORS[111])
    await expect(run(c.buyResale(id, W, MAX))).rejects.toThrow(OPTIONS_ERRORS[111])
    expect(await c.getAsk(id)).toBe(UNIT)
  })

  it('cancel_sale: holder only; then NoAsk on buy and on a second cancel', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await expect(run(c.cancelSale(id, B))).rejects.toThrow(OPTIONS_ERRORS[108])
    await run(c.cancelSale(id, H))
    expect(await c.getAsk(id)).toBeNull()
    await expect(run(c.buyResale(id, B, MAX))).rejects.toThrow(OPTIONS_ERRORS[120])
    await expect(run(c.cancelSale(id, H))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('after expiry: the ask is hidden, buy fails with Expired (109), the holder can still cancel', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await vi.advanceTimersByTimeAsync(3600 * 1000)
    expect(await run(c.listAsks())).toEqual([])
    expect(await c.getAsk(id)).toBeNull()
    await expect(run(c.buyResale(id, B, MAX))).rejects.toThrow(OPTIONS_ERRORS[109])
    await run(c.cancelSale(id, H))
    await expect(run(c.cancelSale(id, H))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('the ask disappears on exercise', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.exercise(id, H))
    expect(await run(c.listAsks())).toEqual([])
    await expect(run(c.buyResale(id, B, MAX))).rejects.toThrow(OPTIONS_ERRORS[120])
  })

  it('the new holder can exercise and re-list; the old holder cannot', async () => {
    const { c, id } = await setup()
    await run(c.listForSale(id, H, UNIT))
    await run(c.buyResale(id, B, UNIT))
    await expect(run(c.listForSale(id, H, UNIT))).rejects.toThrow(OPTIONS_ERRORS[108])
    await expect(run(c.exercise(id, H))).rejects.toThrow()
    await run(c.listForSale(id, B, 2n * UNIT))
    expect(await c.getAsk(id)).toBe(2n * UNIT)
    await run(c.exercise(id, B))
    expect((await c.getOption(id)).state).toBe('exercised')
  })
})
