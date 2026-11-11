// How the markets feature reads and writes the URL. The search types in src/app/search.ts are the contract; the
// router validates them. Reads are non-strict so this folder does not depend on route ids.
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { AssetSearch, MarketsSearch } from '../../app/search'

export const ASSET_ROUTE = '/markets/$asset'
export const MARKETS_ROUTE = '/markets'
export const RESERVES_ROUTE = '/reserves'

/**
 * For a link to the route it is on. The router marks a link as the current page when its search is a subset of
 * the current one; with `exact` only the link whose address is the current address is marked.
 */
export const EXACT = { exact: true } as const

export type AssetTab = NonNullable<AssetSearch['tab']>
export type AssetMode = NonNullable<AssetSearch['mode']>

/** Search params that belong to the order ticket. Cleared when the ticket closes or another one opens. */
const TICKET_KEYS = ['side', 'offer', 'bid', 'ask', 'step', 'qty', 'premium'] as const satisfies readonly (keyof AssetSearch)[]

export const CLEAR_TICKET: Partial<AssetSearch> = Object.fromEntries(TICKET_KEYS.map((k) => [k, undefined]))

/** Drops undefined fields so a link's search never carries empty keys. */
export function compactSearch<T extends object>(search: T): T {
  return Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined && v !== '')) as T
}

/** The `$asset` segment of the current route, or an empty string. */
export function useAssetParam(): string {
  const params = useParams({ strict: false }) as { asset?: string }
  return params.asset ?? ''
}

export function useAssetSearch(): AssetSearch {
  return useSearch({ strict: false }) as AssetSearch
}

export function useMarketsSearch(): MarketsSearch {
  return useSearch({ strict: false }) as MarketsSearch
}

export interface PatchOptions {
  /** Replace the history entry instead of adding one (typing, corrections). */
  replace?: boolean
}

/** Merges a patch into the search of the current route. `undefined` removes a key. */
export function usePatchSearch<T extends object>(): (patch: Partial<T>, opts?: PatchOptions) => void {
  const navigate = useNavigate()
  return useCallback(
    (patch, opts) => {
      void navigate({
        to: '.',
        search: ((prev: T) => compactSearch({ ...prev, ...patch })) as never,
        replace: opts?.replace ?? false,
        resetScroll: false,
      })
    },
    [navigate],
  )
}
