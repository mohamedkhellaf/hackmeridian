import { describe, expect, it } from 'vitest'
import type { OptionOffer, TokenInfo } from '../options/types'
import { coverageText, matchProtection } from './match'

const U = 10_000_000n
const FUND: TokenInfo = { contractId: 'F', code: 'FUND', decimals: 7 }
const BOND: TokenInfo = { contractId: 'B', code: 'BOND', decimals: 7 }
const USDX: TokenInfo = { contractId: 'Q', code: 'USDx', decimals: 7 }
const NOW = 1_000_000
const DAY = 86400

function offer(p: Partial<OptionOffer> & { id: bigint }): OptionOffer {
  return {
    kind: 'put', underlying: FUND, quote: USDX, underlyingQty: 5n * U, totalStrike: 50n * U, totalPremium: 2n * U,
    expiry: NOW + 3 * DAY, writer: 'GW', holder: null, state: 'offered', ...p,
  }
}
const goal = { underlyingId: 'F', qty: 50n * U, floor: 10n * U, maxDays: null as number | null }

describe('matchProtection', () => {
  it('keeps only open puts on the same underlying and ranks by premium per unit', () => {
    const offers = [
      offer({ id: 0n }),
      offer({ id: 1n, totalPremium: (18n * U) / 10n }),
      offer({ id: 2n, kind: 'call' }),
      offer({ id: 3n, underlying: BOND }),
      offer({ id: 4n, state: 'active' }),
      offer({ id: 5n, expiry: NOW - 1 }),
    ]
    const r = matchProtection(offers, goal, NOW)
    expect(r.matches.map((m) => m.offer.id)).toEqual([1n, 0n])
    expect(r.matches[0].strikePU).toBe(10n * U)
    expect(r.matches[0].premiumPU).toBe((36n * U) / 100n)
    expect(r.matches[0].partial).toBe(true)
    expect(r.matches[0].covered).toBe(5n * U)
  })

  it('compares premium across different sizes per unit', () => {
    const small = offer({ id: 0n, totalPremium: 2n * U }) // 0.40 / unit
    const big = offer({ id: 1n, underlyingQty: 20n * U, totalStrike: 200n * U, totalPremium: 6n * U }) // 0.30 / unit
    expect(matchProtection([small, big], goal, NOW).matches[0].offer.id).toBe(1n)
  })

  it('filters by floor and shows the closest strikes only when nothing matches', () => {
    const low = offer({ id: 0n, totalStrike: 40n * U }) // 8 / unit
    const lower = offer({ id: 1n, totalStrike: 30n * U }) // 6 / unit
    const r = matchProtection([low, lower], goal, NOW)
    expect(r.matches).toEqual([])
    expect(r.closest.map((m) => m.offer.id)).toEqual([0n, 1n])
    const ok = matchProtection([low, lower, offer({ id: 2n })], goal, NOW)
    expect(ok.matches.map((m) => m.offer.id)).toEqual([2n])
    expect(ok.closest).toEqual([])
  })

  it('applies the expiry window', () => {
    const near = offer({ id: 0n, expiry: NOW + 2 * DAY })
    const far = offer({ id: 1n, expiry: NOW + 10 * DAY })
    expect(matchProtection([near, far], { ...goal, maxDays: 3 }, NOW).matches.map((m) => m.offer.id)).toEqual([0n])
    expect(matchProtection([near, far], { ...goal, maxDays: 14 }, NOW).matches).toHaveLength(2)
    expect(matchProtection([near, far], goal, NOW).matches).toHaveLength(2)
  })

  it('excludes offers larger than the quantity and counts them', () => {
    const r = matchProtection([offer({ id: 0n })], { ...goal, qty: 3n * U }, NOW)
    expect(r.matches).toEqual([])
    expect(r.oversized).toBe(1)
  })

  it('full coverage is not partial; own offers are skipped', () => {
    const o = offer({ id: 0n })
    const r = matchProtection([o], { ...goal, qty: 5n * U }, NOW)
    expect(r.matches[0].partial).toBe(false)
    expect(matchProtection([o], { ...goal, me: 'GW' }, NOW).matches).toEqual([])
  })

  it('formats coverage', () => {
    const r = matchProtection([offer({ id: 0n })], goal, NOW)
    expect(coverageText(r.matches[0], goal.qty, 7, 'FUND')).toBe('Covers 5.00 of your 50.00 FUND')
  })
})
