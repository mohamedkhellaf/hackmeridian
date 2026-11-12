import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TxError } from '../tx/errors'
import type { TxStage } from '../tx/types'
import { SorobanOptionsClient } from './sorobanClient'

// SorobanOptionsClient with its bound contract client replaced by a fake and the shared RPC server mocked:
// no network. Covers the parts added for the rewrite: token issuers, read sharing, stages and typed refusals.

const queryContract = vi.fn()
vi.mock('../stellar/rpc', () => ({ server: { queryContract: (...a: unknown[]) => queryContract(...a) } }))

type Fake = Record<string, unknown>
const tx = <T,>(result: T, simulation?: unknown) => Promise.resolve({ result, simulation })
const ISSUER = 'G'.padEnd(56, 'B')

function clientWith(fake: Fake, address: string | null = 'GME') {
  const c = new SorobanOptionsClient('CFAKE', { address, sign: async (x: string) => x })
  ;(c as unknown as { client: () => Promise<Fake> }).client = async () => fake
  return c
}

function registry(counts: { assetCount: number; optionCount: number; bidCount: number }) {
  return {
    counts,
    fake: {
      config: () => tx({ quote: 'CQ', underlyings: ['CU'] }),
      asset_count: vi.fn(() => tx(1)),
      list_assets: vi.fn(() => tx(['CU'])),
      option_count: vi.fn(() => tx(0)),
      get_options: vi.fn(() => tx([])),
      bid_count: vi.fn(() => tx(0)),
      get_bids: vi.fn(() => tx([])),
    } as Fake & Record<'asset_count' | 'list_assets' | 'option_count' | 'get_options' | 'bid_count' | 'get_bids', ReturnType<typeof vi.fn>>,
  }
}

beforeEach(() => {
  queryContract.mockReset()
  queryContract.mockImplementation(async (id: string, fn: string) => {
    if (fn === 'symbol') return { result: id === 'CQ' ? 'USDx' : 'BOND' }
    if (fn === 'decimals') return { result: 7 }
    if (fn === 'name') return { result: id === 'CQ' ? `USDx:${ISSUER}` : `BOND:${ISSUER}` }
    throw new Error(`unexpected ${fn}`)
  })
})

describe('SorobanOptionsClient token info', () => {
  it('carries the classic issuer of each token, read once from the SAC name', async () => {
    const { fake } = registry({ assetCount: 1, optionCount: 0, bidCount: 0 })
    const c = clientWith(fake)
    const assets = await c.supportedAssets()
    expect(assets.quote).toEqual({ contractId: 'CQ', code: 'USDx', decimals: 7, issuer: ISSUER })
    expect(assets.underlyings).toEqual([{ contractId: 'CU', code: 'BOND', decimals: 7, issuer: ISSUER }])
    await c.supportedAssets()
    expect(queryContract.mock.calls.filter((a) => a[1] === 'name')).toHaveLength(2) // one per token, cached
  })

  it('leaves the issuer out for the native asset and when the name cannot be read', async () => {
    queryContract.mockImplementation(async (id: string, fn: string) => {
      if (fn === 'symbol') return { result: 'X' }
      if (fn === 'decimals') return { result: 7 }
      if (id === 'CQ') return { result: 'native' }
      throw new Error('rpc down')
    })
    const { fake } = registry({ assetCount: 1, optionCount: 0, bidCount: 0 })
    const assets = await clientWith(fake).supportedAssets()
    expect(assets.quote).toEqual({ contractId: 'CQ', code: 'X', decimals: 7 })
    expect(assets.underlyings[0]).toEqual({ contractId: 'CU', code: 'X', decimals: 7 })
  })
})

describe('SorobanOptionsClient read sharing', () => {
  it('reads the asset registry once for a whole refresh round', async () => {
    const { fake } = registry({ assetCount: 1, optionCount: 0, bidCount: 0 })
    const c = clientWith(fake)
    await Promise.all([c.listOptions(), c.supportedAssets(), c.openCollateral(), c.listBids()])
    expect(fake.asset_count).toHaveBeenCalledTimes(1)
    expect(fake.list_assets).toHaveBeenCalledTimes(1)
  })

  it('shares the option and request reads that run at the same time, and reads again afterwards', async () => {
    const { fake } = registry({ assetCount: 1, optionCount: 0, bidCount: 0 })
    const c = clientWith(fake)
    await Promise.all([c.listOptions(), c.openCollateral(), c.listBids()])
    expect(fake.option_count).toHaveBeenCalledTimes(1)
    expect(fake.bid_count).toHaveBeenCalledTimes(1)
    await c.listOptions()
    expect(fake.option_count).toHaveBeenCalledTimes(2)
  })

  it('openCollateral includes escrowed request premiums and survives a failed request read', async () => {
    const { fake } = registry({ assetCount: 1, optionCount: 0, bidCount: 1 })
    fake.bid_count = vi.fn(() => tx(1))
    fake.get_bids = vi.fn(() =>
      tx([{ id: 0, buyer: 'GB', kind: { tag: 'Put', values: undefined }, underlying: 'CU', quote: 'CQ', qty: 10n, strike_total: 100n, premium_total: 7n, expiry: 9_999_999_999n, state: { tag: 'Open', values: undefined }, option_id: undefined }]),
    )
    const lines = await clientWith(fake).openCollateral()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ token: { contractId: 'CQ' }, escrowed: 7n, offered: 0n })
    fake.bid_count = vi.fn(() => Promise.reject(new Error('rpc down')))
    expect(await clientWith(fake).openCollateral()).toEqual([])
  })
})

describe('SorobanOptionsClient writes', () => {
  it('reports checking and stops with a "refused" TxError when the simulation fails: nothing reaches the wallet', async () => {
    const sign = vi.fn(async (x: string) => x)
    const c = new SorobanOptionsClient('CFAKE', { address: 'GME', sign })
    ;(c as unknown as { client: () => Promise<Fake> }).client = async () => ({ buy: () => tx(null, { error: 'HostError: Error(Contract, #109)' }) })
    const stages: TxStage[] = []
    const e = await c.buy(1n, 'GME', { onStage: (s) => stages.push(s) }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(TxError)
    expect(e).toMatchObject({ kind: 'refused', hash: null, message: 'This option has expired.' })
    expect(stages).toEqual([{ stage: 'checking' }])
    expect(sign).not.toHaveBeenCalled()
  })

  it('refuses a write without a connected wallet before anything is simulated', async () => {
    const buy = vi.fn(() => tx(null))
    const c = clientWith({ buy }, null)
    const stages: TxStage[] = []
    const e = await c.buy(1n, 'GME', { onStage: (s) => stages.push(s) }).catch((x: unknown) => x)
    expect(e).toMatchObject({ kind: 'refused', message: 'Connect a wallet first.' })
    expect(buy).not.toHaveBeenCalled()
    expect(stages).toEqual([])
  })

  it('keeps a TxError from the signer as it is, so the caller sees where the transaction stopped', async () => {
    const c = clientWith({ exercise: () => tx(null) })
    const unknown = new TxError('unknown', 'Not confirmed yet.', { hash: 'ab'.repeat(32), maxTime: 99 })
    ;(c as unknown as { write: () => Promise<never> }).write = () => Promise.reject(unknown)
    await expect(c.exercise(1n, 'GME')).rejects.toBe(unknown)
  })

  it('passes the stage callback through every write and returns the ledger', async () => {
    const c = clientWith({})
    const seen: unknown[] = []
    ;(c as unknown as { write: (call: unknown, opts?: unknown) => Promise<unknown> }).write = async (_call, opts) => {
      seen.push(opts)
      return { hash: 'h'.repeat(64), ledger: 12, result: 3 }
    }
    ;(c as unknown as { bidClient: () => Promise<Fake> }).bidClient = async () => ({})
    ;(c as unknown as { config: () => Promise<unknown> }).config = async () => ({ quote: 'CQ', underlyings: [] })
    ;(c as unknown as { client: () => Promise<Fake> }).client = async () => ({ list_for_sale: () => tx(null) })
    const opts = { onStage: () => {} }
    const offer = { kind: 'put' as const, underlying: { contractId: 'CU', code: 'BOND', decimals: 7 }, underlyingQty: 1n, totalStrike: 1n, totalPremium: 1n, expiry: 10 }
    expect(await c.createOffer(offer, 'GME', opts)).toEqual({ hash: 'h'.repeat(64), ledger: 12, id: 3n })
    await c.buy(1n, 'GME', opts)
    await c.exercise(1n, 'GME', opts)
    await c.reclaim(1n, 'GME', opts)
    await c.cancelOffer(1n, 'GME', opts)
    await c.claimDelivery(1n, 'GME', opts)
    await c.listForSale(1n, 'GME', 5n, opts)
    await c.cancelSale(1n, 'GME', opts)
    await c.buyResale(1n, 'GME', 5n, opts)
    await c.createBid(offer, 'GME', opts)
    await c.cancelBid(1n, 'GME', opts)
    expect(await c.fillBid(1n, 'GME', opts)).toEqual({ hash: 'h'.repeat(64), ledger: 12, optionId: 3n })
    expect(seen).toHaveLength(12)
    expect(seen.every((o) => o === opts)).toBe(true)
  })
})
