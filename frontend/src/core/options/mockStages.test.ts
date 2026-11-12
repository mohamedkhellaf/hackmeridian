import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TxError } from '../tx/errors'
import { TX_IDLE, reduce, runMachine } from '../tx/machine'
import type { TxStage } from '../tx/types'
import { MOCK_CONTRACT, MOCK_READ_MS, MOCK_TX_MS, MockOptionsClient } from './mockClient'
import { bareSeed } from './mockSeed'
import { OPTIONS_ERRORS } from '../stellar/errors'
import type { NewOffer, TokenInfo } from './types'

const UNIT = 10_000_000n
const W = 'GWRITER'
const B = 'GBUYER'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function run<T>(p: Promise<T>, ms = 1000): Promise<T> {
  const settled = p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  )
  await vi.advanceTimersByTimeAsync(ms)
  const r = await settled
  if (!r.ok) throw r.e
  return r.v
}

async function setup() {
  const c = new MockOptionsClient(bareSeed())
  const assets = await c.supportedAssets()
  const fund = assets.underlyings[0]
  const offer = (over: Partial<NewOffer> = {}): NewOffer => ({
    kind: 'put', underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT,
    totalPremium: UNIT, expiry: Math.floor(Date.now() / 1000) + 3600, ...over,
  })
  const bal = async (who: string, t: TokenInfo) => (await c.balances(who, [t]))[0].balance!
  return { c, quote: assets.quote, fund, offer, bal }
}

describe('MockOptionsClient stages', () => {
  it('reports checking, signing, submitting and pending (with the hash) and resolves with that hash', async () => {
    const { c, offer } = await setup()
    const stages: TxStage[] = []
    const res = await run(c.createOffer(offer(), W, { onStage: (s) => stages.push(s) }))
    expect(stages.map((s) => s.stage)).toEqual(['checking', 'signing', 'submitting', 'pending'])
    const pending = stages[3]
    expect(pending.stage === 'pending' && pending.hash).toBe(res.hash)
    expect(pending.stage === 'pending' && pending.maxTime).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(res.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(res.id).toBe(0n)
  })

  it('keeps its timing: a write takes 600 ms and the state changes only at the end', async () => {
    const { c, offer } = await setup()
    expect(MOCK_TX_MS).toBe(600)
    expect(MOCK_READ_MS).toBe(150)
    const seen: string[] = []
    let done = false
    const p = c.createOffer(offer(), W, { onStage: (s) => seen.push(s.stage) }).then(() => (done = true))
    expect(seen).toEqual(['checking'])
    await vi.advanceTimersByTimeAsync(150)
    expect(seen).toEqual(['checking', 'signing'])
    await vi.advanceTimersByTimeAsync(150)
    expect(seen).toEqual(['checking', 'signing', 'submitting'])
    await vi.advanceTimersByTimeAsync(100)
    expect(seen).toEqual(['checking', 'signing', 'submitting', 'pending'])
    await vi.advanceTimersByTimeAsync(199)
    expect(done).toBe(false)
    expect(await run(c.listOptions())).toHaveLength(1)
    await p
    expect(done).toBe(true)
  })

  it('listOptions keeps its 150 ms read delay', async () => {
    const { c } = await setup()
    let read = false
    void c.listOptions().then(() => (read = true))
    await vi.advanceTimersByTimeAsync(149)
    expect(read).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toBe(true)
  })

  it('a refusal stops at checking with a "refused" TxError: the wallet is never asked', async () => {
    const { c, offer } = await setup()
    const stages: string[] = []
    const e = await run(c.createOffer(offer({ totalPremium: 0n }), W, { onStage: (s) => stages.push(s.stage) })).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(TxError)
    expect(e).toMatchObject({ kind: 'refused', hash: null })
    expect(stages).toEqual(['checking'])
  })

  it('two buyers of one offer: the second one is included and refused, with a hash', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    const first = c.buy(id, B)
    const second = c.buy(id, 'GLATE').catch((x: unknown) => x)
    await vi.advanceTimersByTimeAsync(1000)
    await first
    const e = (await second) as TxError
    expect(e).toMatchObject({ kind: 'failed' })
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
    expect((await c.getOption(id)).holder).toBe(B)
  })

  it('drives the machine to confirmed', async () => {
    const { c, offer } = await setup()
    const phases: string[] = []
    const p = runMachine((opts) => c.createOffer(offer(), W, opts), (s) => phases.push(s.phase))
    await vi.advanceTimersByTimeAsync(1000)
    const { state, result } = await p
    expect(phases).toEqual(['checking', 'signing', 'submitting', 'pending', 'confirmed'])
    expect(state.hash).toBe(result?.hash)
  })
})

describe('MockOptionsClient staged outcomes (failNextWith)', () => {
  it('declined stops at signing and changes nothing', async () => {
    const { c, offer } = await setup()
    c.failNextWith('declined')
    const stages: string[] = []
    const e = await run(c.createOffer(offer(), W, { onStage: (s) => stages.push(s.stage) })).catch((x: unknown) => x)
    expect(e).toMatchObject({ kind: 'declined', hash: null })
    expect(stages).toEqual(['checking', 'signing'])
    expect(await run(c.listOptions())).toHaveLength(0)
    // The switch applies to one write only.
    await expect(run(c.createOffer(offer(), W))).resolves.toMatchObject({ id: 0n })
  })

  it('failed and expired stop after pending, carry the hash and change nothing', async () => {
    const { c, offer } = await setup()
    for (const kind of ['failed', 'expired'] as const) {
      c.failNextWith(kind)
      const e = (await run(c.createOffer(offer(), W)).catch((x: unknown) => x)) as TxError
      expect(e.kind).toBe(kind)
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/)
      // A later check tells the same story.
      expect((await c.checkTx(e.hash!, e.maxTime)).status).toBe(kind)
    }
    expect(await run(c.listOptions())).toHaveLength(0)
  })

  it('checkTx remembers a confirmed transaction and knows nothing about a foreign hash', async () => {
    const { c, offer } = await setup()
    const { hash } = await run(c.createOffer(offer(), W))
    expect(await c.checkTx(hash, null)).toEqual({ status: 'confirmed', ledger: null })
    expect(await c.checkTx('ff'.repeat(32), null)).toEqual({ status: 'unknown' })
  })

  it('an undecided transaction fails at the later check when the state has moved on', async () => {
    const { c, offer } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    c.failNextWith('unknown')
    const e = (await run(c.buy(id, B)).catch((x: unknown) => x)) as TxError
    expect(e.kind).toBe('unknown')
    await run(c.buy(id, 'GFIRST')) // someone else buys it meanwhile
    expect(await c.checkTx(e.hash!, e.maxTime)).toEqual({ status: 'failed', message: OPTIONS_ERRORS[106] })
    expect((await c.getOption(id)).holder).toBe('GFIRST')
  })

  it('unknown holds the change back until checkTx, which confirms it', async () => {
    const { c, offer } = await setup()
    c.failNextWith('unknown')
    const p = runMachine((opts) => c.createOffer(offer(), W, opts), () => {})
    await vi.advanceTimersByTimeAsync(1000)
    const { state } = await p
    expect(state).toMatchObject({ phase: 'unknown', effect: 'outcome-unknown' })
    expect(state.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await run(c.listOptions())).toHaveLength(0)
    const check = await c.checkTx(state.hash!, state.maxTime)
    expect(check).toEqual({ status: 'confirmed', ledger: null })
    expect(reduce(state, { type: 'resolve', check }).phase).toBe('confirmed')
    expect(await run(c.listOptions())).toHaveLength(1)
    expect(reduce(TX_IDLE, { type: 'start' }).phase).toBe('checking')
  })
})

describe('MockOptionsClient demo ledger', () => {
  it('moves collateral and premium for a put from write to claim, and the contract holds what it reserves', async () => {
    const { c, quote, fund, offer, bal } = await setup()
    const w0 = await bal(W, quote)
    const b0 = await bal(B, quote)
    const bf0 = await bal(B, fund)
    const wf0 = await bal(W, fund)
    const held = async (t: TokenInfo) => (await c.collateralHealth()).find((h) => h.token.contractId === t.contractId)

    const { id } = await run(c.createOffer(offer(), W)) // locks 20 USDx
    expect(await bal(W, quote)).toBe(w0 - 20n * UNIT)
    expect(await bal(MOCK_CONTRACT, quote)).toBe(20n * UNIT)
    expect(await held(quote)).toMatchObject({ reserved: 20n * UNIT, held: 20n * UNIT })

    await run(c.buy(id, B)) // premium 1 USDx to the writer
    expect(await bal(B, quote)).toBe(b0 - UNIT)
    expect(await bal(W, quote)).toBe(w0 - 20n * UNIT + UNIT)

    await run(c.exercise(id, B)) // holder delivers 2 RWA, receives 20 USDx
    expect(await bal(B, fund)).toBe(bf0 - 2n * UNIT)
    expect(await bal(B, quote)).toBe(b0 - UNIT + 20n * UNIT)
    expect(await bal(MOCK_CONTRACT, fund)).toBe(2n * UNIT)
    expect(await held(fund)).toMatchObject({ reserved: 2n * UNIT, held: 2n * UNIT })
    expect(await bal(W, fund)).toBe(wf0) // nothing reaches the writer until the claim

    await run(c.claimDelivery(id, W)) // the put writer claims the delivered underlying
    expect(await bal(W, fund)).toBe(wf0 + 2n * UNIT)
    expect(await bal(MOCK_CONTRACT, fund)).toBe(0n)
    expect(await bal(MOCK_CONTRACT, quote)).toBe(0n)
  })

  it('a call writer also has to claim after an exercise: the strike paid in the quote token', async () => {
    const { c, quote, fund, offer, bal } = await setup()
    const w0 = await bal(W, quote)
    const wf0 = await bal(W, fund)
    const { id } = await run(c.createOffer(offer({ kind: 'call' }), W)) // locks 2 RWA
    expect(await bal(W, fund)).toBe(wf0 - 2n * UNIT)
    await run(c.buy(id, B))
    await run(c.exercise(id, B)) // holder pays 20 USDx, receives 2 RWA
    expect((await c.getOption(id)).state).toBe('exercised')
    expect(await bal(W, quote)).toBe(w0 + UNIT) // premium only: the strike waits in the contract
    expect((await c.openCollateral()).find((l) => l.token.contractId === quote.contractId)?.unclaimed).toBe(20n * UNIT)
    await run(c.claimDelivery(id, W))
    expect(await bal(W, quote)).toBe(w0 + UNIT + 20n * UNIT)
    expect((await c.getOption(id)).state).toBe('settled')
  })

  it('returns collateral on cancel and on reclaim', async () => {
    const { c, quote, offer, bal } = await setup()
    const w0 = await bal(W, quote)
    const a = await run(c.createOffer(offer(), W))
    await run(c.cancelOffer(a.id, W))
    expect(await bal(W, quote)).toBe(w0)
    const b = await run(c.createOffer(offer(), W))
    await vi.advanceTimersByTimeAsync(2 * 3600 * 1000)
    await run(c.reclaim(b.id, W))
    expect(await bal(W, quote)).toBe(w0)
  })

  it('refuses a trade the account cannot pay for, like the token contract would', async () => {
    const seed = bareSeed()
    seed.balances.GPOOR = { [seed.quote.contractId]: UNIT / 2n }
    const c = new MockOptionsClient(seed)
    const fund = seed.underlyings[0]
    const expiry = Math.floor(Date.now() / 1000) + 3600
    const { id } = await run(c.createOffer({ kind: 'put', underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT, totalPremium: UNIT, expiry }, W))
    const e = (await run(c.buy(id, 'GPOOR')).catch((x: unknown) => x)) as TxError
    expect(e.kind).toBe('refused')
    expect(e.message).toBe('Insufficient token balance for this action.')
    expect((await c.getOption(id)).state).toBe('offered')
  })

  it('escrows a request premium, pays it to the filler, refunds it on cancel, and counts it as reserved', async () => {
    const { c, quote, fund, bal } = await setup()
    const expiry = Math.floor(Date.now() / 1000) + 3600
    const bid = { kind: 'put' as const, underlying: fund, underlyingQty: 2n * UNIT, totalStrike: 20n * UNIT, totalPremium: 3n * UNIT, expiry }
    const b0 = await bal(B, quote)
    const w0 = await bal(W, quote)
    const first = await run(c.createBid(bid, B))
    expect(await bal(B, quote)).toBe(b0 - 3n * UNIT)
    const line = (await c.openCollateral()).find((l) => l.token.contractId === quote.contractId)
    expect(line?.escrowed).toBe(3n * UNIT)
    expect((await c.collateralHealth())[0]).toMatchObject({ reserved: 3n * UNIT, held: 3n * UNIT })
    await run(c.cancelBid(first.id, B))
    expect(await bal(B, quote)).toBe(b0)

    const second = await run(c.createBid(bid, B))
    await run(c.fillBid(second.id, W)) // writer locks 20, receives 3
    expect(await bal(W, quote)).toBe(w0 - 20n * UNIT + 3n * UNIT)
    const after = (await c.openCollateral()).find((l) => l.token.contractId === quote.contractId)
    expect(after).toMatchObject({ escrowed: 0n, active: 20n * UNIT })
  })

  it('pays the seller on a resale', async () => {
    const { c, quote, offer, bal } = await setup()
    const { id } = await run(c.createOffer(offer(), W))
    await run(c.buy(id, B))
    await run(c.listForSale(id, B, 4n * UNIT))
    const s0 = await bal(B, quote)
    const n0 = await bal('GNEW', quote)
    await run(c.buyResale(id, 'GNEW', 4n * UNIT))
    expect(await bal(B, quote)).toBe(s0 + 4n * UNIT)
    expect(await bal('GNEW', quote)).toBe(n0 - 4n * UNIT)
  })

  it('refuses an offer or a request on an asset that is not listed', async () => {
    const { c, offer } = await setup()
    const other: TokenInfo = { contractId: 'C_MOCK_NOPE', code: 'NOPE', decimals: 7 }
    await expect(run(c.createOffer(offer({ underlying: other }), W))).rejects.toThrow(/not supported/)
    await expect(run(c.createBid(offer({ underlying: other }), B))).rejects.toThrow(/not supported/)
  })
})
