import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, MARGIN_BANNED_WORDS, clawbackShortfallDisclosure, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'

/** Every string in the module: constants, list entries, object fields and what the sentence builders return. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') out.push(String((value as (...args: string[]) => unknown)('1,060.00', '1,080.00')))
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

const ALL = strings(copy)

describe('Reserves copy', () => {
  it('has something to check', () => {
    expect(ALL.length).toBeGreaterThan(60)
  })

  it('uses no promise word, also not about Margin', () => {
    for (const text of ALL) expect(findBannedWords(text, MARGIN_BANNED_WORDS), text).toEqual([])
  })

  it('carries no disclaimer tagline, and no hedge word after the name of Margin', () => {
    for (const text of ALL) expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
    for (const text of ALL) expect(text, text).not.toMatch(/experimental|fictional/i)
    expect(copy.MARGIN_HEADING).toBe('Margin contract')
  })

  it('never names a price as a market or oracle price', () => {
    for (const text of ALL) expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
  })

  it('has no em dash, arrow, exclamation mark or middle dot', () => {
    for (const text of ALL) expect(text, text).not.toMatch(/[—→←⇒!·]/)
  })

  it('is sentence case: no word in capitals except codes and ids', () => {
    const allowed = new Set(['USDx', 'UTC', 'RPC'])
    for (const text of ALL) {
      const shouting = text.match(/\b[A-Z]{4,}\b/g)?.filter((w) => !allowed.has(w)) ?? []
      expect(shouting, text).toEqual([])
    }
  })

  it('does not retype the clawback sentence: it comes from core/disclosures', () => {
    const required = clawbackShortfallDisclosure('BOND')
    for (const text of ALL) expect(text.includes('first come, first served'), text).toBe(false)
    expect(required).toContain('Clawback shortfall on BOND')
  })

  it('states the Covered facts as rows, none opening with a one-word verdict its sentence repeats', () => {
    expect(copy.COVERED_FACTS.map((f) => f.label)).toEqual(['Admin', 'Upgrades', 'Oracle', 'Asset listing', 'Audit'])
    for (const fact of [...copy.COVERED_FACTS, ...copy.MARGIN_FACTS]) expect(fact.text, fact.label).not.toMatch(/^(None|Open)\./)
    expect(copy.COVERED_FACTS[0].text).toBe('The contract has no admin function and no owner.')
  })

  it('uses the Covered words: maker and deadline, never writer or expiry as a noun', () => {
    for (const item of Object.values(copy.ITEM_COPY)) expect(item.meaning, item.meaning).not.toMatch(/\bwriter\b|\bexpiry\b/)
  })

  it('names the table columns exactly', () => {
    expect(copy.TABLE_COLUMNS).toEqual(['Token', 'Locked', 'Held', 'Difference'])
  })
})
