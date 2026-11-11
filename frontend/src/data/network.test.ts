import { describe, expect, it } from 'vitest'
import { LEDGER_STALE_MS, NETWORK_STATE_LABEL, networkState } from './network'

describe('networkState', () => {
  const at = 1_000_000
  it('is mock in mock mode, whatever else', () => {
    expect(networkState({ mock: true, hasData: false, isError: true, readAt: null, nowMs: at })).toBe('mock')
  })
  it('is connecting until the first read, and down when that read failed', () => {
    expect(networkState({ mock: false, hasData: false, isError: false, readAt: null, nowMs: at })).toBe('connecting')
    expect(networkState({ mock: false, hasData: false, isError: true, readAt: null, nowMs: at })).toBe('down')
  })
  it('is ok on a recent read', () => {
    expect(networkState({ mock: false, hasData: true, isError: false, readAt: at - 1_000, nowMs: at })).toBe('ok')
    expect(networkState({ mock: false, hasData: true, isError: false, readAt: at - LEDGER_STALE_MS, nowMs: at })).toBe('ok')
  })
  it('is delayed when the last read failed or the ledger shown is old', () => {
    expect(networkState({ mock: false, hasData: true, isError: true, readAt: at - 1_000, nowMs: at })).toBe('delayed')
    expect(networkState({ mock: false, hasData: true, isError: false, readAt: at - LEDGER_STALE_MS - 1, nowMs: at })).toBe('delayed')
  })
  it('has a word for every state', () => {
    expect(NETWORK_STATE_LABEL).toEqual({ mock: 'Mock data', connecting: 'Connecting', ok: 'Online', delayed: 'Delayed', down: 'Offline' })
  })
})
