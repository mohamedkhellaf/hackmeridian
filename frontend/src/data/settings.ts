// The user's display settings: theme, density, gain and loss colours, and the default mode of an asset page.
// A small external store (subscribe / snapshot), persisted in localStorage with every access in try/catch, and
// applied to <html> as data attributes that `ui/tokens/tokens.css` reads. The ui kit holds no storage; this
// module owns it and calls the kit's three `apply*` functions.
import { useSyncExternalStore } from 'react'
import { DENSITY_CHOICES, PNL_SCHEMES, THEME_CHOICES, applyDensity, applyPnlScheme, applyTheme } from '../ui/theme'
import type { DensityChoice, PnlScheme, ThemeChoice } from '../ui/theme'

export type { DensityChoice, PnlScheme, ThemeChoice } from '../ui/theme'

/** How an asset page opens: the guided flow (default) or the chain. */
export type DefaultMode = 'guided' | 'chain'
export const MODE_CHOICES: readonly DefaultMode[] = ['guided', 'chain']

export interface Settings {
  /** `system` follows `prefers-color-scheme`. */
  theme: ThemeChoice
  density: DensityChoice
  /** Gain and loss colours: `default` (teal and orange), `classic` (green and red), `mono` (ink; sign and glyph carry the meaning). */
  pnl: PnlScheme
  mode: DefaultMode
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', density: 'comfortable', pnl: 'default', mode: 'guided' }
export const SETTINGS_STORAGE_KEY = 'stellsec.settings.v1'

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback)

/** Stored text as settings. Anything missing or unknown falls back to the default, field by field. */
export function parseSettings(text: string | null | undefined): Settings {
  if (!text) return DEFAULT_SETTINGS
  try {
    const raw: unknown = JSON.parse(text)
    if (raw === null || typeof raw !== 'object') return DEFAULT_SETTINGS
    const r = raw as Record<string, unknown>
    return {
      theme: pick(r.theme, THEME_CHOICES, DEFAULT_SETTINGS.theme),
      density: pick(r.density, DENSITY_CHOICES, DEFAULT_SETTINGS.density),
      pnl: pick(r.pnl, PNL_SCHEMES, DEFAULT_SETTINGS.pnl),
      mode: pick(r.mode, MODE_CHOICES, DEFAULT_SETTINGS.mode),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Writes the three display attributes on <html>: `data-theme`, `data-density`, `data-pnl`. A no-op without a document. */
export function applySettings(settings: Settings): void {
  applyTheme(settings.theme)
  applyDensity(settings.density)
  applyPnlScheme(settings.pnl)
}

export interface SettingsStore {
  subscribe(listener: () => void): () => void
  get(): Settings
  /** Changes one or more settings, persists them and applies them. */
  set(patch: Partial<Settings>): void
  /** Back to the defaults. */
  reset(): void
  /** Reads storage again (another tab changed a setting) and applies the result. */
  reload(): void
}

export interface SettingsStoreOptions {
  storage?: SettingsStorage | null
  /** Applies settings to the page. Defaults to `applySettings`. */
  apply?: (settings: Settings) => void
}

function safeStorage(): SettingsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const same = (a: Settings, b: Settings): boolean => a.theme === b.theme && a.density === b.density && a.pnl === b.pnl && a.mode === b.mode

export function createSettingsStore(options: SettingsStoreOptions = {}): SettingsStore {
  const storage = options.storage === undefined ? safeStorage() : options.storage
  const apply = options.apply ?? applySettings
  const listeners = new Set<() => void>()

  const read = (): Settings => {
    try {
      return parseSettings(storage?.getItem(SETTINGS_STORAGE_KEY))
    } catch {
      return DEFAULT_SETTINGS
    }
  }
  let current = read()
  apply(current)

  const commit = (next: Settings, persist: boolean) => {
    if (same(next, current)) return
    current = next
    if (persist) {
      try {
        storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage full or blocked: the choice still holds for this page.
      }
    }
    apply(next)
    for (const l of listeners) l()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get: () => current,
    set: (patch) => commit(parseSettings(JSON.stringify({ ...current, ...patch })), true),
    reset: () => commit(DEFAULT_SETTINGS, true),
    reload: () => commit(read(), false),
  }
}

/**
 * The app's settings. Created (and applied to <html>) when this module is first imported, so importing it from
 * the entry file sets the theme before React renders.
 */
export const settingsStore: SettingsStore = createSettingsStore()

export interface SettingsHandle extends Settings {
  set: (patch: Partial<Settings>) => void
  reset: () => void
}

/** The settings and their setter: `const { theme, density, pnl, mode, set } = useSettings()`. */
export function useSettings(): SettingsHandle {
  const s = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get)
  return { ...s, set: settingsStore.set, reset: settingsStore.reset }
}

/** The remembered mode of an asset page and its setter. The URL's `mode=` param, when present, wins over it. */
export function useDefaultMode(): [DefaultMode, (mode: DefaultMode) => void] {
  const mode = useSyncExternalStore(
    settingsStore.subscribe,
    () => settingsStore.get().mode,
    () => settingsStore.get().mode,
  )
  return [mode, setMode]
}

const setMode = (mode: DefaultMode): void => settingsStore.set({ mode })
