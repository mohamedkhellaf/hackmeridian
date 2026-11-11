// The guided flow without React: what the URL says, the defaults when it says nothing, and the few exact
// amounts the sections print. Token amounts are bigint; payoff figures come from core/payoff/strategies.
import type { AssetSearch } from '../../../app/search'
import { parseAmount } from '../../../core/format'
import type { BookRow } from '../../../core/market/book'
import { bookRowAction, cellKey, seriesRefOf } from '../../../core/market/selection'
import type { SeriesRef } from '../../../core/market/selection'
import type { OptionKind } from '../../../core/options/types'
import { intentFor } from '../../../core/payoff/strategies'
import type { GuidedIntent } from '../../../core/payoff/strategies'
import { expiryFromDayKey } from '../../../core/series'
import type { TicketIntent } from '../../ticket'

/** A default deadline leaves at least this long to act (brief D17: the first reminder is 48 hours out). */
export const MIN_DEFAULT_LEAD_SECONDS = 48 * 3600

export interface Grid {
  /** Standard strikes per unit, in quote units, ascending. */
  ladder: readonly bigint[]
  /** Listed expiries, unix seconds, ascending. */
  expiries: readonly number[]
  /** Reference price per unit in quote units, or null. */
  reference: bigint | null
  nowSec: number
}

export interface Series {
  strike: bigint | null
  expiry: number | null
}

/**
 * The side of the order ticket the URL opens: writing an offer or filling a request is the seller's side; buying
 * an offer or a listing, or posting a request, the buyer's. Null when no ticket is open.
 */
export function ticketSide(search: Pick<AssetSearch, 'side' | 'offer' | 'bid' | 'ask'>): 'buy' | 'write' | null {
  if (search.side === 'write') return 'write'
  if (search.side === 'buy' || search.side === 'bid') return 'buy'
  if (search.bid !== undefined) return 'write'
  if (search.offer !== undefined || search.ask !== undefined) return 'buy'
  return null
}

/**
 * The intent a link means. An open ticket with an option kind decides it, so the guided page and the ticket
 * always describe the same order (F4): a written put is an income while waiting to buy, a written call an income
 * on what you hold, a put bought or requested a floor, a call a buy price to lock. Otherwise the intent the link
 * names; and a link from the chain, which names an option kind and no intent, reads the same way.
 */
export function intentOf(search: Pick<AssetSearch, 'intent' | 'kind' | 'side' | 'offer' | 'bid' | 'ask'>): GuidedIntent {
  const side = ticketSide(search)
  if (side !== null && search.kind) return intentFor(search.kind, side)
  if (search.intent) return search.intent
  if (search.kind) return intentFor(search.kind, 'buy')
  return 'floor'
}

/**
 * The strike and expiry the URL names, kept only when they are on the standard grid and belong to the intent's
 * option kind: the chips are the grid, so anything else falls back to the default rather than selecting a chip
 * that does not exist, and a call's strike never becomes a floor.
 */
export function pinnedSeries(search: Pick<AssetSearch, 'strike' | 'expiry' | 'kind'>, grid: Grid, quoteDecimals: number, kind?: OptionKind): Series {
  if (kind !== undefined && search.kind !== undefined && search.kind !== kind) return { strike: null, expiry: null }
  const strike = search.strike ? parseAmount(search.strike, quoteDecimals) : null
  const expiry = search.expiry ? expiryFromDayKey(search.expiry) : null
  return {
    strike: strike !== null && grid.ladder.includes(strike) ? strike : null,
    expiry: expiry !== null && grid.expiries.includes(expiry) ? expiry : null,
  }
}

/**
 * What the URL named that is not on the grid, to say so once: the strike in exact units (null when it was a
 * listed price, missing, or not a number) and the expiry in unix seconds. A term dropped because it belongs to
 * another option kind is not reported: the intent changed, not the price.
 */
export function offGrid(search: Pick<AssetSearch, 'strike' | 'expiry' | 'kind'>, grid: Grid, quoteDecimals: number, kind: OptionKind): { strike: bigint | null; expiry: number | null } {
  if (search.kind !== undefined && search.kind !== kind) return { strike: null, expiry: null }
  const strike = search.strike ? parseAmount(search.strike, quoteDecimals) : null
  const expiry = search.expiry ? expiryFromDayKey(search.expiry) : null
  return {
    strike: strike !== null && strike > 0n && !grid.ladder.includes(strike) ? strike : null,
    expiry: expiry !== null && !grid.expiries.includes(expiry) ? expiry : null,
  }
}

/**
 * Ladder strikes in the order a newcomer would want them. A put (a floor, a buy price) starts at or below the
 * reference and moves down; a call (a sale price, a locked buy price) starts at or above it and moves up.
 * `rest` holds the strikes on the other side, nearest first. Without a reference the middle of the ladder leads.
 */
export function strikePreference(kind: OptionKind, ladder: readonly bigint[], reference: bigint | null): { preferred: bigint[]; rest: bigint[] } {
  if (reference === null) {
    const middle = (ladder.length - 1) / 2
    const byMiddle = ladder.map((k, i) => ({ k, d: Math.abs(i - middle) })).sort((a, b) => a.d - b.d || (a.k < b.k ? -1 : 1))
    return { preferred: byMiddle.map((x) => x.k), rest: [] }
  }
  const below = ladder.filter((k) => k <= reference).reverse()
  const above = ladder.filter((k) => k >= reference)
  return kind === 'put' ? { preferred: below, rest: ladder.filter((k) => k > reference) } : { preferred: above, rest: ladder.filter((k) => k < reference).reverse() }
}

/** Listed expiries, the ones at least 48 hours away first, each group soonest first. */
export function expiryPreference(expiries: readonly number[], nowSec: number): number[] {
  const far = expiries.filter((e) => e - nowSec >= MIN_DEFAULT_LEAD_SECONDS)
  const near = expiries.filter((e) => e - nowSec < MIN_DEFAULT_LEAD_SECONDS)
  return [...far, ...near]
}

/**
 * The series shown when the URL does not name one: the soonest comfortable deadline that has something funded on
 * the natural side of the reference, at the strike nearest the reference. `funded` holds the `cellKey` of every
 * series the wallet can take an order from. A pinned strike or expiry is kept as it is.
 */
export function defaultSeries(kind: OptionKind, grid: Grid, funded: ReadonlySet<string>, pinned: Series): Series {
  const expiries = pinned.expiry !== null ? [pinned.expiry] : expiryPreference(grid.expiries, grid.nowSec)
  const order = strikePreference(kind, grid.ladder, grid.reference)
  const preferred = pinned.strike !== null ? [pinned.strike] : order.preferred
  const all = pinned.strike !== null ? [pinned.strike] : [...order.preferred, ...order.rest]
  for (const strikes of [preferred, all])
    for (const expiry of expiries)
      for (const strikePerUnit of strikes) if (funded.has(cellKey({ expiry, kind, strikePerUnit }))) return { strike: strikePerUnit, expiry }
  return { strike: all[0] ?? null, expiry: expiries[0] ?? null }
}

/** A positive amount typed by the user, in exact units; null for anything else. */
export function parsePositive(text: string, decimals: number): bigint | null {
  const units = parseAmount(text, decimals)
  return units !== null && units > 0n ? units : null
}

/**
 * A decimal as the router accepts it in a link (`5`, `0.5`, `12.25`), or undefined when the text is empty or not
 * a decimal. `5.` becomes `5` and `.5` becomes `0.5`; nothing else is rewritten.
 */
export function normalizeDecimal(text: string): string | undefined {
  const t = text.trim()
  const m = /^(\d*)(?:\.(\d*))?$/.exec(t)
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) return undefined
  const whole = m[1] === '' ? '0' : m[1]
  const fraction = m[2] ?? ''
  if (whole.length > 19 || fraction.length > 7) return undefined
  return fraction === '' ? whole : `${whole}.${fraction}`
}

/**
 * Strike per unit times quantity as an exact quote amount, or null when it is not one. The contract takes totals,
 * so a quantity that does not multiply out exactly cannot be an order (the same rule as core/maker/buildOffer).
 */
export function totalStrike(strikePerUnit: bigint, qty: bigint, underlyingDecimals: number): bigint | null {
  const base = 10n ** BigInt(underlyingDecimals)
  const scaled = strikePerUnit * qty
  return scaled % base === 0n ? scaled / base : null
}

/**
 * The largest quantity a balance allows, for the Max action. An intent that starts from the asset is capped by
 * the asset held; "Earn while waiting to buy" by what the quote balance pays for at the strike, cut to two
 * decimals. "Lock a buy price" has no cap of this kind (only the premium is paid now): null.
 */
export function maxQuantity(
  intent: GuidedIntent,
  balances: { asset: bigint | null; quote: bigint | null },
  strikePerUnit: bigint | null,
  underlyingDecimals: number,
): bigint | null {
  if (intent === 'floor' || intent === 'earn-hold') return balances.asset !== null && balances.asset > 0n ? balances.asset : null
  if (intent === 'lock-buy' || balances.quote === null || strikePerUnit === null || strikePerUnit <= 0n) return null
  const qty = (balances.quote * 10n ** BigInt(underlyingDecimals)) / strikePerUnit
  const step = 10n ** BigInt(Math.max(underlyingDecimals - 2, 0))
  const cut = qty - (qty % step)
  return cut > 0n ? cut : null
}

/**
 * A total premium for `qty` at a per-unit price, cut down to the 0.01 tick the standard grid uses. Only for the
 * one-tap "use this price" suggestion; the user can type any amount.
 */
export function premiumAt(perUnit: bigint, qty: bigint, underlyingDecimals: number, quoteDecimals: number): bigint {
  const total = (perUnit * qty) / 10n ** BigInt(underlyingDecimals)
  const tick = 10n ** BigInt(Math.max(quoteDecimals - 2, 0))
  return total - (total % tick)
}

/**
 * An amount as an input shows it: no grouping, two decimals for a round amount (`2.00`), every digit otherwise
 * (`2.125`). It parses back to exactly the same units.
 */
export function inputAmount(units: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const fraction = decimals > 0 ? (units % base).toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  return `${units / base}${decimals > 0 ? `.${fraction.padEnd(Math.min(2, decimals), '0')}` : ''}`
}

/** The ticket that takes an order as it stands: buy an offer, buy a resale listing, or fill a request. */
export function takeIntent(row: BookRow, me: string | null): TicketIntent | null {
  const action = bookRowAction(row, me).kind
  if (action === 'buy' && row.offer) return { mode: 'buy', offerId: row.offer.id }
  if (action === 'buy-resale' && row.offer) return { mode: 'buy-resale', optionId: row.offer.id }
  if (action === 'fill' && row.bid) return { mode: 'fill', bidId: row.bid.id }
  return null
}

export interface OwnTerms {
  assetId: string
  kind: OptionKind
  /** Decimal strings as the URL carries them. */
  strike: string
  qty: string
  premium?: string
  expiry: number
}

/** The ticket for terms of the user's own: a buyer posts a request (bid), a seller posts an offer (write). */
export function ownIntent(side: 'buy' | 'write', t: OwnTerms): TicketIntent {
  const terms = { assetId: t.assetId, kind: t.kind, strike: t.strike, expiry: t.expiry, qty: t.qty, ...(t.premium ? { premium: t.premium } : {}) }
  return side === 'buy' ? { mode: 'bid', ...terms } : { mode: 'write', ...terms }
}

// ------------------------------------------------------------------------------------------- lots

/** The quantities on offer in one series, smallest first, each once. Offers are sold whole: these are the lots. */
export function lotsOf(rows: readonly Pick<BookRow, 'underlyingQty'>[]): bigint[] {
  return [...new Set(rows.map((r) => r.underlyingQty))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Smaller lots of the same series that together stay within the quantity asked for, best price per unit first:
 * what taking them one by one would cover. Empty when no smaller lot exists.
 */
export function coverWith<R extends Pick<BookRow, 'underlyingQty' | 'totalPremium'>>(rows: readonly R[], qty: bigint, side: 'buy' | 'write'): { rows: R[]; total: bigint } {
  const smaller = rows
    .filter((r) => r.underlyingQty < qty)
    .sort((a, b) => {
      // Cross-multiplied per-unit prices: cheaper first for a buyer, higher first for a seller.
      const lhs = a.totalPremium * b.underlyingQty
      const rhs = b.totalPremium * a.underlyingQty
      return side === 'buy' ? (lhs < rhs ? -1 : lhs > rhs ? 1 : 0) : lhs > rhs ? -1 : lhs < rhs ? 1 : 0
    })
  const taken: R[] = []
  let total = 0n
  for (const r of smaller) {
    if (total + r.underlyingQty > qty) continue
    taken.push(r)
    total += r.underlyingQty
  }
  return { rows: taken, total }
}

/** True when an option, offer or request is of exactly this series. */
export function inSeries(o: Parameters<typeof seriesRefOf>[0], ref: Pick<SeriesRef, 'underlyingId' | 'expiry' | 'kind' | 'strikePerUnit'>): boolean {
  const own = seriesRefOf(o)
  return own !== null && own.underlyingId === ref.underlyingId && own.expiry === ref.expiry && own.kind === ref.kind && own.strikePerUnit === ref.strikePerUnit
}

// ------------------------------------------------------------------------------------------- display numbers

/** `0.4% below`, `1% above`, `at`: where a strike stands against the reference. `pct` comes from core/reference `distancePct`. */
export function distanceWords(pct: number | null): { short: string; side: 'below' | 'above' | 'at' } | null {
  if (pct === null) return null
  const abs = Math.abs(pct)
  if (abs === 0) return { short: 'at the price', side: 'at' }
  const digits = abs < 0.1 ? abs.toFixed(2) : abs.toFixed(1)
  const text = digits.includes('.') ? digits.replace(/0+$/, '').replace(/\.$/, '') : digits
  return { short: `${text}% ${pct < 0 ? 'below' : 'above'}`, side: pct < 0 ? 'below' : 'above' }
}

/** The largest of 1, 2 or 5 times a power of ten that is not above `x`. */
function niceBelow(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1
  const power = 10 ** Math.floor(Math.log10(x))
  const lead = x / power
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power
}

export interface Scenarios {
  low: number
  mid: number
  high: number
}

/**
 * Three prices for the outcome cards: the reference (or the strike when there is none), and a round price about
 * a tenth below and above it, pushed out until both sit beyond the strike and the breakeven so that each card
 * shows a different regime. Display numbers for a hypothetical figure, never amounts.
 */
export function scenarioPrices(strike: number, reference: number | null, breakeven: number): Scenarios {
  const mid = reference ?? strike
  const step = niceBelow(mid * 0.1)
  const floor = Math.min(strike, breakeven, mid)
  const ceil = Math.max(strike, breakeven, mid)
  let low = Math.round((mid - step) / step) * step
  let high = Math.round((mid + step) / step) * step
  for (let i = 0; i < 20 && low >= floor - step * 0.25 && low > step; i++) low -= step
  for (let i = 0; i < 20 && high <= ceil + step * 0.25; i++) high += step
  const clean = (n: number) => Number(n.toPrecision(12))
  return { low: clean(Math.max(low, 0)), mid, high: clean(high) }
}
