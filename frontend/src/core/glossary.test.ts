import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from './disclosures'
import { GLOSSARY, definitionOf, glossaryEntry } from './glossary'

describe('glossary (one home for every definition)', () => {
  it('has one entry per id, in alphabetical order, each one sentence', () => {
    const ids = GLOSSARY.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    const terms = GLOSSARY.map((g) => g.term.toLowerCase())
    expect([...terms].sort((a, b) => a.localeCompare(b))).toEqual(terms)
    for (const g of GLOSSARY) {
      expect(g.definition, g.term).toMatch(/^[A-Z].*\.$/)
      expect(g.definition, g.term).not.toMatch(/[—–→!]/)
      expect(findBannedWords(g.definition, [...BANNED_WORDS, ...BANNED_TAGLINES, ...BANNED_PRICE_TERMS]), g.term).toEqual([])
    }
  })

  it('gives the sentence a Term popover shows', () => {
    expect(definitionOf('premium')).toBe('The price of the option, paid once by the buyer to the maker at purchase and never refunded.')
    expect(glossaryEntry('breakeven')?.term).toBe('Breakeven')
    expect(definitionOf('collateral')).toMatch(/^What the maker locks/)
  })

  it('uses one word per thing (ruling R7): Bid and Expiry have no entry, Writer is Margin\'s term', () => {
    const terms = GLOSSARY.map((g) => g.term)
    expect(terms).not.toContain('Bid')
    expect(terms).not.toContain('Expiry')
    expect(definitionOf('writer')).toMatch(/^In Margin/)
  })
})
