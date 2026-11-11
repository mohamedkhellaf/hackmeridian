import { describe, expect, it } from 'vitest'
import { TxError } from './errors'
import { TX_IDLE, canCheckAgain, canStart, hasHash, isSettled, isWorking, notFoundStatus, reduce, refusedOnSend, runMachine, stoppedStage } from './machine'
import type { TxEvent, TxState } from './machine'
import type { TxStage } from './types'

const HASH = 'ab'.repeat(32)
const play = (events: TxEvent[], from: TxState = TX_IDLE) => events.reduce(reduce, from)
const stage = (s: 'checking' | 'signing' | 'submitting'): TxEvent => ({ type: 'stage', stage: { stage: s } })
const pending: TxEvent = { type: 'stage', stage: { stage: 'pending', hash: HASH, maxTime: 1000 } }
const toPending: TxEvent[] = [{ type: 'start' }, stage('signing'), stage('submitting'), pending]

describe('transaction machine: the happy path', () => {
  it('walks idle, checking, signing, submitting, pending, confirmed and reports the hash at pending', () => {
    let s = reduce(TX_IDLE, { type: 'start' })
    expect(s.phase).toBe('checking')
    expect(s.effect).toBe('nothing-sent')
    s = reduce(s, stage('signing'))
    expect(s).toMatchObject({ phase: 'signing', hash: null, effect: 'nothing-sent' })
    s = reduce(s, stage('submitting'))
    expect(s).toMatchObject({ phase: 'submitting', hash: null, effect: 'outcome-unknown' })
    s = reduce(s, pending)
    expect(s).toMatchObject({ phase: 'pending', hash: HASH, maxTime: 1000, effect: 'outcome-unknown' })
    expect(hasHash(s)).toBe(true)
    expect(isWorking(s)).toBe(true)
    s = reduce(s, { type: 'confirmed', hash: HASH, ledger: 77 })
    expect(s).toEqual({ phase: 'confirmed', hash: HASH, maxTime: 1000, ledger: 77, error: null, effect: 'fee-charged' })
    expect(isSettled(s)).toBe(true)
    expect(isWorking(s)).toBe(false)
  })

  it('never moves backwards on a late or repeated stage', () => {
    const s = play(toPending)
    expect(reduce(s, stage('signing'))).toBe(s)
    expect(reduce(s, stage('checking'))).toBe(s)
    expect(reduce(s, pending)).toBe(s)
    const done = reduce(s, { type: 'confirmed', hash: HASH })
    expect(reduce(done, stage('submitting'))).toBe(done)
  })

  it('accepts a stage without a start, and skipped stages', () => {
    expect(reduce(TX_IDLE, stage('signing')).phase).toBe('signing')
    expect(play([{ type: 'start' }, pending]).phase).toBe('pending')
  })
})

describe('transaction machine: where it can stop', () => {
  it('a refusal while checking is failed with nothing sent', () => {
    const s = play([{ type: 'start' }, { type: 'error', error: new TxError('refused', 'This option has expired.') }])
    expect(s).toMatchObject({ phase: 'failed', hash: null, error: 'This option has expired.', effect: 'nothing-sent' })
    expect(canStart(s)).toBe(true)
  })

  it('a wallet rejection is declined, not failed, with nothing sent', () => {
    const s = play([{ type: 'start' }, stage('signing'), { type: 'error', error: new TxError('declined', 'You rejected the request in your wallet.') }])
    expect(s).toMatchObject({ phase: 'declined', hash: null, effect: 'nothing-sent' })
    expect(canStart(s)).toBe(true)
  })

  it('a transaction that a ledger included and refused is failed with the fee charged', () => {
    const s = play([...toPending, { type: 'error', error: new TxError('failed', 'Offer is no longer available', { hash: HASH, maxTime: 1000 }) }])
    expect(s).toMatchObject({ phase: 'failed', hash: HASH, effect: 'fee-charged' })
    expect(canStart(s)).toBe(true)
  })

  it('a sent transaction that was not found is unknown: it may not be sent again, only checked again', () => {
    const s = play([...toPending, { type: 'error', error: new TxError('unknown', 'Not confirmed yet.', { hash: HASH, maxTime: 1000 }) }])
    expect(s).toMatchObject({ phase: 'unknown', hash: HASH, maxTime: 1000, effect: 'outcome-unknown' })
    expect(canStart(s)).toBe(false)
    expect(canCheckAgain(s)).toBe(true)
    expect(isSettled(s)).toBe(false)
    // Neither a new start nor a reset gets past an unknown outcome.
    expect(reduce(s, { type: 'start' })).toBe(s)
    expect(reduce(s, { type: 'reset' })).toBe(s)
  })

  it('expired means it can never be included: nothing was charged and a retry is allowed', () => {
    const s = play([...toPending, { type: 'error', error: new TxError('expired', 'Expired.', { hash: HASH, maxTime: 1000 }) }])
    expect(s).toMatchObject({ phase: 'expired', hash: HASH, effect: 'nothing-sent' })
    expect(canStart(s)).toBe(true)
    expect(reduce(s, { type: 'start' }).phase).toBe('checking')
  })

  it('an untyped error before signing is a failure with nothing sent', () => {
    const s = play([{ type: 'start' }, { type: 'error', error: new Error('Account not funded') }])
    expect(s).toMatchObject({ phase: 'failed', error: 'Account not funded', effect: 'nothing-sent' })
  })

  it('an untyped error after submitting is unknown, never "failed, try again"', () => {
    const fromSubmitting = play([{ type: 'start' }, stage('signing'), stage('submitting'), { type: 'error', error: new Error('fetch failed') }])
    expect(fromSubmitting).toMatchObject({ phase: 'unknown', effect: 'outcome-unknown' })
    expect(canStart(fromSubmitting)).toBe(false)
    const fromPending = play([...toPending, { type: 'error', error: 'socket hang up' }])
    expect(fromPending).toMatchObject({ phase: 'unknown', hash: HASH, error: 'socket hang up' })
  })

  it('ignores start and reset while a transaction is in flight', () => {
    const s = play(toPending)
    expect(reduce(s, { type: 'start' })).toBe(s)
    expect(reduce(s, { type: 'reset' })).toBe(s)
  })

  it('a confirmation wins over an earlier unknown', () => {
    const s = play([...toPending, { type: 'error', error: new TxError('unknown', 'Not confirmed yet.', { hash: HASH }) }, { type: 'confirmed', hash: HASH, ledger: 9 }])
    expect(s).toMatchObject({ phase: 'confirmed', ledger: 9, error: null, effect: 'fee-charged' })
  })

  it('an error after it settled changes nothing', () => {
    const done = play([...toPending, { type: 'confirmed', hash: HASH }])
    expect(reduce(done, { type: 'error', error: new Error('late') })).toBe(done)
  })
})

describe('transaction machine: resolving an unknown outcome', () => {
  const unknown = play([...toPending, { type: 'error', error: new TxError('unknown', 'Not confirmed yet.', { hash: HASH, maxTime: 1000 }) }])

  it('still unknown keeps the state', () => {
    expect(reduce(unknown, { type: 'resolve', check: { status: 'unknown' } })).toBe(unknown)
  })
  it('confirmed', () => {
    expect(reduce(unknown, { type: 'resolve', check: { status: 'confirmed', ledger: 12 } })).toMatchObject({ phase: 'confirmed', hash: HASH, ledger: 12, effect: 'fee-charged' })
  })
  it('failed in a ledger', () => {
    expect(reduce(unknown, { type: 'resolve', check: { status: 'failed', message: 'This option has expired.' } })).toMatchObject({ phase: 'failed', error: 'This option has expired.', effect: 'fee-charged' })
  })
  it('expired: only now may the user send again', () => {
    const s = reduce(unknown, { type: 'resolve', check: { status: 'expired' } })
    expect(s).toMatchObject({ phase: 'expired', effect: 'nothing-sent' })
    expect(canStart(s)).toBe(true)
  })
  it('does nothing outside pending and unknown', () => {
    expect(reduce(TX_IDLE, { type: 'resolve', check: { status: 'confirmed', ledger: 1 } })).toBe(TX_IDLE)
  })
})

describe('notFoundStatus', () => {
  it('is expired only once a ledger has closed after the time bound', () => {
    expect(notFoundStatus(999, 1000)).toBe('unknown')
    expect(notFoundStatus(1000, 1000)).toBe('unknown') // a ledger closing exactly at maxTime can still include it
    expect(notFoundStatus(1001, 1000)).toBe('expired')
  })
  it('is unknown when either figure is missing', () => {
    expect(notFoundStatus(null, 1000)).toBe('unknown')
    expect(notFoundStatus(5000, null)).toBe('unknown')
    expect(notFoundStatus(undefined, undefined)).toBe('unknown')
  })
})

describe('runMachine', () => {
  it('emits every state of a confirmed write and returns its result', async () => {
    const seen: string[] = []
    const { state, result } = await runMachine(
      async ({ onStage }) => {
        onStage({ stage: 'checking' })
        onStage({ stage: 'signing' })
        onStage({ stage: 'submitting' })
        onStage({ stage: 'pending', hash: HASH, maxTime: 5 })
        return { hash: HASH, ledger: 3, id: 7n }
      },
      (s) => seen.push(s.phase),
    )
    expect(seen).toEqual(['checking', 'signing', 'submitting', 'pending', 'confirmed'])
    expect(state.phase).toBe('confirmed')
    expect(result).toEqual({ hash: HASH, ledger: 3, id: 7n })
  })

  it('never rejects: a thrown TxError becomes the final state', async () => {
    const seen: string[] = []
    const { state, result } = await runMachine<{ hash: string }>(
      async ({ onStage }) => {
        onStage({ stage: 'signing' })
        throw new TxError('declined', 'You rejected the request in your wallet.')
      },
      (s) => seen.push(s.phase),
    )
    expect(seen).toEqual(['checking', 'signing', 'declined'])
    expect(state.phase).toBe('declined')
    expect(result).toBeNull()
  })

  it('refuses to start from an unknown outcome and does not call the write', async () => {
    const unknown: TxState = { ...TX_IDLE, phase: 'unknown', hash: HASH, effect: 'outcome-unknown' }
    let called = false
    const { state } = await runMachine<{ hash: string }>(
      async () => {
        called = true
        return { hash: HASH }
      },
      () => {},
      unknown,
    )
    expect(called).toBe(false)
    expect(state).toBe(unknown)
  })
})

describe('where a transaction stopped', () => {
  const through = (...stages: TxStage[]): TxState => stages.reduce((s, stage) => reduce(s, { type: 'stage', stage }), reduce(TX_IDLE, { type: 'start' }))
  const inLedgerQueue: TxStage = { stage: 'pending', hash: 'h1', maxTime: 100 }

  it('tells a refusal before sending from a refusal by the network', () => {
    const early = reduce(through({ stage: 'checking' }), { type: 'error', error: new TxError('refused', 'Not eligible.') })
    expect(early).toMatchObject({ phase: 'failed', effect: 'nothing-sent', stoppedAt: 'checking' })
    expect(stoppedStage(early)).toBe('check')
    expect(refusedOnSend(early)).toBe(false)

    const onSend = reduce(through({ stage: 'checking' }, { stage: 'signing' }, { stage: 'submitting' }), { type: 'error', error: new TxError('refused', 'Bad sequence.') })
    expect(onSend).toMatchObject({ phase: 'failed', effect: 'nothing-sent', stoppedAt: 'submitting' })
    expect(stoppedStage(onSend)).toBe('submit')
    expect(refusedOnSend(onSend)).toBe(true)
  })

  it('puts a decline on the sign step and a ledger failure on the confirm step', () => {
    const declined = reduce(through({ stage: 'checking' }, { stage: 'signing' }), { type: 'error', error: new TxError('declined', 'No.') })
    expect(stoppedStage(declined)).toBe('sign')
    const failed = reduce(through({ stage: 'checking' }, { stage: 'signing' }, { stage: 'submitting' }, inLedgerQueue), { type: 'error', error: new TxError('failed', 'Refused by the contract.') })
    expect(failed.stoppedAt).toBe('pending')
    expect(stoppedStage(failed)).toBe('confirm')
    expect(refusedOnSend(failed)).toBe(false)
  })

  it('reads an older record without the field from what it has: a hash means it was sent', () => {
    const base: TxState = { phase: 'failed', hash: null, maxTime: null, ledger: null, error: 'x', effect: 'nothing-sent' }
    expect(stoppedStage(base)).toBe('check')
    expect(stoppedStage({ ...base, hash: 'abc' })).toBe('submit')
    expect(stoppedStage({ ...base, effect: 'fee-charged' })).toBe('confirm')
    expect(stoppedStage({ ...base, phase: 'declined' })).toBe('sign')
  })

  it('keeps an unknown outcome on a stage that was sent', () => {
    const unknown = reduce(through({ stage: 'checking' }, { stage: 'signing' }, { stage: 'submitting' }), { type: 'error', error: new Error('socket closed') })
    expect(unknown).toMatchObject({ phase: 'unknown', stoppedAt: 'submitting' })
    const settled = reduce(unknown, { type: 'resolve', check: { status: 'failed', message: 'Refused.' } })
    expect(stoppedStage(settled)).toBe('confirm')
  })
})
