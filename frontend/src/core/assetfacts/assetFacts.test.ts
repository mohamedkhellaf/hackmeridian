import { describe, expect, it } from 'vitest'
import { describeFlags, parseAssetsResponse, parseHolderStatus, parseIssuerAccount, parseSacName } from './assetFacts'

const ISSUER = 'GDSX2WUFUT7KCMTUNG3IUQWIUQSC4XNKQ5NTGEZRKLTMLCSJTCUVBEVG'
const ME = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'

const assets = {
  _embedded: {
    records: [
      {
        asset_code: 'FUND',
        num_contracts: 2,
        accounts: { authorized: 3, authorized_to_maintain_liabilities: 1, unauthorized: 2 },
        flags: { auth_required: true, auth_revocable: true, auth_immutable: false, auth_clawback_enabled: true },
      },
    ],
  },
}

describe('parseSacName', () => {
  it('parses CODE:ISSUER and native', () => {
    expect(parseSacName(`FUND:${ISSUER}`)).toEqual({ kind: 'issued', code: 'FUND', issuer: ISSUER })
    expect(parseSacName('native')).toEqual({ kind: 'native' })
  })
  it('rejects anything else', () => {
    expect(parseSacName('FUND')).toBeNull()
    expect(parseSacName(42)).toBeNull()
    expect(parseSacName('FUND:GBAD')).toBeNull()
  })
})

describe('parseAssetsResponse', () => {
  it('reads flags and trustline counts', () => {
    const r = parseAssetsResponse(assets)!
    expect(r.flags).toEqual({ authRequired: true, authRevocable: true, clawback: true, authImmutable: false })
    expect(r.trustlines).toEqual({ authorized: 3, maintainOnly: 1, unauthorized: 2, total: 6 })
    expect(r.contracts).toBe(2)
  })
  it('returns null for an empty or malformed response', () => {
    expect(parseAssetsResponse({ _embedded: { records: [] } })).toBeNull()
    expect(parseAssetsResponse(null)).toBeNull()
  })
})

describe('parseIssuerAccount', () => {
  it('detects a locked issuer (all signers weight 0)', () => {
    const r = parseIssuerAccount({ home_domain: 'x.io', signers: [{ weight: 0 }], flags: { auth_clawback_enabled: true } })!
    expect(r.locked).toBe(true)
    expect(r.homeDomain).toBe('x.io')
    expect(r.flags.clawback).toBe(true)
  })
  it('is unlocked when a signer has weight', () => {
    expect(parseIssuerAccount({ signers: [{ weight: 1 }], flags: {} })!.locked).toBe(false)
  })
  it('returns null without signers', () => {
    expect(parseIssuerAccount({})).toBeNull()
  })
})

describe('parseHolderStatus', () => {
  const acct = (line: object) => ({ balances: [{ asset_type: 'native' }, { asset_code: 'FUND', asset_issuer: ISSUER, ...line }] })
  it('maps authorization states', () => {
    expect(parseHolderStatus(acct({ is_authorized: true }), 'FUND', ISSUER, ME)).toBe('authorized')
    expect(parseHolderStatus(acct({ is_authorized: false, is_authorized_to_maintain_liabilities: true }), 'FUND', ISSUER, ME)).toBe('maintain-only')
    expect(parseHolderStatus(acct({ is_authorized: false, is_authorized_to_maintain_liabilities: false }), 'FUND', ISSUER, ME)).toBe('unauthorized')
    expect(parseHolderStatus({ balances: [] }, 'FUND', ISSUER, ME)).toBe('no-trustline')
    expect(parseHolderStatus({}, 'FUND', ISSUER, ISSUER)).toBe('issuer')
  })
})

describe('describeFlags', () => {
  it('states the clawback consequence only when enabled', () => {
    const on = describeFlags({ authRequired: false, authRevocable: false, clawback: true, authImmutable: false })
    expect(on.find((f) => f.key === 'clawback')!.consequence).toMatch(/take tokens back, including from the options contract/)
    const off = describeFlags({ authRequired: false, authRevocable: false, clawback: false, authImmutable: false })
    expect(off.find((f) => f.key === 'clawback')!.on).toBe(false)
  })
})
