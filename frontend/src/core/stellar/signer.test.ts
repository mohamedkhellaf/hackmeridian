import { describe, expect, it, vi } from 'vitest'
import { TxError } from '../tx/errors'
import type { TxStage } from '../tx/types'
import { checkTransaction, failureText, sendAndWait, signAndSend } from './signer'
import type { TxServer } from './signer'

// signAndSend against a fake AssembledTransaction and a fake RPC: no SDK object, no network, no real waiting.

const HASH_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i)
const LOCAL_HASH = Array.from(HASH_BYTES, (b) => b.toString(16).padStart(2, '0')).join('')
const MAX_TIME = 2_000

function fakeTx(over: { sign?: () => Promise<void>; parse?: (v: unknown) => unknown } = {}) {
  const tx = {
    signed: undefined as unknown,
    options: { parseResultXdr: over.parse ?? ((v: unknown) => v) },
    sign: vi.fn(async () => {
      if (over.sign) await over.sign()
      tx.signed = { hash: () => HASH_BYTES, timeBounds: { minTime: '0', maxTime: String(MAX_TIME) } }
    }),
  }
  return tx as unknown as Parameters<typeof signAndSend>[0] & { sign: ReturnType<typeof vi.fn> }
}

type Send = { status: string; hash?: string; latestLedgerCloseTime?: number; errorResult?: unknown }
type Get = { status: string; ledger?: number; returnValue?: unknown; latestLedgerCloseTime?: number; diagnosticEventsXdr?: unknown }

function fakeServer(sends: (Send | Error)[], gets: (Get | Error)[]) {
  const next = <T,>(list: (T | Error)[]) => {
    const v = list.length > 1 ? list.shift()! : list[0]
    if (v instanceof Error) throw v
    return v
  }
  const server = {
    sendTransaction: vi.fn(async () => next(sends)),
    getTransaction: vi.fn(async () => next(gets)),
  }
  return server as unknown as TxServer & typeof server
}

const run = async (tx: ReturnType<typeof fakeTx>, server: TxServer, opts: { now?: () => number; pollTimeoutMs?: number } = {}) => {
  const stages: TxStage[] = []
  const sleeps: number[] = []
  const p = signAndSend(tx, {
    server,
    onStage: (s) => stages.push(s),
    sleep: async (ms) => void sleeps.push(ms),
    now: opts.now ?? (() => 0),
    pollTimeoutMs: opts.pollTimeoutMs,
  })
  return { p, stages, sleeps }
}

describe('signAndSend', () => {
  it('reports signing, submitting and pending with the hash, then resolves with the result and the ledger', async () => {
    const server = fakeServer([{ status: 'PENDING', hash: 'cd'.repeat(32), latestLedgerCloseTime: 100 }], [{ status: 'NOT_FOUND', latestLedgerCloseTime: 100 }, { status: 'SUCCESS', ledger: 42, returnValue: 'ret' }])
    const { p, stages, sleeps } = await run(fakeTx(), server)
    await expect(p).resolves.toEqual({ hash: 'cd'.repeat(32), result: 'ret', ledger: 42 })
    expect(stages).toEqual([{ stage: 'signing' }, { stage: 'submitting' }, { stage: 'pending', hash: 'cd'.repeat(32), maxTime: MAX_TIME }])
    expect(server.sendTransaction).toHaveBeenCalledTimes(1)
    expect(server.getTransaction).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([1000])
  })

  it('uses the hash of the signed transaction when the RPC returns none', async () => {
    const server = fakeServer([{ status: 'DUPLICATE' }], [{ status: 'SUCCESS', returnValue: 1 }])
    const { p, stages } = await run(fakeTx(), server)
    await expect(p).resolves.toMatchObject({ hash: LOCAL_HASH, ledger: null })
    expect(stages.at(-1)).toEqual({ stage: 'pending', hash: LOCAL_HASH, maxTime: MAX_TIME })
  })

  it('a wallet rejection is declined: nothing is sent', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'SUCCESS' }])
    const tx = fakeTx({ sign: async () => Promise.reject(new Error('You declined to sign in Freighter.')) })
    const { p, stages } = await run(tx, server)
    const e = await p.catch((x: unknown) => x)
    expect(e).toBeInstanceOf(TxError)
    expect(e).toMatchObject({ kind: 'declined', hash: null, message: 'You declined to sign in Freighter.' })
    expect(stages).toEqual([{ stage: 'signing' }])
    expect(server.sendTransaction).not.toHaveBeenCalled()
  })

  it('stopping the wait for a wallet that never answers ends declined, and a late signature sends nothing (finding 42)', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'SUCCESS' }])
    let answer!: () => void
    const tx = fakeTx({ sign: () => new Promise<void>((resolve) => (answer = resolve)) })
    const control = new AbortController()
    const p = signAndSend(tx, { server, signal: control.signal, sleep: async () => {}, now: () => 0 })
    await Promise.resolve()
    control.abort()
    const e = await p.catch((x: unknown) => x)
    expect(e).toMatchObject({ kind: 'declined', hash: null, message: 'You stopped waiting for the wallet. Nothing was signed, so nothing was sent.' })
    answer()
    await new Promise((r) => setTimeout(r, 0))
    expect(server.sendTransaction).not.toHaveBeenCalled()
  })

  it('any other signing failure is refused: nothing is sent', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'SUCCESS' }])
    const tx = fakeTx({ sign: async () => Promise.reject(new Error('Freighter is not installed or not reachable. Install it, unlock it, then try again.')) })
    const e = await (await run(tx, server)).p.catch((x: unknown) => x)
    expect(e).toMatchObject({ kind: 'refused' })
    expect((e as Error).message).toMatch(/not installed/)
    expect(server.sendTransaction).not.toHaveBeenCalled()
  })

  it('a send the node rejects is refused, with the reason and nothing charged', async () => {
    const server = fakeServer([{ status: 'ERROR', errorResult: { result: { type: 'txBadSeq' } } }], [{ status: 'SUCCESS' }])
    const { p, stages } = await run(fakeTx(), server)
    const e = (await p.catch((x: unknown) => x)) as TxError
    expect(e.kind).toBe('refused')
    expect(e.hash).toBe(LOCAL_HASH)
    expect(e.message).toMatch(/went first/)
    expect(stages.map((s) => s.stage)).toEqual(['signing', 'submitting'])
    expect(server.getTransaction).not.toHaveBeenCalled()
  })

  it('names an unmapped node rejection without inventing a cause', async () => {
    const server = fakeServer([{ status: 'ERROR', errorResult: { result: { type: 'txMalformed' } } }], [{ status: 'SUCCESS' }])
    const e = (await (await run(fakeTx(), server)).p.catch((x: unknown) => x)) as TxError
    expect(e.message).toBe('The network did not accept the transaction (txMalformed). Nothing was charged.')
  })

  it('resends the same signed transaction on TRY_AGAIN_LATER while it can still be included', async () => {
    const server = fakeServer([{ status: 'TRY_AGAIN_LATER', latestLedgerCloseTime: 1_000 }, { status: 'TRY_AGAIN_LATER', latestLedgerCloseTime: 1_005 }, { status: 'PENDING' }], [{ status: 'SUCCESS', returnValue: 0 }])
    const { p, sleeps } = await run(fakeTx(), server)
    await expect(p).resolves.toMatchObject({ hash: LOCAL_HASH })
    expect(server.sendTransaction).toHaveBeenCalledTimes(3)
    expect(sleeps.slice(0, 2)).toEqual([2000, 2000])
  })

  it('gives up as expired when TRY_AGAIN_LATER outlasts the time bound', async () => {
    const server = fakeServer([{ status: 'TRY_AGAIN_LATER', latestLedgerCloseTime: MAX_TIME + 1 }], [{ status: 'SUCCESS' }])
    const e = (await (await run(fakeTx(), server)).p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'expired', hash: LOCAL_HASH, maxTime: MAX_TIME })
  })

  it('stops resending a transaction without a time bound after a bounded number of refusals', async () => {
    const server = fakeServer([{ status: 'TRY_AGAIN_LATER', latestLedgerCloseTime: 1 }], [{ status: 'SUCCESS' }])
    const tx = fakeTx()
    tx.sign.mockImplementation(async () => {
      ;(tx as unknown as { signed: unknown }).signed = { hash: () => HASH_BYTES }
    })
    const e = (await (await run(tx, server)).p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'refused', maxTime: null })
    expect(server.sendTransaction).toHaveBeenCalledTimes(30)
    expect(server.getTransaction).not.toHaveBeenCalled()
  })

  it('a network failure while sending is unknown, with the hash, never "failed"', async () => {
    const server = fakeServer([new Error('fetch failed')], [{ status: 'SUCCESS' }])
    const e = (await (await run(fakeTx(), server)).p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'unknown', hash: LOCAL_HASH, maxTime: MAX_TIME })
    expect(e.message).not.toMatch(/try again/i)
  })

  it('NOT_FOUND until the poll window ends is unknown while no ledger has closed after the time bound', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'NOT_FOUND', latestLedgerCloseTime: MAX_TIME - 100 }])
    let t = 0
    const { p, stages } = await run(fakeTx(), server, { now: () => (t += 20_000), pollTimeoutMs: 60_000 })
    const e = (await p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'unknown', hash: LOCAL_HASH, maxTime: MAX_TIME })
    expect(e.message).toMatch(/check again before sending another/)
    expect(stages.at(-1)?.stage).toBe('pending')
  })

  it('NOT_FOUND after a ledger closed past the time bound is expired', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'NOT_FOUND', latestLedgerCloseTime: MAX_TIME - 1 }, { status: 'NOT_FOUND', latestLedgerCloseTime: MAX_TIME + 5 }])
    const e = (await (await run(fakeTx(), server)).p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'expired', hash: LOCAL_HASH })
    expect(e.message).toMatch(/Nothing was charged/)
  })

  it('a transaction that failed in a ledger is failed, and the contract error is decoded', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'FAILED', ledger: 5, diagnosticEventsXdr: [{ event: { body: { v0: { data: { error: { contract: 109 } } } } } }] }])
    const e = (await (await run(fakeTx(), server)).p.catch((x: unknown) => x)) as TxError
    expect(e).toMatchObject({ kind: 'failed', hash: LOCAL_HASH })
    expect(e.message).toBe('This option has expired.')
  })

  it('keeps polling through a failed read', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [new Error('503'), { status: 'SUCCESS', returnValue: 'ok', ledger: 8 }])
    await expect((await run(fakeTx(), server)).p).resolves.toMatchObject({ result: 'ok', ledger: 8 })
  })

  it('an included transaction whose result cannot be decoded is unknown, so a later check confirms it', async () => {
    const server = fakeServer([{ status: 'PENDING' }], [{ status: 'SUCCESS', returnValue: 'x' }])
    const tx = fakeTx({
      parse: () => {
        throw new Error('bad xdr')
      },
    })
    const e = (await (await run(tx, server)).p.catch((x: unknown) => x)) as TxError
    expect(e.kind).toBe('unknown')
    expect(await checkTransaction(server, e.hash!, e.maxTime)).toMatchObject({ status: 'confirmed' })
  })
})

describe('checkTransaction', () => {
  it('maps the four answers', async () => {
    expect(await checkTransaction(fakeServer([], [{ status: 'SUCCESS', ledger: 3 }]), 'h', 10)).toMatchObject({ status: 'confirmed', ledger: 3 })
    expect(await checkTransaction(fakeServer([], [{ status: 'FAILED' }]), 'h', 10)).toMatchObject({ status: 'failed' })
    expect(await checkTransaction(fakeServer([], [{ status: 'NOT_FOUND', latestLedgerCloseTime: 10 }]), 'h', 10)).toEqual({ status: 'unknown' })
    expect(await checkTransaction(fakeServer([], [{ status: 'NOT_FOUND', latestLedgerCloseTime: 11 }]), 'h', 10)).toEqual({ status: 'expired' })
    expect(await checkTransaction(fakeServer([], [new Error('down')]), 'h', 10)).toEqual({ status: 'unknown' })
  })
})

describe('failureText', () => {
  it('finds contract error codes in diagnostic events and falls back to a plain sentence', () => {
    expect(failureText({ diagnosticEventsXdr: [{ a: { error: { contract: 115 } } }, { b: [{ error: { contract: 10 } }] }] })).toBe('Error(Contract, #115) Error(Contract, #10)')
    expect(failureText({})).toMatch(/contract refused it/)
    expect(failureText({ diagnosticEventsXdr: [{ n: 5n }] })).toMatch(/contract refused it/)
  })
})

describe('sendAndWait: the send and poll loop for a transaction signed elsewhere (finding 50)', () => {
  const signed = { hash: () => HASH_BYTES, timeBounds: { minTime: '0', maxTime: String(MAX_TIME) } } as unknown as Parameters<typeof sendAndWait>[0]

  it('resends while the node is busy, then waits for a ledger, reporting the same stages', async () => {
    const server = fakeServer([{ status: 'TRY_AGAIN_LATER' }, { status: 'PENDING', hash: 'h-rpc' }], [{ status: 'NOT_FOUND', latestLedgerCloseTime: 0 }, { status: 'SUCCESS', ledger: 9 }])
    const stages: TxStage[] = []
    const r = await sendAndWait(signed, server, () => undefined, { onStage: (st) => stages.push(st), sleep: async () => {}, now: () => 0 })
    expect(r).toEqual({ hash: 'h-rpc', result: undefined, ledger: 9 })
    expect(server.sendTransaction).toHaveBeenCalledTimes(2)
    expect(stages).toEqual([{ stage: 'submitting' }, { stage: 'pending', hash: 'h-rpc', maxTime: MAX_TIME }])
  })

  it('says a failed send reached nobody, and a lost answer is unknown', async () => {
    const lost = fakeServer([new Error('socket hang up')], [{ status: 'SUCCESS' }])
    await expect(sendAndWait(signed, lost, () => undefined, { sleep: async () => {}, now: () => 0 })).rejects.toMatchObject({ kind: 'unknown', hash: LOCAL_HASH })
  })
})

