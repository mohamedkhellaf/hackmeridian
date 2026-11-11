import { describe, expect, it } from 'vitest'
import { mockAssetFacts } from './assetFacts'

describe('mockAssetFacts', () => {
  it('gives fixture flags marked as mock, and invents no counts', () => {
    const bond = mockAssetFacts('BOND', 'GISSUER')
    expect(bond).toMatchObject({ code: 'BOND', issuer: 'GISSUER', native: false, record: null, partial: false, mock: true })
    expect(bond.issuerInfo?.flags).toEqual({ authRequired: true, authRevocable: true, clawback: true, authImmutable: false })
    // The demo shows a power that is on and one that is off.
    expect(mockAssetFacts('FUND').issuerInfo?.flags.authRequired).toBe(false)
    expect(mockAssetFacts('EQTY').issuerInfo?.flags.clawback).toBe(false)
  })

  it('turns every power off for a code it does not know', () => {
    expect(mockAssetFacts('NEW').issuerInfo?.flags).toEqual({ authRequired: false, authRevocable: false, clawback: false, authImmutable: false })
  })
})
