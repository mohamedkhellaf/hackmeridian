import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_WORDS, DISCLOSURE_HOMES, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'

/** Every string this feature can put on screen: constants as they are, functions called with sample values. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    strings(fn.length >= 3 ? fn(3, 2, false) : fn('BOND', 2, 3), out)
  } else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

const ALL = strings(copy)

describe('markets copy', () => {
  it('names the premium columns by the source of the price they sit near', () => {
    expect(copy.nearPriceHead('put', 'demo')).toBe('Put near demo price')
    expect(copy.nearPriceHead('call', 'demo')).toBe('Call near demo price')
    expect(copy.nearPriceHead('put', 'fixed')).toBe('Put near faucet price')
    expect(copy.nearPriceHead('call', null)).toBe('Call near reference price')
    expect(copy.nearTerms('99.00', '13 Nov')).toBe('at 99.00, 13 Nov')
  })

  it('says who pays in two words, in every intent row', () => {
    expect(Object.values(copy.INTENT_COPY).map((c) => c.payer)).toEqual(['You pay', 'You are paid', 'You are paid', 'You pay'])
  })

  it('describes a demo token without claiming a network on mock data', () => {
    // The unit tests run without a contract id: a mock build.
    expect(copy.TEST_TOKEN_NOTE).toBe(copy.TEST_TOKEN_NOTE_MOCK)
    expect(copy.TEST_TOKEN_NOTE_MOCK).not.toMatch(/Testnet|issuer account/)
  })

  it('collects the copy', () => {
    expect(ALL.length).toBeGreaterThan(100)
    expect(ALL).toContain('What do you want to do?')
    expect(ALL).toContain('No open offers on BOND.')
  })

  it('uses none of the words the product never says', () => {
    const hits = ALL.flatMap((text) => findBannedWords(text, BANNED_WORDS).map((word) => `${word}: ${text}`))
    expect(hits).toEqual([])
  })

  it('never calls a reference price a market, oracle or live price', () => {
    const hits = ALL.flatMap((text) => findBannedWords(text, BANNED_PRICE_TERMS).map((word) => `${word}: ${text}`))
    expect(hits).toEqual([])
  })

  it('has no em dash, arrow, exclamation mark or emoji, and no uppercase label', () => {
    for (const text of ALL) {
      expect(text, text).not.toMatch(/[—←-⇿!]|\p{Extended_Pictographic}/u)
      // Sentence case: no word of four or more letters in capitals, except token codes passed in by the test.
      expect(text.replace(/\b(BOND|XLM)\b/g, ''), text).not.toMatch(/\b[A-Z]{4,}\b/)
    }
  })

  it('does not retype a required sentence: those come from core/disclosures', () => {
    for (const home of DISCLOSURE_HOMES) expect(ALL, home.id).not.toContain(home.text)
  })

  it('says how many assets the index shows', () => {
    // Only said when assets are hidden: a count of the rows on screen alone tells nothing.
    expect(copy.listCountLine(3, 1)).toBe('Showing 3 reference assets. 1 more is listed in the contract.')
    expect(copy.listCountLine(1, 4)).toBe('Showing 1 reference asset. 4 more are listed in the contract.')
  })
})
