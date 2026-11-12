// The three reads behind the page, as one view. Locked (`open_collateral`) and held (the token balance) come from
// the health read; the split by state comes from the option list. Either can be missing without hiding the other.
import { useCallback, useMemo, useState } from 'react'
import { describeError } from '../../core/stellar/errors'
import { useAssets, useCollateral, useHealth, useLedger, useOptionsClient } from '../../data'
import { isReferenceAsset } from '../../core/assets'
import { reserveRows, visibleRows } from './model'
import type { ReserveRow } from './model'

export interface ReservesView {
  /** `loading`: the first read is running. `error`: nothing could be read. `ready`: `rows` can be shown. */
  status: 'loading' | 'error' | 'ready'
  /** The quote token, the reference assets and every token with something locked or held. */
  rows: ReserveRow[]
  /** Listed tokens that are left out because nothing is locked and nothing is held. */
  hiddenEmpty: number
  /** Why nothing could be read, when `status` is `error`. */
  error: string | null
  /** The balances could not be read: held and the difference are unknown. */
  heldMissing: boolean
  /** The option list could not be read: the split by state is missing. */
  splitMissing: boolean
  /** The last read failed and the figures on screen are from an earlier one (see `readAt`). */
  stale: boolean
  /** When the oldest figure on screen was read, in milliseconds since the epoch. */
  readAt: number | null
  /** The network's latest ledger at the last read. Null on mock data, which has no ledger. */
  ledger: number | null
  isMock: boolean
  refreshing: boolean
  /** Reads everything again. Resolves with the new read time, or null when the read failed. */
  refresh: () => Promise<number | null>
}

const message = (error: unknown): string | null => (error ? describeError(error) : null)

export function useReserves(): ReservesView {
  const { isMock, error: clientError } = useOptionsClient()
  const assets = useAssets()
  const collateral = useCollateral()
  const health = useHealth()
  const ledger = useLedger()
  const [manual, setManual] = useState(false)

  const { shown: rows, hiddenEmpty } = useMemo(
    () => visibleRows(assets.data ? reserveRows(assets.data, collateral.data, health.data) : [], isReferenceAsset),
    [assets.data, collateral.data, health.data],
  )

  const { refetch: refetchAssets } = assets
  const { refetch: refetchCollateral } = collateral
  const { refetch: refetchHealth } = health
  const { refetch: refetchLedger } = ledger
  const hasAssets = assets.data !== undefined
  const refresh = useCallback(async () => {
    setManual(true)
    try {
      const [, lines, held] = await Promise.all([
        hasAssets ? null : refetchAssets(),
        refetchCollateral(),
        refetchHealth(),
        // The ledger query is switched off on mock data; a manual refetch would still reach for the network.
        isMock ? null : refetchLedger(),
      ])
      const stamps = [lines.dataUpdatedAt, held.dataUpdatedAt].filter((t) => t > 0)
      return lines.isError && held.isError ? null : stamps.length ? Math.min(...stamps) : null
    } finally {
      setManual(false)
    }
  }, [hasAssets, isMock, refetchAssets, refetchCollateral, refetchHealth, refetchLedger])

  const settled = !assets.isPending && !collateral.isPending && !health.isPending
  const haveFigures = collateral.data !== undefined || health.data !== undefined
  const status: ReservesView['status'] = !settled ? 'loading' : assets.data && haveFigures ? 'ready' : 'error'
  const stamps = [collateral.dataUpdatedAt, health.dataUpdatedAt].filter((t) => t > 0)

  return {
    status,
    rows,
    hiddenEmpty,
    error: status === 'error' ? (message(assets.error) ?? message(health.error) ?? message(collateral.error) ?? clientError) : null,
    heldMissing: status === 'ready' && health.data === undefined,
    splitMissing: status === 'ready' && collateral.data === undefined,
    stale: status === 'ready' && ((collateral.isError && collateral.data !== undefined) || (health.isError && health.data !== undefined)),
    readAt: stamps.length ? Math.min(...stamps) : null,
    ledger: ledger.data?.sequence ?? null,
    isMock,
    refreshing: manual,
    refresh,
  }
}
