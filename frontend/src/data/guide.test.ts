import { describe, expect, it } from 'vitest'
import { GUIDE_VERSION } from '../core/guide'
import { GUIDE_STORAGE_KEY, createGuideStore, parseGuideSeen } from './guide'
import type { GuideStorage } from './guide'

interface Memory extends GuideStorage {
  items: Map<string, string>
  writes: number
}

function memory(initial?: string): Memory {
  const items = new Map<string, string>()
  if (initial !== undefined) items.set(GUIDE_STORAGE_KEY, initial)
  const box: Memory = {
    items,
    writes: 0,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => {
      if (k === GUIDE_STORAGE_KEY) box.writes++
      items.set(k, v)
    },
    removeItem: (k) => {
      items.delete(k)
    },
  }
  return box
}

const stored = (box: Memory): unknown => JSON.parse(box.items.get(GUIDE_STORAGE_KEY) ?? 'null')

describe('parseGuideSeen', () => {
  it('reads the map by guide id', () => {
    expect(parseGuideSeen('{"tour":1,"mode":1}')).toEqual({ tour: 1, mode: 1 })
    expect(parseGuideSeen('{"tour":0}')).toEqual({ tour: 0 })
    expect(parseGuideSeen('{"tour":999,"mode":999}')).toEqual({ tour: 999, mode: 999 })
  })

  it('reads anything that is not an object as empty', () => {
    for (const text of [null, undefined, '', '{not json', 'null', '1', '"seen"', '[1,2]', 'true']) expect(parseGuideSeen(text)).toEqual({})
  })

  it('leaves out a field that is not a non-negative whole number, and every unknown field', () => {
    expect(parseGuideSeen('{"tour":-1,"mode":1}')).toEqual({ mode: 1 })
    expect(parseGuideSeen('{"tour":1.5}')).toEqual({})
    expect(parseGuideSeen('{"tour":"1","mode":true}')).toEqual({})
    expect(parseGuideSeen('{"tour":null,"mode":1e400}')).toEqual({})
    expect(parseGuideSeen('{"tour":1,"other":3,"__proto__":{"mode":1}}')).toEqual({ tour: 1 })
  })
})

describe('guide store', () => {
  it('does not touch storage until its state is asked for', () => {
    let reads = 0
    const box = memory()
    createGuideStore({ storage: { ...box, getItem: (k) => (reads++, box.getItem(k)) } })
    expect(reads).toBe(0)
  })

  it('starts empty and persistent on a first visit, and leaves nothing behind', () => {
    const box = memory()
    const store = createGuideStore({ storage: box })
    expect(store.get()).toEqual({ seen: {}, persistent: true, run: null })
    expect([...box.items.keys()]).toEqual([])
  })

  it('reads what an earlier visit stored', () => {
    const store = createGuideStore({ storage: memory('{"tour":1}') })
    expect(store.get().seen).toEqual({ tour: 1 })
    expect(store.get().persistent).toBe(true)
  })

  it('keeps one snapshot between changes', () => {
    const store = createGuideStore({ storage: memory() })
    expect(store.get()).toBe(store.get())
  })

  it('a run lives in memory only', () => {
    const box = memory()
    const store = createGuideStore({ storage: box })
    let calls = 0
    store.subscribe(() => calls++)
    store.start('tour', 'slip')
    expect(store.get().run).toEqual({ id: 'tour', origin: 'slip' })
    expect(store.get().seen).toEqual({})
    expect(box.writes).toBe(0)
    expect(calls).toBe(1)
    store.end()
    expect(store.get().run).toBeNull()
    expect(calls).toBe(2)
    // Ending when nothing runs changes nothing.
    store.end()
    expect(calls).toBe(2)
  })

  it('ends only the run it is given', () => {
    const store = createGuideStore({ storage: memory() })
    store.start('tour', 'slip')
    const first = store.get().run
    store.start('tour', 'replay')
    const second = store.get().run
    expect(second).not.toBe(first)
    store.end(first)
    expect(store.get().run).toBe(second)
    store.end(second)
    expect(store.get().run).toBeNull()
  })

  it('a note that opens by itself never replaces a guide that is running', () => {
    const store = createGuideStore({ storage: memory('{"tour":1}') })
    store.start('tour', 'replay')
    store.start('mode', 'auto')
    expect(store.get().run).toEqual({ id: 'tour', origin: 'replay' })
    store.end()
    store.start('mode', 'auto')
    expect(store.get().run).toEqual({ id: 'mode', origin: 'auto' })
  })

  it('shown stores the content version and notifies once', () => {
    const box = memory()
    const store = createGuideStore({ storage: box })
    let calls = 0
    store.subscribe(() => calls++)
    store.shown('tour')
    expect(store.get().seen).toEqual({ tour: GUIDE_VERSION })
    expect(stored(box)).toEqual({ tour: GUIDE_VERSION })
    store.shown('tour')
    expect(calls).toBe(1)
    expect(box.writes).toBe(1)
    store.shown('mode')
    expect(stored(box)).toEqual({ tour: GUIDE_VERSION, mode: GUIDE_VERSION })
  })

  it('shown never lowers a stored version, and lifts a decline', () => {
    const high = memory('{"tour":999,"mode":999}')
    const a = createGuideStore({ storage: high })
    a.shown('tour')
    a.shown('mode')
    expect(a.get().seen).toEqual({ tour: 999, mode: 999 })
    expect(high.writes).toBe(0)

    const declined = memory('{"tour":0}')
    const b = createGuideStore({ storage: declined })
    b.shown('tour')
    expect(stored(declined)).toEqual({ tour: GUIDE_VERSION })
  })

  it('decline stores 0 for the tour, and never over a tour that was shown', () => {
    const box = memory()
    const store = createGuideStore({ storage: box })
    store.decline()
    expect(store.get().seen).toEqual({ tour: 0 })
    expect(stored(box)).toEqual({ tour: 0 })

    const seen = memory('{"tour":1}')
    const other = createGuideStore({ storage: seen })
    other.decline()
    expect(other.get().seen).toEqual({ tour: 1 })
    expect(seen.writes).toBe(0)
  })

  it('reload follows another tab, and keeps the run', () => {
    const box = memory()
    const store = createGuideStore({ storage: box })
    store.start('tour', 'slip')
    const run = store.get().run
    let calls = 0
    store.subscribe(() => calls++)
    box.items.set(GUIDE_STORAGE_KEY, '{"tour":0}')
    store.reload()
    expect(store.get().seen).toEqual({ tour: 0 })
    expect(store.get().run).toBe(run)
    expect(calls).toBe(1)
    // Nothing changed: no notification.
    store.reload()
    expect(calls).toBe(1)
  })

  it('without storage nothing is persistent, and the answers hold for the page', () => {
    const store = createGuideStore({ storage: null })
    expect(store.get()).toEqual({ seen: {}, persistent: false, run: null })
    store.decline()
    expect(store.get().seen).toEqual({ tour: 0 })
    store.reload()
    expect(store.get().seen).toEqual({ tour: 0 })
    store.start('tour', 'replay')
    expect(store.get().run).toEqual({ id: 'tour', origin: 'replay' })
  })

  it('storage that throws on read is not persistent', () => {
    const store = createGuideStore({
      storage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {},
        removeItem: () => {},
      },
    })
    expect(store.get().persistent).toBe(false)
    expect(store.get().seen).toEqual({})
    expect(() => store.reload()).not.toThrow()
  })

  it('storage that throws on write is not persistent, and a later write does not throw', () => {
    const store = createGuideStore({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {},
      },
    })
    expect(store.get().persistent).toBe(false)
    expect(() => store.shown('tour')).not.toThrow()
    expect(store.get().seen).toEqual({ tour: GUIDE_VERSION })
  })

  it('a write that fails later keeps the answer for this page', () => {
    const box = memory()
    let full = false
    const store = createGuideStore({
      storage: {
        ...box,
        setItem: (k, v) => {
          if (full) throw new Error('QuotaExceededError')
          box.setItem(k, v)
        },
      },
    })
    expect(store.get().persistent).toBe(true)
    full = true
    expect(() => store.decline()).not.toThrow()
    expect(store.get().seen).toEqual({ tour: 0 })
    expect(box.items.has(GUIDE_STORAGE_KEY)).toBe(false)
  })
})
