// How the chain reads and writes the URL. The search types of src/app/search.ts are the contract and the router
// validates them; reads are non-strict so this folder does not depend on a route id.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { AssetSearch } from '../../../app/search'

/** Search params that belong to an open ticket. A new selection or a new ticket starts from none of them. */
export const CLEAR_TICKET: Partial<AssetSearch> = { side: undefined, offer: undefined, bid: undefined, ask: undefined, step: undefined, qty: undefined, premium: undefined }

export function useChainSearch(): AssetSearch {
  return useSearch({ strict: false }) as AssetSearch
}

const compact = (search: AssetSearch): AssetSearch => Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined && v !== '')) as AssetSearch

/** Merges a patch into the search of the current route. `undefined` removes a key. Scroll and focus stay put. */
export function usePatchSearch(): (patch: Partial<AssetSearch>, opts?: { replace?: boolean }) => void {
  const navigate = useNavigate()
  return useCallback(
    (patch, opts) => {
      void navigate({
        to: '.',
        search: ((prev: AssetSearch) => compact({ ...prev, ...patch })) as never,
        replace: opts?.replace ?? false,
        resetScroll: false,
      })
    },
    [navigate],
  )
}
