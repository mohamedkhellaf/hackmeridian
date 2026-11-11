import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, applySettings, createSettingsStore, initSettings, parseSettings, settingsStore } from './settings'
import type { Settings, SettingsStorage } from './settings'

function memory(initial?: string): SettingsStorage & { value: string | null } {
  const box = {
    value: initial ?? null,
    getItem: (k: string) => (k === SETTINGS_STORAGE_KEY ? box.value : null),
    setItem: (k: string, v: string) => {
      if (k === SETTINGS_STORAGE_KEY) box.value = v
    },
  }
  return box
}

describe('parseSettings', () => {
  it('defaults to system theme, comfortable rows, teal and orange, guided mode', () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'system', density: 'comfortable', pnl: 'default', mode: 'guided' })
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back field by field on anything it does not know', () => {
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('"dark"')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify({ theme: 'dark', density: 'huge', pnl: 7, mode: 'chain', extra: true }))).toEqual({ theme: 'dark', density: 'comfortable', pnl: 'default', mode: 'chain' })
    expect(parseSettings(JSON.stringify({ pnl: 'mono' }))).toEqual({ ...DEFAULT_SETTINGS, pnl: 'mono' })
  })
})

describe('settings store', () => {
  it('reads storage and applies it on creation', () => {
    const apply = vi.fn()
    const store = createSettingsStore({ storage: memory(JSON.stringify({ theme: 'dark', mode: 'chain' })), apply })
    expect(store.get()).toEqual({ theme: 'dark', density: 'comfortable', pnl: 'default', mode: 'chain' })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(store.get())
  })

  it('persists, applies and notifies on a change, and only on a change', () => {
    const storage = memory()
    const applied: Settings[] = []
    const store = createSettingsStore({ storage, apply: (s) => applied.push(s) })
    let calls = 0
    store.subscribe(() => calls++)
    const before = store.get()
    store.set({ theme: 'dark' })
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
    expect(store.get()).not.toBe(before)
    expect(JSON.parse(storage.value!)).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
    expect(calls).toBe(1)
    expect(applied.at(-1)!.theme).toBe('dark')
    // The same value again: same snapshot, no write, no notification.
    const same = store.get()
    store.set({ theme: 'dark' })
    expect(store.get()).toBe(same)
    expect(calls).toBe(1)
    store.set({ density: 'compact', pnl: 'classic', mode: 'chain' })
    expect(store.get()).toEqual({ theme: 'dark', density: 'compact', pnl: 'classic', mode: 'chain' })
    expect(calls).toBe(2)
  })

  it('ignores a value that is not one of the choices', () => {
    const store = createSettingsStore({ storage: memory(), apply: () => {} })
    store.set({ theme: 'neon' as never })
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
  })

  it('resets to the defaults', () => {
    const storage = memory(JSON.stringify({ theme: 'dark', pnl: 'mono' }))
    const store = createSettingsStore({ storage, apply: () => {} })
    store.reset()
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
    expect(JSON.parse(storage.value!)).toEqual(DEFAULT_SETTINGS)
  })

  it('follows a change made in another tab without writing it back', () => {
    const storage = memory()
    const setItem = vi.spyOn(storage, 'setItem')
    const applied: Settings[] = []
    const store = createSettingsStore({ storage, apply: (s) => applied.push(s) })
    let calls = 0
    store.subscribe(() => calls++)
    storage.value = JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'light' })
    store.reload()
    expect(store.get().theme).toBe('light')
    expect(calls).toBe(1)
    expect(applied.at(-1)!.theme).toBe('light')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('works without storage and with a storage that throws', () => {
    const none = createSettingsStore({ storage: null, apply: () => {} })
    none.set({ mode: 'chain' })
    expect(none.get().mode).toBe('chain')
    // Nothing to follow: a reload keeps the choice made on this page.
    none.reload()
    expect(none.get().mode).toBe('chain')

    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    const store = createSettingsStore({ storage: broken, apply: () => {} })
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
    store.set({ theme: 'dark' })
    expect(store.get().theme).toBe('dark')
    store.reload()
    expect(store.get().theme).toBe('dark')
  })
})

describe('applySettings', () => {
  it('is a no-op without a document (unit tests, a server render)', () => {
    expect(typeof document).toBe('undefined')
    expect(() => applySettings({ theme: 'dark', density: 'compact', pnl: 'mono', mode: 'chain' })).not.toThrow()
  })

  it('writes the three attributes on the root element, and removes them for the defaults', () => {
    const attrs = new Map<string, string>()
    const root = { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k), getAttribute: (k: string) => attrs.get(k) ?? null }
    vi.stubGlobal('document', { documentElement: root })
    try {
      applySettings({ theme: 'dark', density: 'compact', pnl: 'classic', mode: 'guided' })
      expect(Object.fromEntries(attrs)).toEqual({ 'data-theme': 'dark', 'data-density': 'compact', 'data-pnl': 'classic' })
      applySettings(DEFAULT_SETTINGS)
      expect(attrs.size).toBe(0)
      applySettings({ ...DEFAULT_SETTINGS, theme: 'light', pnl: 'mono' })
      expect(Object.fromEntries(attrs)).toEqual({ 'data-theme': 'light', 'data-pnl': 'mono' })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('initSettings', () => {
  it('is safe without a document or storage and returns the defaults', () => {
    expect(typeof document).toBe('undefined')
    expect(initSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('reads storage again and writes the attributes even when nothing changed', () => {
    const attrs = new Map<string, string>()
    const root = { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k), getAttribute: (k: string) => attrs.get(k) ?? null }
    vi.stubGlobal('document', { documentElement: root })
    try {
      settingsStore.set({ theme: 'dark', density: 'compact' })
      attrs.clear() // as if the page had been rendered without them
      expect(initSettings()).toMatchObject({ theme: 'dark', density: 'compact', pnl: 'default' })
      expect(Object.fromEntries(attrs)).toEqual({ 'data-theme': 'dark', 'data-density': 'compact' })
    } finally {
      settingsStore.reset()
      vi.unstubAllGlobals()
    }
  })
})
