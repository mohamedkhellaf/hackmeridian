import { describe, expect, it } from 'vitest'
import { describeError, OPTIONS_ERRORS, SAC_ERRORS } from './errors'

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
