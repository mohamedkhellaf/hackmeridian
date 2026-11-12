// Derived views: thin hooks over the pure selectors in ./derived/. Each one reads the per-resource queries it
// needs, so a screen mounts exactly the reads it shows, and returns one `Derived<T>` with a single loading,
// error and "last refresh failed" state for the whole view.
//
// Every result is memoised on the query data. Structural sharing keeps that data identical between polls that
// find nothing new, so these views (and the components under them) only recompute when the chain or the clock
// (a 10 or 30 second step) moves.
import type { UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { resolveAssetParam, tierOf } from '../core/assets'
import type { AssetNetwork, AssetTier } from '../core/assets'
import type { SeriesRef } from '../core/market/selection'
import type { OptionOffer, SupportedAssets, TokenInfo } from '../core/options/types'
import type { GuidedIntent } from '../core/payoff/strategies'
import type { PortfolioSummary } from '../core/portfolio/positions'
import { referenceFor } from '../core/reference'
import type { ReferencePrice } from '../core/reference'
import { useNowSec } from './clock'
import { matchGuided } from './derived/guided'
import type { GuidedMatch } from './derived/guided'
import { buildBook, buildMarket, buildMarketIndex } from './derived/market'
import type { BookView, MarketIndexRow, MarketSource, MarketView } from './derived/market'
import { buildKpis, buildPositions, buildRequestTodo, buildTodo, countActionsWaiting, positionView } from './derived/positions'
import type { PositionView, PositionsView, RequestTodoView, TodoView } from './derived/positions'
import { referenceMode, useAsks, useAssets, useBids, useOption, useOptions, useReference } from './queries'
import type { Cadence } from './queryClient'
import { useOptionsClient } from './useOptionsClient'

export interface Derived<T> {
  /** The view, or null until its first reads are in (or when it has no subject: no wallet, an unknown asset). */
  data: T | null
  /** The first reads are still running. Show the skeleton. */
  isLoading: boolean
  /** The first reads failed and there is nothing to show. Show the error state with `retry`. */
  isError: boolean
  /** The last refresh failed but earlier data is shown. Say so ("Could not refresh") instead of hiding it. */
  refreshFailed: boolean
  error: string | null
  /** When the oldest read behind the view landed (milliseconds since the epoch), or null. */
  updatedAt: number | null
  /** Reads everything behind the view again. */
  retry: () => void
}

type AnyQuery = Pick<UseQueryResult<unknown>, 'data' | 'isPending' | 'isError' | 'error' | 'dataUpdatedAt' | 'refetch' | 'fetchStatus'>

const message = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : 'Could not load data.')

/**
 * One status for a view built from several queries. `required` queries must have data before the view exists;
 * `optional` ones (asks and bids, absent on older contracts) only have to have answered, with data or an error.
 */
export function combineStatus(required: AnyQuery[], optional: AnyQuery[] = []): Omit<Derived<never>, 'data'> & { ready: boolean } {
  const all = [...required, ...optional]
  // A disabled query (no id, no wallet) is not waiting for anything: the view simply has no subject.
  const idle = (q: AnyQuery) => q.isPending && q.fetchStatus === 'idle'
  const missing = required.filter((q) => q.data === undefined && !idle(q))
  const failed = missing.find((q) => q.isError)
  const waiting = missing.some((q) => !q.isError) || optional.some((q) => q.isPending && !idle(q))
  const ready = missing.length === 0 && !waiting
  const stale = all.find((q) => q.isError && q.data !== undefined) ?? optional.find((q) => q.isError)
  const times = all.map((q) => q.dataUpdatedAt).filter((t) => t > 0)
  return {
    ready,
    isLoading: !ready && !failed,
    isError: !!failed,
    refreshFailed: ready && !!stale,
    error: failed ? message(failed.error) : stale ? message(stale.error) : null,
    updatedAt: times.length ? Math.min(...times) : null,
    retry: () => {
      for (const q of all) void q.refetch()
    },
  }
}

export interface ViewOptions {
  /** How often the lists behind the view are polled while it is mounted. Default 'book' (10 s). */
  cadence?: Cadence
}

const idOf = (asset: string | { contractId: string } | null | undefined): string | null => (typeof asset === 'string' ? asset : (asset?.contractId ?? null))

/** The reference price of an option's underlying in this build's mode. A module constant, so it is stable in memo keys. */
export const optionReference = (o: OptionOffer): ReferencePrice => referenceFor(o.underlying, referenceMode(), o.quote.decimals)
const assetReference = (quoteDecimals: number) => (asset: TokenInfo): ReferencePrice => referenceFor(asset, referenceMode(), quoteDecimals)

/**
 * The option, ask and bid lists as one source for the selectors, with their combined status. With `enabled`
 * false nothing is read (a portfolio view without a wallet): the queries stay idle and the view has no subject.
 */
function useSource(me: string | null, cadence: Cadence, stepSec: number, enabled: boolean = true) {
  const options = useOptions({ cadence, enabled })
  const asks = useAsks({ cadence, enabled })
  const bids = useBids({ cadence, enabled })
  const nowSec = useNowSec(stepSec)
  const optionList = options.data
  const askList = asks.data ?? null
  const bidList = bids.data ?? null
  // `null` is the contract's answer "no such feature"; `undefined` is a read that has not landed yet.
  const bidsOn = bids.data !== null
  const resaleOn = asks.data !== null
  const source = useMemo<MarketSource | null>(
    () => (optionList ? { options: optionList, asks: askList, bids: bidList, me, nowSec, bidsOn, resaleOn } : null),
    [optionList, askList, bidList, me, nowSec, bidsOn, resaleOn],
  )
  return { source, options, asks, bids }
}

// ------------------------------------------------------------------------------------------- one asset

export interface AssetRoute {
  /**
   *   found    the segment names an asset the contract lists: `token` is set
   *   unknown  well formed, but the contract lists no such asset
   *   invalid  not a slug, a CODE-ISSUER pair or a contract id: render a fixed "no such asset" view and never echo it
   */
  status: 'found' | 'unknown' | 'invalid'
  token: TokenInfo | null
  /** The contract's quote token. */
  quote: TokenInfo
  /** The canonical `$asset` segment of the asset; replace the URL with it when `isCanonical` is false. */
  canonical: string | null
  isCanonical: boolean
  /** `Reference`, `Domain-linked` or `No domain link`; null when not found. */
  tier: AssetTier | null
  /** `Fund share`, `Bond`, `Equity` for a reference asset, else null. */
  typeLabel: string | null
}

/** Resolves a `$asset` segment against the reference list and the listed tokens. Pure, for tests. */
export function resolveAssetRoute(param: string, listed: SupportedAssets, network: AssetNetwork): AssetRoute {
  const base = { quote: listed.quote, canonical: null, isCanonical: false, tier: null, typeLabel: null, token: null }
  const r = resolveAssetParam(param, network, listed.underlyings)
  if (r.status === 'invalid') return { ...base, status: 'invalid' }
  // A reference asset the contract does not list (yet) has no market: it is unknown here.
  const token = r.status === 'found' ? (listed.underlyings.find((t) => t.contractId === r.contractId) ?? null) : null
  if (r.status !== 'found' || !token) return { ...base, status: 'unknown' }
  return { status: 'found', token, quote: listed.quote, canonical: r.canonical, isCanonical: r.isCanonical, tier: tierOf(token), typeLabel: r.reference?.typeLabel ?? null }
}

/**
 * The asset a `/markets/$asset` URL names: a slug (`bond`), `CODE-ISSUER` or a contract id, resolved with
 * core/assets against the tokens the contract lists. `data.token.contractId` is the id every other hook takes.
 * `data` is null while the asset list loads (or without a param); once loaded it always has a `status`.
 */
export function useAsset(param: string | null | undefined): Derived<AssetRoute> {
  const assets = useAssets()
  const listed = assets.data
  const data = useMemo(() => (listed && param ? resolveAssetRoute(param, listed, referenceMode()) : null), [listed, param])
  const status = combineStatus([assets])
  return { ...status, data: status.ready ? data : null }
}

// ------------------------------------------------------------------------------------------- markets

/**
 * The market of one asset on the standard grid: listed expiries, the strike ladder, one cell per series with the
 * best premium and the number of makers, the off-grid "other" orders with their reason, and the asset's bids.
 * `asset` is the underlying contract id (or a token). `data` is null for an id the contract does not list.
 */
export function useMarket(asset: string | { contractId: string } | null | undefined, opts: ViewOptions = {}): Derived<MarketView> {
  const { me } = useOptionsClient()
  const id = idOf(asset)
  const assets = useAssets()
  const { source, options, asks, bids } = useSource(me, opts.cadence ?? 'book', 30)
  const token = useMemo(() => assets.data?.underlyings.find((t) => t.contractId === id) ?? null, [assets.data, id])
  const quote = assets.data?.quote ?? null
  const reference = useReference(token)
  const data = useMemo(() => (source && token && quote ? buildMarket(source, token, quote, reference) : null), [source, token, quote, reference])
  const status = combineStatus([assets, options], [asks, bids])
  return { ...status, data: status.ready ? data : null }
}

/**
 * One row per listed asset for the Markets index: tier, reference price, open offers, nearest expiry, lowest put
 * and call premium per unit. Reference assets come first; filter on `isReference` for the default list.
 */
export function useMarketsIndex(opts: ViewOptions = {}): Derived<MarketIndexRow[]> {
  const { me } = useOptionsClient()
  const assets = useAssets()
  const { source, options, asks, bids } = useSource(me, opts.cadence ?? 'book', 30)
  const listed = assets.data
  const data = useMemo(
    () => (source && listed ? buildMarketIndex(source, listed.underlyings, listed.quote, referenceMode(), assetReference(listed.quote.decimals)) : null),
    [source, listed],
  )
  const status = combineStatus([assets, options], [asks, bids])
  return { ...status, data: status.ready ? data : null }
}

/**
 * The two-sided book of one exact series (a chain cell, or the series of an off-grid order): bids highest first,
 * offers and resale listings lowest first, each row with its source, what the wallet can do with it and whether
 * it is the wallet's own; the best offer and bid the wallet can take; the ticket prefill.
 */
export function useBook(series: SeriesRef | null | undefined, opts: ViewOptions = {}): Derived<BookView> {
  const market = useMarket(series?.underlyingId, opts)
  const { me } = useOptionsClient()
  const options = useOptions({ cadence: opts.cadence ?? 'book' })
  const asks = useAsks({ cadence: opts.cadence ?? 'book' })
  const bids = useBids({ cadence: opts.cadence ?? 'book' })
  const nowSec = useNowSec(10)
  const view = market.data
  const optionList = options.data
  const askList = asks.data ?? null
  const bidList = bids.data ?? null
  const expiry = series?.expiry
  const kind = series?.kind
  const strike = series?.strikePerUnit
  const underlyingId = series?.underlyingId
  const data = useMemo(() => {
    if (!view || !optionList || expiry === undefined || kind === undefined || strike === undefined || underlyingId === undefined) return null
    const ref: SeriesRef = { underlyingId, expiry, kind, strikePerUnit: strike }
    return buildBook({ options: optionList, asks: askList, bids: bidList, me, nowSec }, ref, view.quote, view.ladder, view.expiries)
  }, [view, optionList, askList, bidList, me, nowSec, expiry, kind, strike, underlyingId])
  return { ...market, data }
}

/**
 * The best funded order for guided terms: for the two buying intents the cheapest offer (or listing) for exactly
 * this series and quantity, for the two earning intents the highest funded bid; plus the nearest alternatives and
 * which strike and expiry chips have something funded behind them. `qty` is in underlying units, `strike` is per
 * unit in quote units, `expiry` in unix seconds; any of them may be null while the user has not chosen.
 */
export function useGuidedMatch(
  asset: string | { contractId: string } | null | undefined,
  intent: GuidedIntent,
  qty: bigint | null,
  strike: bigint | null,
  expiry: number | null,
  opts: ViewOptions = {},
): Derived<GuidedMatch> {
  const { me } = useOptionsClient()
  const id = idOf(asset)
  const assets = useAssets()
  const { source, options, asks, bids } = useSource(me, opts.cadence ?? 'book', 30)
  const token = useMemo(() => assets.data?.underlyings.find((t) => t.contractId === id) ?? null, [assets.data, id])
  const quote = assets.data?.quote ?? null
  const reference = useReference(token)
  const data = useMemo(
    () => (source && token && quote ? matchGuided(source, token, quote, reference, { intent, qty, strikePerUnit: strike, expiry }) : null),
    [source, token, quote, reference, intent, qty, strike, expiry],
  )
  const status = combineStatus([assets, options], [asks, bids])
  return { ...status, data: status.ready ? data : null }
}

// ------------------------------------------------------------------------------------------- portfolio

export interface PortfolioOptions extends ViewOptions {
  /** Include positions and orders with nothing left to do. Default false. */
  showClosed?: boolean
}

/**
 * The connected wallet's portfolio in its three tabs: `holding`, `written`, `orders` (offers without a buyer,
 * requests, resale listings), each row with its status, counterparty line, the action it allows, its deadline
 * urgency and, for an active option, its moneyness at the reference price. `me` defaults to the connected wallet;
 * `data` is null without one.
 */
export function usePositions(me?: string | null, opts: PortfolioOptions = {}): Derived<PositionsView> {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const { source, options, asks, bids } = useSource(who, opts.cadence ?? 'book', 10, !!who)
  const showClosed = opts.showClosed ?? false
  const data = useMemo(() => (source && who ? buildPositions({ ...source, referenceOf: optionReference }, showClosed) : null), [source, who, showClosed])
  const status = combineStatus([options], [asks, bids])
  return { ...status, data: status.ready ? data : null }
}

export interface PositionDetail {
  /** The option re-read from the chain (or its copy from the list until that read lands). */
  option: OptionOffer
  /** The wallet's view of it; null when the wallet is neither its writer nor its holder. */
  position: PositionView | null
  /** True once the option was read from the chain itself, not only taken from the list. */
  fresh: boolean
}

/** True for the message of a read that failed because the id does not exist (as against a network failure). */
export const isNotFoundMessage = (message: string | null): boolean => !!message && /not found|no such|does not exist/i.test(message)

/**
 * One option for the position page, re-read every 10 s while mounted. A guest gets the option with
 * `position: null`. For an id the contract does not have, `isError` and `notFound` are both true: show
 * "No such position", not a retry.
 */
export function usePosition(id: bigint | null | undefined, me?: string | null, opts: ViewOptions = {}): Derived<PositionDetail> & { notFound: boolean } {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const option = useOption(id, { cadence: opts.cadence ?? 'book' })
  const asks = useAsks({ cadence: opts.cadence ?? 'book' })
  const nowSec = useNowSec(10)
  const o = option.data
  const askList = asks.data ?? null
  const fresh = !option.isPlaceholderData
  const data = useMemo<PositionDetail | null>(
    () => (o ? { option: o, position: positionView(o, { asks: askList, me: who, nowSec, referenceOf: optionReference }), fresh } : null),
    [o, askList, who, nowSec, fresh],
  )
  const status = combineStatus([option], [asks])
  return { ...status, data: status.ready ? data : null, notFound: status.isError && isNotFoundMessage(status.error) }
}

/**
 * The to-do strip (brief 4.5), most pressing first. Each item has a `tone`: `urgent` only for an exercise that
 * is in the money at the reference price within 48 hours of its deadline; `action` for claims, reclaims and
 * in-the-money exercises further out; `neutral` for an exercise reminder that is not in the money (or has no
 * reference); `info` for an option that expired unexercised.
 */
export function useTodo(me?: string | null, opts: ViewOptions = {}): Derived<TodoView[]> {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const options = useOptions({ cadence: opts.cadence ?? 'book', enabled: !!who })
  const nowSec = useNowSec(10)
  const list = options.data
  const data = useMemo(() => (list && who ? buildTodo(list, who, nowSec, optionReference) : null), [list, who, nowSec])
  const status = combineStatus([options])
  return { ...status, data: status.ready ? data : null }
}

/**
 * The wallet's expired requests whose premium is still escrowed (review finding 11): each is a real action,
 * "take back" by cancelling, with no deadline of its own. Oldest deadline first.
 */
export function useRequestTodo(me?: string | null, opts: ViewOptions = {}): Derived<RequestTodoView[]> {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const bids = useBids({ cadence: opts.cadence ?? 'book', enabled: !!who })
  const list = bids.data
  const data = useMemo(() => (who ? buildRequestTodo(list ?? [], who) : null), [list, who])
  const status = combineStatus([bids])
  return { ...status, data: status.ready ? data : null }
}

/**
 * The number for the Portfolio navigation badge: claims, reclaims, in-the-money exercises and expired requests
 * whose premium waits to be taken back. Zero while loading or without a wallet. Polls slowly (60 s) because the
 * shell mounts it on every route.
 */
export function useActionsWaiting(me?: string | null, opts: ViewOptions = {}): number {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const options = useOptions({ cadence: opts.cadence ?? 'slow', enabled: !!who })
  const bids = useBids({ cadence: opts.cadence ?? 'slow', enabled: !!who })
  const nowSec = useNowSec(30)
  const list = options.data
  const bidList = bids.data
  return useMemo(() => (list && who ? countActionsWaiting(list, who, nowSec, optionReference, bidList ?? []) : 0), [list, bidList, who, nowSec])
}

/**
 * Portfolio summary figures, exact sums per token: premium paid and earned, collateral locked, unclaimed proceeds,
 * and with the wallet's requests (read alongside) `escrowed`, `lockedNow` and `readyToTakeBack` (ruling E20).
 */
export function usePortfolioKpis(me?: string | null, opts: ViewOptions = {}): Derived<PortfolioSummary> {
  const client = useOptionsClient()
  const who = me === undefined ? client.me : me
  const options = useOptions({ cadence: opts.cadence ?? 'book', enabled: !!who })
  const bids = useBids({ cadence: opts.cadence ?? 'book', enabled: !!who })
  const list = options.data
  const bidList = bids.data
  const data = useMemo(() => (list && who ? buildKpis(list, who, bidList ?? []) : null), [list, bidList, who])
  const status = combineStatus([options], [bids])
  return { ...status, data: status.ready ? data : null }
}
