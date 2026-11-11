// How the guided flow reads and writes the URL. The search types of src/app/search.ts are the contract; the
// router validates them. Reads are non-strict, so this file does not depend on a route id.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { AssetSearch } from '../../../app/search'
import { normalizeDecimal } from './terms'

export interface PatchOptions {
  /** Replace the history entry instead of adding one (typing). A chip or an intent adds one, so Back undoes it. */
  replace?: boolean
}

/** Search keys that open the order ticket. A change of terms in the guided flow removes them: the ticket closes. */
export const CLOSE_TICKET: Partial<AssetSearch> = { side: undefined, offer: undefined, bid: undefined, ask: undefined, step: undefined }

/** True while the URL carries an open order ticket. */
export const ticketOpen = (search: AssetSearch): boolean => search.side !== undefined || search.offer !== undefined || search.bid !== undefined || search.ask !== undefined

const compact = <T extends object>(search: T): T => Object.fromEntries(Object.entries(search).filter(([, value]) => value !== undefined && value !== '')) as T

export function useGuidedSearch(): { search: AssetSearch; patch: (next: Partial<AssetSearch>, opts?: PatchOptions) => void } {
  const search = useSearch({ strict: false }) as AssetSearch
  const navigate = useNavigate()
  const patch = useCallback(
    (next: Partial<AssetSearch>, opts?: PatchOptions) => {
      void navigate({
        to: '.',
        search: ((prev: AssetSearch) => compact({ ...prev, ...next })) as never,
        replace: opts?.replace ?? false,
        resetScroll: false,
      })
    },
    [navigate],
  )
  return { search, patch }
}

export interface DraftParam {
  /** What the input shows. */
  text: string
  /** Records what the user typed and returns the value for the URL (undefined when it is not a decimal). */
  type: (text: string) => string | undefined
}

/**
 * One decimal search param edited in a text input.
 *
 * The URL is the state, but an input needs a little more: `5.` must stay on screen while it is typed, and the
 * value must survive if another part of the page removes the param. (Closing the order ticket in guided mode
 * keeps `qty` and `premium`: the asset page leaves them alone. A ticket of the chain, or a link built elsewhere,
 * may still drop them.) So the last text is remembered per `scope` (asset and intent): it is shown while the URL
 * agrees with it or says nothing, dropped as soon as the URL names another value, and written back to the URL
 * when the ticket is closed and the param is missing, so the link stays complete.
 */
export function useDraftParam(
  scope: string,
  urlValue: string | undefined,
  fallback: string,
  restore: { enabled: boolean; write: (value: string) => void },
): DraftParam {
  const [draft, setDraft] = useState<{ scope: string; text: string } | null>(null)
  const active = draft !== null && draft.scope === scope
  const agrees = active && urlValue !== undefined && normalizeDecimal(draft.text) === urlValue

  // The URL named a value the draft does not have (a link, Back, a suggestion, the ticket): adopt it.
  if (urlValue !== undefined && !agrees) setDraft({ scope, text: urlValue })

  const text = urlValue !== undefined ? (agrees ? draft.text : urlValue) : active ? draft.text : fallback
  const remembered = urlValue === undefined && active ? normalizeDecimal(draft.text) : undefined
  const { enabled, write } = restore

  useEffect(() => {
    if (enabled && remembered !== undefined) write(remembered)
  }, [enabled, remembered, write])

  const type = useCallback(
    (next: string) => {
      setDraft({ scope, text: next })
      return normalizeDecimal(next)
    },
    [scope],
  )
  return { text, type }
}
