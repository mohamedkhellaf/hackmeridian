import { describe, expect, it } from 'vitest'
import { actionsFor, authStateFromSac, authStateFromTrust, flagItems, isNotFound, stateTone, targetKindLabel } from './issuerView'

describe('issuerView', () => {
  it('maps trust status to auth state', () => {
    expect(authStateFromTrust('authorized')).toBe('authorized')
    expect(authStateFromTrust('maintain-liabilities')).toBe('partial')
    expect(authStateFromTrust('not-authorized')).toBe('unauthorized')
    expect(authStateFromTrust('none')).toBe('no-trustline')
    expect(authStateFromSac(true)).toBe('authorized')
    expect(authStateFromSac(false)).toBe('unauthorized')
  })
  it('enables only the relevant action', () => {
    expect(actionsFor('authorized')).toEqual({ authorize: false, freeze: true })
    expect(actionsFor('unauthorized')).toEqual({ authorize: true, freeze: false })
    expect(actionsFor('no-trustline')).toEqual({ authorize: false, freeze: false })
    expect(actionsFor('unknown')).toEqual({ authorize: true, freeze: true })
  })
  it('tones', () => {
    expect(stateTone('authorized')).toBe('ok')
    expect(stateTone('unauthorized')).toBe('danger')
    expect(stateTone('unknown')).toBe('neutral')
  })
  it('lists flags', () => {
    expect(flagItems({ auth_required: true }).map((f) => f.ok)).toEqual([true, false, false])
  })
  it('detects not found', () => {
    expect(isNotFound('Not Found')).toBe(true)
    expect(isNotFound('Request failed with status code 404')).toBe(true)
    expect(isNotFound('Network down')).toBe(false)
  })
  it('labels target kind', () => {
    expect(targetKindLabel('account')).toBe('Account')
    expect(targetKindLabel('contract')).toBe('Contract')
    expect(targetKindLabel(null)).toBeNull()
  })
})
