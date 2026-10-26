import { useCallback, useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { createOptionsClient } from '../options'
import { MockOptionsClient } from '../options/mockClient'
import type { OptionsClient } from '../options/client'
import type { Ask, CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets } from '../options/types'
import type { OptionRow } from '../market/OptionsTable'
import type { Notice } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { useFreighter } from '../wallet/useFreighter'

export type TxOutcome = { ok: true; hash: string; mock: boolean } | { ok: false; error: string }

export type PositionAction =NonNullable<Parameters<typeof OptionRow>[0]['action']>

/**
 * All app state and actions (previously in App.tsx): wallet, options client, listings, collateral,
 * balances, the transaction runner and its notice. Views receive slices of this via props.
 */
export function useStrata() {
  const wallet = useFreighter()
  // One mock for the whole session (recreating it would wipe the demo state). The Soroban client
  // captures the signer, so it is rebuilt when the wallet address or signers change.
  const [mock] = useState(() => (config.optionsContractId ? null : new MockOptionsClient()))
  const { address: walletAddress, sign: walletSign, signAuthEntry: walletSignAuth } = wallet
  const client: OptionsClient = useMemo(
    () => mock ?? createOptionsClient({ address: walletAddress, sign: walletSign, signAuthEntry: walletSignAuth }),
    [mock, walletAddress, walletSign, walletSignAuth],
  )
  const [options, setOptions] = useState<OptionOffer[]>([])
  // Resale asks; null when the contract has no resale (before v1.4) or the read failed.
  const [asks, setAsks] = useState<Ask[] | null>(null)
  const [assets, setAssets] = useState<SupportedAssets | null>(null)
  const [collateral, setCollateral] = useState<CollateralLine[]>([])
  const [health, setHealth] = useState<CollateralHealth[]>([])
  const [busyId, setBusyId] = useState<bigint | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [buying, setBuying] = useState<OptionOffer | null>(null)

  const balanceTokens = useMemo(() => (assets ? [assets.quote, ...assets.underlyings] : []), [assets])
  const balances = useBalances(wallet.address, balanceTokens)
  const refreshBalances = balances.refresh

  const refresh = useCallback(async () => {
    const [opts, assets, lines, hl, ak] = await Promise.all([
      client.listOptions(),
      client.supportedAssets(),
      client.openCollateral(),
      client.collateralHealth().catch(() => [] as CollateralHealth[]),
      client.listAsks().catch(() => null),
    ])
    setOptions(opts)
    setAsks(ak)
    setAssets(assets)
    setCollateral(lines)
    setHealth(hl)
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Runs a transaction, sets the toast and refreshes state. Returns the hash on success.
  const runDetailed = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>): Promise<TxOutcome> => {
    setBusyId(id)
    setNotice(null)
    let ok = false
    try {
      const { hash } = await fn()
      ok = true
      setNotice({ kind: 'ok', text: label, hash, mock: client.isMock })
      return { ok: true, hash, mock: client.isMock }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      setNotice({ kind: 'err', text: error })
      return { ok: false, error }
    } finally {
      setBusyId(null)
      await refresh()
      if (ok) void refreshBalances()
    }
  }

  // Returns whether the transaction went through.
  const run = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>) => (await runDetailed(id, label, fn)).ok

  const me = wallet.address
  const market = options.filter((o) => o.state === 'offered')
  const positions = options.filter((o) => me && (o.holder === me || o.writer === me))
  const busy = busyId !== null
  const dismissNotice = useCallback(() => setNotice(null), [])

  const writeOffer = (offer: NewOffer) => run(-1n, 'Offer written', () => client.createOffer(offer, me!))

  /**
   * Confirm the purchase open in the buy dialog. The dialog stays mounted (`buying` is not cleared) so it can show the
   * confirmed step; it closes itself via `setBuying(null)`. Resolves with the outcome (null if nothing to buy).
   */
  const confirmBuy = async (): Promise<TxOutcome | null> => {
    const o = buying
    if (!o || !me) return null
    return runDetailed(o.id, 'Bought', () => client.buy(o.id, me))
  }

  // Resale (contract v1.4). Each resolves with the outcome so the resale dialogs can show their own result.
  const listForSale = (o: OptionOffer, askTotal: bigint) =>
    runDetailed(o.id, 'Listed for sale', () => client.listForSale(o.id, me!, askTotal))
  const cancelSale = (o: OptionOffer) => runDetailed(o.id, 'Sale cancelled', () => client.cancelSale(o.id, me!))
  const buyResale = (o: OptionOffer) => runDetailed(o.id, 'Bought from holder', () => client.buyResale(o.id, me!))

  /** The next action the connected wallet can take on a position, if any. */
  const actionFor = (o: OptionOffer): PositionAction | undefined => {
    if (!me) return undefined
    if (o.holder === me && o.state === 'active' && Date.now() / 1000 < o.expiry)
      return {
        label: busyId === o.id ? 'Exercising…' : 'Exercise',
        disabled: busy,
        onClick: () => void run(o.id, 'Exercised', () => client.exercise(o.id, me)),
      }
    if (o.writer === me && o.state === 'exercised')
      return {
        label: busyId === o.id ? 'Claiming…' : 'Claim delivery',
        disabled: busy,
        onClick: () => void run(o.id, 'Delivery claimed', () => client.claimDelivery(o.id, me)),
      }
    if (o.writer === me && o.state === 'expired')
      return {
        label: busyId === o.id ? 'Reclaiming…' : 'Reclaim',
        disabled: busy,
        onClick: () => void run(o.id, 'Reclaimed', () => client.reclaim(o.id, me)),
      }
    if (o.writer === me && o.state === 'offered')
      return {
        label: busyId === o.id ? 'Cancelling…' : 'Cancel offer',
        disabled: busy,
        onClick: () => void run(o.id, 'Cancelled', () => client.cancelOffer(o.id, me)),
      }
    return undefined
  }

  // Positions where the user must do something that is not a mere cancel: exercise, claim, reclaim.
  const actionsWaiting = positions.filter((o) => {
    if (!me) return false
    if (o.holder === me && o.state === 'active') return true // 'expired' is derived by the client at list time
    return o.writer === me && (o.state === 'exercised' || o.state === 'expired')
  }).length

  return {
    wallet,
    me,
    client,
    isMock: client.isMock,
    options,
    asks,
    listForSale,
    cancelSale,
    buyResale,
    market,
    positions,
    assets,
    collateral,
    health,
    balanceTokens,
    balances,
    refreshBalances,
    busy,
    busyId,
    notice,
    dismissNotice,
    buying,
    setBuying,
    confirmBuy,
    writeOffer,
    actionFor,
    actionsWaiting,
  }
}

export type Strata = ReturnType<typeof useStrata>
