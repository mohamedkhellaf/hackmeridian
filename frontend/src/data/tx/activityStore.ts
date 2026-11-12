// The Activity list: every transaction started from this browser, per wallet address, with its state and hash.
// An external store (subscribe / snapshot) with no React in it, so the transaction runner can write to it from
// anywhere and tests can run it in Node with a fake storage.
//
// Rules:
//   - one list per wallet address, newest first, capped (`ACTIVITY_CAP`); entries whose outcome is still open
//     (in flight, or unknown) are never dropped by the cap;
//   - persisted in localStorage under `stellsec.activity.v1.<address>`, every access in try/catch;
//   - mock and fixture transactions stay in memory only: their hashes mean nothing after a reload, because the
//     mock market starts again from its seed;
//   - an attempt that never reached the network is not kept in storage. It shows while it runs and is removed
//     by the runner when it ends declined or refused (nothing was sent, so there is nothing to look up);
//   - an entry found in storage still "submitting" or "pending" long after its last update was interrupted by a
//     reload: it is shown as outcome unknown, which is the truth, and can be checked again when it has a hash.
import type { TxEffect, TxPhase, TxState } from '../../core/tx/machine'
import type { TxStageName } from '../../core/tx/types'

export const ACTIVITY_CAP = 50
export const ACTIVITY_KEY_PREFIX = 'stellsec.activity.v1.'
/** The list a guest's (or an unnamed party's) attempts go to. */
export const NO_ADDRESS = 'guest'
/** An in-flight entry from storage that has not moved for this long was interrupted. */
export const INTERRUPTED_AFTER_MS = 120_000

export const INTERRUPTED_WITH_HASH = 'The page was closed before a ledger confirmed this transaction. It was sent and can still be included. Check again.'
export const INTERRUPTED_NO_HASH = 'The page was closed while this transaction was being sent. Its outcome is not known. Look at the account on the explorer before sending it again.'

export type ActivityProduct = 'covered' | 'margin'
export type ActivityPhase = Exclude<TxPhase, 'idle'>

export interface ActivityEntry {
  id: string
  /** The wallet (or, on Margin fixtures, the party) the transaction was made as. */
  address: string
  product: ActivityProduct
  /** Machine name of the action: `buy`, `exercise`, `claim-delivery`... */
  action: string
  /** What it is, with figures: "Buy put on 5.00 BOND". */
  label: string
  /** The terms behind the label, for a second line: "Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC". Null when the caller gave none. */
  detail: string | null
  /** The past-tense word for a confirmed outcome: "Bought". Null when the caller gave none. */
  done: string | null
  /** What it acts on, for links: `option:12`, `bid:3`. Null when it creates something new. */
  subject: string | null
  /**
   * What a confirmed transaction created, once the contract has answered: `option:12` for a written offer or a
   * filled request, `bid:3` for a posted request. Lets a position link the transaction that made it.
   */
  created?: string | null
  phase: ActivityPhase
  effect: TxEffect
  hash: string | null
  /** Unix seconds after which the signed transaction can no longer be included. */
  maxTime: number | null
  ledger: number | null
  error: string | null
  /** The stage it had reached when it stopped short of confirmed (core/tx `TxState.stoppedAt`). Absent on older entries. */
  stoppedAt?: TxStageName | null
  /** Made on the mock client or on Margin fixtures: the hash (if any) has no explorer page. */
  mock: boolean
  /** Milliseconds since the epoch. */
  startedAt: number
  updatedAt: number
}

export type NewActivity = Pick<ActivityEntry, 'product' | 'action' | 'label' | 'mock'> & { address: string | null; detail?: string | null; done?: string | null; subject?: string | null }

export type ActivityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface ActivityStoreOptions {
  /** Where lists persist. Null keeps everything in memory. */
  storage?: ActivityStorage | null
  cap?: number
  now?: () => number
  /** Unique id source, for tests. */
  uid?: () => string
}

export interface ActivityStore {
  subscribe(listener: () => void): () => void
  /** The list of one address, newest first. The same array until something in it changes. */
  list(address: string | null): readonly ActivityEntry[]
  get(address: string | null, id: string): ActivityEntry | undefined
  /** Adds an entry in the `checking` phase and returns it. */
  begin(entry: NewActivity): ActivityEntry
  /** Writes a machine state onto an entry. An `idle` state is ignored. */
  apply(address: string | null, id: string, state: TxState): void
  remove(address: string | null, id: string): void
  /** Records what a confirmed transaction created (`option:<id>`, `bid:<id>`). */
  setCreated(address: string | null, id: string, created: string): void
  /** Removes the entries whose outcome is final. In-flight and unknown entries stay. */
  clearSettled(address: string | null): void
  /**
   * Puts entries removed by `remove` or `clearSettled` back (an Undo), in their place by start time. Entries of
   * another address and ids already in the list are ignored.
   */
  restore(address: string | null, entries: readonly ActivityEntry[]): void
  /** Reads the list of an address from storage again (another tab wrote it). */
  reload(address: string | null): void
}

const WORKING: ReadonlySet<ActivityPhase> = new Set<ActivityPhase>(['checking', 'signing', 'submitting', 'pending'])
const PHASES: ReadonlySet<string> = new Set(['checking', 'signing', 'submitting', 'pending', 'confirmed', 'failed', 'unknown', 'expired', 'declined'])
const EFFECTS: ReadonlySet<string> = new Set(['nothing-sent', 'outcome-unknown', 'fee-charged'])
const STAGES: ReadonlySet<string> = new Set(['checking', 'signing', 'submitting', 'pending'])

/** The outcome is not final: the entry is in flight or unknown. */
export const isOpenEntry = (e: Pick<ActivityEntry, 'phase'>): boolean => WORKING.has(e.phase) || e.phase === 'unknown'

/** The entry as a machine state, to reduce a later check into it. */
export function entryState(e: ActivityEntry): TxState {
  return { phase: e.phase, hash: e.hash, maxTime: e.maxTime, ledger: e.ledger, error: e.error, effect: e.effect, stoppedAt: e.stoppedAt ?? null }
}

/** Only what reached (or may have reached) the network is worth keeping across a reload. */
const persistable = (e: ActivityEntry): boolean => !e.mock && e.phase !== 'checking' && e.phase !== 'signing' && e.phase !== 'declined' && !(e.phase === 'failed' && e.effect === 'nothing-sent')

const str = (v: unknown): v is string => typeof v === 'string'
const strOrNull = (v: unknown): string | null => (str(v) ? v : null)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A stored value as an entry, or null when it is not one (an older shape, a damaged write). */
export function parseEntry(raw: unknown): ActivityEntry | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!str(r.id) || !str(r.address) || !str(r.label) || !str(r.action) || !str(r.phase) || !PHASES.has(r.phase)) return null
  const startedAt = numOrNull(r.startedAt)
  if (startedAt === null) return null
  return {
    id: r.id,
    address: r.address,
    product: r.product === 'margin' ? 'margin' : 'covered',
    action: r.action,
    label: r.label,
    detail: strOrNull(r.detail),
    done: strOrNull(r.done),
    subject: strOrNull(r.subject),
    created: strOrNull(r.created),
    phase: r.phase as ActivityPhase,
    effect: str(r.effect) && EFFECTS.has(r.effect) ? (r.effect as TxEffect) : 'outcome-unknown',
    hash: strOrNull(r.hash),
    maxTime: numOrNull(r.maxTime),
    ledger: numOrNull(r.ledger),
    error: strOrNull(r.error),
    stoppedAt: str(r.stoppedAt) && STAGES.has(r.stoppedAt) ? (r.stoppedAt as TxStageName) : null,
    mock: r.mock === true,
    startedAt,
    updatedAt: numOrNull(r.updatedAt) ?? startedAt,
  }
}

/**
 * An entry read from storage that is still in flight and has not moved for `INTERRUPTED_AFTER_MS` was cut short
 * by a reload. It becomes `unknown`: it was sent or may have been, and nobody waited for the answer.
 */
export function reviveEntry(e: ActivityEntry, nowMs: number): ActivityEntry {
  if (!WORKING.has(e.phase) || nowMs - e.updatedAt < INTERRUPTED_AFTER_MS) return e
  return { ...e, phase: 'unknown', effect: 'outcome-unknown', error: e.hash ? INTERRUPTED_WITH_HASH : INTERRUPTED_NO_HASH }
}

const newestFirst = (a: ActivityEntry, b: ActivityEntry): number => b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/** Newest first, at most `cap` settled entries; entries whose outcome is open are always kept. */
export function capEntries(entries: readonly ActivityEntry[], cap: number): ActivityEntry[] {
  const sorted = [...entries].sort(newestFirst)
  let room = Math.max(0, cap - sorted.filter(isOpenEntry).length)
  const kept: ActivityEntry[] = []
  for (const e of sorted) {
    if (isOpenEntry(e)) kept.push(e)
    else if (room > 0) {
      kept.push(e)
      room--
    }
  }
  return kept
}

const sameEntry = (a: ActivityEntry, b: ActivityEntry): boolean =>
  a.phase === b.phase && a.hash === b.hash && a.error === b.error && a.ledger === b.ledger && a.maxTime === b.maxTime && a.effect === b.effect && a.updatedAt === b.updatedAt

const EMPTY: readonly ActivityEntry[] = Object.freeze([])

export function safeLocalStorage(): ActivityStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function createActivityStore(options: ActivityStoreOptions = {}): ActivityStore {
  const storage = options.storage === undefined ? safeLocalStorage() : options.storage
  const cap = options.cap ?? ACTIVITY_CAP
  const now = options.now ?? Date.now
  let counter = 0
  const uid = options.uid ?? (() => `${now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

  const lists = new Map<string, readonly ActivityEntry[]>()
  /** Entries this page started and is still running: never treated as interrupted. */
  const running = new Set<string>()
  /** Ids removed on this page, so a merge with storage does not bring them back. */
  const dropped = new Set<string>()
  const listeners = new Set<() => void>()
  const keyOf = (address: string | null) => address || NO_ADDRESS
  const storageKey = (address: string) => ACTIVITY_KEY_PREFIX + address

  const notify = () => {
    for (const l of listeners) l()
  }

  function read(address: string): ActivityEntry[] {
    if (!storage) return []
    try {
      const text = storage.getItem(storageKey(address))
      if (!text) return []
      const parsed: unknown = JSON.parse(text)
      if (!Array.isArray(parsed)) return []
      const at = now()
      return parsed.flatMap((raw) => {
        const e = parseEntry(raw)
        return e && e.address === address ? [running.has(e.id) ? e : reviveEntry(e, at)] : []
      })
    } catch {
      return []
    }
  }

  function write(address: string, entries: readonly ActivityEntry[]): void {
    if (!storage) return
    try {
      // Another tab may have added entries since this one read the list: keep those, ours win on the same id.
      const ours = entries.filter(persistable)
      const known = new Set(entries.map((e) => e.id))
      const theirs = read(address).filter((e) => !known.has(e.id) && !dropped.has(e.id))
      const merged = capEntries([...ours, ...theirs], cap)
      if (merged.length === 0) storage.removeItem(storageKey(address))
      else storage.setItem(storageKey(address), JSON.stringify(merged))
    } catch {
      // Storage full or blocked: the list still works for this page.
    }
  }

  function load(address: string): readonly ActivityEntry[] {
    let list = lists.get(address)
    if (!list) {
      const stored = capEntries(read(address), cap)
      list = stored.length ? stored : EMPTY
      lists.set(address, list)
    }
    return list
  }

  function commit(address: string, next: ActivityEntry[]): void {
    const capped = capEntries(next, cap)
    lists.set(address, capped.length ? capped : EMPTY)
    write(address, capped)
    notify()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    list: (address) => load(keyOf(address)),
    get: (address, id) => load(keyOf(address)).find((e) => e.id === id),
    begin(entry) {
      const address = keyOf(entry.address)
      const at = now()
      const created: ActivityEntry = {
        id: uid(),
        address,
        product: entry.product,
        action: entry.action,
        label: entry.label,
        detail: entry.detail ?? null,
        done: entry.done ?? null,
        subject: entry.subject ?? null,
        phase: 'checking',
        effect: 'nothing-sent',
        hash: null,
        maxTime: null,
        ledger: null,
        error: null,
        mock: entry.mock,
        startedAt: at,
        updatedAt: at,
      }
      running.add(created.id)
      commit(address, [created, ...load(address)])
      return created
    },
    apply(address, id, state) {
      if (state.phase === 'idle') return
      const key = keyOf(address)
      const list = load(key)
      const current = list.find((e) => e.id === id)
      if (!current) return
      const next: ActivityEntry = { ...current, phase: state.phase, effect: state.effect, hash: state.hash, maxTime: state.maxTime, ledger: state.ledger, error: state.error, stoppedAt: state.stoppedAt ?? null, updatedAt: now() }
      if (!isOpenEntry(next) || next.phase === 'unknown') running.delete(id)
      if (sameEntry({ ...next, updatedAt: current.updatedAt }, current)) return
      commit(
        key,
        list.map((e) => (e.id === id ? next : e)),
      )
    },
    setCreated(address, id, created) {
      const key = keyOf(address)
      const list = load(key)
      const current = list.find((e) => e.id === id)
      if (!current || current.created === created) return
      commit(
        key,
        list.map((e) => (e.id === id ? { ...e, created } : e)),
      )
    },
    remove(address, id) {
      const key = keyOf(address)
      const list = load(key)
      if (!list.some((e) => e.id === id)) return
      running.delete(id)
      dropped.add(id)
      commit(
        key,
        list.filter((e) => e.id !== id),
      )
    },
    clearSettled(address) {
      const key = keyOf(address)
      const list = load(key)
      const kept = list.filter(isOpenEntry)
      if (kept.length === list.length) return
      for (const e of list) if (!isOpenEntry(e)) dropped.add(e.id)
      commit(key, kept)
    },
    restore(address, entries) {
      const key = keyOf(address)
      const list = load(key)
      const known = new Set(list.map((e) => e.id))
      const back = entries.filter((e) => e.address === key && !known.has(e.id))
      if (back.length === 0) return
      for (const e of back) dropped.delete(e.id)
      commit(
        key,
        [...list, ...back].sort((a, b) => b.startedAt - a.startedAt),
      )
    },
    reload(address) {
      const key = keyOf(address)
      const current = lists.get(key) ?? EMPTY
      const known = new Map(current.map((e) => [e.id, e]))
      // Entries this page is running keep their in-memory state; the rest follows storage.
      const stored = read(key).filter((e) => !dropped.has(e.id))
      const merged = capEntries([...current.filter((e) => running.has(e.id) || !persistable(e)), ...stored.filter((e) => !running.has(e.id) || !known.has(e.id))], cap)
      const unchanged = merged.length === current.length && merged.every((e, i) => e.id === current[i].id && sameEntry(e, current[i]))
      if (unchanged) return
      lists.set(key, merged.length ? merged : EMPTY)
      notify()
    },
  }
}

/** The app's Activity store. Tests build their own with `createActivityStore`. */
export const activityStore: ActivityStore = createActivityStore()

/** The entry's hash can be looked up again: its outcome is unknown and the hash is known. */
export const canCheckEntry = (e: ActivityEntry): boolean => e.phase === 'unknown' && e.hash !== null
