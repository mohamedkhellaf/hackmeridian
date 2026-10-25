import { describe, expect, it } from 'vitest'
import { describeError, OPTIONS_ERRORS } from './errors'

describe('describeError', () => {
  it('decodes unambiguous options codes', () => {
    expect(describeError(new Error('HostError: Error(Contract, #9)'))).toBe(OPTIONS_ERRORS[9])
    expect(describeError(new Error('Error(Contract, #7)'))).toBe(OPTIONS_ERRORS[7])
  })
  it('matches SAC missing-account text before code #6', () => {
    expect(describeError(new Error('Error(Contract, #6) account entry is missing'))).toMatch(/not funded/)
  })
  it('flags ambiguous 10-13 codes as options-or-token when the source is unknown', () => {
    const msg = describeError(new Error('Error(Contract, #10)'))
    expect(msg).toContain(OPTIONS_ERRORS[10])
    expect(msg).toContain('Insufficient token balance')
  })
  it('falls back to a generic message for unknown codes', () => {
    expect(describeError(new Error('Error(Contract, #99)'))).toBe('Contract error #99.')
  })
})
