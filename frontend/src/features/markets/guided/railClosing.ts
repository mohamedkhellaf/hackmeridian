// The order rail says when it shows the guided closing block, so the guided page does not show it a second time.
import { useSyncExternalStore } from 'react'

let inRail = 0
const railListeners = new Set<() => void>()
const emitRail = () => {
  for (const listener of railListeners) listener()
}
const subscribeRail = (listener: () => void) => {
  railListeners.add(listener)
  return () => {
    railListeners.delete(listener)
  }
}

/** True while a closing block is mounted in the order rail. */
export function useClosingInRail(): boolean {
  return useSyncExternalStore(
    subscribeRail,
    () => inRail > 0,
    () => false,
  )
}

/** Counts a closing block mounted in the rail; returns the function that takes it back. */
export function registerRailClosing(): () => void {
  inRail += 1
  emitRail()
  return () => {
    inRail -= 1
    emitRail()
  }
}
