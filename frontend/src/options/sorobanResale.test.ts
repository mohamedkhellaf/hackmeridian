import { describe, expect, it } from 'vitest'
import type { AbiAsk } from './abi'
import { SorobanOptionsClient } from './sorobanClient'

// SorobanOptionsClient with its bound contract client replaced by a fake: no network. `read` only needs
// `{ result }` (no simulation error); `write` is stubbed so no signing happens.
type Fake = Record<string, unknown>
const tx = <T,>(result: T) => Promise.resolve({ result, simulation: undefined })

function clientWith(fake: Fake) {
  const c = new SorobanOptionsClient('CFAKE', { address: 'GME', sign: async (x: string) => x, signAuthEntry: async (x: string) => x })
  const internals = c as unknown as {
    client: () => Promise<Fake>
    write: (call: (b: Fake) => Promise<{ result: unknown }>) => Promise<{ hash: string; result: unknown }>
  }
  internals.client = async () => fake
  internals.write = async (call) => ({ hash: 'h'.repeat(64), result: (await call(fake)).result })
  return c
}

// A v1.4 fake: option_count = n; one ask on every 7th id.
function v14(n: number) {
  const calls: { from: number; limit: number }[] = []
  const fake: Fake = {
    option_count: () => tx(n),
    list_for_sale: () => tx(null),
    list_asks: ({ from, limit }: { from: number; limit: number }) => {
      calls.push({ from, limit })
      const out: AbiAsk[] = []
      for (let id = from; id < Math.min(from + limit, n); id++) if (id % 7 === 0) out.push({ id, holder: 'GH', ask_total: BigInt(id + 1) })
      return tx(out)
    },
  }
  return { fake, calls }
}

describe('SorobanOptionsClient.listAsks', () => {
  it.each([
    [0, []],
    [50, [0]],
    [51, [0, 50]],
  ])('option_count %i pages list_asks from %j (limit 50)', async (n, froms) => {
    const { fake, calls } = v14(n)
    const asks = await clientWith(fake).listAsks()
    expect(calls.map((x) => x.from)).toEqual(froms)
    expect(calls.every((x) => x.limit === 50)).toBe(true)
    const expected = Array.from({ length: n }, (_, i) => i).filter((i) => i % 7 === 0)
    expect(asks?.map((a) => a.id)).toEqual(expected.map(BigInt))
    expect(asks?.[0]?.askTotal).toBe(n ? 1n : undefined)
  })

  it('advances by the page size even when a page returns fewer asks', async () => {
    const { fake, calls } = v14(120)
    const asks = await clientWith(fake).listAsks()
    expect(calls.map((x) => x.from)).toEqual([0, 50, 100])
    expect(asks).toHaveLength(Math.ceil(120 / 7))
  })

  it('returns null on a contract without resale (before v1.4), without reading anything', async () => {
    let reads = 0
    const fake: Fake = { option_count: () => ((reads += 1), tx(3)), get_options: () => ((reads += 1), tx([])) }
    const c = clientWith(fake)
    expect(await c.listAsks()).toBeNull()
    expect(await c.getAsk(1n)).toBeNull()
    expect(reads).toBe(0)
    await expect(c.buyResale(1n, 'GB', 5n)).rejects.toThrow(/needs v1\.4/)
  })
})

describe('SorobanOptionsClient resale writes', () => {
  it('buy_resale passes buyer, u32 id and max_total; list_for_sale passes ask_total', async () => {
    const seen: Record<string, unknown> = {}
    const fake: Fake = {
      list_for_sale: (a: unknown) => ((seen.list = a), tx(null)),
      buy_resale: (a: unknown) => ((seen.buy = a), tx(null)),
      cancel_sale: (a: unknown) => ((seen.cancel = a), tx(null)),
    }
    const c = clientWith(fake)
    await c.listForSale(4n, 'GH', 30_000_000n)
    await c.buyResale(4n, 'GB', 30_000_000n)
    await c.cancelSale(4n, 'GH')
    expect(seen).toEqual({
      list: { holder: 'GH', id: 4, ask_total: 30_000_000n },
      buy: { buyer: 'GB', id: 4, max_total: 30_000_000n },
      cancel: { holder: 'GH', id: 4 },
    })
  })
})
