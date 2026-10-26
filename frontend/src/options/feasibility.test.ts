import { describe, expect, it } from 'vitest'
import { exerciseFeasibility, implausibleTerms, premiumUnaffordable } from './feasibility'

const U = 10_000_000n
const rwa = { contractId: 'CR', code: 'RWA', decimals: 7 }
const usd = { contractId: 'CU', code: 'USDx', decimals: 7 }
const put = { kind: 'put' as const, underlying: rwa, quote: usd, underlyingQty: 5n * U, totalStrike: 50n * U }
const call = { ...put, kind: 'call' as const }

describe('exerciseFeasibility', () => {
  it('put: needs the underlying', () => {
    expect(exerciseFeasibility(put, { status: 'ok', balance: 5n * U }, undefined).level).toBe('ok')
    const w = exerciseFeasibility(put, { status: 'ok', balance: U }, undefined)
    expect(w.level).toBe('warn')
    expect('message' in w && w.message).toMatch(/deliver 5(\.00)? RWA.*hold 1(\.00)? RWA/)
  })
  it('call: needs the quote strike', () => {
    expect(exerciseFeasibility(call, undefined, { status: 'ok', balance: 49n * U }).level).toBe('warn')
    expect(exerciseFeasibility(call, undefined, { status: 'ok', balance: 50n * U }).level).toBe('ok')
  })
  it('flags missing trustline and unauthorized', () => {
    expect(exerciseFeasibility(put, { status: 'no-trustline', balance: null }, undefined).level).toBe('warn')
    expect(exerciseFeasibility(put, { status: 'not-authorized', balance: 9n * U }, undefined).level).toBe('warn')
  })
  it('unknown without a reading', () => {
    expect(exerciseFeasibility(put, undefined, undefined).level).toBe('unknown')
    expect(exerciseFeasibility(put, { status: 'mock', balance: null }, undefined).level).toBe('unknown')
    expect(exerciseFeasibility(put, { status: 'error', balance: null }, undefined).level).toBe('unknown')
  })
})

describe('premiumUnaffordable', () => {
  it('only with a real balance', () => {
    expect(premiumUnaffordable({ totalPremium: 2n * U }, { status: 'ok', balance: U })).toBe(true)
    expect(premiumUnaffordable({ totalPremium: 2n * U }, { status: 'ok', balance: 2n * U })).toBe(false)
    expect(premiumUnaffordable({ totalPremium: 2n * U }, { status: 'mock', balance: null })).toBe(false)
    expect(premiumUnaffordable({ totalPremium: 2n * U }, undefined)).toBe(false)
  })
})

describe('implausibleTerms', () => {
  it('flags premium >= total strike', () => {
    expect(implausibleTerms({ totalPremium: 2n * U, totalStrike: 50n * U, underlyingQty: U })).toBe(false)
    expect(implausibleTerms({ totalPremium: 50n * U, totalStrike: 50n * U, underlyingQty: U })).toBe(true)
  })
})
