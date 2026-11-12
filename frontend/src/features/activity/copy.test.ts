import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, MARGIN_BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'

/** Every string in the module: constants, object fields and what the sentence builders return. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    // Every builder takes counts or short texts: call each with a singular and a plural set.
    for (const args of [
      [1, 0, 0],
      [6, 1, 2],
    ])
      out.push(String((value as (...a: number[]) => unknown)(...args)))
  } else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

const ALL = strings(copy)

describe('Activity copy', () => {
  it('has something to check', () => {
    expect(ALL.length).toBeGreaterThan(30)
  })

  it('uses no promise word and no disclaimer tagline', () => {
    for (const text of ALL) {
      expect(findBannedWords(text, MARGIN_BANNED_WORDS), text).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
    }
  })

  it('has no em dash, arrow, exclamation mark or middle dot', () => {
    for (const text of ALL) expect(text, text).not.toMatch(/[\u2014\u2192\u2190\u21d2!\u00b7]/)
  })

  it('says where the list lives once, in the description', () => {
    expect(copy.PAGE_DESCRIPTION).toContain('Another browser or device shows none of them.')
    expect(copy.PAGE_DESCRIPTION_GUEST).toContain('Another browser or device shows none of them.')
  })

  it('says an unknown outcome in the ticket\'s words, with its cut-off when known', () => {
    expect(copy.unknownNote('14:37:47 UTC')).toBe(
      'The transaction was sent and no ledger has included it yet. It can still go through until 14:37:47 UTC. Do not send another one before that: check again first.',
    )
    expect(copy.unknownNote(null)).toBe('The transaction was sent and no ledger has included it yet. It can still go through. Do not send another one: check again first.')
    expect(copy.checkedNote('14:22:05 UTC')).toBe('Checked at 14:22:05 UTC: not included yet.')
  })

  it('counts with the right plural', () => {
    expect(copy.countLine(1, 0, 0)).toBe('1 transaction.')
    expect(copy.countLine(6, 1, 1)).toBe('6 transactions. 1 in progress. 1 with an unknown outcome.')
    expect(copy.clearedLine(1)).toBe('One finished transaction removed.')
    expect(copy.clearedLine(3)).toBe('3 finished transactions removed.')
    expect(copy.cleared(1)).toBe('One finished transaction removed from the list.')
    expect(copy.cleared(4)).toBe('4 finished transactions removed from the list.')
  })
})
