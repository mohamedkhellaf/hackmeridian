import { useEffect, useMemo, useState } from 'react'
import { server } from '../stellar/rpc'
import type { CollateralHealth, CollateralLine } from '../options/types'

// Time of the last refresh of the reserves data (new data = new array identity), plus (real mode
// only) the latest ledger from RPC getLatestLedger. Mock mode never touches the network.
export function useReadAt(collateral: CollateralLine[], health: CollateralHealth[], real: boolean) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const readAt = useMemo(() => new Date(), [collateral, health])
  const [ledger, setLedger] = useState<number | null>(null)

  useEffect(() => {
    if (!real) return
    let live = true
    server
      .getLatestLedger()
      .then((l) => live && setLedger(l.sequence))
      .catch(() => live && setLedger(null))
    return () => {
      live = false
    }
  }, [readAt, real])

  return { readAt, ledger }
}
