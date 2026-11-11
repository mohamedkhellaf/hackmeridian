import { describe, expect, it, vi } from 'vitest'
import { combineStatus } from './derived'

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
