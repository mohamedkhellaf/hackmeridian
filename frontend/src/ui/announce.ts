/**
 * The announcer behind the two permanent live regions. `announce()` can be called from anywhere, including outside
 * React (a transaction state machine, a clipboard helper). `LiveRegions` renders what it holds.
 */

export type Politeness = 'polite' | 'assertive'

export interface AnnouncerState {
  polite: string
  assertive: string
}

const CLEAR_AFTER_MS = 8000
const REPEAT_GAP_MS = 60

let state: AnnouncerState = { polite: '', assertive: '' }
const listeners = new Set<() => void>()
const clearTimers: Record<Politeness, ReturnType<typeof setTimeout> | undefined> = {
  polite: undefined,
  assertive: undefined,
}
const setTimers: Record<Politeness, ReturnType<typeof setTimeout> | undefined> = {
  polite: undefined,
  assertive: undefined,
}

function emit(next: AnnouncerState): void {
  state = next
  for (const listener of listeners) listener()
}

function write(politeness: Politeness, message: string): void {
  emit({ ...state, [politeness]: message })
}

/**
 * Says `message` to screen-reader users.
 * `polite` waits for the current speech to finish (a copy confirmation, "Pending", "Confirmed").
 * `assertive` interrupts and is for failures and outcomes the user must not miss.
 * The region is emptied first so the same message can be announced twice in a row, and again after a few seconds
 * so stale text is not found later with the reading cursor.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  const text = message.trim()
  if (!text) return
  clearTimeout(clearTimers[politeness])
  clearTimeout(setTimers[politeness])
  write(politeness, '')
  setTimers[politeness] = setTimeout(() => {
    write(politeness, text)
    clearTimers[politeness] = setTimeout(() => write(politeness, ''), CLEAR_AFTER_MS)
  }, REPEAT_GAP_MS)
}

export function subscribeAnnouncer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAnnouncerState(): AnnouncerState {
  return state
}
