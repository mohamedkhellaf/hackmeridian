import { describe, expect, it } from 'vitest'
import type { Bid } from './types'
import { ESCROW_STATUS, STATE_NAME, figureText, holdsEscrow, lockShortfall, requestRow } from './rows'

const U = 10_000_000n
const USDX = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const bid = (over: Partial<Bid> = {}): Bid => ({
  id: 3n, buyer: 'GBUYER', kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: (14n * U) / 10n,
  expiry: Date.UTC(2026, 10, 13, 8) / 1000, state: 'open', optionId: null, ...over,
})

describe('request rows (one model for the board, the asset page and the portfolio)', () => {
  it('reads every term exactly, with one deadline format and the units as suffixes', () => {
    const r = requestRow(bid(), 'GBUYER', 'mock')
    expect(r).toMatchObject({ key: '3', serial: '000003', assetCode: 'FUND', kindWord: 'Put', glyph: 'long-put', state: 'open', stateName: 'Open', escrow: 'escrowed', mine: true })
    expect(figureText(r.quantity)).toBe('5.00 FUND')
    expect(figureText(r.strike)).toBe('10.00 USDx')
    expect(figureText(r.premium)).toBe('1.40 USDx')
    expect(figureText(r.premiumPerUnit)).toBe('0.28 USDx')
    expect(figureText(r.lock)).toBe('50.00 USDx')
    expect(r.deadlineText).toBe('13 Nov 2026, 08:00 UTC')
    expect(r.reference).toEqual({ label: 'Demo price', text: '10.20' })
    expect(r.terms).toBe('put on 5.00 FUND at 10.00 USDx, until 13 Nov 2026, 08:00 UTC, premium 1.40 USDx')
    expect(requestRow(bid({ kind: 'call' }), null).lock.code).toBe('FUND')
    expect(requestRow(bid(), null).reference).toBeNull()
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
