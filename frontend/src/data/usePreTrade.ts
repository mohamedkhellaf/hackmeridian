// The pre-trade re-check as a hook: `core/options/preTrade.ts` fed from the query cache.
//
// While the ticket is open, the facts a trade depends on are read (the option or bid itself, eligibility,
// balances, reserves, caps) and `preTrade` turns them into issues, the three status lines and the amounts that
// move. A fact still being read is `undefined` (the lines say "Checking"); a read that failed is `'unknown'`
// and never blocks, because the contract is the final check. `recheck()` reads everything again, fresh, right
// before the wallet is asked.
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { OptionsClient } from '../core/options/client'
import { preTrade, tokensFor } from '../core/options/preTrade'
import type { Fact, PreTradeAction, PreTradeFacts, PreTradeResult } from '../core/options/preTrade'
import type { CollateralHealth, TokenInfo } from '../core/options/types'
import type { PriceInput } from '../core/reference'
import { balancesById } from '../core/stellar/tokens'
import type { TokenBalance } from '../core/stellar/tokens'
import { nowSec as clockNow } from '../core/time'
import { useNowSec } from './clock'
import { coveredQueries, useAsk, useBalancesById, useBid, useBuyerOpenCount, useEligibility, useHealth, useOption, useOptions, useReference, useWriterOpenCount } from './queries'
import { useOptionsClient } from './useOptionsClient'

export interface PreTradeOptions {
  /**
   * The price an exercise is judged against: a `ReferencePrice` or the user's assumed price per unit. Default:
   * the asset's reference price. It only adds a warning; pass null to leave it out.
   */
  reference?: PriceInput
  /** Set false to keep the hook mounted without reading (a closed ticket). */
  enabled?: boolean
}

export interface PreTradeView extends PreTradeResult {
  /** The facts the result was computed from. */
  facts: PreTradeFacts
  /**
   * Reads every fact again from the chain and resolves with the fresh result. Call it when the user confirms,
   * before starting the transaction, and stop when it is `blocked`.
   */
  recheck: () => Promise<PreTradeResult>
}

const NO_BALANCES: Record<string, TokenBalance> = {}
const NO_HEALTH: CollateralHealth[] = []

export const underlyingOf = (action: PreTradeAction): TokenInfo =>
  action.type === 'buy' ? action.offer.underlying : action.type === 'fill-bid' ? action.bid.underlying : action.type === 'write-offer' ? action.offer.underlying : action.type === 'post-bid' ? action.bid.underlying : action.option.underlying

/** The option an action re-reads, if any. */
export const optionIdOf = (action: PreTradeAction): bigint | null =>
  action.type === 'buy' ? action.offer.id : action.type === 'buy-resale' || action.type === 'exercise' || action.type === 'list-for-sale' ? action.option.id : null

export const needsEligibility = (action: PreTradeAction): boolean => action.type !== 'exercise' && action.type !== 'list-for-sale'

/** A query as a pre-trade fact: `undefined` while reading (or showing a placeholder), `'unknown'` when the read failed. */
export function factOf<T>(q: Pick<UseQueryResult<T>, 'data' | 'isError' | 'isPlaceholderData'>, wanted: boolean): Fact<T> {
  if (!wanted) return undefined
  if (q.isError) return 'unknown'
  if (q.isPlaceholderData || q.data === undefined) return undefined
  return q.data
}

/**
 * Reads the facts of an action through the cache, always fresh (`staleTime: 0`), so the hooks that show them
 * update too. A read that fails becomes `'unknown'`; nothing here throws. Mirrors `readPreTradeFacts`.
 */
export async function readFreshFacts(qc: QueryClient, getClient: () => Promise<OptionsClient>, action: PreTradeAction, me: string | null, nowSec: number = clockNow()): Promise<PreTradeFacts> {
  const facts: PreTradeFacts = { me, nowSec }
  const jobs: Promise<unknown>[] = []
  const read = <T>(query: { queryKey: readonly unknown[]; queryFn: () => Promise<T> }, set: (v: T | 'unknown') => void) =>
    jobs.push(
      qc
        .fetchQuery({ ...query, staleTime: 0, retry: false })
        .catch((): 'unknown' => 'unknown')
        .then(set),
    )
  const optionId = optionIdOf(action)
  if (optionId !== null) read(coveredQueries.option(getClient, optionId), (v) => (facts.option = v))
  if (action.type === 'buy-resale') read(coveredQueries.ask(getClient, action.option.id), (v) => (facts.liveAsk = v))
  if (action.type === 'fill-bid') read(coveredQueries.bid(getClient, action.bid.id), (v) => (facts.bid = v))
  read(coveredQueries.health(getClient), (v) => (facts.health = v === 'unknown' ? [] : v))
  if (me) {
    if (needsEligibility(action)) read(coveredQueries.eligibility(getClient, underlyingOf(action).contractId, me), (v) => (facts.eligible = v))
    const tokens = tokensFor(action)
    if (tokens.length > 0) read(coveredQueries.balances(getClient, me, tokens), (v) => (facts.balances = v === 'unknown' ? {} : balancesById(v)))
    if (action.type === 'write-offer') read(coveredQueries.writerOpenCount(getClient, me), (v) => (facts.writerOpenCount = v))
    if (action.type === 'post-bid') read(coveredQueries.buyerOpenCount(getClient, me), (v) => (facts.buyerOpenCount = v))
  }
  if (action.type === 'write-offer') read(coveredQueries.options(getClient), (v) => (facts.openOffers = v === 'unknown' ? undefined : v.filter((o) => o.state === 'offered')))
  await Promise.all(jobs)
  return facts
}

/**
 * The pre-trade check of an action for the connected wallet, kept current while mounted. Null when there is no
 * action yet. A guest gets the terms and a "Connect a wallet to check" line, never a blocked dead end.
 */
export function usePreTrade(action: PreTradeAction | null, options: PreTradeOptions = {}): PreTradeView | null {
  const { getClient, me } = useOptionsClient()
  const qc = useQueryClient()
  const nowSec = useNowSec(10)
  const on = (options.enabled ?? true) && action !== null

  const optionId = action ? optionIdOf(action) : null
  const wantsAsk = action?.type === 'buy-resale'
  const bidId = action?.type === 'fill-bid' ? action.bid.id : null
  const underlying = action ? underlyingOf(action) : null
  const wantsEligibility = !!action && needsEligibility(action) && !!me
  const tokens = useMemo(() => (action ? tokensFor(action) : []), [action])
  const wantsBalances = !!me && tokens.length > 0
  const wantsWriterCount = action?.type === 'write-offer' && !!me
  const wantsBuyerCount = action?.type === 'post-bid' && !!me
  const wantsOffers = action?.type === 'write-offer'

  const option = useOption(optionId, { enabled: on })
  const ask = useAsk(wantsAsk ? optionId : null, { enabled: on })
  const bid = useBid(bidId, { enabled: on })
  const eligible = useEligibility(underlying?.contractId, me, { enabled: on && wantsEligibility })
  const balances = useBalancesById(me, tokens, { enabled: on && wantsBalances })
  const health = useHealth({ enabled: on })
  const writerCount = useWriterOpenCount(me, { enabled: on && wantsWriterCount })
  const buyerCount = useBuyerOpenCount(me, { enabled: on && wantsBuyerCount })
  const offers = useOptions({ enabled: on && wantsOffers })
  const assetReference = useReference(underlying)
  const reference = options.reference === undefined ? assetReference : options.reference

  // Each query becomes one fact first, so a refetch that changes nothing keeps the facts (and the result) stable.
  const optionFact = factOf(option, optionId !== null)
  const askFact = factOf(ask, wantsAsk)
  const bidFact = factOf(bid, bidId !== null)
  const eligibleFact = factOf(eligible, wantsEligibility)
  const writerFact = factOf(writerCount, wantsWriterCount)
  const buyerFact = factOf(buyerCount, wantsBuyerCount)
  const balanceFact = !wantsBalances ? (me ? NO_BALANCES : undefined) : balances.isError ? NO_BALANCES : balances.data
  const healthFact = health.data ?? NO_HEALTH
  const offerList = wantsOffers ? offers.data : undefined
  const openOffers = useMemo(() => offerList?.filter((o) => o.state === 'offered'), [offerList])

  const facts = useMemo<PreTradeFacts>(
    () => ({
      me,
      nowSec,
      option: optionFact,
      liveAsk: askFact,
      bid: bidFact,
      eligible: eligibleFact,
      balances: balanceFact,
      health: healthFact,
      writerOpenCount: writerFact,
      buyerOpenCount: buyerFact,
      openOffers,
      reference,
    }),
    [me, nowSec, optionFact, askFact, bidFact, eligibleFact, balanceFact, healthFact, writerFact, buyerFact, openOffers, reference],
  )

  const result = useMemo(() => (action ? preTrade(action, facts) : null), [action, facts])

  const recheck = useCallback(async (): Promise<PreTradeResult> => {
    if (!action) throw new Error('No action to check')
    const fresh = await readFreshFacts(qc, getClient, action, me)
    return preTrade(action, { ...fresh, reference })
  }, [qc, getClient, action, me, reference])

  return useMemo(() => (result ? { ...result, facts, recheck } : null), [result, facts, recheck])
}
