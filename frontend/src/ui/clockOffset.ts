import { createContext, useContext } from 'react'

/** The ledger-minus-device clock offset in milliseconds, provided by `ClockProvider`. */
export const ClockOffsetContext = createContext(0)

/** The ledger-minus-device offset in milliseconds; 0 without a provider. */
export function useClockOffset(): number {
  return useContext(ClockOffsetContext)
}
