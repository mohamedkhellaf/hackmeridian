import { describe, expect, it } from 'vitest'
import { countOf, formatList, MINUS, plural, pluralize } from './index'

const maker = { one: 'maker', other: 'makers' }

describe('plural', () => {
  it('picks the form for the count', () => {
    expect(plural(0, maker)).toBe('makers')
    expect(plural(1, maker)).toBe('maker')
    expect(plural(2, maker)).toBe('makers')
    expect(plural(1.5, maker)).toBe('makers')
    expect(plural(-1, maker)).toBe('maker')
  })

  it('is also exported as pluralize', () => {
    expect(pluralize).toBe(plural)
    expect(pluralize(2, maker)).toBe('makers')
  })

  it('accepts bigint counts', () => {
    expect(plural(1n, maker)).toBe('maker')
    expect(plural(500n, maker)).toBe('makers')
  })

  it('handles irregular nouns because the caller supplies both forms', () => {
    expect(plural(1, { one: 'request is', other: 'requests are' })).toBe('request is')
    expect(plural(3, { one: 'request is', other: 'requests are' })).toBe('requests are')
  })
})

describe('countOf', () => {
  it('joins the grouped count and the noun', () => {
    expect(countOf(1, maker)).toBe('1 maker')
    expect(countOf(2, maker)).toBe('2 makers')
    expect(countOf(0, maker)).toBe('0 makers')
    expect(countOf(1200, { one: 'offer', other: 'offers' })).toBe('1,200 offers')
    expect(countOf(497n, { one: 'offer', other: 'offers' })).toBe('497 offers')
    expect(countOf(-2, maker)).toBe(`${MINUS}2 makers`)
  })
})

describe('formatList', () => {
  it('writes a conjunction without a serial comma', () => {
    expect(formatList([])).toBe('')
    expect(formatList(['RWA'])).toBe('RWA')
    expect(formatList(['RWA', 'BOND'])).toBe('RWA and BOND')
    expect(formatList(['RWA', 'BOND', 'EQTY'])).toBe('RWA, BOND and EQTY')
  })

  it('writes a disjunction', () => {
    expect(formatList(['RWA', 'BOND'], 'disjunction')).toBe('RWA or BOND')
    expect(formatList(['RWA', 'BOND', 'EQTY'], 'disjunction')).toBe('RWA, BOND or EQTY')
  })
})
