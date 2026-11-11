// What this browser remembers about the welcome guide, and the request to run it now.
//
// Two things, one small external store (subscribe / snapshot, like `settings.ts`):
// - `seen`, persisted under its own key. Not a field of the settings blob: resetting the settings must not bring
//   the welcome back, and it is not a display attribute. Every storage access is in try/catch.
// - `run`, in memory only: which guide was asked for and from where. The shell, the Markets page and the asset
//   page set it; the tour (mounted by src/app) reads it. A feature never imports the tour.
import { useEffect, useSyncExternalStore } from 'react'
import { GUIDE_IDS, GUIDE_VERSION, canOpenModeNote } from '../core/guide'
import type { GuideId, GuideSeen } from '../core/guide'

/** Value: a JSON object by guide id, `{"tour":1,"mode":1}`. The `v1` is the shape of the value, not the content version. */
export const GUIDE_STORAGE_KEY = 'stellsec.guide.v1'
const PROBE_KEY = 'stellsec.guide.probe'

/** Where a run was asked from: the welcome on Markets, the entry in Settings or More, or the asset page by itself. */
export type GuideOrigin = 'slip' | 'replay' | 'auto'

export interface GuideRun {
  id: GuideId
  origin: GuideOrigin
}

export interface GuideState {
  seen: GuideSeen
  /** False when localStorage cannot be read or written: nothing can be put away for good, so nothing is offered. */
  persistent: boolean
  run: GuideRun | null
}

export type GuideStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** `localStorage`, or null where reaching for it throws (storage blocked by the browser). */
function browserStorage(): GuideStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Stored text as the seen map. Forgiving: text that is not a JSON object reads as empty, and a field that is not
 * a non-negative whole number is left out.
 */
export function parseGuideSeen(text: string | null | undefined): GuideSeen {
  if (!text) return {}
  try {
    const raw: unknown = JSON.parse(text)
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const seen: Partial<Record<GuideId, number>> = {}
    for (const id of GUIDE_IDS) {
      const value = (raw as Record<string, unknown>)[id]
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) seen[id] = value
    }
    return seen
  } catch {
    return {}
  }
}

const sameSeen = (a: GuideSeen, b: GuideSeen): boolean => GUIDE_IDS.every((id) => a[id] === b[id])

export interface GuideStore {
  subscribe(listener: () => void): () => void
  get(): GuideState
  /** Asks for a guide to run now. Stores nothing: the tour records it once a note is on screen. */
  start(id: GuideId, origin: GuideOrigin): void
  /** A note of this guide is on screen: remembered at the current content version. */
  shown(id: GuideId): void
  /** "Not now" on the welcome: the tour is remembered as offered and declined. */
  decline(): void
  /** The run is over. With a run given, only that run is cleared (a newer request is left alone). */
  end(run?: GuideRun | null): void
  /** Reads storage again (another tab answered the welcome). */
  reload(): void
}

export interface GuideStoreOptions {
  /** A storage of your own (tests); `null` for none. Default: `localStorage` when it can be reached. */
  storage?: GuideStorage | null
}

export function createGuideStore(options: GuideStoreOptions = {}): GuideStore {
  const listeners = new Set<() => void>()
  let storage: GuideStorage | null = null
  let state: GuideState | null = null

  const read = (): GuideSeen | null => {
    if (!storage) return null
    try {
      return parseGuideSeen(storage.getItem(GUIDE_STORAGE_KEY))
    } catch {
      return null
    }
  }

  /** Whether a write lands. Probed with a key of its own, so the stored answer is never touched by the check. */
  const writable = (): boolean => {
    if (!storage) return false
    try {
      storage.setItem(PROBE_KEY, '1')
      storage.removeItem(PROBE_KEY)
      return true
    } catch {
      return false
    }
  }

  // Storage is first touched when the state is first asked for, not when this module is imported: the landing
  // page loads the data layer and never shows the guide.
  const current = (): GuideState => {
    if (state) return state
    storage = options.storage === undefined ? browserStorage() : options.storage
    const seen = read()
    state = { seen: seen ?? {}, persistent: seen !== null && writable(), run: null }
    return state
  }

  const commit = (next: GuideState) => {
    state = next
    for (const l of listeners) l()
  }

  const remember = (seen: GuideSeen) => {
    const now = current()
    if (sameSeen(seen, now.seen)) return
    try {
      storage?.setItem(GUIDE_STORAGE_KEY, JSON.stringify(seen))
    } catch {
      // Storage full or blocked: the answer still holds for this page load.
    }
    commit({ ...now, seen })
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: current,
    start(id, origin) {
      const now = current()
      // A note that opens by itself never takes the place of a guide the visitor asked for.
      if (origin === 'auto' && now.run) return
      commit({ ...now, run: { id, origin } })
    },
    shown(id) {
      const now = current()
      remember({ ...now.seen, [id]: Math.max(now.seen[id] ?? 0, GUIDE_VERSION) })
    },
    decline() {
      const now = current()
      if (now.seen.tour === undefined) remember({ ...now.seen, tour: 0 })
    },
    end(run) {
      const now = current()
      if (!now.run || (run !== undefined && run !== now.run)) return
      commit({ ...now, run: null })
    },
    reload() {
      const now = current()
      const seen = read()
      // Without readable storage there is nothing to follow: what this page knows stays.
      if (seen && !sameSeen(seen, now.seen)) commit({ ...now, seen })
    },
  }
}

/** The app's guide store. */
export const guideStore: GuideStore = createGuideStore()

export interface GuideHandle extends GuideState {
  start: GuideStore['start']
  shown: GuideStore['shown']
  decline: GuideStore['decline']
  end: GuideStore['end']
}

const SERVER_STATE: GuideState = { seen: {}, persistent: false, run: null }

/** The guide's state and its actions: `const { seen, persistent, run, start } = useGuide()`. */
export function useGuide(): GuideHandle {
  const state = useSyncExternalStore(guideStore.subscribe, guideStore.get, () => SERVER_STATE)
  return { ...state, start: guideStore.start, shown: guideStore.shown, decline: guideStore.decline, end: guideStore.end }
}

/**
 * For the asset page. When the Trade tab of an asset opens, asks for the one note that shows by itself, on the
 * Guided / Chain switch: only for a visitor who took the tour, once per browser, and never while the address
 * carries an order ticket (`core/guide`, `canOpenModeNote`). The tour decides at that moment whether the switch
 * can be seen and nothing else is open; if not, nothing is recorded and the next asset page asks again.
 * `asset` is the asset of the page (its URL segment): going from one asset to another is a new visit.
 */
export function useModeNoteOffer(onTradeTab: boolean, asset: string): void {
  useEffect(() => {
    if (!onTradeTab || typeof window === 'undefined') return
    const { seen, persistent } = guideStore.get()
    const search = Object.fromEntries(new URLSearchParams(window.location.search))
    if (canOpenModeNote({ seen, persistent, search })) guideStore.start('mode', 'auto')
  }, [onTradeTab, asset])
}
