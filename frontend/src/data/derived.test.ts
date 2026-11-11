import { describe, expect, it, vi } from 'vitest'
import { MOCK_QUOTE, MOCK_UNDERLYINGS } from '../core/options/mockSeed'
import { OPTIONS_ERRORS } from '../core/stellar/errors'
import { combineStatus, isNotFoundMessage, resolveAssetRoute } from './derived'

type Q = Parameters<typeof combineStatus>[0][number]
const q = (over: Partial<Q> = {}): Q => ({ data: undefined, isPending: true, isError: false, error: null, dataUpdatedAt: 0, refetch: vi.fn(), fetchStatus: 'fetching', ...over })
const loaded = (at = 1_000, over: Partial<Q> = {}): Q => q({ data: [], isPending: false, dataUpdatedAt: at, fetchStatus: 'idle', ...over })
const failed = (message = 'RPC 503'): Q => q({ isPending: false, isError: true, error: new Error(message), fetchStatus: 'idle' })
const disabled = (): Q => q({ fetchStatus: 'idle' })

describe('combineStatus: one status for a view built from several reads', () => {
  it('is loading until every required read has data and every optional one has answered', () => {
    expect(combineStatus([q(), loaded()])).toMatchObject({ ready: false, isLoading: true, isError: false, refreshFailed: false })
    expect(combineStatus([loaded()], [q()])).toMatchObject({ ready: false, isLoading: true })
    expect(combineStatus([loaded(), loaded()], [loaded()])).toMatchObject({ ready: true, isLoading: false, isError: false, refreshFailed: false, error: null })
  })

  it('is an error when a required read failed with nothing to show', () => {
    expect(combineStatus([failed('Could not reach the RPC'), loaded()])).toMatchObject({ ready: false, isLoading: false, isError: true, error: 'Could not reach the RPC' })
  })

  it('stays ready when an optional read failed: older contracts have no listings or requests', () => {
    expect(combineStatus([loaded()], [failed('no such function')])).toMatchObject({ ready: true, isError: false, refreshFailed: true, error: 'no such function' })
  })

  it('keeps showing data when a refresh fails, and says the refresh failed', () => {
    const stale = loaded(1_000, { isError: true, error: new Error('RPC 503') })
    expect(combineStatus([stale, loaded(2_000)])).toMatchObject({ ready: true, isLoading: false, isError: false, refreshFailed: true, error: 'RPC 503' })
  })

  it('treats a disabled read as having no subject, not as loading for ever', () => {
    expect(combineStatus([disabled()])).toMatchObject({ ready: true, isLoading: false, isError: false })
    expect(combineStatus([loaded()], [disabled()])).toMatchObject({ ready: true, isLoading: false })
  })

  it('reports the oldest read time, and retries every read', () => {
    const a = loaded(5_000)
    const b = loaded(3_000)
    const c = q()
    const status = combineStatus([a, b], [c])
    expect(status.updatedAt).toBe(3_000)
    status.retry()
    for (const x of [a, b, c]) expect(x.refetch).toHaveBeenCalledTimes(1)
    expect(combineStatus([q()]).updatedAt).toBeNull()
  })
})

describe('resolveAssetRoute: the asset a /markets/$asset URL names', () => {
  const listed = { quote: MOCK_QUOTE, underlyings: MOCK_UNDERLYINGS }
  const bond = MOCK_UNDERLYINGS.find((t) => t.code === 'BOND')!

  it('finds a reference asset by its slug, in any case, and says the URL is canonical only for the slug itself', () => {
    const r = resolveAssetRoute('bond', listed, 'mock')
    expect(r).toMatchObject({ status: 'found', token: bond, quote: MOCK_QUOTE, canonical: 'bond', isCanonical: true, tier: 'Reference', typeLabel: 'Bond' })
    expect(resolveAssetRoute('BOND', listed, 'mock')).toMatchObject({ status: 'found', token: bond, canonical: 'bond', isCanonical: false })
  })

  it('accepts the contract id and the code and issuer pair as aliases of the same asset', () => {
    expect(resolveAssetRoute(bond.contractId, listed, 'mock')).toMatchObject({ status: 'found', token: bond, canonical: 'bond', isCanonical: false })
    expect(resolveAssetRoute(`${bond.code}-${bond.issuer}`, listed, 'mock')).toMatchObject({ status: 'found', token: bond, canonical: 'bond', isCanonical: false })
  })

  it('finds a listed asset outside the reference list by its contract id, with its tier in words', () => {
    const stranger = { contractId: 'C_MOCK_OTHER', code: 'OTHR', decimals: 7 }
    const r = resolveAssetRoute('C_MOCK_OTHER', { quote: MOCK_QUOTE, underlyings: [...MOCK_UNDERLYINGS, stranger] }, 'mock')
    expect(r).toMatchObject({ status: 'found', token: stranger, canonical: 'C_MOCK_OTHER', isCanonical: true, tier: 'No domain link', typeLabel: null })
  })

  it('is unknown for a well formed segment that names nothing listed, also a reference asset the contract does not list', () => {
    expect(resolveAssetRoute('gold', listed, 'mock')).toMatchObject({ status: 'unknown', token: null, canonical: null, tier: null })
    const withoutBond = { quote: MOCK_QUOTE, underlyings: MOCK_UNDERLYINGS.filter((t) => t !== bond) }
    expect(resolveAssetRoute('bond', withoutBond, 'mock')).toMatchObject({ status: 'unknown', token: null })
  })

  it('is invalid for anything that is not a slug, a pair or an id', () => {
    for (const bad of ['%%%', 'a', '<script>', 'x'.repeat(90)]) expect(resolveAssetRoute(bad, listed, 'mock').status).toBe('invalid')
  })
})

describe('isNotFoundMessage', () => {
  it('tells an id the contract does not have from a read that failed', () => {
    expect(isNotFoundMessage(OPTIONS_ERRORS[101])).toBe(true)
    expect(isNotFoundMessage('Request not found.')).toBe(true)
    expect(isNotFoundMessage('RPC 503')).toBe(false)
    expect(isNotFoundMessage(null)).toBe(false)
  })
})
