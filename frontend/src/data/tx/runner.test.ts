import { describe, expect, it, vi } from 'vitest'
import { TxError } from '../../core/tx/errors'
import type { TxState } from '../../core/tx/machine'
import type { TxCheck, TxOptions } from '../../core/tx/types'
import { createActivityStore } from './activityStore'
import { TX_BUSY_MESSAGE } from './copy'
import { createFlights } from './flights'
import { AUTO_CHECK_ATTEMPTS, AUTO_CHECK_MS, checkEntry, mayHaveChanged, refusedState, resumeUnknown, runTransaction, sentNothing, signingSince, stopWaiting, unsettledEntry, waitingForSignature } from './runner'
import type { RunnerDeps, TxMeta } from './runner'

const ME = 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG'
const META: TxMeta = { product: 'covered', action: 'buy', label: 'Buy put on 5.00 BOND', done: 'Bought', subject: 'option:12', address: ME, mock: false }

function setup(over: Partial<RunnerDeps> = {}) {
  const settled: { meta: TxMeta; state: TxState }[] = []
  const said: { message: string; politeness: string }[] = []
  const timers: { fn: () => void; ms: number }[] = []
  const deps: RunnerDeps = {
    activity: createActivityStore({ storage: null }),
    flights: createFlights(),
    onSettled: (meta, state) => settled.push({ meta, state }),
    checkTx: vi.fn(async (): Promise<TxCheck> => ({ status: 'unknown' })),
    announce: (message, politeness) => said.push({ message, politeness }),
    schedule: (fn, ms) => {
      timers.push({ fn, ms })
      return () => {}
    },
    ...over,
  }
  /** Runs the next scheduled timer and waits for the lookup it starts. */
  const tick = async () => {
    const t = timers.shift()
    if (!t) throw new Error('no timer scheduled')
    t.fn()
    await new Promise((r) => setTimeout(r, 0))
  }
  return { deps, settled, said, timers, tick }
}

/** A write that walks the four stages, then settles the way the test says. */
const write =
  (end: 'ok' | Error, upTo: 'checking' | 'signing' | 'submitting' | 'pending' = 'pending') =>
  async ({ onStage }: Required<TxOptions>) => {
    const order = ['checking', 'signing', 'submitting', 'pending'] as const
    for (const s of order) {
      if (s === 'pending') onStage({ stage: 'pending', hash: 'h1', maxTime: 500 })
      else onStage({ stage: s })
      await Promise.resolve()
      if (s === upTo) break
    }
    if (end !== 'ok') throw end
    return { hash: 'h1', ledger: 42, id: 7n }
  }

describe('runTransaction', () => {
  it('walks the stages, records the entry and reports the confirmation', async () => {
    const { deps, settled, said } = setup()
    const seen: string[] = []
    const run = await runTransaction(deps, META, write('ok'), { onState: (s) => seen.push(s.phase) })
    expect(seen).toEqual(['checking', 'signing', 'submitting', 'pending', 'confirmed'])
    expect(run.state).toMatchObject({ phase: 'confirmed', hash: 'h1', ledger: 42, effect: 'fee-charged' })
    expect(run.result).toEqual({ hash: 'h1', ledger: 42, id: 7n })
    expect(run.entryId).not.toBeNull()
    expect(deps.activity.get(ME, run.entryId!)).toMatchObject({ phase: 'confirmed', hash: 'h1', label: META.label, action: 'buy', subject: 'option:12' })
    expect(settled).toHaveLength(1)
    expect(settled[0].meta).toBe(META)
    expect(deps.flights.count()).toBe(0)
    expect(said.map((s) => s.message)).toEqual([
      'Buy put on 5.00 BOND: Waiting for signature.',
      'Buy put on 5.00 BOND: Submitting.',
      'Buy put on 5.00 BOND: Pending.',
      'Buy put on 5.00 BOND: Bought.',
    ])
    expect(said.every((s) => s.politeness === 'polite')).toBe(true)
  })

  it('is visible as in flight while it runs, by subject', async () => {
    const { deps } = setup()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const running = runTransaction(deps, META, async ({ onStage }) => {
      onStage({ stage: 'signing' })
      await gate
      return { hash: 'h1' }
    })
    await Promise.resolve()
    expect(deps.flights.count()).toBe(1)
    expect(deps.flights.has('option:12')).toBe(true)
    expect(deps.flights.has('option:13')).toBe(false)
    expect(deps.activity.list(ME)[0].phase).toBe('signing')
    release()
    await running
    expect(deps.flights.count()).toBe(0)
    expect(deps.flights.has('option:12')).toBe(false)
  })

  it('refuses a second transaction while one is in flight, without sending anything', async () => {
    const { deps, settled } = setup()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const first = runTransaction(deps, META, async () => {
      await gate
      return { hash: 'h1' }
    })
    const secondWrite = vi.fn(write('ok'))
    const second = await runTransaction(deps, { ...META, subject: 'option:13' }, secondWrite)
    expect(secondWrite).not.toHaveBeenCalled()
    expect(second.state).toMatchObject({ phase: 'failed', effect: 'nothing-sent', error: TX_BUSY_MESSAGE })
    expect(second.entryId).toBeNull()
    expect(deps.activity.list(ME)).toHaveLength(1)
    release()
    expect((await first).state.phase).toBe('confirmed')
    expect(settled).toHaveLength(1)
  })

  it('takes a declined request out of Activity and invalidates nothing', async () => {
    const { deps, settled, said } = setup()
    const run = await runTransaction(deps, META, write(new TxError('declined', 'You declined the request.'), 'signing'))
    expect(run.state).toMatchObject({ phase: 'declined', effect: 'nothing-sent' })
    expect(run.entryId).toBeNull()
    expect(deps.activity.list(ME)).toEqual([])
    expect(settled).toEqual([])
    expect(sentNothing(run.state)).toBe(true)
    // A decline is not an error: it does not interrupt.
    expect(said.at(-1)).toEqual({ message: 'Buy put on 5.00 BOND: You declined to sign in your wallet. Nothing was sent.', politeness: 'polite' })
  })

  it('takes a refusal before sending out of Activity too, and says nothing was sent', async () => {
    const { deps, settled, said } = setup()
    const run = await runTransaction(deps, META, write(new TxError('refused', 'This offer is no longer open.'), 'checking'))
    expect(run.state).toMatchObject({ phase: 'failed', effect: 'nothing-sent', error: 'This offer is no longer open.', hash: null })
    expect(deps.activity.list(ME)).toEqual([])
    expect(settled).toEqual([])
    expect(said.at(-1)).toEqual({ message: 'Buy put on 5.00 BOND: Failed. This offer is no longer open. Nothing was sent. No fee was charged.', politeness: 'assertive' })
  })

  it('keeps a transaction that failed in a ledger, and invalidates: the fee was charged and the state moved', async () => {
    const { deps, settled } = setup()
    const run = await runTransaction(deps, META, write(new TxError('failed', 'The option was already exercised.', { hash: 'h1' })))
    expect(run.state).toMatchObject({ phase: 'failed', effect: 'fee-charged', hash: 'h1' })
    expect(deps.activity.get(ME, run.entryId!)).toMatchObject({ phase: 'failed', effect: 'fee-charged' })
    expect(mayHaveChanged(run.state)).toBe(true)
    expect(settled).toHaveLength(1)
  })

  it('keeps an expired transaction and invalidates nothing: it was never included', async () => {
    const { deps, settled } = setup()
    const run = await runTransaction(deps, META, write(new TxError('expired', 'The transaction expired without being included.', { hash: 'h1', maxTime: 500 })))
    expect(run.state).toMatchObject({ phase: 'expired', effect: 'nothing-sent', hash: 'h1' })
    expect(deps.activity.get(ME, run.entryId!)!.phase).toBe('expired')
    expect(settled).toEqual([])
  })

  it('treats an untyped failure after sending as unknown, never as failed', async () => {
    const { deps, settled } = setup()
    const run = await runTransaction(deps, META, write(new Error('network dropped')))
    expect(run.state).toMatchObject({ phase: 'unknown', effect: 'outcome-unknown', hash: 'h1' })
    expect(settled).toEqual([])
  })

  it('never rejects, whatever the write throws', async () => {
    const { deps } = setup()
    await expect(runTransaction(deps, META, () => Promise.reject('plain string'))).resolves.toMatchObject({ state: { phase: 'failed', error: 'plain string' } })
    expect(deps.flights.count()).toBe(0)
  })

  it('stays silent when asked to', async () => {
    const { deps, said } = setup()
    await runTransaction(deps, META, write('ok'), { announce: false })
    expect(said).toEqual([])
  })
})

describe('an unknown outcome', () => {
  const unknown = () => write(new TxError('unknown', 'Not confirmed yet.', { hash: 'h1', maxTime: 500 }))

  it('is never re-sent: it is looked up on a timer until the network answers', async () => {
    const answers: TxCheck[] = [{ status: 'unknown' }, { status: 'confirmed', ledger: 88 }]
    const checkTx = vi.fn(async () => answers.shift()!)
    const { deps, settled, timers, tick, said } = setup({ checkTx })
    const seen: string[] = []
    const send = vi.fn(unknown())
    const run = await runTransaction(deps, META, send, { onState: (s) => seen.push(s.phase) })
    expect(run.state.phase).toBe('unknown')
    expect(settled).toEqual([])
    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(AUTO_CHECK_MS)

    await tick()
    expect(checkTx).toHaveBeenCalledWith(META, 'h1', 500)
    expect(deps.activity.get(ME, run.entryId!)!.phase).toBe('unknown')
    expect(timers).toHaveLength(1)

    await tick()
    expect(deps.activity.get(ME, run.entryId!)).toMatchObject({ phase: 'confirmed', ledger: 88, effect: 'fee-charged' })
    expect(seen.at(-1)).toBe('confirmed')
    expect(settled).toHaveLength(1)
    expect(timers).toHaveLength(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(said.at(-1)!.message).toBe('Buy put on 5.00 BOND: Bought.')
  })

  it('interrupts the screen reader once, when it becomes unknown', async () => {
    const { deps, said } = setup()
    await runTransaction(deps, META, unknown())
    expect(said.at(-1)).toEqual({ message: 'Buy put on 5.00 BOND: Outcome unknown. The transaction was sent and no ledger has included it yet. It can still go through. Do not send another one: check again first.', politeness: 'assertive' })
  })

  it('resolves to expired once a ledger closed after its time bound, without invalidating', async () => {
    const { deps, settled, tick } = setup({ checkTx: async () => ({ status: 'expired' }) })
    const run = await runTransaction(deps, META, unknown())
    await tick()
    expect(deps.activity.get(ME, run.entryId!)).toMatchObject({ phase: 'expired', effect: 'nothing-sent' })
    expect(settled).toEqual([])
  })

  it('resolves to failed with the fee charged, and invalidates', async () => {
    const { deps, settled, tick } = setup({ checkTx: async () => ({ status: 'failed', message: 'The offer was bought by someone else.' }) })
    const run = await runTransaction(deps, META, unknown())
    await tick()
    expect(deps.activity.get(ME, run.entryId!)).toMatchObject({ phase: 'failed', effect: 'fee-charged', error: 'The offer was bought by someone else.' })
    expect(settled).toHaveLength(1)
  })

  it('stops looking after a bounded number of attempts and leaves it to the user', async () => {
    const { deps, timers, tick } = setup()
    const run = await runTransaction(deps, META, unknown())
    for (let i = 0; i < AUTO_CHECK_ATTEMPTS; i++) await tick()
    expect(timers).toHaveLength(0)
    expect(deps.activity.get(ME, run.entryId!)!.phase).toBe('unknown')
    expect(deps.checkTx).toHaveBeenCalledTimes(AUTO_CHECK_ATTEMPTS)
  })

  it('can be looked up by hand, and a lookup that throws leaves it unknown', async () => {
    const checkTx = vi.fn<RunnerDeps['checkTx']>().mockRejectedValueOnce(new Error('RPC down')).mockResolvedValueOnce({ status: 'confirmed', ledger: 5 })
    const { deps, settled } = setup({ checkTx, autoCheck: false })
    const run = await runTransaction(deps, META, unknown())
    expect((await checkEntry(deps, META, run.entryId!))!.phase).toBe('unknown')
    expect((await checkEntry(deps, META, run.entryId!))!.phase).toBe('confirmed')
    expect(settled).toHaveLength(1)
    // Checking a settled entry again does nothing more.
    expect((await checkEntry(deps, META, run.entryId!))!.phase).toBe('confirmed')
    expect(checkTx).toHaveBeenCalledTimes(2)
    expect(await checkEntry(deps, META, 'no-such-entry')).toBeNull()
  })

  it('does not schedule a lookup when automatic checks are off', async () => {
    const { deps, timers } = setup({ autoCheck: false })
    await runTransaction(deps, META, unknown())
    expect(timers).toHaveLength(0)
  })
})

describe('fixtures (Margin simulation)', () => {
  it('confirms with an empty hash: recorded, nothing sent, not persisted', async () => {
    const { deps, settled } = setup()
    const meta: TxMeta = { product: 'margin', action: 'margin', label: 'Deposit', address: 'MAKER_A', mock: true }
    const run = await runTransaction(deps, meta, async () => ({ hash: '', ledger: null }))
    expect(run.state).toMatchObject({ phase: 'confirmed', hash: null, effect: 'nothing-sent' })
    expect(deps.activity.get('MAKER_A', run.entryId!)).toMatchObject({ product: 'margin', mock: true, phase: 'confirmed' })
    expect(settled).toHaveLength(1)
  })
})

describe('refusedState', () => {
  it('is a failure that sent nothing', () => {
    const s = refusedState('Connect a wallet first.')
    expect(s).toMatchObject({ phase: 'failed', effect: 'nothing-sent', hash: null, error: 'Connect a wallet first.' })
    expect(sentNothing(s)).toBe(true)
    expect(mayHaveChanged(s)).toBe(false)
  })
})

describe('what a confirmed transaction created', () => {
  it('is recorded on its Activity entry, and only when the write was confirmed', async () => {
    const activity = createActivityStore({ storage: null })
    const deps = { activity, flights: createFlights(), onSettled: () => {}, checkTx: async () => ({ status: 'unknown' as const }), autoCheck: false }
    const meta = { product: 'covered' as const, action: 'write-offer', label: 'Write put on 5.00 BOND', address: 'GME', mock: true }

    const ok = await runTransaction(deps, meta, async () => ({ hash: 'h1', ledger: null, id: 12n }), { created: (r) => `option:${r.id}` })
    expect(ok.state.phase).toBe('confirmed')
    expect(activity.get('GME', ok.entryId!)?.created).toBe('option:12')

    const failed = await runTransaction(
      deps,
      meta,
      async (): Promise<{ hash: string; ledger: null; id: bigint }> => {
        throw new TxError('failed', 'Refused by the contract.', { hash: 'h2', maxTime: 10 })
      },
      { created: (r) => `option:${r.id}` },
    )
    expect(failed.state.phase).toBe('failed')
    expect(activity.get('GME', failed.entryId!)?.created ?? null).toBeNull()
  })
})

describe('an unknown outcome blocks the next write of the same account, across components (review finding 19)', () => {
  // The writes of these tests carry a time bound of 500; the clock says 100, so the first transaction can still land.
  const unknownWrite = () =>
    write(new TxError('unknown', 'Not confirmed yet.', { hash: 'h1', maxTime: 500 }))

  it('refuses a second write while the first is still unknown, after looking it up once more', async () => {
    const checkTx = vi.fn(async (): Promise<TxCheck> => ({ status: 'unknown' }))
    const { deps } = setup({ checkTx, autoCheck: false, nowSec: () => 100 })
    const first = await runTransaction(deps, META, unknownWrite())
    expect(first.state.phase).toBe('unknown')
    expect(unsettledEntry(deps, META)?.id).toBe(first.entryId)

    const second = vi.fn(write('ok'))
    const run = await runTransaction(deps, { ...META, label: 'Request put on 2.00 BOND' }, second)
    expect(second).not.toHaveBeenCalled()
    expect(checkTx).toHaveBeenCalledTimes(1)
    expect(run.state).toMatchObject({ phase: 'failed', effect: 'nothing-sent' })
    expect(run.state.error).toMatch(/^A transaction sent at \d\d:\d\d:\d\d\u00A0UTC is not confirmed yet and can still go through until 00:08:20\u00A0UTC\. Check it in Activity before you send another\.$/)
    expect(run.entryId).toBeNull()
  })

  it('lets it through once the first is found confirmed, and records that answer', async () => {
    const { deps } = setup({ checkTx: async () => ({ status: 'confirmed', ledger: 9 }), autoCheck: false, nowSec: () => 100 })
    const first = await runTransaction(deps, META, unknownWrite())
    const run = await runTransaction(deps, META, write('ok'))
    expect(run.state.phase).toBe('confirmed')
    expect(deps.activity.get(ME, first.entryId!)).toMatchObject({ phase: 'confirmed', ledger: 9 })
  })

  it('does not block another account, another product, or a transaction whose time bound passed', async () => {
    const { deps } = setup({ autoCheck: false, nowSec: () => 100 })
    await runTransaction(deps, META, unknownWrite())
    expect(unsettledEntry(deps, { address: 'GOTHER', product: 'covered' })).toBeUndefined()
    expect(unsettledEntry(deps, { address: ME, product: 'margin' })).toBeUndefined()
    expect(unsettledEntry({ ...deps, nowSec: () => 600 }, META)).toBeUndefined()
  })

  it('restarts the timer for unknown entries found in Activity, once per entry', async () => {
    const { deps, timers } = setup({ nowSec: () => 100 })
    const first = await runTransaction(deps, META, unknownWrite())
    timers.length = 0 // the timer of the page that sent it is gone with that page
    expect(resumeUnknown(deps, ME)).toBe(1)
    expect(timers).toHaveLength(1)
    expect(resumeUnknown(deps, ME)).toBe(0)
    expect(deps.activity.get(ME, first.entryId!)!.phase).toBe('unknown')
  })
})

describe('a run that ends after its screen closed (review finding 41)', () => {
  it('is told in a visible notice instead of only in the live region', async () => {
    const notices: { title: string; description: string; tone: string }[] = []
    const { deps, said } = setup({ notify: (n) => notices.push(n) })
    let open = true
    const run = runTransaction(deps, META, write('ok'), { isMounted: () => open })
    open = false
    await run
    expect(notices).toEqual([{ title: 'Bought', description: 'Buy put on 5.00 BOND. It is listed in Activity.', tone: 'success' }])
    expect(said.map((s) => s.message)).not.toContain('Buy put on 5.00 BOND: Bought.')
  })

  it('says a failure and an unknown outcome with what happened to the fee', async () => {
    const notices: { title: string; description: string; tone: string }[] = []
    const { deps } = setup({ notify: (n) => notices.push(n), autoCheck: false })
    await runTransaction(deps, META, write(new TxError('failed', 'The option changed before your transaction landed.', { hash: 'h1', maxTime: 500 })), { isMounted: () => false })
    await runTransaction(deps, META, write(new TxError('unknown', 'Not confirmed yet.', { hash: 'h2', maxTime: 500 })), { isMounted: () => false })
    expect(notices[0]).toMatchObject({ title: 'Failed', tone: 'danger' })
    expect(notices[0].description).toMatch(/^Buy put on 5\.00 BOND\. The option changed before your transaction landed\. /)
    expect(notices[1]).toMatchObject({ title: 'Outcome unknown', tone: 'warning' })
    expect(notices[1].description).toMatch(/Do not send another one: check again first\.$/)
  })

  it('keeps the in-place result while the screen is open', async () => {
    const notices: unknown[] = []
    const { deps, said } = setup({ notify: (n) => notices.push(n) })
    await runTransaction(deps, META, write('ok'), { isMounted: () => true })
    expect(notices).toEqual([])
    expect(said.at(-1)!.message).toBe('Buy put on 5.00 BOND: Bought.')
  })
})

describe('stop waiting for a wallet that never answers (review finding 42)', () => {
  it('ends the run declined, releases the flight and keeps nothing in Activity; a late signature sends nothing', async () => {
    const { deps } = setup({ autoCheck: false })
    let entry: string | null = null
    const hold: { late?: (v: unknown) => void } = {}
    const sent = vi.fn()
    // A write that reports `signing`, then waits for the signal like signAndSend does.
    const hanging = async ({ onStage, signal }: Required<TxOptions>) => {
      onStage({ stage: 'checking' })
      onStage({ stage: 'signing' })
      await new Promise((resolve, reject) => {
        hold.late = resolve
        signal.addEventListener('abort', () => reject(new TxError('declined', 'You stopped waiting for the wallet. Nothing was signed, so nothing was sent.')), { once: true })
      })
      sent()
      return { hash: 'h1', ledger: 1 }
    }
    const run = runTransaction(deps, META, hanging, { onEntry: (id) => (entry = id) })
    await Promise.resolve()
    await Promise.resolve()
    expect(entry).not.toBeNull()
    expect(deps.flights.count()).toBe(1)
    expect(signingSince(entry!)).not.toBeNull()
    expect(waitingForSignature()).toEqual([entry])
    expect(stopWaiting(entry!)).toBe(true)
    const done = await run
    expect(done.state).toMatchObject({ phase: 'declined', effect: 'nothing-sent', error: 'You stopped waiting for the wallet. Nothing was signed, so nothing was sent.' })
    expect(deps.flights.count()).toBe(0)
    expect(deps.activity.list(ME)).toEqual([])
    hold.late?.(null)
    await Promise.resolve()
    expect(sent).not.toHaveBeenCalled()
    expect(stopWaiting(entry!)).toBe(false)
  })

  it('does nothing once the transaction is signed', async () => {
    const { deps } = setup({ autoCheck: false })
    let entry: string | null = null
    const run = runTransaction(deps, META, write('ok'), { onEntry: (id) => (entry = id) })
    await run
    expect(stopWaiting(entry!)).toBe(false)
  })
})
