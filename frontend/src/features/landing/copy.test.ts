import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, MARGIN_BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'

/** Every string of the landing copy, with the functions called on sample figures. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    const args = Array.from({ length: (value as (...a: unknown[]) => unknown).length }, (_, i) => (i % 2 === 0 ? '10.00' : 'USDx'))
    const result = (value as (...a: unknown[]) => unknown)(...args)
    strings(result, out)
  } else if (Array.isArray(value)) for (const item of value) strings(item, out)
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) strings(item, out)
  return out
}

const COPY = [copy.STATUS, copy.NAV, copy.HERO, copy.WIDGET, copy.INTENTS, copy.LIFECYCLE, copy.PROOF, copy.DIFFERENT, copy.MARGIN, copy.LIMITS, copy.QUESTIONS, copy.CLOSING, copy.FOOTER]
const ALL = strings(COPY)

describe('landing copy', () => {
  it('has something to check', () => {
    expect(ALL.length).toBeGreaterThan(150)
  })

  it('makes no promise the product cannot keep', () => {
    for (const text of ALL) expect(findBannedWords(text, BANNED_WORDS), text).toEqual([])
  })

  it('carries no disclaimer tagline (owner direction of 11 Nov 2026)', () => {
    for (const text of ALL) {
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
      expect(findBannedWords(text, ['testnet only', 'experimental', 'fictional']), text).toEqual([])
    }
  })

  it('never calls a price a market, oracle or live price', () => {
    for (const text of ALL) expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
  })

  it('never calls anything fully collateralized: the phrase is not used on a page that also shows Margin', () => {
    for (const text of ALL) expect(findBannedWords(text, MARGIN_BANNED_WORDS), text).toEqual([])
  })

  it('uses no em dash, arrow, exclamation mark or emoji, and no upper-case shouting', () => {
    for (const text of ALL) {
      expect(text, text).not.toMatch(/[—←-⇿!]/)
      expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u)
      // No word of five letters or more in capitals (asset codes and XLM are shorter).
      expect(text, text).not.toMatch(/\b[A-Z]{5,}\b/)
    }
  })

  it('ends sentences with a full stop and starts them with a capital', () => {
    const sentences = [copy.HERO.lede, copy.MARGIN.body, copy.MARGIN.isolation, ...copy.QUESTIONS.items.map((q) => q.a), ...copy.DIFFERENT.items.flatMap((d) => [d.body, d.limit]), ...copy.LIMITS.rows.flatMap((r) => [r.exists(250), r.missing])]
    for (const text of sentences) {
      expect(text, text).toMatch(/^[A-Z0-9]/)
      expect(text, text).toMatch(/\.$/)
    }
  })

  it('says of Margin only what may be said', () => {
    const margin = strings(copy.MARGIN).join(' ')
    expect(margin).toContain('Payouts can be reduced; any deficit is shown.')
    expect(margin).toContain('set by the team’s publisher')
    expect(margin).toContain('It shares no storage and no balance with the covered contract.')
  })

  it('names the intents as the rest of the app does, without the word that was removed on purpose', () => {
    expect(copy.INTENTS.items.map((i) => i.name)).toEqual(['Set a floor', 'Earn on what you hold', 'Earn while waiting to buy'])
  })

  it('answers every question', () => {
    expect(copy.QUESTIONS.items).toHaveLength(8)
    for (const item of copy.QUESTIONS.items) expect(item.q).toMatch(/\?$/)
  })
})
