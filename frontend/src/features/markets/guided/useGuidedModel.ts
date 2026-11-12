// The guided flow as one model, read from the URL and the data hooks. The form (GuidedMode) and its closing
// block (GuidedClosing, which the asset page renders in the order rail from 1200 px) both call this hook, so the
// two always show the same terms, the same order and the same action. No financial maths here: exact amounts
// come from core/ and the derived data views; this file only chooses which of them applies.
import { useCallback, useMemo } from 'react'
import type { AssetSearch } from '../../../app/search'
import { formatUnits, formatUtc } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { cellKey } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import type { TokenInfo } from '../../../core/options/types'
import { intentInfo } from '../../../core/payoff/strategies'
import type { GuidedIntent, IntentInfo } from '../../../core/payoff/strategies'
import { priceOf } from '../../../core/reference'
import type { ReferencePrice } from '../../../core/reference'
import { expiryDayKey, plainDecimal } from '../../../core/series'
import { premiumUnits } from '../../../core/units'
import { useBalances, useGuidedMatch, useMarket, useMe, useNowSec, usePositions } from '../../../data'
import type { GuidedMatch, MarketView } from '../../../data'
import { searchFromTicketIntent } from '../../ticket'
import type { TicketIntent } from '../../ticket'
import { ACTION, ANOTHER, INTENT_COPY, LOCK_SUMMARY, NEED_PREMIUM_ACTION, NEED_QTY_ACTION, OWN_SUMMARY, PREMIUM_INEXACT_ACTION, another } from './copy'
import type { IntentCopy, Words } from './copy'
import {
  canonicalDecimal,
  coverWith,
  defaultSeries,
  inSeries,
  inputAmount,
  intentOf,
  lotsOf,
  maxQuantity,
  normalizeDecimal,
  offGrid,
  ownIntent,
  parsePositive,
  pinnedSeries,
  premiumAt,
  premiumPerUnitOf,
  premiumTotal,
  takeIntent,
  totalStrike,
} from './terms'
import { CLOSE_TICKET, ticketOpen, useDraftParam, useGuidedSearch } from './useGuidedSearch'
import type { DraftParam, PatchOptions } from './useGuidedSearch'

/** Terms that belong to one intent. Choosing another intent starts from that intent's own defaults. */
export const CLEAR_TERMS: Partial<AssetSearch> = { strike: undefined, expiry: undefined, qty: undefined, premium: undefined, kind: undefined }

/** What the wallet already has at the chosen terms (its own orders are never matched as something to take). */
export type OwnItem =
  | { kind: 'holding'; id: bigint; qty: bigint }
  | { kind: 'written'; id: bigint; qty: bigint }
  | { kind: 'offer'; id: bigint; qty: bigint; premium: bigint }
  | { kind: 'request'; id: bigint; qty: bigint; premium: bigint }

export interface GuidedModel {
  assetId: string
  intent: GuidedIntent
  info: IntentInfo
  copy: IntentCopy
  side: 'buy' | 'write'
  view: MarketView
  asset: TokenInfo
  quote: TokenInfo
  reference: ReferencePrice
  refPrice: bigint | null
  nowSec: number
  funded: ReadonlySet<string>
  strike: bigint
  expiry: number
  ref: SeriesRef
  /** A price or date the link named that is not on the list (said once above the chips). */
  dropped: { strike: bigint | null; expiry: number | null }
  qtyDraft: DraftParam
  /** The premium field: a total on the buyer side, per unit on the seller side (E18, H4). */
  premiumDraft: DraftParam
  /** True on the seller side, where the premium is typed per unit and its exact total is shown as a row. */
  premiumPerUnit: boolean
  /** The premium per unit typed on the seller side does not multiply out to an exact total for this quantity. */
  premiumInexact: boolean
  /** The premium as the URL keeps it (a total), from what is typed; undefined while there is none. */
  premiumUrl: string | undefined
  /** What the quantity field holds, when it is a positive amount. */
  typedQty: bigint | null
  strikeTotal: bigint | null
  /** The quantity once strike times quantity is an exact amount: the contract takes totals. */
  qty: bigint | null
  /** The quantities on the side of the book the user can take, at the chosen series. */
  lots: bigint[]
  match: GuidedMatch | null
  matchReady: boolean
  exact: BookRow | null
  /** The cheapest open offer of the series, whoever posted it: the reference for a price of one's own. */
  lowestOffer: BookRow | null
  /** Smaller offers of the same series that together stay within the quantity: what they would cover. */
  cover: { rows: BookRow[]; total: bigint }
  /** The total premium the user typed (or that their price per unit comes to), when there is no exact match. */
  ownPremium: bigint | null
  /** The premium of the order or the user's own: what gets signed. */
  premium: bigint | null
  /** A premium for the figures only, while the user has not typed one: the lowest offer's price per unit (E13). */
  assumed: { perUnit: bigint; total: bigint } | null
  premiumSource: 'order' | 'own' | 'assumed' | 'none'
  held: bigint | null
  cash: bigint | null
  max: { qty: bigint; byLot: boolean } | null
  me: string | null
  mine: OwnItem | null
  words: Words
  deadline: string
  primary: { ticket: TicketIntent; step: 'terms' | 'review' } | null
  primaryLabel: string
  /** Why the action waits, when `primary` is null: a quantity first, then (seller side) a premium. */
  primaryReason: string
  ownTerms: TicketIntent | null
  summary: string | null
  /** What the action needs in quote units, and what the wallet has, when it has less. */
  shortfall: { have: bigint; need: bigint } | null
  open: (ticket: TicketIntent, step: 'terms' | 'review') => void
  pin: (next: { qty?: string | undefined; strike?: bigint; expiry?: number; premium?: string | undefined }, opts?: PatchOptions) => void
  typeQty: (text: string) => void
  typePremium: (text: string) => void
  /** Adopts other terms (a suggestion, a smaller lot). Adds a history entry. */
  useTerms: (terms: { qty: bigint; strike: bigint; expiry: number }) => void
  ticketIsOpen: boolean
  refreshFailed: boolean
  updatedAt: number | null
  retry: () => void
}

export type GuidedState =
  | { status: 'error'; retry: () => void }
  | { status: 'loading' }
  | { status: 'not-listed' }
  | { status: 'no-grid'; others: number }
  | { status: 'ready'; model: GuidedModel }

/** The intent the URL means, and the action that changes it. */
export function useGuidedIntent(): { intent: GuidedIntent; setIntent: (next: GuidedIntent) => void } {
  const { search, patch } = useGuidedSearch()
  const intent = intentOf(search)
  const setIntent = useCallback((next: GuidedIntent) => patch({ ...CLOSE_TICKET, ...CLEAR_TERMS, intent: next }), [patch])
  return { intent, setIntent }
}

export function useGuidedModel(assetId: string): GuidedState {
  const { search, patch } = useGuidedSearch()
  const intent = intentOf(search)
  const info = intentInfo(intent)
  const kind = info.optionKind
  const side = info.side
  const copy = INTENT_COPY[intent]
  const market = useMarket(assetId)
  // Asked with no terms, the match only says which series have something the wallet can take: the chip marks
  // and the defaults are built from that.
  const probe = useGuidedMatch(assetId, intent, null, null, null)
  const me = useMe()
  const nowSec = useNowSec(30)
  const view = market.data
  const refPrice = view ? priceOf(view.reference) : null

  // ---- the series: what the URL names, else the default
  const grid = useMemo(
    () => (view ? { ladder: view.ladder, expiries: view.expiries, reference: refPrice, nowSec } : null),
    [view, refPrice, nowSec],
  )
  const quoteDecimals = view?.quote.decimals ?? 7
  const pinned = grid ? pinnedSeries(search, grid, quoteDecimals, kind) : { strike: null, expiry: null }
  const funded = probe.data?.funded ?? EMPTY_SET
  const series = grid ? defaultSeries(kind, grid, funded, pinned) : { strike: null, expiry: null }
  const strike = series.strike ?? view?.ladder[0] ?? null
  const expiry = series.expiry ?? view?.expiries[0] ?? null
  const cell = view && strike !== null && expiry !== null ? view.cells.get(cellKey({ expiry, kind, strikePerUnit: strike })) : undefined
  const dropped = grid && view ? offGrid(search, grid, quoteDecimals, kind) : { strike: null, expiry: null }

  // ---- the quantity and the premium: text inputs kept in step with the URL
  // The default quantity is the lot of the order the user can take here; on the seller side with no buyer
  // waiting, the lot of the lowest open offer (E13), so the comparison is like for like.
  const lotRow = side === 'buy' ? (cell?.best ?? null) : (cell?.bestBid ?? cell?.best ?? null)
  const decimals = view?.asset.decimals ?? 7
  const scope = `${assetId}:${intent}`
  const qtyDraft = useDraftParam(`${scope}:qty`, search.qty, lotRow !== null ? inputAmount(lotRow.underlyingQty, decimals) : '1.00')
  // A seller types the premium per unit (E18); the URL keeps the total, as the ticket does. The field is compared
  // with the URL's total over the URL's quantity, both written one way, so a typed `0.40` stays on screen.
  const perUnitPremium = side === 'write'
  const urlQty = parsePositive(search.qty ?? qtyDraft.text, decimals)
  const urlTotal = search.premium !== undefined ? parsePositive(search.premium, quoteDecimals) : null
  const urlPerUnit = urlTotal !== null && urlQty !== null ? premiumPerUnitOf(urlTotal, urlQty, decimals) : null
  const canonPerUnit = useCallback((text: string) => canonicalDecimal(text, quoteDecimals), [quoteDecimals])
  const premiumDraft = useDraftParam(
    `${scope}:${perUnitPremium ? 'premiumPerUnit' : 'premium'}`,
    perUnitPremium ? (urlPerUnit !== null ? plainDecimal(urlPerUnit, quoteDecimals) : undefined) : search.premium,
    '',
    perUnitPremium ? canonPerUnit : undefined,
  )

  const typedQty = parsePositive(qtyDraft.text, decimals)
  const strikeTotal = typedQty !== null && strike !== null ? totalStrike(strike, typedQty, decimals) : null
  const qty = strikeTotal !== null ? typedQty : null

  const matchQuery = useGuidedMatch(assetId, intent, qty, strike, expiry)
  const balances = useBalances(me)
  const positions = usePositions(me)
  const match = matchQuery.data

  if (market.isError || probe.isError)
    return {
      status: 'error',
      retry: () => {
        market.retry()
        probe.retry()
      },
    }
  if (market.isLoading || probe.isLoading) return { status: 'loading' }
  if (!view || !probe.data) return { status: 'not-listed' }
  if (strike === null || expiry === null || view.ladder.length === 0 || view.expiries.length === 0) return { status: 'no-grid', others: view.other.length }

  const { asset, quote, reference } = view
  const ref: SeriesRef = { underlyingId: asset.contractId, expiry, kind, strikePerUnit: strike }

  // ---- what is on offer at this series, and what the wallet already has there
  const sideRows: BookRow[] = match ? [...(match.exact ? [match.exact] : []), ...match.sameSeries.map((a) => a.row)] : []
  // Every lot of the series (match.lots is not capped like sameSeries), one entry per size.
  const lots = match ? lotsOf(match.lots.map((underlyingQty) => ({ underlyingQty }))) : []
  const exact = match?.exact ?? null
  const cover = exact || qty === null || side !== 'buy' ? { rows: [], total: 0n } : coverWith(sideRows, qty, side)
  const lowestOffer = cell?.best ?? null

  const mine = ownItem(positions.data, ref, side)

  const typedPremium = exact ? null : parsePositive(premiumDraft.text, quote.decimals)
  const ownTotal = perUnitPremium && typedPremium !== null && qty !== null ? premiumTotal(typedPremium, qty, asset.decimals) : null
  const ownPremium = perUnitPremium ? ownTotal : typedPremium
  const premiumInexact = perUnitPremium && typedPremium !== null && qty !== null && ownTotal === null
  const premium = exact ? exact.totalPremium : ownPremium
  const lowestPerUnit = lowestOffer ? premiumUnits(lowestOffer) : null
  const assumedTotal = !exact && ownPremium === null && lowestPerUnit !== null && qty !== null ? premiumAt(lowestPerUnit, qty, asset.decimals, quote.decimals) : null
  const assumed = assumedTotal !== null && assumedTotal > 0n && lowestPerUnit !== null ? { perUnit: lowestPerUnit, total: assumedTotal } : null
  const premiumSource: GuidedModel['premiumSource'] = exact ? 'order' : ownPremium !== null ? 'own' : assumed ? 'assumed' : 'none'

  // ---- balances
  const balanceOf = (id: string): bigint | null => (me ? (balances.data?.find((b) => b.contractId === id)?.balance ?? null) : null)
  const held = balanceOf(asset.contractId)
  const cash = balanceOf(quote.contractId)
  // On the buyer side offers are sold whole: Max is the largest lot the holding covers, when there is one.
  const cap = me ? maxQuantity(intent, { asset: held, quote: cash }, strike, asset.decimals) : null
  const lotCap = side === 'buy' && intent === 'floor' && held !== null ? [...lots].reverse().find((l) => l <= held) : undefined
  const max = lotCap !== undefined ? { qty: lotCap, byLot: true } : cap !== null ? { qty: cap, byLot: false } : null

  // ---- words
  const money = (units: bigint) => formatUnits(units, quote.decimals)
  const deadline = formatUtc(expiry)
  const words: Words = {
    a: asset.code,
    q: quote.code,
    qty: qty !== null ? formatUnits(qty, asset.decimals) : '',
    strike: money(strike),
    strikeTotal: strikeTotal !== null ? money(strikeTotal) : '',
    premium: premium !== null ? money(premium) : null,
  }

  // ---- writing the URL: any change of terms closes an open ticket and clears a premium typed for other terms
  const qtyPinned = search.qty !== undefined || qtyDraft.edited
  const pin: GuidedModel['pin'] = (next, opts) => {
    const keepsPremium = 'premium' in next
    if (!keepsPremium) premiumDraft.reset()
    patch(
      {
        ...CLOSE_TICKET,
        intent,
        kind,
        strike: plainDecimal(next.strike ?? strike, quote.decimals),
        expiry: expiryDayKey(next.expiry ?? expiry),
        // A quantity the user never set follows the lot of the series chosen: every ticked chip then matches.
        qty: 'qty' in next ? next.qty : qtyPinned ? normalizeDecimal(qtyDraft.text) : undefined,
        premium: keepsPremium ? next.premium : undefined,
      },
      opts,
    )
  }
  // The total a premium typed per unit comes to for a quantity typed as text: what the URL keeps.
  const totalFor = (perUnitText: string, qtyText: string): string | undefined => {
    const unit = parsePositive(perUnitText, quote.decimals)
    const q = parsePositive(qtyText, asset.decimals)
    const total = unit !== null && q !== null ? premiumTotal(unit, q, asset.decimals) : null
    return total !== null ? plainDecimal(total, quote.decimals) : undefined
  }
  // A seller's price per unit stays when the quantity changes, as in the ticket, while it still multiplies out.
  const typeQty = (text: string) => {
    const nextQty = qtyDraft.type(text)
    const kept = perUnitPremium && premiumDraft.text.trim() !== '' ? totalFor(premiumDraft.text, text) : undefined
    pin(kept !== undefined ? { qty: nextQty, premium: kept } : { qty: nextQty }, { replace: true })
  }
  const typePremium = (text: string) => {
    const typed = premiumDraft.type(text)
    if (!perUnitPremium) return pin({ premium: typed }, { replace: true })
    // Per unit: the URL gets the exact total. A price that does not multiply out leaves the URL as it was; the
    // field keeps what was typed and says why it cannot be used.
    const total = totalFor(text, qtyDraft.text)
    if (total !== undefined || text.trim() === '') pin({ premium: total }, { replace: true })
  }
  const useTerms = (t: { qty: bigint; strike: bigint; expiry: number }) => pin({ qty: qtyDraft.type(inputAmount(t.qty, asset.decimals)), strike: t.strike, expiry: t.expiry })

  // ---- the ticket
  // The link carries the quantity and the premium as they are typed, so the inputs do not change under the user.
  const strikeParam = plainDecimal(strike, quote.decimals)
  const qtyParam = qty !== null ? normalizeDecimal(qtyDraft.text) : undefined
  const premiumParam = ownPremium !== null ? (perUnitPremium ? plainDecimal(ownPremium, quote.decimals) : normalizeDecimal(premiumDraft.text)) : undefined
  const premiumUrl = perUnitPremium ? premiumParam : normalizeDecimal(premiumDraft.text)
  const own = (withPremium: boolean): TicketIntent | null =>
    qtyParam === undefined ? null : ownIntent(side, { assetId, kind, strike: strikeParam, qty: qtyParam, premium: withPremium ? premiumParam : undefined, expiry })
  const open = (ticket: TicketIntent, step: 'terms' | 'review') =>
    patch({ ...searchFromTicketIntent(ticket), intent, strike: strikeParam, expiry: expiryDayKey(expiry), qty: qtyParam, step })
  // A funded order is taken as it stands, at the review step. Terms of one's own go to review once they have a
  // premium, and to the terms step of the ticket while they do not.
  const taking = exact ? takeIntent(exact, me) : null
  // A seller's own offer waits for a premium (H4): its action stays disabled, with the reason, until one is typed.
  const posting = exact || (perUnitPremium && ownPremium === null) ? null : own(true)
  const primary = taking ? { ticket: taking, step: 'review' as const } : posting ? { ticket: posting, step: ownPremium !== null ? ('review' as const) : ('terms' as const) } : null
  const primaryReason = qty === null ? NEED_QTY_ACTION : premiumInexact ? PREMIUM_INEXACT_ACTION : NEED_PREMIUM_ACTION
  const primaryLabel = exact
    ? exact.source === 'bid'
      ? ACTION.request
      : exact.source === 'resale'
        ? ACTION.listing
        : ACTION.offer
    : side === 'buy'
      ? ownPremium !== null
        ? ACTION.ownRequest
        : ACTION.postRequest
      : ownPremium !== null
        ? ACTION.ownOffer
        : ACTION.postOffer
  const ownTerms = exact ? own(false) : null
  const collateral = kind === 'put' ? `${words.strikeTotal}\u00a0${words.q}` : `${words.qty}\u00a0${words.a}`
  // A seller's deal is said before a premium is typed too: what is locked, and that the price is theirs to ask.
  const deal =
    qty === null
      ? null
      : exact
        ? copy.summary({ ...words, deadline })
        : ownPremium !== null
          ? OWN_SUMMARY[side]({ ...words, collateral, deadline })
          : side === 'write'
            ? LOCK_SUMMARY({ ...words, collateral, deadline })
            : null
  // With the wallet's own order or position at these terms, the sentence says it is about another one.
  const anotherLead = exact ? (exact.source === 'bid' ? ANOTHER.bid : exact.source === 'resale' ? ANOTHER.resale : ANOTHER.offer) : side === 'buy' ? ANOTHER.ownRequest : ANOTHER.ownOffer
  const summary = deal !== null && mine !== null ? another(anotherLead, deal) : deal

  // What the action takes from the quote balance now, for a buyer: the premium. (A seller's shortfall is said
  // under the quantity field, with its figures.)
  const need = side === 'buy' ? premium : null
  const shortfall = me && cash !== null && need !== null && need > cash ? { have: cash, need } : null

  return {
    status: 'ready',
    model: {
      assetId,
      intent,
      info,
      copy,
      side,
      view,
      asset,
      quote,
      reference,
      refPrice,
      nowSec,
      funded,
      strike,
      expiry,
      ref,
      dropped,
      qtyDraft,
      premiumDraft,
      premiumPerUnit: perUnitPremium,
      premiumInexact,
      premiumUrl,
      typedQty,
      strikeTotal,
      qty,
      lots,
      match: match ?? null,
      matchReady: match !== null && match !== undefined,
      exact,
      lowestOffer,
      cover,
      ownPremium,
      premium,
      assumed,
      premiumSource,
      held,
      cash,
      max,
      me,
      mine,
      words,
      deadline,
      primary,
      primaryLabel,
      primaryReason,
      ownTerms,
      summary,
      shortfall,
      open,
      pin,
      typeQty,
      typePremium,
      useTerms,
      ticketIsOpen: ticketOpen(search),
      refreshFailed: market.refreshFailed || probe.refreshFailed || matchQuery.refreshFailed,
      updatedAt: market.updatedAt,
      retry: () => {
        market.retry()
        probe.retry()
        matchQuery.retry()
      },
    },
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/**
 * The wallet's own option, offer or request at exactly this series, on the side of the intent: a buyer's live
 * position or open request, a seller's live written option or open offer. The first found, live positions first.
 */
function ownItem(view: ReturnType<typeof usePositions>['data'], ref: SeriesRef, side: 'buy' | 'write'): OwnItem | null {
  if (!view) return null
  if (side === 'buy') {
    const held = view.holding.find((p) => p.option.state === 'active' && inSeries(p.option, ref))
    if (held) return { kind: 'holding', id: held.option.id, qty: held.option.underlyingQty }
    const request = view.orders.requests.find((b) => b.state === 'open' && inSeries(b, ref))
    if (request) return { kind: 'request', id: request.id, qty: request.underlyingQty, premium: request.totalPremium }
    return null
  }
  const written = view.written.find((p) => p.option.state === 'active' && inSeries(p.option, ref))
  if (written) return { kind: 'written', id: written.option.id, qty: written.option.underlyingQty }
  const offer = view.orders.offers.find((p) => p.option.state === 'offered' && inSeries(p.option, ref))
  if (offer) return { kind: 'offer', id: offer.option.id, qty: offer.option.underlyingQty, premium: offer.option.totalPremium }
  return null
}
