// The query cache and its defaults.
//
// What the defaults encode:
//   - nothing refetches in a background tab (`refetchIntervalInBackground: false`); coming back to the tab
//     refetches whatever is stale (`refetchOnWindowFocus`), like the old 10 s poll did on focus;
//   - reads are deduplicated: two components asking for the option list share one request;
//   - structural sharing stays on. It keeps the identity of every unchanged option, bid and balance between
//     polls (bigint fields compare by value), so a poll that finds nothing new re-renders nothing;
//   - a query never retries more than twice, and never on an answer that will not change (a missing id);
//   - mutations are not used for chain writes: the transaction layer in ./tx owns those, with stages.
import { QueryClient } from '@tanstack/react-query'
import { isMockMode } from '../core/options/createClient'

/** Refetch intervals by kind of resource, in milliseconds. A query polls only while a component reads it. */
export const POLL_MS = {
  /** Offers, bids, listings: what other people's trades change. */
  book: 10_000,
  /** Assets, reserves, balances, counts: slow to change, and refreshed after each of the user's own transactions. */
  slow: 60_000,
  /** The network chip. */
  ledger: 30_000,
} as const

/** How long an answer is served from cache before a new reader triggers a refetch. */
export const STALE_MS = {
  book: 5_000,
  slow: 30_000,
  ledger: 15_000,
  /** Asset lists and issuer facts. */
  facts: 60_000,
} as const

export type Cadence = 'book' | 'slow' | 'off'

/** `refetchInterval` for a cadence: `false` turns polling off (the query still refetches on focus and on invalidation). */
export const intervalOf = (cadence: Cadence): number | false => (cadence === 'off' ? false : POLL_MS[cadence])

/**
 * Hashes a query key. Same as the library default (object keys sorted), except that a stray `bigint` becomes
 * `"12n"` instead of throwing. The key factory never produces one; this is the net under a hand-written key.
 */
export function hashQueryKey(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey, (_, value: unknown) => {
    if (typeof value === 'bigint') return `${value}n`
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(value).sort()) sorted[k] = (value as Record<string, unknown>)[k]
      return sorted
    }
    return value
  })
}

/** A read that failed twice is reported; an answer that cannot change (unknown id, wrong contract) is not retried. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  const text = error instanceof Error ? error.message : String(error)
  return !/not found|no such|does not exist|mock token|is set but empty/i.test(text)
}

export function createQueryClient(mock: boolean = isMockMode()): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: hashQueryKey,
        staleTime: STALE_MS.book,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        // The mock client needs no network: keep it answering when the browser reports offline.
        networkMode: mock ? 'always' : 'online',
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  })
}

/** The app's cache. One per page load; tests build their own with `createQueryClient`. */
export const queryClient: QueryClient = createQueryClient()
