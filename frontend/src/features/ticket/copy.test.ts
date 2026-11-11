import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import * as copy from './copy'
import type { TicketMode } from './intent'

const MODES: TicketMode[] = ['buy', 'buy-resale', 'write', 'bid', 'fill', 'list']
const KINDS = ['put', 'call'] as const
const PHASES = ['checking', 'signing', 'submitting', 'pending', 'confirmed', 'failed', 'unknown', 'expired', 'declined'] as const
const EFFECTS = ['nothing-sent', 'outcome-unknown', 'fee-charged'] as const

/** Every sentence the ticket can say on its own, with sample figures. */
function everySentence(): string[] {
  const out: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') out.push(value)
    else if (value && typeof value === 'object') for (const v of Object.values(value)) collect(v)
  }
  for (const value of Object.values(copy)) if (typeof value !== 'function') collect(value)
  for (const mode of MODES)
    for (const kind of KINDS) {
      out.push(copy.ticketTitle(mode, kind, 'BOND'), copy.ticketTitle(mode, kind, 'BOND', true))
      out.push(copy.receiptTitle(mode, kind), copy.receiptTitle(mode, kind, true), copy.receiptReminder(mode, kind))
      out.push(copy.signSummary(mode, copy.optionPhrase(kind, '5.00 BOND', '10.00 USDx', '13 Nov 2026, 08:00 UTC'), { pays: '1.80 USDx', locks: '50.00 USDx', receives: '1.80 USDx' }))
    }
  for (const kind of KINDS) for (const side of ['long', 'short'] as const) out.push(copy.settlementSentence(side, kind, '5.00 BOND', '50.00 USDx'))
  for (const phase of PHASES) for (const effect of EFFECTS) out.push(copy.signHelp(phase, effect, '08:01:30 UTC'), copy.signHelp(phase, effect, null))
  out.push(copy.listingNote('USDx', false), copy.listingNote('USDx', true))
  return out
}

describe('ticket copy', () => {
  const sentences = everySentence()

  it('has something to check', () => {
    expect(sentences.length).toBeGreaterThan(120)
  })

  it('promises nothing: none of the banned words', () => {
    for (const s of sentences) expect(findBannedWords(s, BANNED_WORDS), s).toEqual([])
  })

  it('never calls a price a market, oracle or live price', () => {
    for (const s of sentences) expect(findBannedWords(s, BANNED_PRICE_TERMS), s).toEqual([])
  })

  it('uses no em dash, arrow, exclamation mark or emoji', () => {
    for (const s of sentences) expect(s, s).not.toMatch(/[\u2014\u2190-\u21ff!]|\p{Extended_Pictographic}/u)
  })

  it('is in sentence case: no word in capitals except codes and UTC', () => {
    for (const s of sentences) {
      const shouting = (s.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !['BOND', 'UTC'].includes(w))
      expect(shouting, s).toEqual([])
    }
  })

  it('never offers to send again while the outcome is unknown', () => {
    for (const until of ['08:01:30 UTC', null]) {
      const text = copy.signHelp('unknown', 'outcome-unknown', until)
      expect(text).toMatch(/check again first/)
      expect(text).not.toMatch(/sign again|try again|send it again/i)
    }
    expect(copy.signHelp('unknown', 'outcome-unknown', '08:01:30 UTC')).toContain('until 08:01:30 UTC')
  })

  it('tells the three money situations apart', () => {
    expect(copy.signHelp('failed', 'nothing-sent', null)).toMatch(/Nothing was sent and no fee was charged/)
    expect(copy.signHelp('failed', 'fee-charged', null)).toMatch(/network fee was charged/)
    expect(copy.signHelp('declined', 'nothing-sent', null)).toMatch(/Nothing was sent/)
    expect(copy.signHelp('expired', 'nothing-sent', null)).toMatch(/Nothing was charged/)
  })

  it('names every mode in its title, its receipt and its consent', () => {
    for (const mode of MODES) {
      expect(copy.CONSENT[mode]).toMatch(/^I understand that /)
      expect(copy.LOADING_TITLE[mode].length).toBeGreaterThan(8)
      for (const kind of KINDS) expect(copy.ticketTitle(mode, kind, 'BOND')).toContain('BOND')
    }
  })

  it('says who is paid in a resale and what a writer must still do', () => {
    expect(copy.RESALE_NOTE).toContain('You pay the seller, not the writer.')
    expect(copy.settlementSentence('short', 'call', '50.00 USDx', '5.00 BOND')).toContain('waits in the contract until you claim it')
    expect(copy.settlementSentence('short', 'put', '5.00 BOND', '50.00 USDx')).toContain('waits in the contract until you claim it')
  })
})
