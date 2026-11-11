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
  it('collects the copy', () => {
    expect(ALL.length).toBeGreaterThan(120)
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
    expect(copy.listCountLine(3, 0, false)).toBe('Showing 3 reference assets. No other asset is listed in the contract.')
    expect(copy.listCountLine(3, 1, false)).toBe('Showing 3 reference assets. 1 more is listed in the contract.')
    expect(copy.listCountLine(1, 4, false)).toBe('Showing 1 reference asset. 4 more are listed in the contract.')
    expect(copy.listCountLine(7, 0, true)).toBe('Showing all 7 assets listed in the contract.')
    expect(copy.listCountLine(1, 0, true)).toBe('Showing the 1 asset listed in the contract.')
  })
})
