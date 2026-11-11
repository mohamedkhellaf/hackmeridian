// The issuer console as one hook: what is read, what can be signed, and the log of what was signed. The components
// under this folder only render what it returns.
//
// Reads are queries under the key prefix ['issuer'] and are all read again after every action, whatever its
// outcome. Writes go through the app's one transaction machine (`useTx`), so an issuer action has the same
// stages as a trade and is recorded in the Activity list, which is where "Recent actions" comes from.
//
// On mock data there is no asset contract and no issuer account: nothing is read from a network and nothing can
// be signed. The page still shows what the mock data holds: the listed assets, the demo flags of each
// (`mockAssetFacts`), and what the Covered contract holds and reserves in it.
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mockAssetFacts } from '../../core/assetfacts/assetFacts'
import type { AssetRecordFacts, IssuerFacts } from '../../core/assetfacts/assetFacts'
import { config } from '../../core/config'
import { describeError } from '../../core/stellar/errors'
import { TX_IDLE } from '../../core/tx/machine'
import type { TxState } from '../../core/tx/machine'
import { useActivity, useAssets, useHealth, useOptions, useOptionsClient, useTx, useTxBusy } from '../../data'
import { useWallet } from '../../wallet'
import type { IssuerSearch } from '../../app/search'
import { COPY } from './copy'
import {
  ACTION_DONE,
  accessOf,
  accountExposure,
  actionLabel,
  actionName,
  checkNewAccount,
  doneLabel,
  escrowExposure,
  issuerSubject,
  logRows,
  mergeRows,
  openIssuerAction,
  otherIssuedAsset,
  pickAsset,
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
  /** The same, done: "Frozen GDY2…ZUVN for BOND." Null when idle. */
  done: string | null
  kind: IssuerActionKind | null
  /** The account or contract it acts on. */
  target: string | null
  working: boolean
  canCheckAgain: boolean
  checkAgain: () => void
  /** Clears a settled outcome from the page. It stays in "Recent actions". */
  dismiss: () => void
}

/** The Covered contract as a statement: what it holds and owes in the asset, and whether it may hold it. */
export interface ContractView {
  /** Its address. Absent on mock data, where the contract has no id to show. */
  address: string | undefined
  /** Its read as a holder of the asset (Testnet only): the authorization and the balance. */
  row: AccountRow | null
  /** What it holds in the asset. Null when not read. */
  held: bigint | null
  /** What it owes to open options in the asset. Null when not read. */
  reserved: bigint | null
  exposure: EscrowExposure | null
  /** The reserves or the options are still being read for the first time. */
  loading: boolean
}

export interface IssuerConsole {
  /** True when the build has no Testnet contract: nothing is read from a network and nothing can be signed. */
  mock: boolean
  assetsStatus: 'loading' | 'error' | 'ready'
  assetsError: string | null
  retryAssets: () => void
  assets: IssuerAsset[]
  asset: IssuerAsset | null
  selectAsset: (contractId: string) => void
  access: Access
  /** Read again whether the connected account issues the asset, after that check failed. */
  retryAccess: () => void
  /** Another listed asset the connected account issues, when it does not issue the one on screen. */
  otherIssued: IssuerAsset | null
  connect: () => void
  /** The asset's issuer account: undefined while it is being read, null when it cannot be known. */
  issuer: string | null | undefined
  flags: FlagsView
  retryFlags: () => void
  record: AssetRecordFacts | null
  contract: ContractView
  /** The accounts the issuer acts on: typed addresses, then the holders. Empty for anyone else. */
  rows: AccountRow[]
  holders: HoldersView
  /** Milliseconds since the epoch of the oldest read on screen, or null before the first one. */
  readAt: number | null
  refreshing: boolean
  refresh: () => void
  addAccount: (text: string) => AddResult
  removeAccount: (address: string) => void
  exposureOf: (account: string) => AccountExposure | null
  /** Why no action can start right now: a transaction is in flight, or the last one is still unknown. Null when one can. */
  busy: string | null
  /**
   * An issuer action recorded in this browser whose outcome is not known yet (also one sent before the page was
   * left): every action waits for it. `check` looks it up again.
   */
  unresolved: { id: string; check: () => void } | null
  tx: TxView
  /** Starts an action. Resolves with the state it ended in; never rejects. A second call while one runs is ignored. */
  authorize: (target: string) => Promise<TxState>
  freeze: (target: string) => Promise<TxState>
  clawback: (target: string, units: bigint) => Promise<TxState>
  log: LogRow[]
  /** Looks a recorded action up again (an unknown outcome in "Recent actions"). */
  checkLogged: (id: string) => void
}

const errorText = (e: unknown): string => describeError(e)

/** The contract id an `asset` param names: a code of the list (any case) or a contract id. */
function assetFromParam(assets: readonly IssuerAsset[], param: string | undefined): string | null {
  if (!param) return null
  const lower = param.toLowerCase()
  return (assets.find((a) => a.contractId === param) ?? assets.find((a) => a.code.toLowerCase() === lower))?.contractId ?? null
}

/** The shortest param that names this asset alone: its code in lower case, else its contract id. */
function assetParamOf(assets: readonly IssuerAsset[], asset: IssuerAsset): string {
  const code = asset.code.toLowerCase()
  return assets.filter((a) => a.code.toLowerCase() === code).length === 1 ? code : asset.contractId
}

export function useIssuerConsole(net: IssuerNet = liveNet): IssuerConsole {
  const wallet = useWallet()
  const { isMock } = useOptionsClient()
  const queryClient = useQueryClient()
  const address = wallet.address
  const live = !isMock
  const escrow = live ? config.optionsContractId : undefined

  // ---- the listed assets (the mock client lists its demo assets)
  const assetsQ = useAssets()
  const assets = useMemo<IssuerAsset[]>(
    () => (assetsQ.data?.underlyings ?? []).map((t) => ({ contractId: t.contractId, code: t.code, decimals: t.decimals, issuer: t.issuer })),
    [assetsQ.data],
  )
  // The asset is in the URL (`?asset=bond`, or a contract id when two listed assets share a code), so a reload or a
  // shared link opens the same one. The list can arrive after the first render: until something is picked, the
  // first asset the connected account issues, else the first listed.
  const search = useSearch({ strict: false }) as IssuerSearch
  const navigate = useNavigate()
  const picked = assetFromParam(assets, search.asset)
  const setPicked = useCallback(
    (contractId: string) => {
      const next = assets.find((a) => a.contractId === contractId)
      if (!next) return
      void navigate({ to: '/issuer', search: (prev: IssuerSearch) => ({ ...prev, asset: assetParamOf(assets, next) }), replace: true, resetScroll: false })
    },
    [assets, navigate],
  )
  const asset = pickAsset(assets, picked, live ? address : null)
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
  else if (!address || !live) issuer = null
  else if (deriveQ.isPending) issuer = undefined
  else issuer = deriveQ.data === true ? address : null

  const access = accessOf({ mock: isMock, address, issuer, checkFailed: needsDerive && deriveQ.isError })
  const isIssuer = access.kind === 'issuer'
  const otherIssued = live && !isIssuer && access.kind !== 'checking' ? otherIssuedAsset(assets, asset, address) : null

  // ---- the issuer account and the asset record
  const factsQ = useQuery({ queryKey: [KEY, 'facts', issuer ?? null], queryFn: () => net.readIssuer(issuer!), enabled: live && !!issuer })
  const recordQ = useQuery({
    queryKey: [KEY, 'record', asset?.code ?? null, issuer ?? null],
    queryFn: () => net.readRecord(asset!.code, issuer!),
    enabled: live && !!asset && !!issuer,
  })
  let flags: FlagsView
  if (isMock) flags = asset ? { status: 'ready', facts: mockAssetFacts(asset.code, asset.issuer ?? null).issuerInfo! } : { status: 'loading' }
  else if (issuer === undefined) flags = { status: 'loading' }
  else if (issuer === null) flags = { status: 'unknown-issuer' }
  else if (factsQ.isPending) flags = { status: 'loading' }
  else if (factsQ.isError) flags = { status: 'error', message: errorText(factsQ.error) }
  else if (!factsQ.data) flags = { status: 'missing' }
  else flags = { status: 'ready', facts: factsQ.data }

  // ---- rows: the Covered contract, the addresses typed in this session, and (for the issuer) Horizon's holders
  const [added, setAdded] = useState<Readonly<Record<string, readonly string[]>>>({})
  const addedHere: readonly string[] = isIssuer && assetId ? (added[assetId] ?? []) : []
  const targets = [...new Set([...(escrow ? [escrow] : []), ...addedHere])]
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
  const merged = mergeRows({ escrow, added: addedHere, holders: isIssuer ? (holdersQ.data?.rows ?? []) : [], reads })
  const escrowRow = merged.find((r) => r.escrow) ?? null
  const rows = merged.filter((r) => !r.escrow)

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

  const listed = merged.map((r) => r.address)
  const addAccount = (text: string): AddResult => {
    const result = checkNewAccount(text, listed)
    if (result.ok && assetId) setAdded((prev) => ({ ...prev, [assetId]: [result.address, ...(prev[assetId] ?? [])] }))
    return result
  }
  const removeAccount = (target: string): void => {
    if (assetId) setAdded((prev) => ({ ...prev, [assetId]: (prev[assetId] ?? []).filter((a) => a !== target) }))
  }

  // ---- what depends on the asset inside the Covered contract (the mock client answers these too)
  const optionsQ = useOptions({ cadence: 'slow' })
  const healthQ = useHealth()
  const options = optionsQ.data
  const healthLine = assetId ? healthQ.data?.find((h) => h.token.contractId === assetId) : undefined
  const escrowCounts = useMemo(() => (options && assetId ? escrowExposure(options, assetId) : null), [options, assetId])
  const exposureOf = useCallback((account: string) => (options && assetId ? accountExposure(options, assetId, account) : null), [options, assetId])
  const contract: ContractView = {
    address: escrow,
    row: escrowRow,
    held: healthLine?.held ?? escrowRow?.read?.balance ?? null,
    reserved: healthLine?.reserved ?? null,
    exposure: escrowCounts,
    loading: healthQ.isPending || optionsQ.isPending,
  }

  // ---- actions
  const txc = useTx({ mock: false })
  const pageBusy = useTxBusy()
  const lock = useRef(false) // synchronous guard: a state update is too late to stop a double click
  const [current, setCurrent] = useState<{ label: string; done: string; kind: IssuerActionKind; target: string } | null>(null)

  const { run, reset } = txc
  const sign = wallet.sign

  const start = useCallback(
    async (kind: IssuerActionKind, target: string, units?: bigint): Promise<TxState> => {
      if (lock.current || !asset || access.kind !== 'issuer') return TX_IDLE
      lock.current = true
      try {
        const input = { kind, asset, target, units }
        const label = actionLabel(input)
        setCurrent({ label, done: doneLabel(input), kind, target })
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

  // An unknown outcome can be resolved later (the automatic re-check, or a check from the log): read the rows
  // again when it is.
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
    done: idle ? null : (current?.done ?? null),
    kind: idle ? null : (current?.kind ?? null),
    target: idle ? null : (current?.target ?? null),
    working: txc.working,
    canCheckAgain: txc.canCheckAgain,
    checkAgain,
    dismiss,
  }

  // The persisted list, not only this page's transaction: an outcome left unknown before the page was left still
  // blocks every action until it is checked.
  const activity = useActivity()
  const log = useMemo(() => logRows(activity.entries, assetId), [activity.entries, assetId])
  const open = live ? openIssuerAction(activity.entries) : null
  const { check } = activity
  const checkLogged = useCallback(
    (id: string) => {
      void check(id).then(() => queryClient.invalidateQueries({ queryKey: [KEY] }))
    },
    [check, queryClient],
  )
  const unknown = txc.state.phase === 'unknown' || (open?.unknown ?? false)
  const busy = unknown ? COPY.reasons.unknownPending : pageBusy || txc.working || open !== null ? COPY.reasons.busy : null
  // The page's own unknown transaction is checked from its panel; one left from an earlier visit, from here.
  const unresolved = open?.unknown && txc.state.phase !== 'unknown' ? { id: open.id, check: () => checkLogged(open.id) } : null

  return {
    mock: isMock,
    assetsStatus: assetsQ.isPending ? 'loading' : assetsQ.isError ? 'error' : 'ready',
    assetsError: assetsQ.isError ? errorText(assetsQ.error) : null,
    retryAssets: () => void assetsQ.refetch(),
    assets,
    asset,
    selectAsset: setPicked,
    access,
    retryAccess: () => void deriveQ.refetch(),
    otherIssued,
    connect: () => void wallet.connect(),
    issuer,
    flags,
    retryFlags: () => void factsQ.refetch(),
    record: recordQ.data ?? null,
    contract,
    rows,
    holders,
    readAt,
    refreshing,
    refresh,
    addAccount,
    removeAccount,
    exposureOf,
    busy,
    unresolved,
    tx,
    authorize,
    freeze,
    clawback,
    log,
    checkLogged,
  }
}
