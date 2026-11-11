import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, findBannedWords } from '../../core/disclosures'
import { TX_IDLE } from '../../core/tx/machine'
import type { TxEffect, TxState } from '../../core/tx/machine'
import { TX_STATE_LABEL } from '../../ui/txStates'
import { TX_BUSY_MESSAGE, TX_EFFECT_TEXT, TX_NOT_CONNECTED, TX_PHASE_HELP, TX_PHASE_LABEL, announcementFor, describeTx } from './copy'

const state = (phase: TxState['phase'], effect: TxEffect = 'nothing-sent', error: string | null = null): TxState => ({ ...TX_IDLE, phase, effect, error })
const ALL = [...Object.values(TX_PHASE_LABEL), ...Object.values(TX_PHASE_HELP), ...Object.values(TX_EFFECT_TEXT), TX_BUSY_MESSAGE, TX_NOT_CONNECTED]

describe('transaction copy', () => {
  it('uses the same phase names as the ui kit', () => {
    expect(TX_PHASE_LABEL).toEqual(TX_STATE_LABEL)
  })

  it('follows the house style: no banned words, dashes, arrows or exclamation marks', () => {
    for (const text of ALL) {
      expect(findBannedWords(text)).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES)).toEqual([])
      expect(text).not.toMatch(/[—–→←!…]/)
      expect(text[0]).toBe(text[0].toUpperCase())
    }
  })

  it('tells the three situations apart', () => {
    expect(TX_EFFECT_TEXT['nothing-sent']).toMatch(/Nothing was sent/)
    expect(TX_EFFECT_TEXT['outcome-unknown']).toMatch(/not confirmed yet/)
    expect(TX_EFFECT_TEXT['fee-charged']).toMatch(/fee was charged/)
    // Unknown never suggests sending again; expired says it is fine to.
    expect(TX_PHASE_HELP.unknown).toMatch(/Do not send it again/)
    expect(TX_PHASE_HELP.unknown).not.toMatch(/try again/i)
    expect(TX_PHASE_HELP.expired).toMatch(/Nothing was charged/)
  })

  it('describes a state as a title and a detail', () => {
    expect(describeTx(TX_IDLE)).toBeNull()
    expect(describeTx(state('signing'))).toEqual({ title: 'Waiting for signature', detail: TX_PHASE_HELP.signing })
    expect(describeTx(state('failed', 'nothing-sent', 'This offer is no longer open.'))).toEqual({ title: 'Failed', detail: 'This offer is no longer open. Nothing was sent. No fee was charged.' })
    expect(describeTx(state('failed', 'fee-charged', 'The contract refused it.'))!.detail).toBe('The contract refused it. A ledger included the transaction. The network fee was charged.')
    expect(describeTx(state('unknown', 'outcome-unknown', 'Not confirmed yet.'))!.detail).toBe(TX_PHASE_HELP.unknown)
  })

  it('announces progress politely and bad news assertively', () => {
    expect(announcementFor('Exercise', state('checking'))).toBeNull()
    expect(announcementFor('Exercise', TX_IDLE)).toBeNull()
    expect(announcementFor('Exercise', state('signing'))).toEqual({ message: 'Exercise: Waiting for signature.', politeness: 'polite' })
    expect(announcementFor('Exercise', state('confirmed', 'fee-charged'))).toEqual({ message: 'Exercise: Confirmed.', politeness: 'polite' })
    expect(announcementFor('Exercise', state('confirmed', 'fee-charged'), 'Exercised')).toEqual({ message: 'Exercise: Exercised.', politeness: 'polite' })
    expect(announcementFor('Exercise', state('declined'))!.politeness).toBe('polite')
    for (const phase of ['failed', 'unknown', 'expired'] as const) expect(announcementFor('Exercise', state(phase, 'outcome-unknown', 'x'))!.politeness).toBe('assertive')
    // A failure without a message still reads as a sentence.
    expect(announcementFor('Exercise', state('failed'))!.message).toBe('Exercise: Failed. Nothing was sent. No fee was charged.')
  })
})

describe('a refusal after sending', () => {
  it('never says nothing was sent, and still says no fee was charged', async () => {
    const { describeTx, txEffectText, TX_EFFECT_TEXT, TX_REFUSED_ON_SEND } = await import('./copy')
    const refused = { phase: 'failed', hash: null, maxTime: null, ledger: null, error: 'The sequence number is out of date.', effect: 'nothing-sent', stoppedAt: 'submitting' } as const
    expect(txEffectText(refused)).toBe(TX_REFUSED_ON_SEND)
    expect(TX_REFUSED_ON_SEND).not.toMatch(/nothing was sent/i)
    expect(TX_REFUSED_ON_SEND).toMatch(/no fee was charged/i)
    expect(describeTx(refused)?.detail).toBe(`The sequence number is out of date. ${TX_REFUSED_ON_SEND}`)
    // Before anything was sent the usual sentence stands.
    expect(txEffectText({ ...refused, stoppedAt: 'checking' })).toBe(TX_EFFECT_TEXT['nothing-sent'])
    expect(txEffectText({ ...refused, stoppedAt: undefined })).toBe(TX_EFFECT_TEXT['nothing-sent'])
  })
})
