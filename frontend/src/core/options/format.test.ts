import { describe, expect, it } from 'vitest'
import { formatAmount, formatDisplay, parseAmount, shortAddress, strikePerUnit } from './format'
import { requiredCollateral } from './types'
import type { OptionOffer, TokenInfo } from './types'

const Q: TokenInfo = { contractId: 'CQ', code: 'USDx', decimals: 7 }
const U: TokenInfo = { contractId: 'CU', code: 'FUND', decimals: 7 }
const UNIT = 10_000_000n

describe('parseAmount', () => {
  it('parses whole and fractional values to exact units', () => {
    expect(parseAmount('12.5', 7)).toBe(125_000_000n)
    expect(parseAmount('1', 7)).toBe(UNIT)
    expect(parseAmount('0.0000001', 7)).toBe(1n)
    expect(parseAmount('  3  ', 2)).toBe(300n)
  })
  it('handles zero', () => {
    expect(parseAmount('0', 7)).toBe(0n)
    expect(parseAmount('0.0', 7)).toBe(0n)
  })
  it('accepts a trailing dot but rejects a leading dot', () => {
    expect(parseAmount('1.', 7)).toBe(UNIT)
    expect(parseAmount('.5', 7)).toBeNull()
  })
  it('rejects too many decimals', () => {
    expect(parseAmount('0.00000001', 7)).toBeNull()
    expect(parseAmount('1.5', 0)).toBeNull()
    expect(parseAmount('1.', 0)).toBe(1n)
  })
  it('rejects junk, signs, exponents, separators', () => {
    for (const s of ['', ' ', 'abc', '-1', '+1', '1e3', '1,000', '1.2.3', '1 2', '.']) {
      expect(parseAmount(s, 7), s).toBeNull()
    }
  })
  it('is exact for values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(parseAmount('123456789012345678901234567890', 7)).toBe(123456789012345678901234567890n * UNIT)
    expect(parseAmount('9007199254740993.0000001', 7)).toBe(9007199254740993n * UNIT + 1n)
  })
})

describe('formatAmount', () => {
  it('formats with grouping and trims trailing zeros', () => {
    expect(formatAmount(0n, 7)).toBe('0')
    expect(formatAmount(UNIT, 7)).toBe('1')
    expect(formatAmount(125_000_000n, 7)).toBe('12.5')
    expect(formatAmount(1_234_567n * UNIT, 7)).toBe('1,234,567')
  })
  it('truncates (does not round) to maxFraction', () => {
    expect(formatAmount(19_999_999n, 7)).toBe('1.99')
    expect(formatAmount(19_999_999n, 7, 4)).toBe('1.9999')
    expect(formatAmount(1n, 7)).toBe('0')
    expect(formatAmount(1_000_000n, 7, 0)).toBe('0')
  })
  it('formats negatives', () => {
    expect(formatAmount(-125_000_000n, 7)).toBe('-12.5')
    expect(formatAmount(-UNIT, 7)).toBe('-1')
  })
  it('formats huge values and zero decimals', () => {
    expect(formatAmount(123456789012345678901234567890n * UNIT, 7)).toBe('123,456,789,012,345,678,901,234,567,890')
    expect(formatAmount(42n, 0)).toBe('42')
  })
  it('round-trips with parseAmount when within precision', () => {
    expect(formatAmount(parseAmount('12.5', 7)!, 7)).toBe('12.5')
    expect(formatAmount(parseAmount('1000.25', 7)!, 7)).toBe('1,000.25')
    expect(formatAmount(parseAmount('0.01', 7)!, 7)).toBe('0.01')
    expect(formatAmount(parseAmount('0.1234567', 7)!, 7, 7)).toBe('0.1234567')
  })
})

describe('formatAmount minFraction / formatDisplay', () => {
  it('pads to the minimum fraction digits', () => {
    expect(formatAmount(2n * UNIT, 7, 2, 2)).toBe('2.00')
    expect(formatAmount(4_000_000n, 7, 2, 2)).toBe('0.40')
    expect(formatAmount(19_999_999n, 7, 2, 2)).toBe('1.99')
  })
  it('formatDisplay shows at least 2 and at most 4 decimals', () => {
    expect(formatDisplay(1080n * UNIT, 7)).toBe('1,080.00')
    expect(formatDisplay(18_000_000n, 7)).toBe('1.80')
    expect(formatDisplay(12_345_678n, 7)).toBe('1.2345')
    expect(formatDisplay(-5n * UNIT, 7)).toBe('-5.00')
    expect(formatDisplay(42n, 0)).toBe('42')
    expect(formatDisplay(5n, 1)).toBe('0.5')
  })
})

describe('strikePerUnit', () => {
  const offer = (qty: bigint, strike: bigint): OptionOffer => ({
    id: 0n, kind: 'put', underlying: U, quote: Q, underlyingQty: qty, totalStrike: strike,
    totalPremium: UNIT, expiry: 0, writer: 'W', holder: null, state: 'offered',
  })
  it('divides total strike by quantity', () => {
    expect(strikePerUnit(offer(5n * UNIT, 50n * UNIT))).toBe('10.00')
    expect(strikePerUnit(offer(3n * UNIT, 36n * UNIT))).toBe('12.00')
    expect(strikePerUnit(offer(4n * UNIT, 10n * UNIT))).toBe('2.50')
  })
  it('returns a dash for zero quantity', () => {
    expect(strikePerUnit(offer(0n, 10n * UNIT))).toBe('–')
  })
  it('accounts for differing decimals', () => {
    const o = { ...offer(2n * 10n ** 6n, 30n * 10n ** 2n), underlying: { ...U, decimals: 6 }, quote: { ...Q, decimals: 2 } }
    expect(strikePerUnit(o)).toBe('15.00')
  })
})

describe('shortAddress', () => {
  it('shortens long addresses and keeps short ones', () => {
    expect(shortAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('GABC…WXYZ')
    expect(shortAddress('GABCDEFGHIJK')).toBe('GABCDEFGHIJK')
  })
})

describe('requiredCollateral', () => {
  const base = { underlying: U, quote: Q, underlyingQty: 5n * UNIT, totalStrike: 50n * UNIT }
  it('put locks the total strike in the quote token', () => {
    expect(requiredCollateral({ kind: 'put', ...base })).toEqual({ token: Q, amount: 50n * UNIT })
  })
  it('call locks the underlying quantity', () => {
    expect(requiredCollateral({ kind: 'call', ...base })).toEqual({ token: U, amount: 5n * UNIT })
  })
})
