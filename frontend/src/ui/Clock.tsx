import type { ReactNode } from 'react'
import { ClockOffsetContext } from './clockOffset'

export interface ClockProviderProps {
  /**
   * The ledger close time minus this device's clock, in milliseconds, measured when the ledger was last read
   * (0 on mock data or before the first read). Every `Countdown` without a `now` adds it to the device clock, so
   * time left follows the ledger, which decides deadlines, and not a device clock that is a few minutes off.
   */
  offsetMs: number
  children: ReactNode
}

/** Mount once, above every countdown, with the offset the data layer measures. */
export function ClockProvider({ offsetMs, children }: ClockProviderProps) {
  return <ClockOffsetContext.Provider value={Number.isFinite(offsetMs) ? offsetMs : 0}>{children}</ClockOffsetContext.Provider>
}
