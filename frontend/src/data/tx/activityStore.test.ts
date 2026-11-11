import { describe, expect, it } from 'vitest'
import { TX_IDLE, reduce } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { TxError } from '../../core/tx/errors'
import {
  ACTIVITY_KEY_PREFIX,
  INTERRUPTED_AFTER_MS,
  INTERRUPTED_NO_HASH,
  INTERRUPTED_WITH_HASH,
  NO_ADDRESS,
  canCheckEntry,
  capEntries,
  createActivityStore,
  entryState,
  isOpenEntry,
  parseEntry,
  reviveEntry,
} from './activityStore'
import type { ActivityEntry, ActivityStorage, NewActivity } from './activityStore'

const ME = 'GBE65ZTLRGUEVNDQU65HG6EY36PW5QMJKXVSDVH72HOOIHTZYRZG3ZEG'
const OTHER = 'GBPHYE7XMH6GWDVWVTB3V2N55I6GRFAEK6BPWVOH2RGKX3PMNA2VIEEM'

function memoryStorage(): ActivityStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

function harness(storage: ActivityStorage | null = memoryStorage(), cap?: number) {
  let t = 1_000_000
  let n = 0
  const clock = { advance: (ms: number) => (t += ms), now: () => t }
  const store = createActivityStore({ storage, cap, now: () => t, uid: () => `id-${n++}` })
  return { store, clock, storage }
}

const live = (over: Partial<NewActivity> = {}): NewActivity => ({ address: ME, product: 'covered', action: 'buy', label: 'Buy put on 5.00 BOND', done: 'Bought', subject: 'option:12', mock: false, ...over })

const stage = (s: TxState, name: 'signing' | 'submitting'): TxState => reduce(s, { type: 'stage', stage: { stage: name } })
const pending = (s: TxState, hash = 'abc123', maxTime: number | null = 2_000): TxState => reduce(s, { type: 'stage', stage: { stage: 'pending', hash, maxTime } })
const CHECKING = reduce(TX_IDLE, { type: 'start' })
const PENDING = pending(stage(stage(CHECKING, 'signing'), 'submitting'))
const CONFIRMED = reduce(PENDING, { type: 'confirmed', hash: 'abc123', ledger: 77 })
const UNKNOWN = reduce(PENDING, { type: 'error', error: new TxError('unknown', 'Not confirmed yet.', { hash: 'abc123', maxTime: 2_000 }) })

const stored = (h: ReturnType<typeof harness>, address = ME): ActivityEntry[] => JSON.parse((h.storage as ReturnType<typeof memoryStorage>).data.get(ACTIVITY_KEY_PREFIX + address) ?? '[]')

describe('activity store: recording', () => {
  it('starts an entry in the checking phase and follows the machine', () => {
    const h = harness()
    const e = h.store.begin(live())
    expect(e).toMatchObject({ id: 'id-0', address: ME, phase: 'checking', effect: 'nothing-sent', hash: null, label: 'Buy put on 5.00 BOND', done: 'Bought', subject: 'option:12', mock: false })
    h.clock.advance(500)
    h.store.apply(ME, e.id, PENDING)
    expect(h.store.get(ME, e.id)).toMatchObject({ phase: 'pending', hash: 'abc123', maxTime: 2_000, effect: 'outcome-unknown', startedAt: 1_000_000, updatedAt: 1_000_500 })
    h.store.apply(ME, e.id, CONFIRMED)
    expect(h.store.get(ME, e.id)).toMatchObject({ phase: 'confirmed', ledger: 77, effect: 'fee-charged', error: null })
    expect(entryState(h.store.get(ME, e.id)!)).toEqual({ ...CONFIRMED, stoppedAt: null })
  })

  it('keeps one list per address, newest first', () => {
    const h = harness()
    const first = h.store.begin(live({ label: 'first' }))
    h.clock.advance(10)
    const second = h.store.begin(live({ label: 'second' }))
    h.store.begin(live({ address: OTHER, label: 'theirs' }))
    expect(h.store.list(ME).map((e) => e.id)).toEqual([second.id, first.id])
    expect(h.store.list(OTHER).map((e) => e.label)).toEqual(['theirs'])
    expect(h.store.get(OTHER, first.id)).toBeUndefined()
  })

  it('files a guest attempt under the guest list', () => {
    const h = harness()
    const e = h.store.begin(live({ address: null }))
    expect(e.address).toBe(NO_ADDRESS)
    expect(h.store.list(null)).toHaveLength(1)
    expect(h.store.list(ME)).toHaveLength(0)
  })

  it('returns the same array until something changes, and notifies on change only', () => {
    const h = harness()
    let calls = 0
    h.store.subscribe(() => calls++)
    const empty = h.store.list(ME)
    expect(h.store.list(ME)).toBe(empty)
    const e = h.store.begin(live())
    expect(calls).toBe(1)
    const one = h.store.list(ME)
    expect(one).not.toBe(empty)
    expect(h.store.list(ME)).toBe(one)
    // Applying the state it already has changes nothing.
    h.store.apply(ME, e.id, CHECKING)
    expect(calls).toBe(1)
    expect(h.store.list(ME)).toBe(one)
    h.store.apply(ME, e.id, TX_IDLE)
    expect(calls).toBe(1)
    h.store.apply(ME, 'no-such-id', PENDING)
    expect(calls).toBe(1)
    h.store.apply(ME, e.id, PENDING)
    expect(calls).toBe(2)
    expect(h.store.list(ME)).not.toBe(one)
  })

  it('removes one entry, and clears the settled ones while keeping what is still open', () => {
    const h = harness()
    const done = h.store.begin(live())
    h.store.apply(ME, done.id, CONFIRMED)
    const open = h.store.begin(live())
    h.store.apply(ME, open.id, UNKNOWN)
    const flying = h.store.begin(live())
    h.store.apply(ME, flying.id, PENDING)
    const gone = h.store.begin(live())
    h.store.remove(ME, gone.id)
    expect(h.store.list(ME).map((e) => e.id)).not.toContain(gone.id)
    h.store.clearSettled(ME)
    expect(h.store.list(ME).map((e) => e.phase).sort()).toEqual(['pending', 'unknown'])
    expect(canCheckEntry(h.store.get(ME, open.id)!)).toBe(true)
    expect(canCheckEntry(h.store.get(ME, flying.id)!)).toBe(false)
  })
})

describe('activity store: persistence', () => {
  it('persists per address what reached the network, and reads it back in a new store', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const e = h.store.begin(live())
    // Checking and signing never touch storage: nothing was sent.
    expect(storage.data.size).toBe(0)
    h.store.apply(ME, e.id, stage(CHECKING, 'signing'))
    expect(storage.data.size).toBe(0)
    h.store.apply(ME, e.id, PENDING)
    expect([...storage.data.keys()]).toEqual([ACTIVITY_KEY_PREFIX + ME])
    h.store.apply(ME, e.id, CONFIRMED)

    const again = createActivityStore({ storage, now: () => 9_000_000 })
    expect(again.list(ME)).toHaveLength(1)
    expect(again.list(ME)[0]).toMatchObject({ id: e.id, phase: 'confirmed', hash: 'abc123', ledger: 77, label: 'Buy put on 5.00 BOND' })
    expect(again.list(OTHER)).toHaveLength(0)
  })

  it('keeps the terms line of an entry, and reads an entry stored without one', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const detail = 'Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC'
    const e = h.store.begin(live({ detail }))
    expect(e.detail).toBe(detail)
    h.store.apply(ME, e.id, CONFIRMED)
    expect(createActivityStore({ storage }).list(ME)[0].detail).toBe(detail)
    // An entry written by a build that had no such field.
    const key = ACTIVITY_KEY_PREFIX + ME
    const stored = JSON.parse(storage.data.get(key)!) as Record<string, unknown>[]
    delete stored[0].detail
    storage.data.set(key, JSON.stringify(stored))
    expect(createActivityStore({ storage }).list(ME)[0]).toMatchObject({ id: e.id, detail: null, phase: 'confirmed' })
    expect(h.store.begin(live()).detail).toBeNull()
  })

  it('keeps mock and fixture transactions in memory only', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const e = h.store.begin(live({ mock: true }))
    h.store.apply(ME, e.id, CONFIRMED)
    expect(h.store.list(ME)).toHaveLength(1)
    expect(storage.data.size).toBe(0)
    expect(createActivityStore({ storage }).list(ME)).toHaveLength(0)
  })

  it('does not keep an attempt that sent nothing', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const declined = h.store.begin(live())
    h.store.apply(ME, declined.id, reduce(stage(CHECKING, 'signing'), { type: 'error', error: new TxError('declined', 'Declined in the wallet.') }))
    const refused = h.store.begin(live())
    h.store.apply(ME, refused.id, reduce(CHECKING, { type: 'error', error: new TxError('refused', 'This offer is no longer open.') }))
    expect(h.store.list(ME).map((e) => e.phase).sort()).toEqual(['declined', 'failed'])
    expect(storage.data.size).toBe(0)
  })

  it('caps the list but never drops an entry whose outcome is open', () => {
    const h = harness(memoryStorage(), 3)
    const unknown = h.store.begin(live({ label: 'unknown' }))
    h.store.apply(ME, unknown.id, UNKNOWN)
    for (let i = 0; i < 6; i++) {
      h.clock.advance(10)
      const e = h.store.begin(live({ label: `tx ${i}` }))
      h.store.apply(ME, e.id, CONFIRMED)
    }
    const list = h.store.list(ME)
    expect(list.map((e) => e.label)).toEqual(['tx 5', 'tx 4', 'unknown'])
    expect(stored(h).map((e) => e.label)).toEqual(['tx 5', 'tx 4', 'unknown'])
    expect(capEntries(list, 1).map((e) => e.label)).toEqual(['unknown'])
  })

  it('works without storage, and survives a storage that throws', () => {
    const none = harness(null)
    none.store.apply(ME, none.store.begin(live()).id, CONFIRMED)
    expect(none.store.list(ME)).toHaveLength(1)

    const broken: ActivityStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const h = harness(broken)
    const e = h.store.begin(live())
    h.store.apply(ME, e.id, CONFIRMED)
    expect(h.store.list(ME)).toHaveLength(1)
  })

  it('ignores damaged storage instead of failing', () => {
    const storage = memoryStorage()
    storage.data.set(ACTIVITY_KEY_PREFIX + ME, '{not json')
    expect(createActivityStore({ storage }).list(ME)).toEqual([])
    storage.data.set(ACTIVITY_KEY_PREFIX + ME, JSON.stringify([{ id: 1 }, null, 'x', { id: 'ok', address: OTHER, label: 'l', action: 'buy', phase: 'confirmed', startedAt: 1 }]))
    // Wrong shapes are dropped; so is an entry filed under another address.
    expect(createActivityStore({ storage }).list(ME)).toEqual([])
    expect(parseEntry({ id: 'ok', address: ME, label: 'l', action: 'buy', phase: 'bogus', startedAt: 1 })).toBeNull()
    expect(parseEntry({ id: 'ok', address: ME, label: 'l', action: 'buy', phase: 'confirmed', startedAt: 1 })).toMatchObject({ product: 'covered', effect: 'outcome-unknown', hash: null, mock: false, updatedAt: 1 })
  })
})

describe('activity store: a reload in the middle of a transaction', () => {
  it('shows an interrupted pending transaction as unknown, with its hash to check again', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const e = h.store.begin(live())
    h.store.apply(ME, e.id, PENDING)
    // A new page, long after: nobody waited for the answer.
    const later = createActivityStore({ storage, now: () => h.clock.now() + INTERRUPTED_AFTER_MS + 1 })
    const revived = later.get(ME, e.id)!
    expect(revived).toMatchObject({ phase: 'unknown', hash: 'abc123', effect: 'outcome-unknown', error: INTERRUPTED_WITH_HASH })
    expect(canCheckEntry(revived)).toBe(true)
    expect(isOpenEntry(revived)).toBe(true)
  })

  it('says so when it was cut while submitting and no hash was recorded', () => {
    const base = parseEntry({ id: 'x', address: ME, label: 'l', action: 'buy', phase: 'submitting', startedAt: 0, updatedAt: 0 })!
    const revived = reviveEntry(base, INTERRUPTED_AFTER_MS)
    expect(revived).toMatchObject({ phase: 'unknown', hash: null, error: INTERRUPTED_NO_HASH })
    expect(canCheckEntry(revived)).toBe(false)
  })

  it('leaves a recent in-flight entry alone: another tab may be running it', () => {
    const storage = memoryStorage()
    const h = harness(storage)
    const e = h.store.begin(live())
    h.store.apply(ME, e.id, PENDING)
    const soon = createActivityStore({ storage, now: () => h.clock.now() + 5_000 })
    expect(soon.get(ME, e.id)!.phase).toBe('pending')
    // And the page that runs it never sees its own entry as interrupted.
    h.clock.advance(INTERRUPTED_AFTER_MS * 2)
    h.store.reload(ME)
    expect(h.store.get(ME, e.id)!.phase).toBe('pending')
  })
})

describe('activity store: two tabs', () => {
  it('keeps the other tab entries when writing, and picks them up on reload', () => {
    const storage = memoryStorage()
    const a = createActivityStore({ storage, now: () => 1_000, uid: () => 'tab-a' })
    const b = createActivityStore({ storage, now: () => 2_000, uid: () => 'tab-b' })
    expect(a.list(ME)).toEqual([])
    expect(b.list(ME)).toEqual([])
    a.apply(ME, a.begin(live({ label: 'from a' })).id, CONFIRMED)
    b.apply(ME, b.begin(live({ label: 'from b' })).id, CONFIRMED)
    // Tab b wrote last and did not know tab a's entry: it is still in storage.
    expect((JSON.parse(storage.data.get(ACTIVITY_KEY_PREFIX + ME)!) as ActivityEntry[]).map((e) => e.label).sort()).toEqual(['from a', 'from b'])
    let notified = 0
    a.subscribe(() => notified++)
    a.reload(ME)
    expect(a.list(ME).map((e) => e.label)).toEqual(['from b', 'from a'])
    expect(notified).toBe(1)
    // Nothing new: no notification, same array.
    const before = a.list(ME)
    a.reload(ME)
    expect(notified).toBe(1)
    expect(a.list(ME)).toBe(before)
  })

  it('follows a resolution made in another tab, and does not bring back what was removed here', () => {
    const storage = memoryStorage()
    const a = createActivityStore({ storage, now: () => 1_000, uid: () => 'shared' })
    const e = a.begin(live())
    a.apply(ME, e.id, UNKNOWN)
    const b = createActivityStore({ storage, now: () => 2_000 })
    b.apply(ME, e.id, reduce(UNKNOWN, { type: 'resolve', check: { status: 'confirmed', ledger: 99 } }))
    a.reload(ME)
    expect(a.get(ME, e.id)).toMatchObject({ phase: 'confirmed', ledger: 99 })
    a.remove(ME, e.id)
    a.reload(ME)
    expect(a.list(ME)).toEqual([])
  })
})
