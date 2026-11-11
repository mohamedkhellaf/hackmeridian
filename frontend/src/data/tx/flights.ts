// Transactions in flight on this page (checking, waiting for a signature, submitting, pending). A wallet signs
// one transaction at a time and an account's sequence number admits one at a time, so the runner refuses to start
// a second one while the first is in flight, and every action button can disable itself from `useTxBusy()`.

export interface Flights {
  subscribe(listener: () => void): () => void
  /** How many transactions are in flight. */
  count(): number
  /** Is a transaction on this subject (`option:12`, `bid:3`) in flight? */
  has(subject: string | null | undefined): boolean
  enter(id: string, subject: string | null): void
  leave(id: string): void
}

export function createFlights(): Flights {
  const byId = new Map<string, string | null>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const l of listeners) l()
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    count: () => byId.size,
    has: (subject) => {
      if (!subject) return false
      for (const s of byId.values()) if (s === subject) return true
      return false
    },
    enter(id, subject) {
      byId.set(id, subject)
      notify()
    },
    leave(id) {
      if (byId.delete(id)) notify()
    },
  }
}

export const flights: Flights = createFlights()
