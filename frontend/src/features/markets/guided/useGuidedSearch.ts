// How the guided flow reads and writes the URL. The search types of src/app/search.ts are the contract; the
// router validates them. Reads are non-strict, so this file does not depend on a route id.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
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

// ------------------------------------------------------------------------------------------- drafts

export interface DraftParam {
  /** What the input shows. */
  text: string
  /** True while the input shows what the user typed rather than the URL's value or the fallback. */
  edited: boolean
  /** Records what the user typed and returns the value for the URL (undefined when empty or not a decimal). */
  type: (text: string) => string | undefined
  /** Forgets what was typed: the input shows the URL's value, or the fallback. */
  reset: () => void
}

export interface Draft {
  /** What the user typed, as typed: `5.`, or an empty field. */
  text: string
  /** The URL value the text stands for. */
  expect: string | undefined
  /**
   * URL values that may still be on screen while the user's own writes are on their way: the value before the
   * first keystroke, and those of earlier keystrokes that have not landed. Emptied once the last write lands.
   */
  pending: ReadonlyArray<string | undefined>
}

// One store for the whole page, so the guided form and its closing block (rendered in the order rail, outside
// the form) read the same draft. Keyed by asset, intent and param.
const drafts = new Map<string, Draft>()
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const owns = (draft: Draft | undefined, url: string | undefined): draft is Draft => draft !== undefined && (url === draft.expect || draft.pending.includes(url))

/** What the input shows for a URL value: the typed text while the URL holds one of the draft's values. Pure. */
export function shownDraft(draft: Draft | undefined, url: string | undefined, fallback: string): { text: string; edited: boolean } {
  return owns(draft, url) ? { text: draft.text, edited: true } : { text: url ?? fallback, edited: false }
}

/** The draft after a keystroke, while the URL holds `url`. Pure. */
export function typedDraft(prev: Draft | undefined, url: string | undefined, next: string): Draft {
  const pending = owns(prev, url) && url !== prev.expect ? [...prev.pending, prev.expect] : [url]
  return { text: next, expect: normalizeDecimal(next), pending }
}

/** The draft once the URL holds its last value: the earlier writes have landed and are forgotten. Pure. */
export function landedDraft(draft: Draft | undefined, url: string | undefined): Draft | undefined {
  return draft && draft.pending.length > 0 && url === draft.expect ? { ...draft, pending: [] } : draft
}

/**
 * One decimal search param edited in a text input.
 *
 * The URL is the state, but an input needs a little more: `5.` must stay on screen while it is typed, and an
 * emptied field must stay empty although the URL still names the old value until the navigation lands. So what
 * the user typed is kept, with the URL values its writes may still meet on the way. The input shows the typed
 * text while the URL holds one of those values, and the URL's own value (or `fallback` when it has none) as soon
 * as it names anything else: a link, Back, a suggestion, the ticket. Nothing is ever written back to the URL.
 */
export function useDraftParam(key: string, urlValue: string | undefined, fallback: string): DraftParam {
  const draft = useSyncExternalStore(subscribe, () => drafts.get(key))
  const { text, edited } = shownDraft(draft, urlValue, fallback)

  const url = useRef(urlValue)
  useEffect(() => {
    url.current = urlValue
  }, [urlValue])

  // The last write has landed, so the earlier ones have too: forget them, so that Back to one of those values
  // is read as the link it is.
  const landed = draft !== undefined && landedDraft(draft, urlValue) !== draft
  useEffect(() => {
    if (!landed) return
    const current = drafts.get(key)
    const next = landedDraft(current, urlValue)
    if (next && next !== current) {
      drafts.set(key, next)
      emit()
    }
  }, [landed, key, urlValue])

  const type = useCallback(
    (next: string) => {
      const draft = typedDraft(drafts.get(key), url.current, next)
      drafts.set(key, draft)
      emit()
      return draft.expect
    },
    [key],
  )
  const reset = useCallback(() => {
    if (drafts.delete(key)) emit()
  }, [key])
  return { text, edited, type, reset }
}
