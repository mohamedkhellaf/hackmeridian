import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockOptionsClient } from '../options/mockClient'
import type { Notice } from '../ui'
import { runTx } from './runTx'

const UNIT = 10_000_000n

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2000)
  return p
}

// A client whose reads start failing once a resale went through (e.g. the RPC drops after the tx confirmed).
class FlakyAfterResale extends MockOptionsClient {
  broken = false
  override async buyResale(id: bigint, buyer: string, maxTotal: bigint) {
    const r = await super.buyResale(id, buyer, maxTotal)
    this.broken = true
    return r
  }
  override async listOptions() {
    if (this.broken) throw new Error('RPC unavailable')
    return super.listOptions()
  }
}

describe('runTx', () => {
  it('keeps a confirmed buy_resale ok when the post-tx refresh rejects, and reports the refresh failure', async () => {
    const c = new FlakyAfterResale()
    const [o] = await settle(c.listOptions())
    await settle(c.buy(o.id, 'GHOLDER'))
    await settle(c.listForSale(o.id, 'GHOLDER', 2n * UNIT))

    const notices: (Notice | null)[] = []
    const onSuccess = vi.fn()
    const outcome = await settle(
      runTx('Bought from holder', true, () => c.buyResale(o.id, 'GBUYER', 2n * UNIT), {
        setNotice: (n) => notices.push(n),
        refresh: () => c.listOptions(),
        onSuccess,
      }),
    )
    expect(outcome).toMatchObject({ ok: true, mock: true })
    expect(outcome.ok && outcome.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(onSuccess).toHaveBeenCalledOnce()
    const last = notices[notices.length - 1]
    expect(last).toMatchObject({ kind: 'err' })
    expect(last && last.text).toMatch(/confirmed .*reloading data failed: RPC unavailable/)
    expect((await c.getOption(o.id)).holder).toBe('GBUYER')
  })

  it('a failed transaction stays failed and keeps its own error, even if the refresh also fails', async () => {
    const notices: (Notice | null)[] = []
    const outcome = await runTx('X', false, () => Promise.reject(new Error('NoAsk')), {
      setNotice: (n) => notices.push(n),
      refresh: () => Promise.reject(new Error('RPC down')),
    })
    expect(outcome).toEqual({ ok: false, error: 'NoAsk' })
    expect(notices[notices.length - 1]).toEqual({ kind: 'err', text: 'NoAsk' })
  })

  it('success with a working refresh leaves the ok notice', async () => {
    const notices: (Notice | null)[] = []
    const outcome = await runTx('Listed', false, async () => ({ hash: 'abc' }), {
      setNotice: (n) => notices.push(n),
      refresh: async () => undefined,
    })
    expect(outcome).toEqual({ ok: true, hash: 'abc', mock: false })
    expect(notices[notices.length - 1]).toEqual({ kind: 'ok', text: 'Listed', hash: 'abc', mock: false })
  })
})
