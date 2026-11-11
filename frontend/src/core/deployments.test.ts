import { describe, expect, it } from 'vitest'
import { QUOTE_ASSETS, REFERENCE_ASSETS, isAccountId, isContractId } from './assets'
import { COVERED_CONTRACT, DEPLOYER, MARGIN_CONTRACT, TOKEN_RECORDS, coveredRecordFor, findTokenRecord, marginRecordFor } from './deployments'

const HEX64 = /^[0-9a-f]{64}$/

describe('recorded Testnet deployments', () => {
  it('holds well-formed contract ids, with valid checksums', () => {
    for (const id of [COVERED_CONTRACT.contractId, MARGIN_CONTRACT.contractId, ...TOKEN_RECORDS.map((t) => t.contractId)]) {
      expect(isContractId(id), id).toBe(true)
    }
  })

  it('holds well-formed account ids, with valid checksums', () => {
    for (const id of [DEPLOYER, MARGIN_CONTRACT.admin, MARGIN_CONTRACT.publisher, ...TOKEN_RECORDS.map((t) => t.issuer)]) {
      expect(isAccountId(id), id).toBe(true)
    }
  })

  it('holds 64-digit hex hashes', () => {
    for (const hash of [COVERED_CONTRACT.wasmHash, COVERED_CONTRACT.deployTx, MARGIN_CONTRACT.wasmHash, MARGIN_CONTRACT.deployTx]) expect(hash).toMatch(HEX64)
    expect(new Set([COVERED_CONTRACT.wasmHash, COVERED_CONTRACT.deployTx, MARGIN_CONTRACT.wasmHash, MARGIN_CONTRACT.deployTx]).size).toBe(4)
  })

  it('keeps the Margin roles apart from each other and from the deployer', () => {
    expect(new Set([MARGIN_CONTRACT.admin, MARGIN_CONTRACT.publisher, DEPLOYER]).size).toBe(3)
  })

  it('keeps the two contracts apart', () => {
    expect(COVERED_CONTRACT.contractId).not.toBe(MARGIN_CONTRACT.contractId)
  })

  it('lists the quote token first, then the reference assets, with the ids of core/assets', () => {
    expect(TOKEN_RECORDS.map((t) => t.code)).toEqual(['USDx', 'RWA', 'BOND', 'EQTY'])
    expect(TOKEN_RECORDS[0].contractId).toBe(QUOTE_ASSETS.testnet.contractId)
    expect(TOKEN_RECORDS[0].role).toBe('quote')
    for (const asset of REFERENCE_ASSETS.testnet) {
      const record = findTokenRecord(asset.contractId)
      expect(record?.code).toBe(asset.code)
      expect(record?.issuer).toBe(asset.issuer)
    }
  })

  it('records the issuer flags: none on USDx, revocable and clawback on the three assets of the team issuer', () => {
    const flags = Object.fromEntries(TOKEN_RECORDS.map((t) => [t.code, t.flags]))
    expect(flags.USDx).toEqual({ authRequired: false, authRevocable: false, clawback: false })
    // One issuer account, so one set of flags: AUTH_REQUIRED was cleared on it on 26 Oct 2026.
    for (const code of ['RWA', 'BOND', 'EQTY']) expect(flags[code], code).toEqual({ authRequired: false, authRevocable: true, clawback: true })
    expect(new Set(TOKEN_RECORDS.filter((t) => t.role === 'underlying').map((t) => t.issuer)).size).toBe(1)
  })

  it('gives a record only for the recorded ids', () => {
    expect(coveredRecordFor(COVERED_CONTRACT.contractId)).toBe(COVERED_CONTRACT)
    expect(coveredRecordFor(MARGIN_CONTRACT.contractId)).toBeNull()
    expect(coveredRecordFor(undefined)).toBeNull()
    expect(marginRecordFor(MARGIN_CONTRACT.contractId)).toBe(MARGIN_CONTRACT)
    expect(marginRecordFor('CSOMETHINGELSE')).toBeNull()
  })
})

describe('recorded proof figures', () => {
  it('counts 250 contract tests and keeps the four fees of the recorded put', async () => {
    const { CONTRACT_TESTS, CONTRACT_TEST_TOTAL, RECORDED_PUT_FEES } = await import('./deployments')
    expect(CONTRACT_TEST_TOTAL).toBe(250)
    expect(CONTRACT_TESTS).toEqual({ unit: 146, invariant: 18, negative: 86 })
    expect(RECORDED_PUT_FEES).toEqual({ write: 309_366n, buy: 31_976n, exercise: 79_873n, claim: 10_223n })
  })
})
