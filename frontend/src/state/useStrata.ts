import { useCallback, useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { createOptionsClient } from '../options'
import { MockOptionsClient } from '../options/mockClient'
import type { OptionsClient } from '../options/client'
import type { CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets } from '../options/types'
import type { OptionRow } from '../market/OptionsTable'
import type { Notice } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { useFreighter } from '../wallet/useFreighter'

export type PositionAction = NonNullable<Parameters<typeof OptionRow>[0]['action']>

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
    const [opts, assets, lines, hl] = await Promise.all([
      client.listOptions(),
      client.supportedAssets(),
      client.openCollateral(),
      client.collateralHealth().catch(() => [] as CollateralHealth[]),
    ])
    setOptions(opts)
    setAssets(assets)
    setCollateral(lines)
    setHealth(hl)
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Returns whether the transaction went through.
  const run = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>) => {
    setBusyId(id)
    setNotice(null)
    let ok = false
    try {
      const { hash } = await fn()
      ok = true
      setNotice({ kind: 'ok', text: `${label} confirmed`, hash, mock: client.isMock })
      return true
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
      return false
    } finally {
      setBusyId(null)
      await refresh()
      if (ok) void refreshBalances()
    }
  }

  const me = wallet.address
  const market = options.filter((o) => o.state === 'offered')
  const positions = options.filter((o) => me && (o.holder === me || o.writer === me))
  const busy = busyId !== null
  const dismissNotice = useCallback(() => setNotice(null), [])

  const writeOffer = (offer: NewOffer) => run(-1n, 'Offer published', () => client.createOffer(offer, me!))

  /** Confirm the purchase currently open in the buy dialog. */
  const confirmBuy = () => {
    const o = buying
    if (!o || !me) return
    setBuying(null)
    void run(o.id, 'Purchase', () => client.buy(o.id, me))
  }

  /** The next action the connected wallet can take on a position, if any. */
  const actionFor = (o: OptionOffer): PositionAction | undefined => {
    if (!me) return undefined
    if (o.holder === me && o.state === 'active' && Date.now() / 1000 < o.expiry)
      return {
        label: busyId === o.id ? 'Exercising…' : 'Exercise',
        disabled: busy,
        onClick: () => void run(o.id, 'Exercise', () => client.exercise(o.id, me)),
      }
    if (o.writer === me && o.state === 'exercised')
      return {
        label: busyId === o.id ? 'Claiming…' : 'Claim delivery',
        disabled: busy,
        onClick: () => void run(o.id, 'Claim delivery', () => client.claimDelivery(o.id, me)),
      }
    if (o.writer === me && o.state === 'expired')
      return {
        label: busyId === o.id ? 'Reclaiming…' : 'Reclaim collateral',
        disabled: busy,
        onClick: () => void run(o.id, 'Reclaim', () => client.reclaim(o.id, me)),
      }
    if (o.writer === me && o.state === 'offered')
      return {
        label: busyId === o.id ? 'Cancelling…' : 'Cancel',
        disabled: busy,
        onClick: () => void run(o.id, 'Cancel', () => client.cancelOffer(o.id, me)),
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
