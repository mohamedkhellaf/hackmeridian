// Loads the Margin client once per page (fixtures or the live contract, both dynamic imports) and keeps the live
// one in step with the wallet. The client survives leaving and re-entering the Margin routes, so the simulation
// keeps its scenario and step, and the live model is not read from scratch on every visit.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { FIXTURE_DEFAULT_PARTY, PRO_REFRESH_MS, createProClient } from '../../core/pro/createClient'
import type { ProClientHandle } from '../../core/pro/createClient'
import type { ProClientStatus } from '../../core/pro/SorobanProClient'
import type { Party } from '../../core/pro/types'
import { useWallet } from '../../wallet'
import { createClientSource } from '../clientSource'
import type { ClientSource } from '../clientSource'

// Created on first use, not at import: a build without Margin must be able to drop this module and the two
// client chunks behind `createProClient`.
let shared: ClientSource<ProClientHandle> | null = null
const source = (): ClientSource<ProClientHandle> => (shared ??= createClientSource<ProClientHandle>(createProClient))

export interface ProClientState {
  /** The client and its controls once loaded, else null. */
  handle: ProClientHandle | null
  /** Why it could not be loaded, or null. */
  error: string | null
  retry: () => void
  /** The account Margin acts as: the fixture default party while simulated, the wallet address on chain ('' when not connected). */
  me: Party
  /** True when a wallet is connected (always true on fixtures, which need none). */
  connected: boolean
  /** The live client's read status (loading, last failure, last success). Null on fixtures. */
  status: ProClientStatus | null
}

const NO_STATUS = (): null => null
const NO_SUBSCRIPTION = (): (() => void) => () => {}

/**
 * The Margin client of this build. Mount it only under the Margin routes: the first call starts the load (the
 * 1 MB fixture file, or the live client and the Stellar SDK). On chain it hands the wallet to the client, reads
 * at once, and re-reads every 15 s while the tab is visible.
 */
export function useProClient(): ProClientState {
  const wallet = useWallet()
  const src = source()
  const handle = useSyncExternalStore(src.subscribe, src.peek, src.peek)
  const error = useSyncExternalStore(src.subscribe, src.error, src.error)

  useEffect(() => {
    if (!src.peek()) src.get().catch(() => undefined)
  }, [src])
  const retry = useCallback(() => {
    src.get().catch(() => undefined)
  }, [src])

  const live = handle?.live ?? null
  const { address, sign, signAuthEntry } = wallet
  // The client reads the wallet at call time; hand it over on every change, then read as that account.
  useEffect(() => {
    if (!live) return
    live.setWallet({ address, sign, signAuthEntry })
    void live.refresh()
  }, [live, address, sign, signAuthEntry])

  // Poll only while the tab is visible; coming back reads at once.
  useEffect(() => {
    if (!live) return
    let stop: (() => void) | null = null
    const sync = () => {
      const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
      if (visible && !stop) {
        stop = live.start(PRO_REFRESH_MS)
      } else if (!visible && stop) {
        stop()
        stop = null
      }
    }
    const onVisibility = () => {
      const wasPaused = stop === null
      sync()
      if (wasPaused && stop) void live.refresh()
    }
    sync()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop?.()
    }
  }, [live])

  const subscribeStatus = useCallback((listener: () => void) => (live ? live.subscribe(listener) : NO_SUBSCRIPTION()), [live])
  const getStatus = useCallback(() => (live ? live.getStatus() : NO_STATUS()), [live])
  const status = useSyncExternalStore(subscribeStatus, getStatus, getStatus)

  const simulated = handle?.simulated ?? false
  return {
    handle,
    error,
    retry,
    me: simulated ? FIXTURE_DEFAULT_PARTY : (address ?? ''),
    connected: simulated || !!address,
    status,
  }
}
