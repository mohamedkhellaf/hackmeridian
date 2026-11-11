import { useEffect, useState } from 'react'
import { server } from '../stellar/rpc'

export interface NetworkStatus {
  ledger: number | null
  /** 'unknown' until the first answer; 'degraded' when the last RPC call failed. */
  rpc: 'ok' | 'degraded' | 'unknown'
}

const REFRESH_MS = 30_000

/** Latest ledger from RPC `getLatestLedger`, refreshed every 30s. Disabled (no calls) when `enabled` is false. */
export function useNetworkStatus(enabled: boolean): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({ ledger: null, rpc: 'unknown' })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const read = async () => {
      try {
        const { sequence } = await server.getLatestLedger()
        if (alive) setStatus({ ledger: sequence, rpc: 'ok' })
      } catch {
        if (alive) setStatus((s) => ({ ledger: s.ledger, rpc: 'degraded' }))
      }
    }
    void read()
    const t = window.setInterval(() => void read(), REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [enabled])
  return status
}
