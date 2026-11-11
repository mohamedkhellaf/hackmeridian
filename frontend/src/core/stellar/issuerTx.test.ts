import { Account, Asset, Keypair, Networks, xdr } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import {
  buildClawbackTx,
  buildSacAuthorizedQuery,
  buildSetAuthorizedTx,
  isAccountId,
  isContractId,
  isValidAssetCode,
  missingFlags,
  sacClawbackOp,
  sacContractId,
  sacSetAuthorizedOp,
  trustStatus,
} from './issuerTx'

const issuer = Keypair.random().publicKey()
const holder = Keypair.random().publicKey()
const asset = new Asset('FUND', issuer)
const NET = Networks.TESTNET
const sac = sacContractId('FUND', issuer, NET)
const src = () => new Account(issuer, '100')

describe('issuerTx', () => {
  it('derives a valid SAC id', () => {
    expect(isContractId(sac)).toBe(true)
    expect(isAccountId(holder)).toBe(true)
    expect(isAccountId(sac)).toBe(false)
  })

  it('validates asset codes', () => {
    expect(isValidAssetCode('FUND')).toBe(true)
    expect(isValidAssetCode('')).toBe(false)
    expect(isValidAssetCode('TOOLONGASSET1')).toBe(false)
    expect(isValidAssetCode('A-B')).toBe(false)
  })

  it('builds setTrustLineFlags authorize and revoke', () => {
    for (const authorized of [true, false]) {
      const tx = buildSetAuthorizedTx(src(), asset, holder, authorized, NET)
      const op = tx.operations[0]
      expect(op.type).toBe('setTrustLineFlags')
      if (op.type !== 'setTrustLineFlags') return
      expect(op.trustor).toBe(holder)
      expect(op.flags.authorized).toBe(authorized)
    }
  })

  it('builds a classic clawback', () => {
    const op = buildClawbackTx(src(), asset, holder, '12.5', NET).operations[0]
    expect(op.type).toBe('clawback')
    if (op.type === 'clawback') expect([op.from, op.amount]).toEqual([holder, '12.5000000'])
  })

  it('builds SAC set_authorized / clawback / authorized calls', () => {
    const fn = (op: xdr.Operation) => {
      if (op.body.type !== 'invokeHostFunction') throw new Error('not an invoke op')
      const fn = op.body.invokeHostFunctionOp.hostFunction
      if (fn.type !== 'hostFunctionTypeInvokeContract') throw new Error('not a contract call')
      return { name: String(fn.invokeContract.functionName), args: fn.invokeContract.args.length }
    }
    expect(fn(sacSetAuthorizedOp(sac, sac, true))).toEqual({ name: 'set_authorized', args: 2 })
    expect(fn(sacClawbackOp(sac, holder, 10_000_000n))).toEqual({ name: 'clawback', args: 2 })
    const q = buildSacAuthorizedQuery(sac, sac, NET)
    expect(q.operations[0].type).toBe('invokeHostFunction')
  })

  it('reads trustline status from Horizon balances', () => {
    const line = { asset_type: 'credit_alphanum4', asset_code: 'FUND', asset_issuer: issuer, balance: '5.0000000' }
    expect(trustStatus([], 'FUND', issuer).status).toBe('none')
    expect(trustStatus([{ ...line, is_authorized: true }], 'FUND', issuer).status).toBe('authorized')
    expect(trustStatus([{ ...line, is_authorized: false }], 'FUND', issuer).status).toBe('not-authorized')
    expect(trustStatus([{ ...line, is_authorized: false, is_authorized_to_maintain_liabilities: true }], 'FUND', issuer).status).toBe(
      'maintain-liabilities',
    )
    expect(trustStatus([{ ...line, is_authorized: true }], 'OTHR', issuer).status).toBe('none')
  })

  it('lists missing issuer flags', () => {
    expect(missingFlags({})).toHaveLength(3)
    expect(missingFlags({ auth_required: true, auth_revocable: true, auth_clawback_enabled: true })).toEqual([])
    expect(missingFlags({ auth_required: true })).toEqual(['AUTH_REVOCABLE', 'AUTH_CLAWBACK_ENABLED'])
  })
})
