import { describe, expect, it } from 'vitest'
import { describeError, NETWORK_UNREACHABLE, OPTIONS_ERRORS, SAC_ERRORS } from './errors'

describe('describeError', () => {
  it('decodes v1.1+ options codes (101-115)', () => {
    expect(describeError(new Error('HostError: Error(Contract, #109)'))).toBe(OPTIONS_ERRORS[109])
    expect(describeError(new Error('Error(Contract, #107)'))).toBe(OPTIONS_ERRORS[107])
    expect(describeError(new Error('Error(Contract, #114)'))).toBe(OPTIONS_ERRORS[114])
    expect(describeError(new Error('Error(Contract, #115)'))).toBe(OPTIONS_ERRORS[115])
  })
  it('keeps every options code 101-115 mapped', () => {
    for (let c = 101; c <= 115; c++) expect(OPTIONS_ERRORS[c]).toBeTruthy()
  })
  it('decodes SAC codes unambiguously now that options start at 101', () => {
    expect(describeError(new Error('Error(Contract, #10)'))).toBe(SAC_ERRORS[10])
    expect(describeError(new Error('Error(Contract, #11)'))).toBe(SAC_ERRORS[11])
    expect(describeError(new Error('Error(Contract, #13)'))).toBe(SAC_ERRORS[13])
  })
  it('matches SAC missing-account text before code #6', () => {
    expect(describeError(new Error('Error(Contract, #6) account entry is missing'))).toMatch(/not funded/)
  })
  it('matches the trustline-missing text', () => {
    expect(describeError(new Error('trustline entry is missing for account'))).toMatch(/trustline/i)
  })
  it('falls back to a generic message for unknown codes', () => {
    expect(describeError(new Error('Error(Contract, #99)'))).toBe('Contract error #99.')
  })
})

describe('v1.3 codes', () => {
  it('maps 116-119', () => {
    for (let c = 116; c <= 119; c++) {
      expect(OPTIONS_ERRORS[c]).toBeTruthy()
      expect(describeError(new Error(`Error(Contract, #${c})`))).toBe(OPTIONS_ERRORS[c])
    }
  })
})

describe('v1.4 and v1.5 codes', () => {
  it('maps 120-125', () => {
    for (let c = 120; c <= 125; c++) expect(describeError(new Error(`Error(Contract, #${c})`))).toBe(OPTIONS_ERRORS[c])
  })
})

describe('transaction-level failures', () => {
  it('a timeout says the outcome is not known and never suggests sending again', () => {
    for (const raw of ['Waited 300 seconds for transaction to complete, but it did not. Timed out', 'request timeout', 'Transaction still pending']) {
      const text = describeError(new Error(raw))
      expect(text).toBe('Not confirmed yet. The transaction may still be included; check again before sending another.')
      expect(text).not.toMatch(/try again/i)
    }
  })
  it('a time bound that passed before the network accepted it is safe to sign again', () => {
    expect(describeError('txTooLate')).toMatch(/Nothing was charged; sign it again/)
    expect(describeError(new Error('tx_too_late'))).toMatch(/time limit/)
  })
  it('names a stale sequence number and a low fee', () => {
    expect(describeError('txBadSeq')).toMatch(/went first/)
    expect(describeError('txInsufficientFee')).toMatch(/Fee too low/)
  })
  it('keeps the wallet and network cases', () => {
    expect(describeError(new Error('User declined access'))).toBe('You declined to sign in your wallet.')
    expect(describeError(new Error('networkPassphrase mismatch'))).toMatch(/wrong network/)
    expect(describeError(new Error('Account not found'))).toMatch(/not funded/)
  })
  it('gives a switched account or network its own sentence', () => {
    expect(describeError(new Error('tx_bad_auth'))).toMatch(/another account, or for another network/)
    expect(describeError('txBadAuth')).not.toMatch(/wrong network\. Switch/)
  })
  it('says a network or loading failure plainly, never with the URL', () => {
    for (const raw of ['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'Failed to fetch dynamically imported module: http://localhost:5199/src/core/options/mockClient.ts']) {
      expect(describeError(new Error(raw))).toBe(NETWORK_UNREACHABLE)
    }
  })
  it('words the commonest failures with their cause and what to do', () => {
    expect(OPTIONS_ERRORS[106]).toMatch(/^The option changed before your transaction landed/)
    expect(OPTIONS_ERRORS[125]).toMatch(/the most one account can have/)
    expect(OPTIONS_ERRORS[125]).not.toMatch(/on this asset/)
    expect(OPTIONS_ERRORS[115]).toMatch(/^Clawback shortfall/)
    expect(describeError('Error(Contract, #6) account entry is missing')).toMatch(/Friendbot/)
  })
  it('uses the product words: maker, deadline, request, Covered contract (ruling R7)', () => {
    for (const text of Object.values(OPTIONS_ERRORS)) {
      expect(text, text).not.toMatch(/\bwriter\b|\bexpiry\b|\bbids?\b|options contract/i)
      expect(text, text).not.toMatch(/[—–→←!]/)
    }
  })
  it('never says "please"', () => {
    for (const raw of ['timeout', 'expired', 'txTooLate', 'txBadSeq', 'denied', 'tx_insufficient_balance']) expect(describeError(raw)).not.toMatch(/please/i)
  })
})
