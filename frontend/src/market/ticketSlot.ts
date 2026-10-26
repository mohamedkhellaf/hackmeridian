import { useSyncExternalStore } from 'react'

// The Markets page hosts the buy ticket in a slot element; the app-level BuyDialog portals into it.
// This tiny store connects the two without props through the app shell.

interface SlotState {
  el: HTMLElement | null
  open: boolean
}

let state: SlotState = { el: null, open: false }
const listeners = new Set<() => void>()

function set(patch: Partial<SlotState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Ref callback for the slot element on Markets. */
export const registerTicketSlot = (el: HTMLElement | null) => {
  if (el !== state.el) set({ el })
}
/** Called by the BuyDialog while its ticket is shown in the slot. */
export const setTicketOpen = (open: boolean) => {
  if (open !== state.open) set({ open })
}
export const useTicketSlot = () => useSyncExternalStore(subscribe, () => state.el)
export const useTicketOpen = () => useSyncExternalStore(subscribe, () => state.open)

const NARROW = '(max-width: 768px)'

/** True at phone and small tablet widths, where the ticket opens as a sheet instead of a column. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  )
}
