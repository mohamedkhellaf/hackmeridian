import { describe, expect, it } from 'vitest'
import { BANNED_TAGLINES, BANNED_WORDS, findBannedWords } from '../disclosures'
import type { Bid } from './types'
import {
  CANCEL_REQUEST,
  ESCROW_STATUS,
  FILL_REQUEST,
  REQUEST_COLUMNS,
  STATE_NAME,
  WARN_BELOW_MS,
  cancelRequestLabel,
  figureText,
  fillRequestLabel,
  holdsEscrow,
  lapsing,
  lockShortfall,
  perAsset,
  IN_TOTAL,
  requestRow,
  requestTitle,
  serialText,
  warnBelowOf,
} from './rows'

const U = 10_000_000n
const USDX = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const RWA = { contractId: 'C_MOCK_RWA', code: 'RWA', decimals: 7 }
const DEADLINE = Date.UTC(2026, 10, 13, 8) / 1000
const bid = (over: Partial<Bid> = {}): Bid => ({
  id: 3n, buyer: 'GBUYER', kind: 'put', underlying: RWA, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: (14n * U) / 10n,
  expiry: DEADLINE, state: 'open', optionId: null, ...over,
})
/** A figure never parts from its unit and a date never breaks inside (ruling F7): read the no-break spaces as spaces. */
const plain = (text: string): string => text.replaceAll(' ', ' ')

describe('request rows (one model for the board, the asset page and the portfolio)', () => {
  it('reads every term exactly, with one deadline format and the units as suffixes', () => {
    const r = requestRow(bid(), 'GBUYER', 'mock')
    expect(r).toMatchObject({ key: '3', serial: '3', assetCode: 'RWA', kindWord: 'Put', glyph: 'long-put', state: 'open', stateName: 'Open', escrow: 'escrowed', mine: true })
    expect(plain(figureText(r.quantity))).toBe('5.00 RWA')
    expect(plain(figureText(r.strike))).toBe('10.00 USDx')
    expect(plain(figureText(r.premium))).toBe('1.40 USDx')
    expect(plain(figureText(r.premiumPerUnit))).toBe('0.28 USDx')
    expect(plain(figureText(r.lock))).toBe('50.00 USDx')
    expect(plain(r.deadlineText)).toBe('13 Nov 2026, 08:00 UTC')
    expect(r.reference).toEqual({ label: 'Demo price', text: '10.20' })
    expect(plain(r.terms)).toBe('put on 5.00 RWA at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 1.40 USDx')
    expect(requestRow(bid({ kind: 'call' }), null).lock.code).toBe('RWA')
    expect(requestRow(bid(), null).reference).toBeNull()
  })

  it('never lets a figure part from its unit', () => {
    expect(figureText({ text: '1,080.00', exact: '1,080.00', code: 'USDx' })).toBe('1,080.00 USDx')
  })

  it('names the state and what the premium is doing', () => {
    expect(STATE_NAME.pruned).toBe('Expired')
    expect(ESCROW_STATUS.expired).toBe('stranded')
    expect(holdsEscrow(bid({ state: 'expired' }))).toBe(true)
    expect(holdsEscrow(bid({ state: 'filled' }))).toBe(false)
  })

  it('says how much collateral a maker is missing', () => {
    const r = requestRow(bid(), null)
    expect(lockShortfall(r, 20n * U)?.missing.text).toBe('30.00')
    expect(lockShortfall(r, 60n * U)).toBeNull()
    expect(lockShortfall(r, null)).toBeNull()
  })
})

describe('how an open request is drawn on /requests and on the asset page (ruling F15)', () => {
  const r = requestRow(bid({ id: 26n }), null)

  it('has the columns of the ruling, in its order', () => {
    const { kind, strike, quantity, deadline, premium, buyer, action } = REQUEST_COLUMNS
    expect([kind, strike, quantity, deadline, premium, buyer, action]).toEqual(['Kind', 'Strike', 'Quantity', 'Deadline', 'Premium per unit', 'Buyer', 'Action'])
  })

  it('writes the id unpadded and the card lines from the same figures', () => {
    expect(serialText(r.serial)).toBe('No. 26')
    expect(plain(requestTitle(r))).toBe('Put on 5.00 RWA')
    expect(IN_TOTAL).toBe('in total')
    expect(perAsset(r)).toBe('per RWA')
  })

  it('starts each accessible name with the visible label and ends the fill with what a maker locks', () => {
    expect(fillRequestLabel(r).startsWith(FILL_REQUEST)).toBe(true)
    expect(plain(fillRequestLabel(r))).toMatch(/, you lock 50\.00 USDx$/)
    expect(plain(cancelRequestLabel(r))).toBe(`${CANCEL_REQUEST} No. 26: put on 5.00 RWA at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 1.40 USDx`)
  })

  it('warns on the wallet own request, and says in words when a fill may land too late', () => {
    expect(warnBelowOf({ mine: true })).toBe(WARN_BELOW_MS)
    expect(warnBelowOf({ mine: false })).toBeUndefined()
    const theirs = { mine: false, state: 'open' as const, deadlineSec: DEADLINE }
    expect(lapsing(theirs, DEADLINE - 10 * 60)).toBe(true)
    expect(lapsing(theirs, DEADLINE - 20 * 60)).toBe(false)
    expect(lapsing(theirs, DEADLINE)).toBe(false)
    expect(lapsing({ ...theirs, mine: true }, DEADLINE - 60)).toBe(false)
    expect(lapsing({ ...theirs, state: 'expired' }, DEADLINE - 60)).toBe(false)
  })

  it('uses no banned word, no bid, no expiry as a noun', () => {
    const strings = [...Object.values(REQUEST_COLUMNS), FILL_REQUEST, CANCEL_REQUEST, fillRequestLabel(r), cancelRequestLabel(r), IN_TOTAL, requestTitle(r)]
    for (const text of strings) {
      expect(findBannedWords(text, BANNED_WORDS), text).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
      expect(text, text).not.toMatch(/\bbids?\b|\bexpiry\b|[—→!]/i)
    }
  })
})
