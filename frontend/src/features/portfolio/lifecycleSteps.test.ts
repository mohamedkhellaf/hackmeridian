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

  it('speaks to the viewer about its own steps and states the exact legs', () => {
    const holder = lifecycleSteps(opt(), { role: 'holder' }).find((s) => s.id === 'window')!
    expect(holder.text).toBe('You can exercise at any time: deliver 5.00\u00A0RWA and receive 50.00\u00A0USDx in the same transaction.')
    const viewer = lifecycleSteps(opt()).find((s) => s.id === 'window')!
    expect(viewer.text).toBe('The holder can exercise at any time: deliver 5.00\u00A0RWA and receive 50.00\u00A0USDx in the same transaction.')
    const call = lifecycleSteps(opt({ kind: 'call' }), { role: 'holder' }).find((s) => s.id === 'window')!
    expect(call.text).toContain('pay 50.00\u00A0USDx and receive 5.00\u00A0RWA')
    const maker = lifecycleSteps(opt({ writer: ME, holder: MAKER }), { role: 'writer' })
    expect(maker[0].text).toBe('You locked 50.00\u00A0USDx in the contract and asked a premium of 1.80\u00A0USDx.')
    expect(maker.find((s) => s.id === 'after')!.text).toContain('You claim what an exercise left')
  })

  it('dates the step "The deadline passes" in every state that has one', () => {
    for (const state of ['offered', 'active', 'expired', 'reclaimed'] as const) {
      const steps = lifecycleSteps(opt({ state, holder: state === 'offered' ? null : ME }))
      const dated = steps.filter((s) => s.atDeadline)
      expect(dated.map((s) => s.title), state).toEqual(['The deadline passes'])
    }
    expect(lifecycleSteps(opt()).find((s) => s.id === 'at-deadline')!.text).toBe('If the holder has not exercised, the option expires.')
    expect(lifecycleSteps(opt(), { role: 'holder' }).find((s) => s.id === 'at-deadline')!.text).toBe('If you have not exercised, the option expires.')
  })

  it('tells both kinds of maker what waits to be claimed', () => {
    expect(lifecycleSteps(opt({ state: 'exercised', writer: MAKER })).at(-1)!.text).toBe('5.00\u00A0RWA waits in the contract until the maker claims it.')
    expect(lifecycleSteps(opt({ kind: 'call', state: 'exercised' }), { role: 'writer' }).at(-1)!.text).toBe('50.00\u00A0USDx waits in the contract until you claim it.')
  })

  it('gives a resale its own step, and never says the reseller paid the original premium', () => {
    const steps = lifecycleSteps(opt(), { role: 'holder', resold: true })
    expect(steps.map((s) => s.id)).toEqual(['offered', 'bought', 'resold', 'window', 'at-deadline', 'after'])
    expect(steps.find((s) => s.id === 'bought')!.text).toBe('A buyer paid the premium of 1.80\u00A0USDx to the maker and became the holder.')
    expect(steps.find((s) => s.id === 'resold')!.actions).toEqual(['buy-resale'])
  })

  it('starts an option made by filling a request with the request', () => {
    const steps = lifecycleSteps(opt(), { role: 'holder', fromRequest: true, paid: true })
    expect(steps.map((s) => s.title).slice(0, 2)).toEqual(['Requested', 'Request filled'])
    expect(steps[0].text).toBe('You escrowed a premium of 1.80\u00A0USDx for this option.')
    expect(steps[1].createdBy).toEqual(['fill-bid'])
    expect(steps.some((s) => s.id === 'bought')).toBe(false)
    // A holder whose own request it was not is told about the buyer in the third person.
    expect(lifecycleSteps(opt(), { role: 'holder', fromRequest: true })[0].text).toBe('A buyer escrowed a premium of 1.80\u00A0USDx for this option.')
  })

  it('says "you paid" only when the payment of this wallet is proven', () => {
    const bought = (ctx: Parameters<typeof lifecycleSteps>[1]) => lifecycleSteps(opt(), ctx).find((s) => s.id === 'bought')!.text
    expect(bought({ role: 'holder', paid: true })).toBe('You paid the premium of 1.80\u00A0USDx to the maker and became the holder.')
    // Holding the option proves nothing: it may have come by a resale elsewhere or a transfer.
    expect(bought({ role: 'holder' })).toBe('A buyer paid the premium of 1.80\u00A0USDx to the maker and became the holder.')
    expect(bought({ role: 'holder', paid: true, resold: true })).toBe('A buyer paid the premium of 1.80\u00A0USDx to the maker and became the holder.')
  })

  it('names the contract calls whose transaction a done step can link', () => {
    const steps = lifecycleSteps(opt({ state: 'settled' }))
    expect(steps.find((s) => s.id === 'bought')!.actions).toEqual(['buy'])
    expect(steps.find((s) => s.id === 'exercised')!.actions).toEqual(['exercise'])
    expect(steps.find((s) => s.id === 'claim')!.actions).toEqual(['claim-delivery'])
    expect(lifecycleSteps(opt({ state: 'reclaimed' })).at(-1)!.actions).toEqual(['reclaim'])
    expect(lifecycleSteps(opt({ state: 'cancelled', holder: null })).at(-1)!.actions).toEqual(['cancel-offer'])
  })
})
