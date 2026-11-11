import { Networks } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import { TESTNET_PASSPHRASE, config } from '../config'
import { parseLatestLedger } from './ledger'

describe('config', () => {
  it('carries the Testnet passphrase as a literal equal to the SDK constant', () => {
    expect(TESTNET_PASSPHRASE).toBe(Networks.TESTNET)
    expect(config.networkPassphrase).toBe(Networks.TESTNET)
  })
  it('points at Testnet only', () => {
    expect(config.rpcUrl).toMatch(/testnet/)
    expect(config.horizonUrl).toMatch(/testnet/)
  })
})

describe('parseLatestLedger', () => {
  it('reads the sequence and the close time', () => {
    expect(parseLatestLedger({ result: { sequence: 58331204, closeTime: '1794364150' } })).toEqual({ sequence: 58331204, closeTime: 1794364150 })
    expect(parseLatestLedger({ result: { sequence: 12 } })).toEqual({ sequence: 12, closeTime: null })
  })
  it('throws on an RPC error or an empty answer', () => {
    expect(() => parseLatestLedger({ error: { message: 'boom' } })).toThrow('boom')
    expect(() => parseLatestLedger({})).toThrow(/no ledger/)
  })
})
