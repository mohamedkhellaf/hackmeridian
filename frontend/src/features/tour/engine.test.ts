import { describe, expect, it } from 'vitest'
import type { GuideAnchor } from '../../core/guide'
import { notesFor, present, reconcile, spoken } from './engine'
import { NOTES } from './notes'

const desktop = notesFor(NOTES, { phone: false, connected: false })
const phone = notesFor(NOTES, { phone: true, connected: false })
const byId = (notes: ReturnType<typeof notesFor>, id: GuideAnchor) => notes.find((note) => note.id === id)!
const on = (...ids: GuideAnchor[]) => (id: GuideAnchor) => ids.includes(id)

describe('notesFor', () => {
  it('keeps the order of the list', () => {
    expect(desktop.map((note) => note.id)).toEqual(['intents', 'assets', 'mode', 'nav', 'wallet'])
    expect(phone.map((note) => note.id)).toEqual(desktop.map((note) => note.id))
  })

  it('places each note beside its control from 768 px', () => {
    expect(desktop.map((note) => [note.side, note.align, note.dock])).toEqual([
      ['bottom', 'start', false],
      ['top', 'start', false],
      ['top', 'end', false],
      ['bottom', 'start', false],
      ['bottom', 'end', false],
    ])
  })

  it('docks the two tall groups above the tab bar on a phone, and puts the navigation note above it', () => {
    expect(byId(phone, 'intents')).toMatchObject({ dock: true, side: 'top', align: 'center' })
    expect(byId(phone, 'assets')).toMatchObject({ dock: true, side: 'top', align: 'center' })
    expect(byId(phone, 'nav')).toMatchObject({ dock: false, side: 'top', align: 'center' })
    expect(byId(phone, 'mode')).toMatchObject({ dock: false, side: 'bottom', align: 'center' })
    expect(byId(phone, 'wallet')).toMatchObject({ dock: false, side: 'bottom', align: 'end' })
  })

  it('names the fifth tab only where it exists', () => {
    expect(byId(desktop, 'nav').terms?.map((t) => t.term)).toEqual(['Portfolio', 'Requests', 'Reserves'])
    expect(byId(phone, 'nav').terms?.map((t) => t.term)).toEqual(['Portfolio', 'Requests', 'Reserves', 'More'])
  })

  it('explains the wallet menu once a wallet is connected, on the same anchor', () => {
    expect(byId(desktop, 'wallet').title).toBe('Connect wallet')
    const connected = notesFor(NOTES, { phone: false, connected: true })
    expect(byId(connected, 'wallet').title).toBe('Wallet menu')
    expect(byId(connected, 'wallet').body).toContain('Disconnect')
    // No other note changes with the wallet.
    for (const id of ['intents', 'assets', 'mode', 'nav'] as const) expect(byId(connected, id)).toEqual(byId(desktop, id))
  })

  it('gives every note a body or terms, never both', () => {
    for (const note of [...desktop, ...phone]) expect((note.body !== null) !== (note.terms !== null)).toBe(true)
  })
})

describe('present', () => {
  it('keeps the notes whose control is on screen, in order', () => {
    expect(present(desktop, on('wallet', 'intents', 'nav', 'assets')).map((note) => note.id)).toEqual(['intents', 'assets', 'nav', 'wallet'])
    expect(present(desktop, on('mode', 'nav', 'wallet')).map((note) => note.id)).toEqual(['mode', 'nav', 'wallet'])
    expect(present(desktop, on('nav', 'wallet')).map((note) => note.id)).toEqual(['nav', 'wallet'])
    expect(present(desktop, on())).toEqual([])
  })
})

describe('reconcile', () => {
  const here = (...ids: GuideAnchor[]) => present(desktop, on(...ids))

  it('stays on the note while its control is on screen', () => {
    expect(reconcile(desktop, here('intents', 'assets', 'nav', 'wallet'), 'assets')).toBe('assets')
  })

  it('moves to the next note that has a control', () => {
    expect(reconcile(desktop, here('intents', 'nav', 'wallet'), 'assets')).toBe('nav')
    expect(reconcile(desktop, here('wallet'), 'intents')).toBe('wallet')
  })

  it('falls back to the previous one when nothing follows', () => {
    expect(reconcile(desktop, here('intents', 'assets', 'nav'), 'wallet')).toBe('nav')
    expect(reconcile(desktop, here('intents'), 'nav')).toBe('intents')
  })

  it('ends the tour when no control is left', () => {
    expect(reconcile(desktop, [], 'nav')).toBeNull()
  })
})

describe('spoken', () => {
  it('reads a body as it is and a list of terms as sentences', () => {
    expect(spoken(byId(desktop, 'assets'))).toBe(byId(desktop, 'assets').body)
    expect(spoken(byId(desktop, 'nav'))).toBe(
      'Portfolio: Your options, each with its deadline and what it needs from you. Requests: Buyers whose payment is locked in, waiting for a maker. Reserves: The collateral the contract holds, token by token.',
    )
    expect(spoken(byId(phone, 'nav'))).toMatch(/ More: Learn, Activity, Settings and this guide\.$/)
  })
})
