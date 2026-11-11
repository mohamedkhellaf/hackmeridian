import { describe, expect, it } from 'vitest'
import { parseAmount } from './options/format'
import { amt, amtExact, byId, byPremiumPerUnit, byStrikePerUnit, compareRatio, perUnit, perUnitText, plainAmount, premiumUnits, shortBy, strikeUnits } from './units'

const U = 10_000_000n
const FUND = { code: 'FUND', decimals: 7 }

describe('units', () => {
  it('formats an amount with its code, two decimals, truncated: the one rule of core/format', () => {
    expect(amt(5n * U, FUND)).toBe('5.00 FUND')
    expect(amt(10_800n * U, { code: 'USDx', decimals: 7 })).toBe('10,800.00 USDx')
    expect(amt(12_345_678n, FUND)).toBe('1.23 FUND') // 1.2345678 truncated, never rounded up
    expect(amt(24_999_945_000n, FUND)).toBe('2,499.99 FUND') // the same as the asset header
    expect(amt(1n, FUND)).toBe('<0.01 FUND') // never a zero for a non-zero amount
    expect(amt(-5n * U, FUND)).toBe('\u22125.00 FUND')
  })

  it('writes a shortfall to the last unit, which truncation would understate', () => {
    expect(amtExact(4_700_055_000n, { code: 'USDx', decimals: 7 })).toBe('470.0055 USDx')
    expect(amtExact(5n * U, FUND)).toBe('5.00 FUND')
    expect(amtExact(1n, FUND)).toBe('0.0000001 FUND')
  })

  it('writes plain decimals that parse back to the same units', () => {
    for (const units of [0n, 1n, 5n * U, 125n * (U / 10n), 12_345_678n, 3n * U + 1n]) {
      const text = plainAmount(units, 7)
      expect(text).not.toMatch(/,/)
      expect(parseAmount(text, 7)).toBe(units)
    }
    expect(plainAmount(125n * (U / 10n), 7)).toBe('12.5')
    expect(plainAmount(-5n * U, 7)).toBe('-5')
    expect(plainAmount(42n, 0)).toBe('42')
  })

  it('computes per-unit figures by flooring, and nothing for a zero quantity', () => {
    const o = { underlyingQty: 3n * U, underlying: { decimals: 7 }, totalStrike: 10n * U, totalPremium: U }
    expect(perUnit(10n * U, o)).toBe(33_333_333n) // 3.3333333, floored
    expect(strikeUnits(o)).toBe(33_333_333n)
    expect(premiumUnits(o)).toBe(3_333_333n)
    expect(perUnitText(U, o, 7)).toBe('0.33')
    expect(perUnit(U, { underlyingQty: 0n, underlying: { decimals: 7 } })).toBeNull()
    expect(perUnitText(U, { underlyingQty: 0n, underlying: { decimals: 7 } }, 7)).toBe('–')
  })

  it('compares ratios exactly, where a float would tie', () => {
    // 1/3 against 333333333333333333/10^18: equal as doubles, different as fractions.
    expect(Number(1n) / Number(3n) === Number(333333333333333333n) / 1e18).toBe(true)
    expect(compareRatio(1n, 3n, 333333333333333333n, 10n ** 18n)).toBe(1)
    expect(byPremiumPerUnit({ totalPremium: 2n, underlyingQty: 5n }, { totalPremium: 4n, underlyingQty: 10n })).toBe(0)
    expect(byStrikePerUnit({ totalStrike: 50n, underlyingQty: 5n }, { totalStrike: 36n, underlyingQty: 3n })).toBe(-1)
    expect([{ id: 3n }, { id: 1n }, { id: 2n }].sort(byId).map((x) => x.id)).toEqual([1n, 2n, 3n])
  })

  it('says how much is missing', () => {
    expect(shortBy(12n, 18n)).toBe(6n)
    expect(shortBy(18n, 18n)).toBe(0n)
    expect(shortBy(20n, 18n)).toBe(0n)
  })
})
