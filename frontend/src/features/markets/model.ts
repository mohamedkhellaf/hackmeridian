// Pure decisions of the markets pages, kept out of the components so they can be tested: which assets the index
// lists, where an intent card leads, when the first-run strip shows and how far its steps are.
import type { AssetSearch, Intent, MarketsSearch } from '../../app/search'
import type { BookRow } from '../../core/market/book'
import { GUIDED_INTENTS } from '../../core/payoff/strategies'
import type { Bid } from '../../core/requests/types'
import type { HolderStatus } from '../../core/assetfacts/assetFacts'
import type { OptionKind } from '../../core/options/types'
import { priceOf } from '../../core/reference'
import { nearestStrike } from '../../core/series'
import type { TokenBalance } from '../../core/stellar/tokens'
import { byPremiumPerUnit } from '../../core/units'
import type { MarketIndexRow, MarketView } from '../../data'

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

/** The best offer of one kind near the reference price: its premium per unit and the terms it is for. */
export interface NearOffer {
  perUnit: bigint
  strikePerUnit: bigint
  /** Unix seconds. */
  expiry: number
}

/**
 * What the Markets index shows per kind (ruling F10, metric to be confirmed by the product owner): on the nearest
 * listed deadline that has a standard offer or listing, the strike of the ladder nearest the reference price
 * (the lower one on a tie), and the best offer per unit there, as the chain cell shows it. Null for a kind with
 * no offer at that strike, and for both kinds without a reference price or without any offer.
 */
export function nearReference(view: Pick<MarketView, 'reference' | 'ladder' | 'columns'>): Record<OptionKind, NearOffer | null> {
  const none = { put: null, call: null }
  const strike = nearestStrike(priceOf(view.reference), view.ladder)
  const column = view.columns.find((c) => c.offers > 0)
  const row = strike === null || !column ? undefined : column.rows.find((r) => r.strikePerUnit === strike)
  if (!column || !row) return none
  const offer = (kind: OptionKind): NearOffer | null => {
    const cell = row[kind]
    return cell.bestPerUnit === null ? null : { perUnit: cell.bestPerUnit, strikePerUnit: row.strikePerUnit, expiry: column.expiry }
  }
  return { put: offer('put'), call: offer('call') }
}

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

const empty = (b: TokenBalance): boolean => b.balance === null || b.balance === 0n

/**
 * True for a connected wallet that holds no quote token: it cannot pay a premium or a strike, whatever else it
 * holds. False while the balances are not read (never flash the strip), and false when the quote read failed.
 */
export function needsTestFunds(balances: readonly TokenBalance[] | null | undefined, quoteId: string): boolean {
  const quote = balances?.find((b) => b.contractId === quoteId)
  if (!quote || quote.status === 'error') return false
  return empty(quote)
}

/** What the strip's lead says: the wallet holds nothing traded here, no quote token, or the strip was asked for. */
export type FundsLead = 'none' | 'noQuote' | 'asked'

export function fundsLead(balances: readonly TokenBalance[], quoteId: string): FundsLead {
  if (balances.length > 0 && balances.every(empty)) return 'none'
  return needsTestFunds(balances, quoteId) ? 'noQuote' : 'asked'
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

/** A request in the shape of a row of the book, for the dialog that cancels it (the same one as in the chain). */
export const requestRow = (bid: Bid): BookRow => ({
  key: `b${bid.id}`,
  source: 'bid',
  kind: bid.kind,
  underlying: bid.underlying,
  quote: bid.quote,
  underlyingQty: bid.underlyingQty,
  totalStrike: bid.totalStrike,
  totalPremium: bid.totalPremium,
  expiry: bid.expiry,
  counterparty: bid.buyer,
  bid,
})

// ------------------------------------------------------------------------------------------- access to one asset

/** Which sentence "Your access" says: what the wallet itself lacks first, then the issuer's decision. */
export type AccessCase = 'unfunded' | 'noTrustline' | 'issuer' | 'maintainOnly' | 'no' | 'yes' | 'checking' | 'error'

/**
 * `status` is the wallet's balance status for the asset, `holder` the trustline read from Horizon (live builds),
 * `eligible` the contract's own answer (undefined while it is read, null when the read failed). A missing account
 * or trustline is the wallet's own fix and is said before any authorization.
 */
export function accessCase(status: TokenBalance['status'] | undefined, holder: HolderStatus | undefined, eligible: boolean | null | undefined): AccessCase {
  if (status === 'unfunded' || holder === 'unfunded') return 'unfunded'
  if (status === 'no-trustline' || holder === 'no-trustline') return 'noTrustline'
  if (holder === 'issuer') return 'issuer'
  if (holder === 'maintain-only') return 'maintainOnly'
  if (status === 'not-authorized' || holder === 'unauthorized') return 'no'
  if (eligible === undefined) return 'checking'
  if (eligible === null) return 'error'
  return eligible ? 'yes' : 'no'
}
