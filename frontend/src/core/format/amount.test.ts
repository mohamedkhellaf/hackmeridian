import { describe, expect, it } from 'vitest'
import { formatMoney, formatExact, formatNumber, formatUnits, groupDigits, MINUS, NBSP, parseAmount, THIN_NBSP, withUnit } from './index'

const UNIT = 10_000_000n // 7 decimals, as on chain
const USDX = { code: 'USDx', decimals: 7 }

describe('groupDigits', () => {
  it('groups by three from the right', () => {
    expect(groupDigits('0')).toBe('0')
    expect(groupDigits('999')).toBe('999')
    expect(groupDigits('1000')).toBe('1,000')
    expect(groupDigits('12345')).toBe('12,345')
    expect(groupDigits('123456')).toBe('123,456')
    expect(groupDigits('1234567')).toBe('1,234,567')
  })

  it('leaves anything that is not a digit string alone', () => {
    expect(groupDigits('')).toBe('')
    expect(groupDigits('1.5')).toBe('1.5')
    expect(groupDigits('-1000')).toBe('-1000')
  })
})

describe('formatUnits', () => {
  it('shows two fixed decimals by default', () => {
    expect(formatUnits(0n, 7)).toBe('0.00')
    expect(formatUnits(2n * UNIT, 7)).toBe('2.00')
    expect(formatUnits(4_000_000n, 7)).toBe('0.40')
    expect(formatUnits(1080n * UNIT, 7)).toBe('1,080.00')
    expect(formatUnits(1_234_567n * UNIT + 8_900_000n, 7)).toBe('1,234,567.89')
  })

  it('truncates and never rounds up', () => {
    expect(formatUnits(19_999_999n, 7)).toBe('1.99')
    expect(formatUnits(9_999_999n, 7)).toBe('0.99')
    expect(formatUnits(99n * UNIT + 9_999_999n, 7, { dp: 0 })).toBe('99')
    expect(formatUnits(1_005_000n, 7, { dp: 2 })).toBe('0.10')
    expect(formatUnits(-19_999_999n, 7)).toBe(`${MINUS}1.99`)
  })

  it('never shows a non-zero amount as zero', () => {
    expect(formatUnits(1n, 7)).toBe('<0.01')
    expect(formatUnits(99_999n, 7)).toBe('<0.01')
    expect(formatUnits(100_000n, 7)).toBe('0.01')
    expect(formatUnits(1n, 7, { dp: 4 })).toBe('<0.0001')
    expect(formatUnits(999n, 7, { dp: 4 })).toBe('<0.0001')
    expect(formatUnits(1_000n, 7, { dp: 4 })).toBe('0.0001')
    expect(formatUnits(5_000_000n, 7, { dp: 0 })).toBe('<1')
    expect(formatUnits(-1n, 7)).toBe(`${MINUS}<0.01`)
    expect(formatUnits(1n, 7, { sign: true })).toBe('+<0.01')
  })

  it('uses the true minus sign, and a plus only on request', () => {
    expect(formatUnits(-5n * UNIT, 7)).toBe('\u22125.00')
    expect(formatUnits(-5n * UNIT, 7)).not.toContain('-')
    expect(formatUnits(5n * UNIT, 7)).toBe('5.00')
    expect(formatUnits(5n * UNIT, 7, { sign: true })).toBe('+5.00')
    expect(formatUnits(-5n * UNIT, 7, { sign: true })).toBe(`${MINUS}5.00`)
    expect(formatUnits(0n, 7, { sign: true })).toBe('0.00')
  })

  it('can skip grouping', () => {
    expect(formatUnits(1080n * UNIT, 7, { group: false })).toBe('1080.00')
    expect(formatUnits(-1_234_567n * UNIT, 7, { group: false, dp: 0 })).toBe(`${MINUS}1234567`)
  })

  it('never shows more fraction digits than the token has', () => {
    expect(formatUnits(1234n, 0)).toBe('1,234')
    expect(formatUnits(1234n, 1)).toBe('123.4')
    expect(formatUnits(1234n, 2, { dp: 6 })).toBe('12.34')
    expect(formatUnits(12_345_678n, 7, { dp: 7 })).toBe('1.2345678')
  })

  it('is exact far beyond the range of a JavaScript number', () => {
    const max = (1n << 127n) - 1n // i128::MAX
    expect(formatUnits(max, 7)).toBe('17,014,118,346,046,923,173,168,730,371,588.41')
    expect(formatUnits(-max, 7, { group: false })).toBe(`${MINUS}17014118346046923173168730371588.41`)
    expect(formatUnits(9_007_199_254_740_993n * UNIT, 7, { dp: 0 })).toBe('9,007,199,254,740,993')
  })

  it('falls back to defaults on a bad dp and refuses bad decimals', () => {
    expect(formatUnits(5n * UNIT, 7, { dp: -1 })).toBe('5.00')
    expect(formatUnits(5n * UNIT, 7, { dp: 1.5 })).toBe('5.00')
    expect(formatUnits(5n, -1)).toBe('–')
    expect(formatUnits(5n, 1.5)).toBe('–')
  })
})

describe('formatExact', () => {
  it('keeps every digit and trims trailing zeros down to two decimals', () => {
    expect(formatExact(12_345_678n, 7)).toBe('1.2345678')
    expect(formatExact(5n * UNIT, 7)).toBe('5.00')
    expect(formatExact(53_000_000n, 7)).toBe('5.30')
    expect(formatExact(53_210_000n, 7)).toBe('5.321')
    expect(formatExact(1n, 7)).toBe('0.0000001')
    expect(formatExact(-1n, 7)).toBe(`${MINUS}0.0000001`)
    expect(formatExact(1080n * UNIT + 1n, 7)).toBe('1,080.0000001')
  })

  it('honours minDp, sign and group', () => {
    expect(formatExact(5n * UNIT, 7, { minDp: 0 })).toBe('5')
    expect(formatExact(5n * UNIT, 7, { minDp: 7 })).toBe('5.0000000')
    expect(formatExact(5n * UNIT, 7, { sign: true })).toBe('+5.00')
    expect(formatExact(1080n * UNIT, 7, { group: false })).toBe('1080.00')
    expect(formatExact(12n, 0)).toBe('12')
  })

  it('round-trips through the input parser once grouping is off', () => {
    for (const units of [0n, 1n, 4_000_000n, 12_345_678n, 1080n * UNIT, 99n * UNIT + 9_999_999n]) {
      expect(parseAmount(formatExact(units, 7, { group: false }), 7)).toBe(units)
    }
  })
})

describe('withUnit and formatMoney', () => {
  it('appends the code after a no-break space by default, so the figure never breaks from its unit (ruling F7)', () => {
    expect(withUnit('1,080.00', 'USDx')).toBe('1,080.00\u00A0USDx')
    expect(formatMoney(2n * UNIT, USDX)).toBe('2.00\u00A0USDx')
    expect(formatMoney(-18_000_000n, USDX, { sign: true })).toBe(`${MINUS}1.80${NBSP}USDx`)
    expect(formatMoney(2n * UNIT, USDX)).not.toContain(' ')
  })

  it('takes a narrow no-break separator for dense cells', () => {
    expect(withUnit('2.00', 'USDx', THIN_NBSP)).toBe('2.00\u202FUSDx')
    expect(formatMoney(2n * UNIT, USDX, { separator: THIN_NBSP })).toBe('2.00\u202FUSDx')
  })
})

describe('formatNumber (chart figures only)', () => {
  it('truncates like formatUnits, past the error of a binary float', () => {
    expect(formatNumber(9.639999999)).toBe('9.64')
    expect(formatNumber(0.1 + 0.2)).toBe('0.30')
    expect(formatNumber(1080)).toBe('1,080.00')
    expect(formatNumber(1234567.891, { dp: 1 })).toBe('1,234,567.8')
    expect(formatNumber(12.5, { dp: 0 })).toBe('12')
    // Review finding 46: the read-out and the rows beside it agree to the cent.
    expect(formatNumber(-2400.999)).toBe(`${MINUS}2,400.99`)
    expect(formatNumber(32.6799)).toBe('32.67')
  })

  it('signs like the amount formatter and never prints a non-zero figure as zero', () => {
    expect(formatNumber(-1.8)).toBe(`${MINUS}1.80`)
    expect(formatNumber(1.8, { sign: true })).toBe('+1.80')
    expect(formatNumber(0, { sign: true })).toBe('0.00')
    expect(formatNumber(-0)).toBe('0.00')
    expect(formatNumber(0.1 + 0.2 - 0.3)).toBe('0.00') // float noise is zero
    expect(formatNumber(-0.00001)).toBe(`${MINUS}<0.01`)
    expect(formatNumber(0.005, { sign: true })).toBe('+<0.01')
    expect(formatNumber(0.4, { dp: 0 })).toBe('<1')
  })

  it('handles values that are not finite', () => {
    expect(formatNumber(Infinity)).toBe('∞')
    expect(formatNumber(Infinity, { sign: true })).toBe('+∞')
    expect(formatNumber(-Infinity)).toBe(`${MINUS}∞`)
    expect(formatNumber(NaN)).toBe('–')
  })
})

describe('noBreak', () => {
  it('keeps a deadline or a figure with its unit on one line', async () => {
    const { noBreak, NBSP } = await import('./amount')
    expect(noBreak('20 Nov 2026, 08:00 UTC')).toBe(`20${NBSP}Nov${NBSP}2026,${NBSP}08:00${NBSP}UTC`)
    expect(noBreak('1.80 USDx')).toBe(`1.80${NBSP}USDx`)
    expect(noBreak('BOND')).toBe('BOND')
  })
})
