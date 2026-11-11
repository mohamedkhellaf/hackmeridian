// The issuer console as one hook: what is read, what can be signed, and the log of what was signed. The components
// under this folder only render what it returns.
//
// Reads are queries under the key prefix ['issuer'] and are all read again after every action, whatever its
// outcome. Writes go through the app's one transaction machine (`useTx`), so an issuer action has the same
// stages as a trade and is recorded in the Activity list, which is where "Recent actions" comes from.
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetRecordFacts, IssuerFacts } from '../../core/assetfacts/assetFacts'
import { config } from '../../core/config'
import { describeError } from '../../core/stellar/errors'
import { TX_IDLE } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { useActivity, useAssets, useHealth, useOptions, useOptionsClient, useTx, useTxBusy } from '../../data'
import { useWallet } from '../../wallet'
import { COPY } from './copy'
import {
  ACTION_DONE,
  accessOf,
  accountExposure,
  actionLabel,
  actionName,
  checkNewAccount,
  escrowExposure,
  issuerSubject,
  logRows,
  mergeRows,
} from './model'
import type { Access, AccountExposure, AccountRow, AddResult, EscrowExposure, HolderRead, IssuerActionKind, IssuerAsset, LogRow } from './model'
import { liveNet } from './net'
import type { IssuerNet } from './net'

/** The key prefix of every read of the console. */
const KEY = 'issuer'

export type FlagsView =
  | { status: 'loading' }
  /** The asset's issuer is not known, so there is no account to read flags from. */
  | { status: 'unknown-issuer' }
  /** The issuer account does not exist on Testnet. */
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; facts: IssuerFacts }

export type HoldersView =
  /** Not listed: only the issuer sees the trustlines. */
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; count: number; more: boolean }

export interface TxView {
  /** The staged state of the running or last action. `idle` when there is none. */
  state: TxState
  /** What it is, with figures: "Freeze GDY2…ZUVN for BOND". Null when idle. */
  label: string | null
  kind: IssuerActionKind | null
  /** The account or contract it acts on. */
  target: string | null
  working: boolean
  canCheckAgain: boolean
  checkAgain: () => void
  /** Clears a settled outcome from the panel. It stays in "Recent actions". */
  dismiss: () => void
}

export interface IssuerConsole {
  /** True when the build has no Testnet contract: nothing below is read. */
  mock: boolean
  assetsStatus: 'loading' | 'error' | 'ready'
  assetsError: string | null
  retryAssets: () => void
  assets: IssuerAsset[]
  asset: IssuerAsset | null
  selectAsset: (contractId: string) => void
  access: Access
  connect: () => void
  /** The asset's issuer account: undefined while it is being read, null when it cannot be known. */
  issuer: string | null | undefined
  flags: FlagsView
  retryFlags: () => void
  record: AssetRecordFacts | null
  /** The options contract of this build, the escrow of every option. */
  escrow: string | undefined
  rows: AccountRow[]
  holders: HoldersView
  /** Milliseconds since the epoch of the oldest read on screen, or null before the first one. */
  readAt: number | null
  refreshing: boolean
  refresh: () => void
  addAccount: (text: string) => AddResult
  removeAccount: (address: string) => void
  /** What the options contract owes and holds in the selected asset, when the reserves were read. */
  health: { reserved: bigint; held: bigint } | null
  escrowExposure: EscrowExposure | null
  exposureOf: (account: string) => AccountExposure | null
  /** Why no action can start right now: a transaction is in flight, or the last one is still unknown. Null when one can. */
  busy: string | null
  tx: TxView
  /** Starts an action. Resolves with the state it ended in; never rejects. A second call while one runs is ignored. */
  authorize: (target: string) => Promise<TxState>
  freeze: (target: string) => Promise<TxState>
  clawback: (target: string, units: bigint) => Promise<TxState>
  log: LogRow[]
}

const errorText = (e: unknown): string => describeError(e)

export function useIssuerConsole(net: IssuerNet = liveNet): IssuerConsole {
  const wallet = useWallet()
  const { isMock } = useOptionsClient()
  const queryClient = useQueryClient()
  const address = wallet.address
  const live = !isMock
  const escrow = live ? config.optionsContractId : undefined

  // ---- the listed assets
  const assetsQ = useAssets({ enabled: live })
  const assets = useMemo<IssuerAsset[]>(
    () => (assetsQ.data?.underlyings ?? []).map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals, issuer: t.issuer })),
    [assetsQ.data],
  )
  const [picked, setPicked] = useState<string | null>(null)
  // The list can arrive after the first render: fall back to the first asset until a pick matches.
  const asset = assets.find((a) => a.contractId === picked) ?? assets[0] ?? null
  const assetId = asset?.contractId ?? null

  // ---- who issues it. The client reads the issuer from the asset contract; when that read failed, the connected
  // account is tested against the contract id instead (the asset contract id is derived from code and issuer).
  const needsDerive = live && !!asset && !asset.issuer && !!address
  const deriveQ = useQuery({
    queryKey: [KEY, 'is-issuer', assetId, address],
    queryFn: () => net.isIssuerOf(asset!, address!),
    enabled: needsDerive,
    staleTime: Number.POSITIVE_INFINITY,
  })
  let issuer: string | null | undefined
  if (!asset) issuer = undefined
  else if (asset.issuer) issuer = asset.issuer
  else if (!address) issuer = null
  else if (deriveQ.isPending) issuer = undefined
  else issuer = deriveQ.data === true ? address : null

  const access = accessOf({ mock: isMock, address, issuer })
  const isIssuer = access.kind === 'issuer'

  // ---- the issuer account and the asset record
  const factsQ = useQuery({ queryKey: [KEY, 'facts', issuer ?? null], queryFn: () => net.readIssuer(issuer!), enabled: live && !!issuer })
  const recordQ = useQuery({
    queryKey: [KEY, 'record', asset?.code ?? null, issuer ?? null],
    queryFn: () => net.readRecord(asset!.code, issuer!),
    enabled: live && !!asset && !!issuer,
  })
  let flags: FlagsView
  if (issuer === undefined) flags = { status: 'loading' }
  else if (issuer === null) flags = { status: 'unknown-issuer' }
  else if (factsQ.isPending) flags = { status: 'loading' }
  else if (factsQ.isError) flags = { status: 'error', message: errorText(factsQ.error) }
  else if (!factsQ.data) flags = { status: 'missing' }
  else flags = { status: 'ready', facts: factsQ.data }

  // ---- rows: the options contract, the addresses typed in this session, and (for the issuer) Horizon's holders
  const [added, setAdded] = useState<Readonly<Record<string, readonly string[]>>>({})
  const addedHere = useMemo(() => (isIssuer && assetId ? (added[assetId] ?? []) : []), [added, assetId, isIssuer])
  const targets = useMemo(() => [...new Set([...(escrow ? [escrow] : []), ...addedHere])], [escrow, addedHere])
  const targetQs = useQueries({
    queries: targets.map((target) => ({
      queryKey: [KEY, 'target', assetId, issuer ?? null, target],
      queryFn: (): Promise<HolderRead> => net.readTarget(asset!, issuer ?? '', target),
      // An account row needs the issuer to find the trustline; a contract row does not.
      enabled: live && !!asset && issuer !== undefined,
    })),
  })
  const holdersQ = useQuery({
    queryKey: [KEY, 'holders', assetId, issuer ?? null],
    queryFn: () => net.readHolders(asset!, issuer!),
    enabled: live && isIssuer && !!asset,
  })
  const reads: Record<string, HolderRead | undefined> = {}
  targets.forEach((target, i) => {
    reads[target] = targetQs[i]?.data
  })
  const rows = mergeRows({ escrow, added: addedHere, holders: isIssuer ? (holdersQ.data?.rows ?? []) : [], reads })

  let holders: HoldersView
  if (!isIssuer) holders = { status: 'hidden' }
  else if (holdersQ.isPending) holders = { status: 'loading' }
  else if (holdersQ.isError) holders = { status: 'error', message: errorText(holdersQ.error) }
  else holders = { status: 'ready', count: holdersQ.data.rows.length, more: holdersQ.data.more }

  const stamps = [...targetQs.map((q) => q.dataUpdatedAt), holdersQ.dataUpdatedAt, factsQ.dataUpdatedAt].filter((t) => t > 0)
  const readAt = stamps.length > 0 ? Math.min(...stamps) : null
  const refreshing = targetQs.some((q) => q.isFetching) || holdersQ.isFetching || factsQ.isFetching || recordQ.isFetching

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [KEY] })
  }, [queryClient])

  const listed = rows.map((r) => r.address)
  const addAccount = (text: string): AddResult => {
    const result = checkNewAccount(text, listed)
    if (result.ok && assetId) setAdded((prev) => ({ ...prev, [assetId]: [result.address, ...(prev[assetId] ?? [])] }))
    return result
  }
  const removeAccount = (target: string): void => {
    if (assetId) setAdded((prev) => ({ ...prev, [assetId]: (prev[assetId] ?? []).filter((a) => a !== target) }))
  }

  // ---- what depends on the asset inside the options contract
  const optionsQ = useOptions({ enabled: live, cadence: 'slow' })
  const healthQ = useHealth({ enabled: live })
  const options = optionsQ.data
  const healthLine = assetId ? healthQ.data?.find((h) => h.token.contractId === assetId) : undefined
  const health = useMemo(() => (healthLine ? { reserved: healthLine.reserved, held: healthLine.held } : null), [healthLine])
  const escrowCounts = useMemo(() => (options && assetId ? escrowExposure(options, assetId) : null), [options, assetId])
  const exposureOf = useCallback((account: string) => (options && assetId ? accountExposure(options, assetId, account) : null), [options, assetId])

  // ---- actions
  const txc = useTx({ mock: false })
  const pageBusy = useTxBusy()
  const lock = useRef(false) // synchronous guard: a state update is too late to stop a double click
  const [current, setCurrent] = useState<{ label: string; kind: IssuerActionKind; target: string } | null>(null)

  const { run, reset } = txc
  const sign = wallet.sign

  const start = useCallback(
    async (kind: IssuerActionKind, target: string, units?: bigint): Promise<TxState> => {
      if (lock.current || !asset || access.kind !== 'issuer') return TX_IDLE
      lock.current = true
      try {
        const input = { kind, asset, target, units }
        const label = actionLabel(input)
        setCurrent({ label, kind, target })
        const done = await run({ label, action: actionName(kind), done: ACTION_DONE[kind], subject: issuerSubject(asset.contractId, target) }, (opts) =>
          net.send({ kind, asset, issuer: access.issuer, target, units }, sign, opts),
        )
        return done.state
      } finally {
        lock.current = false
        // Every row is read again, whatever the outcome: a failed or unknown transaction may still have landed.
        void queryClient.invalidateQueries({ queryKey: [KEY] })
      }
    },
    [asset, access, run, net, sign, queryClient],
  )
  const authorize = useCallback((target: string) => start('authorize', target), [start])
  const freeze = useCallback((target: string) => start('freeze', target), [start])
  const clawback = useCallback((target: string, units: bigint) => start('clawback', target, units), [start])

  // An unknown outcome can be resolved later (the automatic re-check): read the rows again when it is.
  const phase = txc.state.phase
  const lastPhase = useRef(phase)
  useEffect(() => {
    if (lastPhase.current === 'unknown' && phase !== 'unknown') void queryClient.invalidateQueries({ queryKey: [KEY] })
    lastPhase.current = phase
  }, [phase, queryClient])

  const dismiss = useCallback(() => {
    reset()
    setCurrent(null)
  }, [reset])
  const checkAgain = useCallback(() => {
    void txc.checkAgain()
  }, [txc])

  const idle = txc.state.phase === 'idle'
  const tx: TxView = {
    state: txc.state,
    label: idle ? null : (current?.label ?? null),
    kind: idle ? null : (current?.kind ?? null),
    target: idle ? null : (current?.target ?? null),
    working: txc.working,

    canCheckAgain: txc.canCheckAgain,
    checkAgain,
    dismiss,
  }

  const activity = useActivity()
  const log = useMemo(() => logRows(activity.entries), [activity.entries])

  return {
    mock: isMock,
    assetsStatus: !live ? 'ready' : assetsQ.isPending ? 'loading' : assetsQ.isError ? 'error' : 'ready',
    assetsError: live && assetsQ.isError ? errorText(assetsQ.error) : null,
    retryAssets: () => void assetsQ.refetch(),
    assets,
    asset,
    selectAsset: setPicked,
    access,
    connect: () => void wallet.connect(),
    issuer,
    flags,
    retryFlags: () => void factsQ.refetch(),
    record: recordQ.data ?? null,
    escrow,
    rows,
    holders,
    readAt,
    refreshing,
    refresh,
    addAccount,
    removeAccount,
    health,
    escrowExposure: escrowCounts,
    exposureOf,
    busy: txc.state.phase === 'unknown' ? COPY.reasons.unknownPending : pageBusy || txc.working ? COPY.reasons.busy : null,
    tx,
    authorize,
    freeze,
    clawback,
    log,
  }
}
