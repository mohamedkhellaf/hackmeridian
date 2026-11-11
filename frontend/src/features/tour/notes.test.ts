import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import { GUIDE_ANCHORS, GUIDE_COPY, TOUR_NOTES_ON_MARKETS } from '../../core/guide'
import * as copy from './copy'
import { MARKETS_ANCHORS, NOTES } from './notes'

/** Every string a visitor can read or hear from the guide: the notes' copy module and the shared words. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}
const COPY_STRINGS = [
  ...strings(Object.values(copy).filter((v) => typeof v !== 'function')),
  ...strings(GUIDE_COPY),
  copy.countText(2, 4),
  copy.stepAnnouncement(2, 4, copy.ASSETS_NOTE.title, copy.ASSETS_NOTE.body),
  copy.soloAnnouncement(copy.MODE_NOTE.title, copy.MODE_NOTE.body),
]

describe('the notes', () => {
  it('has one note per anchor, and no anchor without a note', () => {
    expect(NOTES.map((note) => note.id).sort()).toEqual([...GUIDE_ANCHORS].sort())
    expect(new Set(NOTES.map((note) => note.id)).size).toBe(NOTES.length)
    expect(NOTES.length).toBeLessThanOrEqual(5)
  })

  it('shows on Markets the number of notes the welcome states', () => {
    expect(MARKETS_ANCHORS.length).toBe(TOUR_NOTES_ON_MARKETS)
    expect(NOTES.filter((note) => MARKETS_ANCHORS.includes(note.id)).map((note) => note.id)).toEqual(['intents', 'assets', 'nav', 'wallet'])
    expect(GUIDE_COPY.welcomeBody).toMatch(/^Four /)
  })

  it('puts the page notes before the two notes of the shell', () => {
    expect(NOTES.map((note) => note.id).slice(-2)).toEqual(['nav', 'wallet'])
  })

  it('keeps every title and text short', () => {
    for (const note of NOTES) {
      const variants = [note, ...(note.connected ? [note.connected] : [])]
      for (const v of variants) {
        expect(v.title.length, v.title).toBeLessThanOrEqual(32)
        if (v.body !== undefined) expect(v.body.length, v.body).toBeLessThanOrEqual(160)
      }
      for (const t of note.terms ?? []) expect(t.text.length, t.text).toBeLessThanOrEqual(160)
      expect(note.body !== undefined || (note.terms?.length ?? 0) > 0, note.id).toBe(true)
    }
  })
})

describe("the guide's words", () => {
  it('finds the copy', () => {
    expect(COPY_STRINGS.length).toBeGreaterThan(25)
  })

  it('carry no banned word, tagline or price term', () => {
    for (const text of COPY_STRINGS) expect(findBannedWords(text, [...BANNED_WORDS, ...BANNED_TAGLINES, ...BANNED_PRICE_TERMS]), text).toEqual([])
  })

  it('carry no em dash, arrow, exclamation mark or curly quote', () => {
    for (const text of COPY_STRINGS) expect(text, text).not.toMatch(/[—–←-⇿!‘’“”]/)
  })

  it('use no directional word: a note must make sense wherever it is placed', () => {
    for (const text of COPY_STRINGS) expect(text, text).not.toMatch(/\b(left|right|above|below|beside|top|bottom|underneath|over here)\b/i)
  })

  it("use the product's one word per thing: request, deadline, maker", () => {
    for (const text of COPY_STRINGS) expect(text, text).not.toMatch(/\b(bids?|expiry|expiries|writers?|counterpart(y|ies))\b/i)
  })

  it('count plainly, and name the subject only for a screen reader', () => {
    expect(copy.countText(2, 4)).toBe('2 of 4')
    expect(copy.stepAnnouncement(2, 4, 'Assets', 'Body.')).toBe('Note 2 of 4. Assets. Body.')
    expect(copy.stepAnnouncement(1, 4, 'What do you want to do?', 'Body.')).toBe('Note 1 of 4. What do you want to do? Body.')
    expect(copy.soloAnnouncement('Guided and Chain', 'Body.')).toBe('Note. Guided and Chain. Body. Press Escape to close.')
  })

  it('say where the guide lives in the words of the layout', () => {
    expect(copy.CLOSING_LINE).toContain('Settings')
    expect(copy.CLOSING_LINE_PHONE).toContain('More')
    expect(GUIDE_COPY.stays).toContain('Settings')
    expect(GUIDE_COPY.staysPhone).toContain('More')
  })
})
