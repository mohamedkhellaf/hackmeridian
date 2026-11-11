import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, DISCLOSURE_HOMES, findBannedWords } from '../../../core/disclosures'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import * as copy from './copy'

const words: copy.Words = { a: 'BOND', q: 'USDx', qty: '2.00', strike: '99.00', strikeTotal: '198.00', premium: '1.36' }
const bare: copy.Words = { ...words, premium: null }
const facts: copy.FactWords = { ...words, premiumPerUnit: '0.68' }
const sample = { ...facts, collateral: '198.00\u00a0USDx', deadline: '20 Nov 2026, 08:00 UTC', value: '190.00' }
const outcome: copy.OutcomeWords = { ...words, premium: '1.36', value: '190.00' }

/**
 * Every string the module can produce: constants as they are, templates called with the sample words. A template
 * that takes plain strings instead prints the sample object as text: that result is dropped here, and the
 * template is called by hand in `everything`.
 */
function collect(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (!/\[object|undefined/.test(value)) out.push(value)
  } else if (typeof value === 'function') {
    try {
      collect((value as (...args: unknown[]) => unknown)(sample), out)
    } catch {
      // Another signature: called by hand below.
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) collect(v, out)
  return out
}

function everything(): string[] {
  const out = collect(copy)
  for (const { id } of GUIDED_INTENTS) {
    out.push(copy.INTENT_COPY[id].lead('BOND', 'USDx'), copy.INTENT_COPY[id].level('99.00'), copy.INTENT_COPY[id].heading('BOND'))
    for (const used of [true, false]) out.push(copy.outcomeSentence(id, used, outcome))
    for (const w of [words, bare]) for (const route of ['take', 'own'] as const) for (const step of Object.values(copy.timelineSteps(id, route, w))) out.push(step.title, step.body)
    if (id !== 'earn-hold') out.push(copy.MAX_LOSS_HINT[id](facts))
  }
  out.push(copy.GIVE_UP.value(words), copy.GIVE_UP.hint(words))
  out.push(copy.SCENARIO.low('BOND', '95.00'), copy.SCENARIO.high('BOND', '105.00'))
  out.push(copy.HOLD('12.00', 'BOND'), copy.HAVE('2,500.00', 'USDx'), copy.LOCKS('198.00', 'USDx'), copy.NEEDS_LATER('198.00', 'USDx'), copy.OVER_HOLDING('12.00', 'BOND'))
  out.push(copy.SHORT_ASSET('12.00', '15.00', '3.00', 'BOND'), copy.SHORT_QUOTE('100.00', '198.00', '98.00', 'USDx'), copy.LOWEST_OFFER('0.52', 'USDx', '2.00', 'BOND'))
  out.push(copy.DISTANCE_FULL('0.4% below', 'demo price', '99.40'), copy.AT_REFERENCE('demo price', '99.40'), copy.OWN_PREMIUM_NOTE('1.04', 'USDx'), copy.ASSUMED_NOTE('0.60', 'USDx'), copy.qtyNotExact('BOND'))
  out.push(copy.MAX_HOLDING('12.00', 'BOND'), copy.MAX_LOT('5.00', 'BOND'), copy.MAX_AFFORD('25.51', 'BOND'), copy.TIME_LEFT('8 d 20 h'), copy.YOUR_TIME('20 Nov 2026, 09:00 CET'), copy.matchPrice('0.52'), copy.perUnitHint('0.52', 'USDx'))
  out.push(copy.SLIDER_LABEL('BOND'), copy.READOUT_LABEL('BOND', '95.00'), copy.NO_SINGLE_OFFER('5.00', 'BOND'), copy.READ_AT('14:27:00'))
  out.push(copy.ANNOUNCE.offer('1.36', 'USDx'), copy.ANNOUNCE.listing('1.36', 'USDx'), copy.ANNOUNCE.request('1.60', 'USDx'), copy.ANNOUNCE.terms('5.00', 'BOND', '99.00', 'USDx', '27 Nov'))
  out.push(copy.COVER(1, '2.00', '5.00', 'BOND'), copy.COVER(2, '4.00', '5.00', 'BOND'), copy.START_WITH('2.00', 'BOND', '0.68'))
  out.push(copy.DIFFERS.qty('2.00', '5.00', 'BOND'), copy.DIFFERS.strike('Floor 97.00', '99.00'), copy.DIFFERS.expiry('27 Nov', '20 Nov'), copy.PER_UNIT('0.68', 'USDx'), copy.IN_TOTAL('1.36', 'USDx'))
  out.push(copy.OFF_GRID.strike('97.50', '99.00', 'USDx'), copy.OFF_GRID.expiry('21 Nov', '20 Nov'), copy.CANNOT_PAY('1.00', '1.36', 'USDx'), copy.WHEN.at('20 Nov', '08:00 UTC'))
  out.push(copy.NO_GRID_OTHERS(1), copy.NO_GRID_OTHERS(3))
  out.push(copy.OWN.holding(sample), copy.OWN.written(sample), copy.OWN.offer('000004', '2.00', 'BOND', '1.20', 'USDx'), copy.OWN.request('000004', '2.00', 'BOND', '0.50', 'USDx'))
  for (const side of ['buy', 'write'] as const) out.push(copy.LOTS[side]('2.00 and 5.00', 'BOND'), copy.OWN_SUMMARY[side](sample))
  out.push(copy.LOCK_SUMMARY(sample))
  for (const kind of ['holding', 'written', 'offer', 'request'] as const) out.push(copy.OWN_SHORT[kind]('58'))
  for (const lead of Object.values(copy.ANOTHER)) out.push(copy.another(lead, copy.INTENT_COPY.floor.summary(sample)))
  for (const side of ['buy', 'write'] as const) out.push(copy.FALLBACK[side].body('2.00\u00a0BOND'))
  return [...new Set(out)]
}

describe('guided copy', () => {
  const all = everything()

  it('covers a real body of text', () => {
    expect(all.length).toBeGreaterThan(150)
  })

  it('makes no promise and names no price it cannot name', () => {
    for (const text of all) {
      expect(findBannedWords(text, BANNED_WORDS), text).toEqual([])
      expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
    }
  })

  it('has no em dash, arrow, exclamation mark, emoji or unfilled figure', () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/[—←-⇿!]|\p{Extended_Pictographic}/u)
      expect(text, text).not.toMatch(/undefined|null|NaN|\[object/)
      expect(text, text).not.toMatch(/ {2}| ,| \./)
    }
  })

  it('never retypes a required sentence', () => {
    for (const { text: required } of DISCLOSURE_HOMES) for (const text of all) expect(text.includes(required), `${required} in: ${text}`).toBe(false)
  })

  it('names put, call, strike and premium once each in the sentence that introduces them', () => {
    for (const { id, optionKind } of GUIDED_INTENTS) {
      const lead = copy.INTENT_COPY[id].lead('BOND', 'USDx')
      expect(lead).toContain(`called a ${optionKind}`)
      expect(lead).toContain('premium')
      expect(lead).toContain('strike')
    }
  })

  it('keeps the intent picker free of contract words', () => {
    for (const { id, name } of GUIDED_INTENTS) expect(`${name} ${copy.INTENT_COPY[id].line}`).not.toMatch(/\b(put|call|strike)\b/i)
  })

  it('states the consequence at the deadline itself, without the slogan', () => {
    for (const { id } of GUIDED_INTENTS)
      for (const route of ['take', 'own'] as const) {
        const steps = copy.timelineSteps(id, route, words)
        expect(steps.at.title).toBe('The deadline passes')
        expect(steps.at.body).toMatch(/^If /)
        for (const step of Object.values(steps)) expect(step.body).not.toContain('Nothing settles by itself')
      }
  })

  it("tells an order of one's own as what happens if someone takes it, and if nobody does", () => {
    for (const id of ['floor', 'lock-buy'] as const) {
      const steps = copy.timelineSteps(id, 'own', words)
      expect(steps.until.title).toMatch(/^If a maker accepts/)
      expect(steps.at.body).toContain('If nobody accepted, the request can no longer be filled.')
      expect(steps.after.body).toContain('cancel the request')
      expect(steps.at.body).not.toMatch(/^If you have not exercised/)
    }
    for (const id of ['earn-hold', 'earn-buy'] as const) {
      const steps = copy.timelineSteps(id, 'own', words)
      expect(steps.until.title).toMatch(/^If a buyer takes your offer/)
      expect(steps.after.body).toContain('You keep the premium only if a buyer took the offer.')
      expect(steps.after.body).not.toContain('either way')
    }
  })

  it('says what is escrowed before posting, not that it already waits', () => {
    expect(copy.OWN_SUMMARY.buy(sample)).toMatch(/^You escrow 1\.36\u00a0USDx now\. It waits in the contract/)
  })

  it('never prints a loss figure for a written covered call', () => {
    expect(Object.keys(copy.MAX_LOSS_HINT)).not.toContain('earn-hold')
    expect(copy.GIVE_UP.value(words)).toBe('Every rise above 99.00\u00a0USDx per BOND')
    expect(`${copy.GIVE_UP.value(words)} ${copy.GIVE_UP.hint(words)}`).not.toMatch(/no cap|unlimited/i)
  })

  it('says each figure of the deal once: no sentence restates the order or narrates a control', () => {
    const names = Object.keys(copy)
    for (const gone of ['FOUND', 'FOUND_RESALE', 'IN_CONTRACT_WORDS', 'NEXT_NOTE', 'GUEST_NOTE', 'OUTCOME_HINT', 'NO_PREMIUM_NOTE', 'WHEN_LEAD', 'OWN_SUMMARY_NO_PREMIUM', 'THIRD_FACT']) expect(names).not.toContain(gone)
    for (const text of all) expect(text, text).not.toMatch(/Arrow keys|Next: the ticket|In contract words/)
  })

  it('labels the quantity as the rest of the app does, never in the first person', () => {
    for (const { id } of GUIDED_INTENTS) expect(copy.INTENT_COPY[id].qtyLabel).toBe(id === 'earn-hold' || id === 'earn-buy' ? 'Quantity to lock' : 'Quantity')
  })

  it('ends no step on a line that defines a word or comforts the reader', () => {
    for (const { id } of GUIDED_INTENTS)
      for (const route of ['take', 'own'] as const)
        for (const w of [words, bare])
          for (const step of Object.values(copy.timelineSteps(id, route, w))) expect(step.body, step.body).not.toMatch(/This is called exercising|You decide if and when/)
    // The word itself stays in the step that uses the right, where the page makes it a glossary term.
    for (const { id } of GUIDED_INTENTS) expect(copy.timelineSteps(id, 'take', words).until.body).toMatch(/\bexercise\b/)
    expect(copy.timelineSteps('floor', 'take', words).after.body).toBe('If you did not exercise, you still hold your BOND.')
    expect(copy.timelineSteps('earn-hold', 'take', words).after.body).toContain('The premium is yours either way.')
  })

  it("says a seller's deal before a premium is typed, and that a second order is another one", () => {
    expect(copy.LOCK_SUMMARY(sample)).toBe('You lock 198.00\u00a0USDx. You are paid the premium you ask only if a buyer takes the offer before 20 Nov 2026, 08:00 UTC.')
    expect(copy.another(copy.ANOTHER.offer, 'You pay 1.40 USDx now.')).toBe('Another offer on these terms: you pay 1.40 USDx now.')
    expect(copy.OWN_SHORT.holding('58')).toBe('You hold option No. 58.')
  })

  it('counts in words in a sentence', () => {
    expect(copy.COVER(2, '4.00', '5.00', 'BOND')).toBe('Two smaller offers at these terms cover 4.00 of your 5.00\u00a0BOND, in two purchases. Each is sold whole and signed on its own.')
  })

  it('never lets a line break part a figure from its unit', () => {
    for (const text of all) expect(text, text).not.toMatch(/\d (USDx|BOND)\b/)
  })
})
