// Pure decisions of the markets pages, kept out of the components so they can be tested: which assets the index
// lists, where an intent card leads, when the first-run strip shows and how far its steps are.
import type { AssetSearch, Intent, MarketsSearch } from '../../app/search'
import { GUIDED_INTENTS } from '../../core/payoff/strategies'
import type { Bid } from '../../core/requests/types'
import type { TokenBalance } from '../../core/stellar/tokens'
import { byPremiumPerUnit } from '../../core/units'
import type { MarketIndexRow } from '../../data'

export interface IndexList {
  /** The rows on screen: reference assets, or every listed asset with `all`. */
  rows: MarketIndexRow[]
  /** Listed assets that are not shown (always 0 with `all`). */
  hidden: number
  /** True when the list shows every listed asset. */
  all: boolean
}

/** The Markets index lists reference assets by default (brief D20). When the list has none, it lists everything. */
export function indexList(rows: readonly MarketIndexRow[], showAll: boolean): IndexList {
  const reference = rows.filter((r) => r.isReference)
  if (showAll || reference.length === 0) return { rows: [...rows], hidden: 0, all: true }
  return { rows: reference, hidden: rows.length - reference.length, all: false }
}

/** Search of the asset page an intent leads to: guided mode with that intent. */
export const guidedSearch = (intent: Intent): AssetSearch => ({ mode: 'guided', intent })

/** Search of the Markets index while an intent waits for its asset. */
export const choosingSearch = (intent: Intent, showAll: boolean): MarketsSearch => (showAll ? { intent, all: '1' } : { intent })

const positive = (b: TokenBalance | undefined): boolean => b !== undefined && b.balance !== null && b.balance > 0n

/**
 * The one obvious asset for an intent, or null when the user has to choose (brief 4.2).
 * Obvious means: a single asset is listed; or, for an intent that starts from the asset itself (set a floor,
 * earn on what you hold), the connected wallet holds exactly one of the listed assets.
 */
export function obviousAsset(intent: Intent, rows: readonly MarketIndexRow[], balances: Readonly<Record<string, TokenBalance>> | null | undefined): MarketIndexRow | null {
  if (rows.length === 1) return rows[0]
  const info = GUIDED_INTENTS.find((i) => i.id === intent)
  if (!info || info.starts !== 'asset' || !balances) return null
  const held = rows.filter((r) => positive(balances[r.asset.contractId]))
  return held.length === 1 ? held[0] : null
}

/**
 * True for a connected wallet that holds none of the tokens traded here: no quote token and no listed asset.
 * False while the balances are not read (never flash the strip), and false when a read failed.
 */
export function needsTestFunds(balances: readonly TokenBalance[] | null | undefined): boolean {
  if (!balances || balances.length === 0) return false
  if (balances.some((b) => b.status === 'error')) return false
  return balances.every((b) => b.balance === null || b.balance === 0n)
}

export type FundingStep = 'fund' | 'trust' | 'swap'
export type StepState = 'done' | 'next' | 'later'

/**
 * How far a wallet is through the three steps, from what its balances say: an unfunded account has done
 * nothing; an account with no trustline to the quote token or to any asset still has to add them; with both it
 * only has to swap. The steps are done in the wallet, so this is read, never assumed.
 */
export function fundingProgress(balances: readonly TokenBalance[], quoteId: string): Record<FundingStep, StepState> {
  const funded = balances.length > 0 && balances.every((b) => b.status !== 'unfunded')
  const canHold = (b: TokenBalance) => b.status === 'ok' || b.status === 'mock'
  const quote = balances.find((b) => b.contractId === quoteId)
  const trusted = funded && quote !== undefined && canHold(quote) && balances.some((b) => b.contractId !== quoteId && canHold(b))
  if (!funded) return { fund: 'next', trust: 'later', swap: 'later' }
  if (!trusted) return { fund: 'done', trust: 'next', swap: 'later' }
  return { fund: 'done', trust: 'done', swap: 'next' }
}

// ------------------------------------------------------------------------------------------- requests of one asset


export interface AssetRequest {
  bid: Bid
  /** Posted by the connected wallet. */
  mine: boolean
  /** Still open and before its expiry: a seller can fill it. */
  open: boolean
}

/**
 * The requests shown on an asset's Requests tab: every open, unexpired bid on the asset (highest premium per
 * unit first, then soonest expiry), followed by the connected wallet's own bids that lapsed and still hold its
 * premium (cancelling refunds it). Other wallets' lapsed bids and filled or cancelled ones are not shown.
 */
export function assetRequests(bids: readonly Bid[], assetId: string, me: string | null, nowSec: number): AssetRequest[] {
  const onAsset = bids.filter((b) => b.underlying.contractId === assetId)
  const isOpen = (b: Bid) => b.state === 'open' && b.expiry > nowSec
  const lapsed = (b: Bid) => b.state === 'expired' || (b.state === 'open' && b.expiry <= nowSec)
  const byId = (a: Bid, b: Bid) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const open = onAsset.filter(isOpen).sort((a, b) => byPremiumPerUnit(b, a) || a.expiry - b.expiry || byId(a, b))
  const mineLapsed = me === null ? [] : onAsset.filter((b) => b.buyer === me && lapsed(b)).sort((a, b) => a.expiry - b.expiry || byId(a, b))
  return [...open.map((bid) => ({ bid, mine: me !== null && bid.buyer === me, open: true })), ...mineLapsed.map((bid) => ({ bid, mine: true, open: false }))]
}
