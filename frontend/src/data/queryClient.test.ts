import { replaceEqualDeep } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { POLL_MS, createQueryClient, intervalOf, shouldRetry } from './queryClient'

describe('query client defaults', () => {
  it('never refetches on an interval in a background tab, and refetches on focus', () => {
    const q = createQueryClient(true).getDefaultOptions().queries!
    expect(q.refetchIntervalInBackground).toBe(false)
    expect(q.refetchOnWindowFocus).toBe(true)
    // No interval by default: each hook chooses one for its resource.
    expect(q.refetchInterval).toBeUndefined()
  })

  it('keeps the mock answering offline and leaves live reads to the network state', () => {
    expect(createQueryClient(true).getDefaultOptions().queries!.networkMode).toBe('always')
    expect(createQueryClient(false).getDefaultOptions().queries!.networkMode).toBe('online')
  })

  it('does not use mutation retries for chain writes', () => {
    expect(createQueryClient(true).getDefaultOptions().mutations!.retry).toBe(false)
  })

  it('maps a cadence to an interval', () => {
    expect(intervalOf('book')).toBe(POLL_MS.book)
    expect(intervalOf('slow')).toBe(POLL_MS.slow)
    expect(intervalOf('off')).toBe(false)
    expect(POLL_MS.book).toBe(10_000)
    expect(POLL_MS.slow).toBe(60_000)
    expect(POLL_MS.ledger).toBe(30_000)
  })

  it('retries a failed read twice at most, and never an answer that cannot change', () => {
    expect(shouldRetry(0, new Error('RPC 503'))).toBe(true)
    expect(shouldRetry(1, new Error('RPC 503'))).toBe(true)
    expect(shouldRetry(2, new Error('RPC 503'))).toBe(false)
    expect(shouldRetry(0, new Error('Option not found'))).toBe(false)
    expect(shouldRetry(0, new Error('mock token'))).toBe(false)
    expect(shouldRetry(0, new Error('VITE_OPTIONS_CONTRACT_ID is set but empty.'))).toBe(false)
  })
})

describe('structural sharing with bigint data', () => {
  const option = (id: bigint, premium: bigint) => ({ id, totalPremium: premium, underlying: { contractId: 'C_A', decimals: 7 }, holder: null as string | null })

  it('keeps the identity of a list that did not change', () => {
    const before = [option(1n, 100n), option(2n, 200n)]
    const after = [option(1n, 100n), option(2n, 200n)]
    expect(replaceEqualDeep(before, after)).toBe(before)
  })

  it('keeps the identity of the items that did not change when one did', () => {
    const before = [option(1n, 100n), option(2n, 200n)]
    const after = [option(1n, 100n), option(2n, 250n)]
    const shared = replaceEqualDeep(before, after)
    expect(shared).not.toBe(before)
    expect(shared[0]).toBe(before[0])
    expect(shared[1]).not.toBe(before[1])
    expect(shared[1].totalPremium).toBe(250n)
    expect(shared[0].underlying).toBe(before[0].underlying)
  })
})
