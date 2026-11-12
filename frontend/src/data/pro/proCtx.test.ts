import { describe, expect, it } from 'vitest'
import { proErrorMessage } from '../../core/pro/errors'
import type { CallResult } from '../../core/pro/types'
import { notStarted, outcomeOf } from './proCtx'

describe('outcomeOf: a Margin call result as the banner shows it', () => {
  it('confirms with the caller text and keeps the replayed step as a note', () => {
    const ok: CallResult<number> = { ok: true, value: 3, note: 'Step 23: buy' }
    expect(outcomeOf('Buy', ok, 'Bought.')).toEqual({ label: 'Buy', ok: true, text: 'Bought.', code: null, name: null, note: 'Step 23: buy' })
    expect(outcomeOf('Buy', { ok: true, value: null }, 'Done.').note).toBeNull()
  })

  it('shows a contract refusal with its name, code and reason', () => {
    const refused: CallResult = { ok: false, code: 224, name: 'LiquidateFirst', note: 'Step 40: exercise' }
    expect(outcomeOf('Exercise', refused, 'Done.')).toEqual({ label: 'Exercise', ok: false, text: proErrorMessage(224), code: 224, name: 'LiquidateFirst', note: 'Step 40: exercise' })
  })

  it('says so when the simulation has no scripted step', () => {
    const none: CallResult = { ok: false, code: 0, name: 'NotScripted', note: 'No step for this call here' }
    expect(outcomeOf('Deposit', none, 'Done.')).toMatchObject({ ok: false, text: 'Not available in this simulation.', code: null, name: 'NotScripted', note: 'No step for this call here' })
  })

  it('shows a wallet or network failure by its own message, without a code', () => {
    const wallet: CallResult = { ok: false, code: -1, name: '', note: 'You declined the request in the wallet.', kind: 'declined' }
    expect(outcomeOf('Deposit', wallet, 'Done.')).toEqual({ label: 'Deposit', ok: false, text: 'You declined the request in the wallet.', code: null, name: null, note: null })
    expect(outcomeOf('Deposit', { ok: false, code: -1, name: '' }, 'Done.').text).toBe('The transaction failed.')
  })

  it('reports a call the transaction layer did not start as a refusal that sent nothing', () => {
    const r = notStarted<null>('Another transaction is in progress. Wait for it to finish, then try again.')
    expect(r).toEqual({ ok: false, code: -1, name: '', note: 'Another transaction is in progress. Wait for it to finish, then try again.', kind: 'refused' })
    expect(outcomeOf('Deposit', r, 'Done.').text).toBe('Another transaction is in progress. Wait for it to finish, then try again.')
  })
})
