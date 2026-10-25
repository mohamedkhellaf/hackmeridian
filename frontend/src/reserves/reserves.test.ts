import { describe, expect, it } from 'vitest'
import { backingFor, formatFixed, formatTenths, lineTotal, ratioTenths, shortfall } from './reserves'
import type { CollateralHealth, CollateralLine, TokenInfo } from '../options/types'

const token: TokenInfo = { contractId: 'C1', code: 'FUND', decimals: 7 }
const line = (o: bigint, a: bigint, p: bigint, u: bigint): CollateralLine => ({ token, offered: o, active: a, pendingReclaim: p, unclaimed: u })
const health = (reserved: bigint, held: bigint): CollateralHealth => ({ token, reserved, held })

describe('reserves helpers', () => {
  it('sums the breakdown', () => {
    expect(lineTotal(line(1n, 2n, 3n, 4n))).toBe(10n)
  })
  it('computes shortfall only when held < reserved', () => {
    expect(shortfall(5n, 8n)).toBe(3n)
    expect(shortfall(8n, 8n)).toBe(0n)
    expect(shortfall(9n, 8n)).toBe(0n)
  })
  it('ratio is null when nothing is owed', () => {
    expect(ratioTenths(0n, 0n)).toBeNull()
    expect(ratioTenths(5n, 0n)).toBeNull()
  })
  it('ratio rounds down so a shortfall never shows 100.0%', () => {
    expect(formatTenths(ratioTenths(5n, 8n) as number)).toBe('62.5%')
    expect(formatTenths(ratioTenths(9999999n, 10000000n) as number)).toBe('99.9%')
    expect(formatTenths(ratioTenths(8n, 8n) as number)).toBe('100.0%')
  })
  it('classifies backing', () => {
    expect(backingFor(line(1n, 0n, 0n, 0n), health(8n, 5n))).toMatchObject({ status: 'short', shortfall: 3n, fill: 62.5 })
    expect(backingFor(line(1n, 0n, 0n, 0n), health(8n, 12n))).toMatchObject({ status: 'backed', shortfall: 0n, fill: 100 })
    expect(backingFor(line(0n, 0n, 0n, 0n), health(0n, 0n))).toMatchObject({ status: 'backed', tenthsPct: null, fill: 100 })
  })
  it('formats with at least 2 decimals', () => {
    expect(formatFixed(10800000000n, 7)).toBe('1,080.00')
    expect(formatFixed(35000000n, 7)).toBe('3.50')
    expect(formatFixed(12500000n, 7)).toBe('1.25')
  })
  it('is unknown without a health reading', () => {
    expect(backingFor(line(1n, 2n, 0n, 0n))).toMatchObject({ status: 'unknown', owed: 3n, held: null })
  })
})
