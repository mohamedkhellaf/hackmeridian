import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, DISCLOSURE_HOMES, findBannedWords } from '../../../core/disclosures'
import { GUIDED_INTENTS } from '../../../core/payoff/strategies'
import * as copy from './copy'

const words: copy.Words = { a: 'BOND', q: 'USDx', qty: '2.00', strike: '99.00', strikeTotal: '198.00', premium: '1.36' }
const bare: copy.Words = { ...words, premium: null }
const facts: copy.FactWords = { ...words, breakeven: '98.32', maxLoss: '2.16', maxGain: '4.56', reference: 'demo price 99.40' }
const sample = { ...facts, collateral: '198.00 USDx', deadline: '20 Nov 2026, 08:00 UTC', value: '190.00' }

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
    for (const w of [words, bare]) {
      for (const used of [true, false]) out.push(copy.outcomeSentence(id, used, { ...w, value: '190.00' }))
      for (const route of ['take', 'own'] as const) for (const step of Object.values(copy.timelineSteps(id, route, w))) out.push(step.actor, step.title, step.body)
    }
    for (const f of [facts, { ...facts, reference: null, maxGain: null }]) out.push(copy.BREAKEVEN_HINT[id](f), copy.MAX_LOSS_HINT[id](f), copy.THIRD_FACT[id].hint(f), copy.THIRD_FACT[id].value(f))
  }
  out.push(copy.SCENARIO.low('BOND', '95.00'), copy.SCENARIO.mid('BOND', '99.40', 'demo price'), copy.SCENARIO.mid('BOND', '99.00', null), copy.SCENARIO.high('BOND', '105.00'))
  out.push(copy.HOLD('12.00', 'BOND'), copy.HAVE('2,500.00', 'USDx'), copy.LOCKS('198.00', 'USDx'), copy.NEEDS_LATER('198.00', 'USDx'), copy.OVER_HOLDING('12.00', 'BOND'))
  out.push(copy.SHORT_ASSET('12.00', '15.00', '3.00', 'BOND'), copy.SHORT_QUOTE('100.00', '198.00', '98.00', 'USDx'), copy.LOWEST_OFFER('0.52', 'USDx', '2.00', 'BOND'))
  out.push(copy.DISTANCE_FULL('0.4% below', 'demo price', '99.40'), copy.AT_REFERENCE('demo price', '99.40'), copy.OWN_PREMIUM_NOTE('1.04', 'USDx'), copy.qtyNotExact('BOND'))
  out.push(copy.MAX_HOLDING('12.00', 'BOND'), copy.MAX_AFFORD('25.51', 'BOND'), copy.TIME_LEFT('8 d 20 h'), copy.YOUR_TIME('20 Nov 2026, 09:00 CET'), copy.matchPrice('0.52'), copy.perUnitHint('0.52', 'USDx', 'BOND'))
  out.push(copy.SLIDER_LABEL('BOND'), copy.READOUT_LABEL('BOND', '95.00'))
  out.push(copy.ANNOUNCE.offer('1.36', 'USDx'), copy.ANNOUNCE.listing('1.36', 'USDx'), copy.ANNOUNCE.request('1.60', 'USDx'))
  for (const side of ['buy', 'write'] as const) out.push(copy.FALLBACK[side].body('2.00 BOND'))
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

  it('says that nothing settles by itself, for every intent', () => {
    expect(copy.WHEN_LEAD).toContain('Nothing settles by itself')
    expect(copy.WHEN_LEAD).toContain('must exercise it before the deadline')
    for (const { id } of GUIDED_INTENTS) expect(copy.timelineSteps(id, 'take', words).at.body).toContain('Nothing settles by itself')
  })

  it('drops the premium clause when no premium is known', () => {
    for (const { id } of GUIDED_INTENTS) for (const used of [true, false]) expect(copy.outcomeSentence(id, used, { ...bare, value: '190.00' })).not.toMatch(/premium|paid/)
  })
})
