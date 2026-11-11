import { describe, expect, it } from 'vitest'
import type { SupportedAssets, TokenInfo } from '../../core/options/types'
import { isStandardExpiry } from '../../core/series'
import { TICKET_LADDER_COUNT, chipCountdown, draftOf, fieldOfError, gridFor, initialForm, isOnGrid, parseUtcDateTime, premiumTotalText, strikeText, takeOver, unitFromTotal, utcDateTimeFields } from './form'
import type { TermsForm } from './form'
import type { FormIntent } from './intent'

const BOND: TokenInfo = { contractId: 'C_BOND', code: 'BOND', decimals: 7 }
const USDX: TokenInfo = { contractId: 'C_USDX', code: 'USDx', decimals: 7 }
const ASSETS: SupportedAssets = { quote: USDX, underlyings: [BOND] }
const u = (n: number) => BigInt(Math.round(n * 1e7))
const NOW = Math.floor(Date.now() / 1000)
const grid = gridFor({ nowSec: NOW, referencePerUnit: u(99.4), quoteDecimals: 7 })
const intent = (extra: Partial<FormIntent> = {}): FormIntent => ({ mode: 'write', assetId: BOND.contractId, kind: 'put', ...extra })
const D7 = { underlying: 7, quote: 7 }
// The premium is typed per unit: 0.36 USDx per BOND on 5.00 BOND is 1.80 USDx in total.
const filled = (extra: Partial<TermsForm> = {}): TermsForm => ({ kind: 'put', strike: '100', expiry: grid.expiries[0], qty: '5', premium: '0.36', ...extra })

describe('gridFor', () => {
  it('lists the standard expiries and nine strikes around the reference', () => {
    expect(grid.expiries.length).toBeGreaterThanOrEqual(4)
    expect(grid.expiries.every(isStandardExpiry)).toBe(true)
    expect(grid.ladder).toHaveLength(TICKET_LADDER_COUNT)
    expect(grid.ladder[0]).toBeLessThan(u(99.4))
    expect(grid.ladder[grid.ladder.length - 1]).toBeGreaterThan(u(99.4))
  })

  it('builds the ladder from open offers when the asset has no reference price', () => {
    const offers = [9, 10, 11].map((k) => ({ underlying: BOND, underlyingQty: u(1), totalStrike: u(k) }))
    expect(gridFor({ nowSec: NOW, referencePerUnit: null, quoteDecimals: 7, existing: offers }).ladder).toEqual([u(9), u(10), u(11)])
    expect(gridFor({ nowSec: NOW, referencePerUnit: null, quoteDecimals: 7 }).ladder).toEqual([])
  })
})

describe('initialForm', () => {
  it('defaults to the first listed expiry and the strike nearest the reference, and invents no amounts', () => {
    const form = initialForm(intent(), grid, u(99.4), D7)
    expect(form.expiry).toBe(grid.expiries[0])
    expect(grid.ladder.map((k) => strikeText(k, 7))).toContain(form.strike)
    expect(form.qty).toBe('')
    expect(form.premium).toBe('')
    expect(isOnGrid(form, grid, 7)).toBe(true)
  })

  it('keeps the terms the intent carries, its total premium held per unit', () => {
    const custom = grid.expiries[0] + 3600
    const form = initialForm(intent({ kind: 'call', strike: '101.25', expiry: custom, qty: '2', premium: '0.5' }), grid, u(99.4), D7)
    expect(form).toEqual({ kind: 'call', strike: '101.25', expiry: custom, qty: '2', premium: '0.25' })
    expect(isOnGrid(form, grid, 7)).toBe(false)
  })

  it('has no strike to offer without a reference and without offers', () => {
    expect(initialForm(intent(), { expiries: [], ladder: [] }, null, D7)).toEqual({ kind: 'put', strike: '', expiry: null, qty: '', premium: '' })
  })
})

describe('draftOf', () => {
  it('builds the exact terms of a valid form', () => {
    const draft = draftOf(filled(), BOND, ASSETS)
    expect(draft).toEqual({ ok: true, offer: { kind: 'put', underlying: BOND, underlyingQty: u(5), totalStrike: u(500), totalPremium: u(1.8), expiry: grid.expiries[0] } })
  })

  it('asks for a blank field in plain words, under that field', () => {
    expect(draftOf(filled({ qty: '' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'qty', error: 'Enter a quantity of BOND.' })
    expect(draftOf(filled({ strike: ' ' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'strike', error: 'Pick a strike.' })
    expect(draftOf(filled({ premium: '' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'premium', error: 'Enter the premium per BOND, in USDx.' })
    expect(draftOf(filled({ expiry: null }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'expiry' })
  })

  it('marks every field on its own: a quantity of 0 while the premium is still empty', () => {
    const draft = draftOf(filled({ qty: '0', premium: '' }), BOND, ASSETS)
    expect(draft).toMatchObject({ ok: false, field: 'qty', errors: { qty: 'Quantity must be a positive amount of BOND.', premium: 'Enter the premium per BOND, in USDx.' } })
  })

  it('refuses a strike times quantity that is not an exact amount', () => {
    // 0.0000001 BOND at 0.5 USDx is half a unit of USDx.
    const draft = draftOf(filled({ qty: '0.0000001', strike: '0.5' }), BOND, ASSETS)
    expect(draft).toEqual({ ok: false, field: 'qty', error: 'Strike × quantity is not an exact amount; adjust one of them.' })
  })

  it('refuses a premium per unit whose total is not an exact amount', () => {
    // 0.0000001 USDx per BOND on 0.5 BOND is half a unit of USDx.
    expect(draftOf(filled({ qty: '0.5', strike: '2', premium: '0.0000001' }), BOND, ASSETS)).toEqual({ ok: false, field: 'premium', error: 'Premium × quantity is not an exact amount; adjust one of them.' })
  })

  it('refuses zero amounts, a past expiry and a tenor over two years', () => {
    expect(draftOf(filled({ qty: '0' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'qty' })
    expect(draftOf(filled({ strike: '0' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'strike' })
    expect(draftOf(filled({ premium: '0' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'premium' })
    // The wording of these two is core/maker's (buildOffer); the ticket only adds the full stop.
    expect(draftOf(filled({ expiry: NOW - 10 }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'expiry', error: expect.stringMatching(/must be in the future\.$/) })
    expect(draftOf(filled({ expiry: NOW + 3 * 365 * 86_400 }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'expiry', error: expect.stringMatching(/must be within 2 years\.$/) })
  })

  it('refuses more decimals than the token has', () => {
    expect(draftOf(filled({ qty: '1.00000001' }), BOND, ASSETS)).toMatchObject({ ok: false, field: 'qty' })
  })
})

describe('fieldOfError', () => {
  it('sends each validator message to its field', () => {
    expect(fieldOfError('Quantity must be a positive amount of BOND')).toBe('qty')
    expect(fieldOfError('Strike × quantity is not an exact amount; adjust one of them')).toBe('qty')
    expect(fieldOfError('Strike must be a positive USDx price')).toBe('strike')
    expect(fieldOfError('Premium must be a positive USDx amount')).toBe('premium')
    expect(fieldOfError('Expiry must be within 2 years')).toBe('expiry')
  })
})

describe('premium per unit', () => {
  it('computes the total exactly, and says when it is not a whole number of quote units', () => {
    expect(premiumTotalText({ qty: '5', premium: '0.36' }, D7)).toBe('1.8')
    expect(premiumTotalText({ qty: '3', premium: '0.3333333' }, D7)).toBe('0.9999999')
    expect(premiumTotalText({ qty: '0.5', premium: '0.0000001' }, D7)).toBe('inexact')
    expect(premiumTotalText({ qty: '', premium: '0.36' }, D7)).toBeNull()
  })

  it('reads a total from a link per unit, truncated', () => {
    expect(unitFromTotal('1.8', '5', D7)).toBe('0.36')
    expect(unitFromTotal('1', '3', D7)).toBe('0.3333333')
    expect(unitFromTotal('1.8', '', D7)).toBeNull()
  })
})

describe('custom expiry', () => {
  it('reads a date and a time as UTC', () => {
    expect(parseUtcDateTime('2026-12-18', '08:00')).toBe(Date.UTC(2026, 11, 18, 8, 0, 0) / 1000)
    expect(parseUtcDateTime(' 2026-12-18 ', '8:05')).toBe(Date.UTC(2026, 11, 18, 8, 5, 0) / 1000)
  })

  it('takes the digits alone, as a phone number pad types them', () => {
    expect(parseUtcDateTime('20261218', '0800')).toBe(Date.UTC(2026, 11, 18, 8, 0, 0) / 1000)
  })

  it('rejects what is not a date or a time', () => {
    for (const [d, t] of [
      ['2026-02-30', '08:00'],
      ['18/12/2026', '08:00'],
      ['2026-12-18', '24:00'],
      ['2026-12-18', '08:60'],
      ['2026-12-18', ''],
      ['', '08:00'],
    ]) expect(parseUtcDateTime(d, t)).toBeNull()
  })

  it('round-trips through its two fields', () => {
    const ts = Date.UTC(2027, 0, 29, 15, 30, 0) / 1000
    const { date, time } = utcDateTimeFields(ts)
    expect([date, time]).toEqual(['2027-01-29', '15:30'])
    expect(parseUtcDateTime(date, time)).toBe(ts)
  })
})

describe('takeOver', () => {
  const decimals = { underlying: 7, quote: 7 }

  it('takes nothing over from an echo of the form itself', () => {
    const form = filled({ strike: '10.20' })
    expect(takeOver(form, intent({ strike: '10.2', expiry: form.expiry!, qty: '5.0', premium: '1.80' }), decimals)).toBeNull()
  })

  it('takes over a total premium from the URL as a premium per unit', () => {
    expect(takeOver(filled(), intent({ qty: '5', premium: '2.5' }), decimals)).toEqual({ premium: '0.5' })
    expect(takeOver(filled(), intent({ qty: '10', premium: '3.6' }), decimals)).toEqual({ qty: '10' })
  })

  it('takes over the terms another cell of the chain carries', () => {
    const form = filled()
    expect(takeOver(form, intent({ kind: 'call', strike: '101', expiry: grid.expiries[1] }), decimals)).toEqual({ kind: 'call', strike: '101', expiry: grid.expiries[1] })
  })

  it('keeps a custom time of day through its own echo, which carries only the day', () => {
    const day = Date.UTC(2026, 11, 18, 8, 0, 0) / 1000
    const form = filled({ expiry: day + 2.5 * 3600 })
    expect(takeOver(form, intent({ strike: '100', expiry: day }), decimals)).toBeNull()
    expect(takeOver(form, intent({ strike: '100', expiry: day + 86_400 }), decimals)).toEqual({ expiry: day + 86_400 })
  })

  it('never clears what was typed: a field the URL does not carry is left alone', () => {
    expect(takeOver(filled(), intent(), decimals)).toBeNull()
  })
})

describe('chipCountdown', () => {
  it('counts whole days from one day up, and hours and minutes below', () => {
    // A duration never breaks inside: its spaces are no-break spaces.
    const nb = (text: string) => text.replaceAll(' ', '\u00A0')
    expect(chipCountdown(9 * 86_400 + 3600)).toBe(nb('9 d'))
    expect(chipCountdown(86_400)).toBe(nb('1 d'))
    expect(chipCountdown(3 * 3600 + 12 * 60)).toBe(nb('3 h 12 min'))
  })
})
