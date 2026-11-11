import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from './disclosures'
import { GUIDE_ANCHORS, GUIDE_COPY, GUIDE_VERSION, TOUR_NOTES_ON_MARKETS, canOfferTour, canOpenModeNote, guideAnchor } from './guide'

describe('guideAnchor', () => {
  it('writes the name as data-tour', () => {
    expect(guideAnchor('nav')).toEqual({ 'data-tour': 'nav' })
    for (const name of GUIDE_ANCHORS) expect(guideAnchor(name)['data-tour']).toBe(name)
  })

  it('adds the inset mark only when asked', () => {
    expect(guideAnchor('nav', { ring: 'inset' })).toEqual({ 'data-tour': 'nav', 'data-tour-ring': 'inset' })
    expect('data-tour-ring' in guideAnchor('wallet', {})).toBe(false)
  })

  it('has five names, each once', () => {
    expect(GUIDE_ANCHORS).toEqual(['intents', 'assets', 'mode', 'nav', 'wallet'])
    expect(new Set(GUIDE_ANCHORS).size).toBe(GUIDE_ANCHORS.length)
  })
})

describe('canOfferTour', () => {
  it('offers the welcome only when nothing is stored for the tour', () => {
    expect(canOfferTour({ seen: {}, persistent: true })).toBe(true)
    expect(canOfferTour({ seen: { mode: 1 }, persistent: true })).toBe(true)
    expect(canOfferTour({ seen: { tour: 0 }, persistent: true })).toBe(false)
    expect(canOfferTour({ seen: { tour: 1 }, persistent: true })).toBe(false)
    expect(canOfferTour({ seen: { tour: GUIDE_VERSION + 5 }, persistent: true })).toBe(false)
  })

  it('never offers it where the answer could not be remembered', () => {
    expect(canOfferTour({ seen: {}, persistent: false })).toBe(false)
  })
})

describe('canOpenModeNote', () => {
  const open = (seen: Parameters<typeof canOpenModeNote>[0]['seen'], search: Record<string, unknown> = {}, persistent = true) => canOpenModeNote({ seen, persistent, search })

  it('opens only for a visitor who started the tour', () => {
    expect(open({})).toBe(false)
    expect(open({ tour: 0 })).toBe(false)
    expect(open({ tour: 1 })).toBe(true)
    expect(open({ tour: 999 })).toBe(true)
  })

  it('opens once', () => {
    expect(open({ tour: 1, mode: 1 })).toBe(false)
    expect(open({ tour: 1, mode: 0 })).toBe(false)
    expect(open({ tour: 999, mode: 999 })).toBe(false)
  })

  it('stays away while the URL carries a ticket', () => {
    for (const name of ['side', 'offer', 'bid', 'ask']) expect(open({ tour: 1 }, { [name]: name === 'side' ? 'buy' : '7' })).toBe(false)
    expect(open({ tour: 1 }, { mode: 'chain', intent: 'floor', expiry: '2026-11-13', side: undefined })).toBe(true)
  })

  it('stays away where it could not be remembered', () => {
    expect(open({ tour: 1 }, {}, false)).toBe(false)
  })
})

describe('the shared words', () => {
  it('state the number of notes a tour of Markets has', () => {
    expect(TOUR_NOTES_ON_MARKETS).toBe(4)
    expect(GUIDE_COPY.welcomeBody.startsWith('Four ')).toBe(true)
  })

  it('use one label for every way to start the guide', () => {
    expect(GUIDE_COPY.start).toBe('Show me around')
  })

  it('carry no banned word, tagline, em dash, arrow or exclamation mark', () => {
    for (const text of Object.values(GUIDE_COPY)) {
      expect(findBannedWords(text, [...BANNED_WORDS, ...BANNED_TAGLINES, ...BANNED_PRICE_TERMS]), text).toEqual([])
      expect(text, text).not.toMatch(/[—–←-⇿!]/)
    }
  })
})
