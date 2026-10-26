import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from '../config'
import { createOptionsClient } from '../options'
import { MockOptionsClient } from '../options/mockClient'
import type { OptionsClient } from '../options/client'
import type { Ask, CollateralHealth, CollateralLine, NewOffer, OptionOffer, SupportedAssets } from '../options/types'
import type { OptionRow } from '../market/OptionsTable'
import type { Bid, NewBid } from '../requests/types'
import type { Notice } from '../ui'
import { useBalances } from '../wallet/useBalances'
import { useFreighter } from '../wallet/useFreighter'

import { runTx } from './runTx'
import type { TxOutcome } from './runTx'
export type { TxOutcome } from './runTx'

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
  // Buyer requests (bids); null when the contract has no bids (before v1.5) or the read failed.
  const [bids, setBids] = useState<Bid[] | null>(null)
  const [assets, setAssets] = useState<SupportedAssets | null>(null)
  const [collateral, setCollateral] = useState<CollateralLine[]>([])
  const [health, setHealth] = useState<CollateralHealth[]>([])
  const [busyId, setBusyId] = useState<bigint | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [buying, setBuying] = useState<OptionOffer | null>(null)

  const balanceTokens = useMemo(() => (assets ? [assets.quote, ...assets.underlyings] : []), [assets])
  const balances = useBalances(wallet.address, balanceTokens)
  const refreshBalances = balances.refresh

  // First-load status: `loading` until the first read round finishes, then `ready` (or `error` if that first round failed).
  // Later refreshes never flip it back, so screens do not flash skeletons again.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const readyRef = useRef(false)

  const refresh = useCallback(async () => {
    const [opts, assets, lines, hl, ak, bd] = await Promise.all([
      client.listOptions(),
      client.supportedAssets(),
      client.openCollateral(),
      client.collateralHealth().catch(() => [] as CollateralHealth[]),
      client.listAsks().catch(() => null),
      client.listBids().catch(() => null),
    ])
    setOptions(opts)
    setAsks(ak)
    setBids(bd)
    setAssets(assets)
    setCollateral(lines)
    setHealth(hl)
  }, [client])

  const load = useCallback(async () => {
    try {
      await refresh()
      readyRef.current = true
      setLoadError(null)
      setStatus('ready')
    } catch (e) {
      if (readyRef.current) return
      setLoadError(e instanceof Error ? e.message : 'Could not load data.')
      setStatus('error')
    }
  }, [refresh])

  useEffect(() => {
    void load()
  }, [load])

  // Runs a transaction, sets the toast and refreshes state (runTx: a failed refresh never fails a confirmed tx).
  const runDetailed = async (id: bigint, label: string, fn: () => Promise<{ hash: string }>): Promise<TxOutcome> => {
    setBusyId(id)
    try {
      return await runTx(label, client.isMock, fn, {
        setNotice,
        refresh: async () => {
          setBusyId(null)
          await refresh()
        },
        onSuccess: () => void refreshBalances(),
      })
    } finally {
      setBusyId(null)
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
  // `maxTotal` is the ask the buyer reviewed; the contract refuses a higher price (PriceMoved 121).
  const buyResale = (o: OptionOffer, maxTotal: bigint) =>
    runDetailed(o.id, 'Bought from holder', () => client.buyResale(o.id, me!, maxTotal))

  // Buyer requests (contract v1.5). Each resolves with the outcome so the request dialogs can show their own result.
  // Bid ids and option ids are separate sequences, so the busy marker uses a negative id for bids.
  const bidBusyId = (id: bigint) => -2n - id
  const createBid = (bid: NewBid) => runDetailed(-1n, 'Request posted', () => client.createBid(bid, me!))
  const cancelBid = (b: Bid) => runDetailed(bidBusyId(b.id), 'Request cancelled', () => client.cancelBid(b.id, me!))
  const fillBid = (b: Bid) => runDetailed(bidBusyId(b.id), 'Request filled', () => client.fillBid(b.id, me!))

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
    status,
    ready: status === 'ready',
    loadError,
    retry: () => {
      setStatus('loading')
      return load()
    },
    options,
    asks,
    listForSale,
    cancelSale,
    buyResale,
    bids,
    bidBusyId,
    createBid,
    cancelBid,
    fillBid,
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

export type StellSec = ReturnType<typeof useStrata>
