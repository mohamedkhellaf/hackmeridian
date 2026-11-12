// How the Requests page reads and writes its URL. The search type in src/app/search.ts is the contract and the
// router validates it; this file only merges patches. Reads are non-strict so the folder holds no route ids.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { RequestsSearch } from '../../app/search'

export const PORTFOLIO_POSITION_ROUTE = '/portfolio/$id'
export const RESERVES_ROUTE = '/reserves'
export const MARKETS_ROUTE = '/markets'

export function useRequestsSearch(): RequestsSearch {
  return useSearch({ strict: false }) as RequestsSearch
}

/** Drops empty fields so the URL never carries a key without a value. */
export function compactSearch(search: RequestsSearch): RequestsSearch {
  return Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined && v !== '')) as RequestsSearch
}

export interface PatchOptions {
  /** Replace the history entry instead of adding one. Filters replace; opening a ticket adds. */
  replace?: boolean
}

/** Merges a patch into the search of the page. `undefined` removes a key. */
export function usePatchRequestsSearch(): (patch: Partial<RequestsSearch>, opts?: PatchOptions) => void {
  const navigate = useNavigate()
  return useCallback(
    (patch, opts) => {
      void navigate({
        to: '.',
        search: ((prev: RequestsSearch) => compactSearch({ ...prev, ...patch })) as never,
        replace: opts?.replace ?? false,
        resetScroll: false,
      })
    },
    [navigate],
  )
}
