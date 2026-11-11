import { describe, expect, it } from 'vitest'
import type { OptionState } from '../../core/options/types'
import { ME, MAKER, opt } from './fixtures.testhelper'
import { lifecycleSteps } from './lifecycleSteps'

const ids = (state: OptionState, holder: string | null = ME) => lifecycleSteps(opt({ state, holder })).map((s) => `${s.id}:${s.status}`)

describe('lifecycleSteps', () => {
  it('shows an open offer as waiting for a buyer', () => {
    expect(ids('offered', null)).toEqual(['offered:done', 'bought:current', 'at-deadline:upcoming'])
  })

  it('puts an active option inside its exercise window, with the deadline and the aftermath still to come', () => {
    expect(ids('active')).toEqual(['offered:done', 'bought:done', 'window:current', 'at-deadline:upcoming', 'after:upcoming'])
  })

  it('leaves the claim open after an exercise and closes it once settled', () => {
    expect(ids('exercised')).toEqual(['offered:done', 'bought:done', 'exercised:done', 'claim:current'])
    expect(ids('settled')).toEqual(['offered:done', 'bought:done', 'exercised:done', 'claim:done'])
  })

  it('leaves the reclaim open after an expiry, for a sold option and for an unsold offer', () => {
    expect(ids('expired')).toEqual(['offered:done', 'bought:done', 'expired:done', 'reclaim:current'])
    expect(ids('expired', null)).toEqual(['offered:done', 'expired:done', 'reclaim:current'])
    expect(ids('reclaimed')).toEqual(['offered:done', 'bought:done', 'expired:done', 'reclaim:done'])
  })

  it('ends a cancelled offer at its cancellation', () => {
    expect(ids('cancelled', null)).toEqual(['offered:done', 'cancelled:done'])
  })

  it('has at most one current step, and none once everything is done', () => {
    for (const state of ['offered', 'active', 'exercised', 'settled', 'expired', 'reclaimed', 'cancelled'] as const) {
      const current = lifecycleSteps(opt({ state })).filter((s) => s.status === 'current')
      expect(current.length, state).toBe(state === 'settled' || state === 'reclaimed' || state === 'cancelled' ? 0 : 1)
    }
  })

  it('says who acts and states the exact legs', () => {
    const window = lifecycleSteps(opt()).find((s) => s.id === 'window')!
    expect(window.actor).toBe('The holder acts')
    expect(window.text).toBe('The holder can exercise at any time: deliver 5.00 FUND and receive 50.00 USDx in the same transaction.')
    expect(window.atDeadline).toBe(true)
    const call = lifecycleSteps(opt({ kind: 'call' })).find((s) => s.id === 'window')!
    expect(call.text).toContain('pay 50.00 USDx and receive 5.00 FUND')
  })

  it('says that nothing settles by itself', () => {
    const at = lifecycleSteps(opt()).find((s) => s.id === 'at-deadline')!
    expect(at.text).toContain('Nothing settles by itself.')
    expect(at.actor).toBe('Nobody acts')
  })

  it('tells both kinds of writer what waits to be claimed', () => {
    expect(lifecycleSteps(opt({ state: 'exercised', writer: MAKER })).at(-1)!.text).toBe('5.00 FUND waits in the contract until the writer claims it.')
    expect(lifecycleSteps(opt({ kind: 'call', state: 'exercised' })).at(-1)!.text).toBe('50.00 USDx waits in the contract until the writer claims it.')
  })

  it('names the contract calls whose transaction a done step can link', () => {
    const steps = lifecycleSteps(opt({ state: 'settled' }))
    expect(steps.find((s) => s.id === 'bought')!.actions).toEqual(['buy', 'buy-resale'])
    expect(steps.find((s) => s.id === 'exercised')!.actions).toEqual(['exercise'])
    expect(steps.find((s) => s.id === 'claim')!.actions).toEqual(['claim-delivery'])
    expect(lifecycleSteps(opt({ state: 'reclaimed' })).at(-1)!.actions).toEqual(['reclaim'])
    expect(lifecycleSteps(opt({ state: 'cancelled', holder: null })).at(-1)!.actions).toEqual(['cancel-offer'])
  })
})
