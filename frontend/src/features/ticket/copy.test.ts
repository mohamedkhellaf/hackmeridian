import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import type { TokenInfo } from '../../core/options/types'
import { calendarFor } from './calendar'
import * as copy from './copy'
import type { TicketMode } from './intent'

const MODES: TicketMode[] = ['buy', 'buy-resale', 'write', 'bid', 'fill', 'list']
const KINDS = ['put', 'call'] as const
const PHASES = ['checking', 'signing', 'submitting', 'pending', 'confirmed', 'unknown', 'expired', 'declined'] as const
const OUTCOMES = ['failed', 'unknown', 'expired', 'declined'] as const
const EFFECTS = ['nothing-sent', 'outcome-unknown', 'fee-charged'] as const
const HOLDER: copy.HolderWords = { code: 'BOND', qty: '5.00 BOND', strikeTotal: '495.00 USDx', strike: '99.00 USDx', deadline: '27 Nov 2026, 08:00 UTC' }
const WORDS: copy.OutcomeWords = { code: 'BOND', strike: '99.00 USDx', qty: '5.00 BOND', strikeTotal: '495.00 USDx', premium: '1.80 USDx' }

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
      out.push(copy.receiptTitle(mode, kind), copy.receiptTitle(mode, kind, true), copy.receiptReminder(mode, kind), copy.receiptReminder(mode, kind, HOLDER))
      out.push(copy.signSummary(mode, copy.optionPhrase(kind, '5.00 BOND', '10.00 USDx', '13 Nov 2026, 08:00 UTC'), { pays: '1.80 USDx', locks: '50.00 USDx', receives: '1.80 USDx' }))
    }
  for (const mode of ['write', 'bid', 'list'] as const) out.push(copy.reviewTitle(mode), copy.reviewTitle(mode, true))
  for (const kind of KINDS) for (const side of ['long', 'short'] as const) out.push(...copy.outcomePair(side, kind, WORDS))
  for (const phase of PHASES) out.push(copy.signHelp(phase, '08:01:30 UTC'), copy.signHelp(phase, null))
  for (const phase of OUTCOMES) for (const effect of EFFECTS) out.push(copy.outcomeTitle(phase, effect, false), copy.outcomeTitle(phase, effect, true))
  out.push(copy.listingNote('USDx', false), copy.listingNote('USDx', true))
  out.push(copy.checksSentence('13:45:12 UTC', ['the offer is open', 'the BOND issuer has authorized your account', 'you hold 2,500.00 USDx']), copy.checksSentence(null, ['you hold 2,500.00 USDx']))
  out.push(copy.pendingTxNotice('14:38:02 UTC', '14:43:41 UTC'), copy.betterRequest('0.65 USDx', '5.00 BOND', '000001'), copy.cheaperOffer('0.16 USDx', 'BOND', '5.00 BOND', '000032'))
  out.push(copy.giveUpValue('25.00 USDx', 'EQTY'), copy.giveUpHint('4.00 EQTY'), copy.capOffers(50, 50), copy.capRequests(50, 50))
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

  it('carries no disclaimer tagline', () => {
    for (const s of sentences) expect(findBannedWords(s, BANNED_TAGLINES), s).toEqual([])
    for (const s of sentences) expect(s, s).not.toMatch(/fictional|testnet/i)
  })

  it('never calls a price a market, oracle or live price', () => {
    for (const s of sentences) expect(findBannedWords(s, BANNED_PRICE_TERMS), s).toEqual([])
  })

  it('uses one word per thing: request, deadline, maker', () => {
    for (const s of sentences) expect(s, s).not.toMatch(/\bbids?\b|\bexpiry\b|\bwriter\b|\bcounterparty\b|\bunlimited\b|\bno cap\b/i)
  })

  it('uses no em dash, arrow, exclamation mark or emoji', () => {
    for (const s of sentences) expect(s, s).not.toMatch(/[—←-⇿!]|\p{Extended_Pictographic}/u)
  })

  it('is in sentence case: no word in capitals except codes and UTC', () => {
    for (const s of sentences) {
      const shouting = (s.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !['BOND', 'EQTY', 'UTC'].includes(w))
      expect(shouting, s).toEqual([])
    }
  })

  it('never offers to send again while the outcome is unknown', () => {
    for (const until of ['08:01:30 UTC', null]) {
      const text = copy.signHelp('unknown', until)
      expect(text).toMatch(/check again first/)
      expect(text).not.toMatch(/sign again|try again|send it again/i)
    }
    expect(copy.signHelp('unknown', '08:01:30 UTC')).toContain('until 08:01:30 UTC')
  })

  it('tells the three money situations apart, in the headings too', () => {
    expect(copy.signHelp('declined', null)).toMatch(/Nothing was sent and no fee was charged/)
    expect(copy.signHelp('expired', null)).toMatch(/Nothing was charged/)
    expect(copy.outcomeTitle('failed', 'fee-charged', false)).toBe('Refused on the ledger')
    expect(copy.outcomeTitle('failed', 'nothing-sent', false)).toBe('Refused before sending')
    expect(copy.outcomeTitle('failed', 'nothing-sent', true)).toBe('Refused by the network')
  })

  it('names every mode in its title, its receipt and its commitment', () => {
    for (const mode of MODES) {
      expect(copy.COMMITMENT[mode].length).toBeGreaterThan(20)
      expect(copy.LOADING_TITLE[mode].length).toBeGreaterThan(8)
      for (const kind of KINDS) {
        expect(copy.ticketTitle(mode, kind, 'BOND')).toContain('BOND')
        // A confirmation is two or three words, without a full stop.
        expect(copy.receiptTitle(mode, kind).split(' ').length).toBeLessThanOrEqual(5)
        expect(copy.receiptTitle(mode, kind)).not.toMatch(/\.$/)
      }
    }
  })

  it('says "nothing settles by itself" once, at the buy review, and nowhere else in the ticket', () => {
    const said = sentences.filter((s) => /nothing settles by itself/i.test(s))
    expect(new Set(said)).toEqual(new Set([copy.COMMITMENT.buy]))
    expect(copy.COMMITMENT['buy-resale']).toBe(copy.COMMITMENT.buy)
  })

  it('says who is paid in a resale and what a maker must still do', () => {
    expect(copy.RESALE_NOTE).toContain('You pay the seller, not the maker.')
    expect(copy.outcomePair('short', 'call', WORDS)[0]).toContain('waits in the contract until you claim it')
    expect(copy.outcomePair('short', 'put', WORDS)[0]).toContain('waits in the contract until you claim it')
  })

  it('gives a holder the right in words on the receipt', () => {
    expect(copy.receiptReminder('buy', 'put', HOLDER)).toBe(
      'Until 27 Nov 2026, 08:00 UTC you can sell 5.00 BOND for 495.00 USDx. Use it only if BOND is worth less than 99.00 USDx then: exercise from Portfolio before the deadline.',
    )
    expect(copy.receiptReminder('buy', 'call', HOLDER)).toMatch(/^Until .* you can buy 5\.00 BOND for 495\.00 USDx\. Use it only if BOND is worth more than/)
  })

  it('folds the passed checks into one sentence with the read time', () => {
    expect(copy.checksSentence('13:45:12 UTC', ['the offer is open', 'the BOND issuer has authorized your account', 'you hold 2,500.00 USDx'])).toBe(
      'Read from the contract at 13:45:12 UTC: the offer is open, the BOND issuer has authorized your account, and you hold 2,500.00 USDx.',
    )
    expect(copy.checksSentence(null, ['the BOND issuer has authorized your account', 'you hold 2,500.00 USDx'])).toBe('Read from the contract: the BOND issuer has authorized your account and you hold 2,500.00 USDx.')
  })
})

describe('calendar entry', () => {
  const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
  const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
  const event = calendarFor({ kind: 'put', underlying: BOND, quote: USDX, underlyingQty: 50_000_000n, totalStrike: 4_950_000_000n, totalPremium: 18_000_000n, expiry: 1_800_000_000 }, 12n, 'https://app.invalid')

  it('says what the holder needs to exercise, and no tagline', () => {
    expect(event.description).toContain('To exercise you need 5.00 BOND in your wallet.')
    expect(findBannedWords(event.description, BANNED_TAGLINES)).toEqual([])
    expect(event.description).not.toMatch(/fictional|testnet/i)
    expect(event.url).toBe('https://app.invalid/portfolio/12?do=exercise')
    expect(event.uid).toBe('option-12-1800000000')
  })
})
