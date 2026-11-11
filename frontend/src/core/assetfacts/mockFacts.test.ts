import { describe, expect, it } from 'vitest'
import { TEAM_ISSUER_FLAGS } from '../deployments'
import { mockAssetFacts } from './assetFacts'

describe('mockAssetFacts', () => {
  it('gives fixture flags marked as mock, and invents no counts', () => {
    const bond = mockAssetFacts('BOND', 'GISSUER')
    expect(bond).toMatchObject({ code: 'BOND', issuer: 'GISSUER', native: false, record: null, partial: false, mock: true })
    expect(bond.issuerInfo?.flags).toEqual({ authRequired: false, authRevocable: true, clawback: true, authImmutable: false })
  })

  it('gives the three mock assets one set of flags, the recorded Testnet issuer\'s (ruling F16)', () => {
    // One issuer account, and the flags belong to the account: FUND, BOND and EQTY cannot differ.
    const live = { ...TEAM_ISSUER_FLAGS, authImmutable: false }
    for (const code of ['FUND', 'BOND', 'EQTY']) expect(mockAssetFacts(code).issuerInfo?.flags, code).toEqual(live)
    // The demo still shows a power that is off (approval) beside two that are on.
    expect(live).toEqual({ authRequired: false, authRevocable: true, clawback: true, authImmutable: false })
  })

  it('turns every power off for a code it does not know', () => {
    expect(mockAssetFacts('NEW').issuerInfo?.flags).toEqual({ authRequired: false, authRevocable: false, clawback: false, authImmutable: false })
  })
})
