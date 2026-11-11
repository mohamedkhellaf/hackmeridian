import { describe, expect, it } from 'vitest'
import { KIND_WORD, serialOf, strikePerUnitExact, strikePerUnitText } from './index'

const U = 10_000_000n
const BOND = { decimals: 7 }
const USDX = { decimals: 7 }

describe('option words', () => {
  it('pads a serial to six digits', () => {
    expect(serialOf(12n)).toBe('000012')
    expect(serialOf(1234567n)).toBe('1234567')
  })
  it('names the kind', () => {
    expect(KIND_WORD).toEqual({ put: 'Put', call: 'Call' })
  })
  it('prints the strike per unit at one precision, and every digit on request', () => {
    const o = { underlyingQty: 3n * U, underlying: BOND, totalStrike: 100n * U, quote: USDX }
    expect(strikePerUnitText(o)).toBe('33.33')
    expect(strikePerUnitExact(o)).toBe('33.3333333')
    expect(strikePerUnitText({ ...o, underlyingQty: 0n })).toBe('–')
  })
})
