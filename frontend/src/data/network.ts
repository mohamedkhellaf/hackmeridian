// The state of the network indicator: "Testnet", the ledger number and a word for how the reads are doing.
import { useMemo } from 'react'
import { useNowSec } from './clock'
import { POLL_MS } from './queryClient'
import { useLedger } from './queries'
import { useOptionsClient } from './useOptionsClient'

/**
 *   mock        the build runs on mock data: there is no chain to read
 *   connecting  the first ledger read is still running
 *   ok          the last read succeeded and is recent
 *   delayed     the last read failed or is older than three polls: the ledger shown may be behind
 *   down        no ledger could be read at all
 */
export type NetworkState = 'mock' | 'connecting' | 'ok' | 'delayed' | 'down'

/**
 * A word for each state, in the user's terms (how fresh the reads are), never the developer's ("RPC"). The shell's
 * indicator has words of its own (features/shell/copy.ts); these are for any other place that names the state.
 */
export const NETWORK_STATE_LABEL: Record<NetworkState, string> = {
  mock: 'Mock data',
  connecting: 'Connecting',
  ok: 'Up to date',
  delayed: 'Reads are late',
  down: 'No connection',
}

export interface NetworkStatus {
  state: NetworkState
  label: string
  /** Latest ledger sequence, or null (mock mode, or nothing read yet). */
  ledger: number | null
  /** Close time of that ledger in unix seconds, when the RPC reports it. */
  closeTime: number | null
  /** When it was read, in milliseconds since the epoch. */
  readAt: number | null
}

/** A ledger read is stale after this long without a newer one. */
export const LEDGER_STALE_MS = 3 * POLL_MS.ledger

export function networkState(input: { mock: boolean; hasData: boolean; isError: boolean; readAt: number | null; nowMs: number }): NetworkState {
  if (input.mock) return 'mock'
  if (!input.hasData) return input.isError ? 'down' : 'connecting'
  if (input.isError || (input.readAt !== null && input.nowMs - input.readAt > LEDGER_STALE_MS)) return 'delayed'
  return 'ok'
}

/** The network indicator's data. Reads the latest ledger every 30 s over plain fetch; nothing is read in mock mode. */
export function useNetworkStatus(): NetworkStatus {
  const { isMock } = useOptionsClient()
  const ledger = useLedger()
  const nowSec = useNowSec(15)
  const sequence = ledger.data?.sequence ?? null
  const closeTime = ledger.data?.closeTime ?? null
  const readAt = ledger.dataUpdatedAt > 0 ? ledger.dataUpdatedAt : null
  const isError = ledger.isError
  return useMemo(() => {
    const state = networkState({ mock: isMock, hasData: sequence !== null, isError, readAt, nowMs: nowSec * 1000 })
    return { state, label: NETWORK_STATE_LABEL[state], ledger: sequence, closeTime, readAt }
  }, [isMock, sequence, closeTime, readAt, isError, nowSec])
}
