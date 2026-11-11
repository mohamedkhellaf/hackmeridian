import { describe, expect, it } from 'vitest'
import { runMachine } from '../tx/machine'
import { createProClient } from './createClient'
import { proErrorMessage } from './errors'
import { ProTxError, proFailureText, proReceipt } from './tx'
import type { CallResult } from './types'

const ok = <T,>(value: T, extra: object = {}): Promise<CallResult<T>> => Promise.resolve({ ok: true, value, ...extra })
const no = (r: { code: number; name: string; note?: string; kind?: 'declined' | 'refused' | 'failed' | 'unknown' | 'expired'; hash?: string }): Promise<CallResult<never>> => Promise.resolve({ ok: false, ...r })

describe('proReceipt', () => {
  it('turns an ok result into a receipt, with the hash when there is one', async () => {
    expect(await proReceipt(ok(7n, { hash: 'ab', note: 'Transaction ab' }))).toEqual({ hash: 'ab', ledger: null, value: 7n, note: 'Transaction ab' })
    expect(await proReceipt(ok(null))).toEqual({ hash: '', ledger: null, value: null, note: null })
  })

  it('rejects a contract refusal with its code, name and plain message: nothing was sent', async () => {
    const e = (await proReceipt(no({ code: 224, name: 'LiquidateFirst' })).catch((x: unknown) => x)) as ProTxError
    expect(e).toBeInstanceOf(ProTxError)
    expect(e).toMatchObject({ kind: 'refused', code: 224, refusal: 'LiquidateFirst', hash: null })
    expect(e.message).toBe(proErrorMessage(224))
  })

  it('keeps where a live transaction stopped, so an unknown outcome is never offered for resend', async () => {
    const e = (await proReceipt(no({ code: -1, name: 'TransactionFailed', note: 'Not confirmed yet.', kind: 'unknown', hash: 'cd' })).catch((x: unknown) => x)) as ProTxError
    expect(e).toMatchObject({ kind: 'unknown', code: null, refusal: null, hash: 'cd', message: 'Not confirmed yet.' })
    const declined = (await proReceipt(no({ code: -1, name: 'TransactionFailed', note: 'You rejected the request in your wallet.', kind: 'declined' })).catch((x: unknown) => x)) as ProTxError
    expect(declined.kind).toBe('declined')
  })

  it('words the three kinds of failure', () => {
    expect(proFailureText({ ok: false, code: 0, name: 'NotScripted' })).toBe('Not available in this simulation.')
    expect(proFailureText({ ok: false, code: -1, name: 'TransactionFailed' })).toBe('The transaction failed.')
    expect(proFailureText({ ok: false, code: -1, name: 'TransactionFailed', note: 'Connect a wallet first.' })).toBe('Connect a wallet first.')
    expect(proFailureText({ ok: false, code: 209, name: 'InsufficientMargin' })).toBe(proErrorMessage(209))
  })

  it('runs a fixture call through the shared machine: confirmed without a hash, or failed with nothing sent', async () => {
    const { client, sim } = await createProClient()
    const model = client.getModel()
    const position = model.positions[0]
    const phases: string[] = []
    const refused = await runMachine((opts) => proReceipt(client.exercise(position.holder, position.id, opts)), (s) => phases.push(s.phase))
    // The default scenario opens on a writer below maintenance margin: the early exercise is refused.
    expect(refused.state).toMatchObject({ phase: 'failed', effect: 'nothing-sent', hash: null })
    expect(phases).toEqual(['checking', 'failed'])

    sim!.setScenario('happy_path_otm')
    sim!.moveTo(0)
    const wallets = Object.keys(client.getModel().wallets)
    let confirmed = null
    for (const who of wallets) {
      const r = await runMachine((opts) => proReceipt(client.deposit(who, 1n, opts)), () => {})
      if (r.state.phase === 'confirmed') confirmed = r.state
    }
    expect(confirmed).toMatchObject({ phase: 'confirmed', hash: null, effect: 'nothing-sent' })
  })
})
