// One hook per resource read from the Covered contract (and the few reads beside it). They replace the single
// 10 s poll of the old app: a resource is fetched only while a mounted component reads it, at the interval that
// suits it, and two readers share one request.
//
// Every list hook takes a `cadence`: 'book' (10 s), 'slow' (60 s) or 'off' (focus and invalidation only). The
// default is what a screen that shows the resource needs. The shell passes 'slow' for anything it reads on
// every route (the navigation badge), so the book is polled fast only while a route that shows it is mounted.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchAssetFacts, fetchHolderStatus, mockAssetFacts } from '../core/assetfacts/assetFacts'
import type { AssetFacts, HolderStatus } from '../core/assetfacts/assetFacts'
import type { OptionsClient } from '../core/options/client'
import { isMockMode } from '../core/options/createClient'
import type { Ask, CollateralHealth, CollateralLine, OptionOffer, SupportedAssets, TokenInfo } from '../core/options/types'
import { noReference, referenceFor } from '../core/reference'
import type { ReferencePrice } from '../core/reference'
import type { Bid } from '../core/requests/types'
import { readLatestLedger } from '../core/stellar/ledger'
import type { LatestLedger } from '../core/stellar/ledger'
import { balancesById, isMockToken } from '../core/stellar/tokens'
import type { TokenBalance } from '../core/stellar/tokens'
import { noteLedgerTime } from './clock'
import { keys } from './keys'
import { POLL_MS, STALE_MS, intervalOf } from './queryClient'
import type { Cadence } from './queryClient'
import { useOptionsClient } from './useOptionsClient'

export interface ReadOptions {
  /** How often to refetch while mounted. See the default of each hook. */
  cadence?: Cadence
  /** Set false to keep the hook mounted without reading. Default true. */
  enabled?: boolean
}

type GetClient = () => Promise<OptionsClient>

// ------------------------------------------------------------------------------------------- query definitions
// Shared by the hooks and by `fetchQuery` callers (the pre-trade re-check), so both use the same key and reader.

export const coveredQueries = {
  assets: (getClient: GetClient) => ({ queryKey: keys.assets(), queryFn: async (): Promise<SupportedAssets> => (await getClient()).supportedAssets() }),
  options: (getClient: GetClient) => ({ queryKey: keys.options(), queryFn: async (): Promise<OptionOffer[]> => (await getClient()).listOptions() }),
  asks: (getClient: GetClient) => ({ queryKey: keys.asks(), queryFn: async (): Promise<Ask[] | null> => (await getClient()).listAsks() }),
  bids: (getClient: GetClient) => ({ queryKey: keys.bids(), queryFn: async (): Promise<Bid[] | null> => (await getClient()).listBids() }),
  collateral: (getClient: GetClient) => ({ queryKey: keys.collateral(), queryFn: async (): Promise<CollateralLine[]> => (await getClient()).openCollateral() }),
  health: (getClient: GetClient) => ({ queryKey: keys.health(), queryFn: async (): Promise<CollateralHealth[]> => (await getClient()).collateralHealth() }),
  option: (getClient: GetClient, id: bigint) => ({ queryKey: keys.option(id), queryFn: async (): Promise<OptionOffer> => (await getClient()).getOption(id) }),
  ask: (getClient: GetClient, id: bigint) => ({ queryKey: keys.ask(id), queryFn: async (): Promise<bigint | null> => (await getClient()).getAsk(id) }),
  bid: (getClient: GetClient, id: bigint) => ({ queryKey: keys.bid(id), queryFn: async (): Promise<Bid> => (await getClient()).getBid(id) }),
  balances: (getClient: GetClient, address: string, tokens?: TokenInfo[]) => ({
    queryKey: keys.balancesFor(address, tokens),
    queryFn: async (): Promise<TokenBalance[]> => (await getClient()).balances(address, tokens),
  }),
  eligibility: (getClient: GetClient, token: string, address: string) => ({
    queryKey: keys.eligibility(token, address),
    queryFn: async (): Promise<boolean> => (await getClient()).isEligible(token, address),
  }),
  writerOpenCount: (getClient: GetClient, address: string) => ({
    queryKey: keys.writerOpenCount(address),
    queryFn: async (): Promise<number | null> => (await getClient()).writerOpenCount(address),
  }),
  buyerOpenCount: (getClient: GetClient, address: string) => ({
    queryKey: keys.buyerOpenCount(address),
    queryFn: async (): Promise<number | null> => (await getClient()).buyerOpenCount(address),
  }),
}

/** A key part for a hook that is mounted without an id. Never fetched. */
const NONE = 'none'

// ------------------------------------------------------------------------------------------- contract lists

/** The quote token and the listed underlyings. Slow (60 s): a new listing is rare. */
export function useAssets(opts: ReadOptions = {}): UseQueryResult<SupportedAssets> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.assets(getClient), staleTime: STALE_MS.facts, refetchInterval: intervalOf(opts.cadence ?? 'slow'), enabled: opts.enabled ?? true })
}

/** Every option of the contract, in every state. Book data (10 s). The source of markets, positions and to-dos. */
export function useOptions(opts: ReadOptions = {}): UseQueryResult<OptionOffer[]> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.options(getClient), staleTime: STALE_MS.book, refetchInterval: intervalOf(opts.cadence ?? 'book'), enabled: opts.enabled ?? true })
}

/** Resale listings. `data` is null when the contract has no resale (before v1.4). Book data (10 s). */
export function useAsks(opts: ReadOptions = {}): UseQueryResult<Ask[] | null> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.asks(getClient), staleTime: STALE_MS.book, refetchInterval: intervalOf(opts.cadence ?? 'book'), enabled: opts.enabled ?? true })
}

/** Buyer requests (funded bids). `data` is null when the contract has no bids (before v1.5). Book data (10 s). */
export function useBids(opts: ReadOptions = {}): UseQueryResult<Bid[] | null> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.bids(getClient), staleTime: STALE_MS.book, refetchInterval: intervalOf(opts.cadence ?? 'book'), enabled: opts.enabled ?? true })
}

/** What the contract holds per token, split by state (offered, active, pending reclaim, unclaimed, escrowed). Slow (60 s). */
export function useCollateral(opts: ReadOptions = {}): UseQueryResult<CollateralLine[]> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.collateral(getClient), staleTime: STALE_MS.slow, refetchInterval: intervalOf(opts.cadence ?? 'slow'), enabled: opts.enabled ?? true })
}

/** Reserved against held per token (`open_collateral` against the contract's token balance). Slow (60 s). */
export function useHealth(opts: ReadOptions = {}): UseQueryResult<CollateralHealth[]> {
  const { getClient } = useOptionsClient()
  return useQuery({ ...coveredQueries.health(getClient), staleTime: STALE_MS.slow, refetchInterval: intervalOf(opts.cadence ?? 'slow'), enabled: opts.enabled ?? true })
}

// ------------------------------------------------------------------------------------------- per account

/**
 * Balances of `address` for `tokens` (default: the quote token and every listed underlying). Disabled without an
 * address. Slow (60 s), and refreshed after every transaction of the wallet. Mock mode returns the demo ledger.
 */
export function useBalances(address: string | null | undefined, tokens?: TokenInfo[], opts: ReadOptions = {}): UseQueryResult<TokenBalance[]> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...coveredQueries.balances(getClient, address ?? NONE, tokens),
    staleTime: STALE_MS.book,
    refetchInterval: intervalOf(opts.cadence ?? 'slow'),
    enabled: (opts.enabled ?? true) && !!address,
  })
}

/** The same read as `useBalances`, keyed by token contract id (the shape the pre-trade checks read). */
export function useBalancesById(address: string | null | undefined, tokens?: TokenInfo[], opts: ReadOptions = {}): UseQueryResult<Record<string, TokenBalance>> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...coveredQueries.balances(getClient, address ?? NONE, tokens),
    staleTime: STALE_MS.book,
    refetchInterval: intervalOf(opts.cadence ?? 'slow'),
    enabled: (opts.enabled ?? true) && !!address,
    select: balancesById,
  })
}

/** `is_eligible(token, address)`: the issuer has authorized this account for the asset. Disabled without both. */
export function useEligibility(token: string | null | undefined, address: string | null | undefined, opts: ReadOptions = {}): UseQueryResult<boolean> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...coveredQueries.eligibility(getClient, token ?? NONE, address ?? NONE),
    staleTime: STALE_MS.slow,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && !!token && !!address,
  })
}

/** Open offers of a writer against the cap of 50. `data` is null when the contract has no cap (before v1.3). */
export function useWriterOpenCount(address: string | null | undefined, opts: ReadOptions = {}): UseQueryResult<number | null> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...coveredQueries.writerOpenCount(getClient, address ?? NONE),
    staleTime: STALE_MS.book,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && !!address,
  })
}

/** Open requests of a buyer against the cap of 50. `data` is null when the contract has no bids (before v1.5). */
export function useBuyerOpenCount(address: string | null | undefined, opts: ReadOptions = {}): UseQueryResult<number | null> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...coveredQueries.buyerOpenCount(getClient, address ?? NONE),
    staleTime: STALE_MS.book,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && !!address,
  })
}

// ------------------------------------------------------------------------------------------- one entity, re-read

const fromList = <T extends { id: bigint }>(qc: QueryClient, key: readonly unknown[], id: bigint | null | undefined): T | undefined =>
  id == null ? undefined : qc.getQueryData<T[] | null>(key)?.find((x) => x.id === id)

/**
 * One option, re-read from the chain (never served stale). Until the read lands, `data` is the copy from the
 * option list when there is one and `isPlaceholderData` is true: show it, but do not treat it as re-checked.
 */
export function useOption(id: bigint | null | undefined, opts: ReadOptions = {}): UseQueryResult<OptionOffer> {
  const { getClient } = useOptionsClient()
  const qc = useQueryClient()
  return useQuery({
    ...(id == null ? { queryKey: keys.option(NONE), queryFn: (): Promise<OptionOffer> => Promise.reject(new Error('No option id')) } : coveredQueries.option(getClient, id)),
    staleTime: 0,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && id != null,
    placeholderData: () => fromList<OptionOffer>(qc, keys.options(), id),
  })
}

/** One request (bid), re-read from the chain. Placeholder from the bid list, as `useOption`. */
export function useBid(id: bigint | null | undefined, opts: ReadOptions = {}): UseQueryResult<Bid> {
  const { getClient } = useOptionsClient()
  const qc = useQueryClient()
  return useQuery({
    ...(id == null ? { queryKey: keys.bid(NONE), queryFn: (): Promise<Bid> => Promise.reject(new Error('No request id')) } : coveredQueries.bid(getClient, id)),
    staleTime: 0,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && id != null,
    placeholderData: () => fromList<Bid>(qc, keys.bids(), id),
  })
}

/** The live resale ask of an option in quote units, re-read from the chain. `data` is null when it is not listed. */
export function useAsk(id: bigint | null | undefined, opts: ReadOptions = {}): UseQueryResult<bigint | null> {
  const { getClient } = useOptionsClient()
  return useQuery({
    ...(id == null ? { queryKey: keys.ask(NONE), queryFn: (): Promise<bigint | null> => Promise.resolve(null) } : coveredQueries.ask(getClient, id)),
    staleTime: 0,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && id != null,
  })
}

// ------------------------------------------------------------------------------------------- beside the contract

/**
 * The network's latest ledger (sequence and close time), every 30 s, over plain fetch (no SDK). Disabled in mock
 * mode: there is no chain to read, and `data` stays undefined.
 */
export function useLedger(opts: ReadOptions = {}): UseQueryResult<LatestLedger> {
  return useQuery({
    queryKey: keys.ledger(),
    // The close time also corrects the app's clock when the device is off (data/clock).
    queryFn: () => readLatestLedger().then((l) => (noteLedgerTime(l.closeTime), l)),
    staleTime: STALE_MS.ledger,
    refetchInterval: opts.cadence === 'off' ? false : POLL_MS.ledger,
    enabled: (opts.enabled ?? true) && !isMockMode(),
  })
}

/**
 * Issuer flags, issuer account and asset record of a token, from the RPC and Horizon. A mock token has no issuer
 * account: it answers with fixture flags marked `mock: true` (no counts), so the demo can show a power on and off.
 */
export function useAssetFacts(token: { contractId: string; code: string; issuer?: string | null } | null | undefined, opts: ReadOptions = {}): UseQueryResult<AssetFacts> {
  const id = token?.contractId
  const code = token?.code ?? ''
  const issuer = token?.issuer ?? null
  return useQuery({
    queryKey: keys.assetFacts(id ?? NONE),
    queryFn: () => (isMockToken(id!) ? Promise.resolve(mockAssetFacts(code, issuer)) : fetchAssetFacts(id!, code)),
    staleTime: STALE_MS.facts,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && !!id,
  })
}

/**
 * The trustline of `address` for a classic asset, from Horizon: `authorized`, `maintain-only`, `unauthorized`,
 * `no-trustline`, `unfunded`, or `issuer`. Disabled without an issuer or an address, and for mock tokens.
 * For "can this account trade the asset" use `useEligibility` (the contract's own answer); this one explains why not.
 */
export function useHolderStatus(
  token: { contractId: string; code: string; issuer?: string | null } | null | undefined,
  address: string | null | undefined,
  opts: ReadOptions = {},
): UseQueryResult<HolderStatus> {
  const code = token?.code ?? ''
  const issuer = token?.issuer ?? ''
  return useQuery({
    queryKey: keys.holderStatus(code || NONE, issuer || NONE, address ?? NONE),
    queryFn: () => fetchHolderStatus(code, issuer, address!),
    staleTime: STALE_MS.slow,
    refetchInterval: intervalOf(opts.cadence ?? 'off'),
    enabled: (opts.enabled ?? true) && !!token && !!issuer && !!address && !isMockToken(token.contractId),
  })
}

/** The provider mode of reference prices in this build. */
export const referenceMode = (): 'mock' | 'testnet' => (isMockMode() ? 'mock' : 'testnet')

/**
 * The reference price of an asset (brief D12): the demo price in mock mode, the fixed Testnet faucet rate for the
 * listed assets in live mode, `none` otherwise. Always show it with `reference.label` and `reference.note`; it is
 * never a market price. Synchronous today; a hook so that a tracked desk price can replace it later.
 */
export function useReference(asset: { contractId: string; code: string } | null | undefined): ReferencePrice {
  const quoteDecimals = useAssets().data?.quote.decimals ?? 7
  const id = asset?.contractId
  const code = asset?.code
  return useMemo(() => (id && code ? referenceFor({ contractId: id, code }, referenceMode(), quoteDecimals) : noReference()), [id, code, quoteDecimals])
}
