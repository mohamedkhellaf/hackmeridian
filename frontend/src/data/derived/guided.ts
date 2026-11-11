// What the contract holds for the terms a user picked in the guided flow (brief 4.3, block 3).
//
// An intent is one option leg seen from the user's side (core/payoff/strategies):
//   floor, lock-buy       the user BUYS a put or a call   -> matched against funded offers and resale listings
//   earn-hold, earn-buy   the user WRITES a call or a put -> matched against funded bids (a buyer's escrowed premium)
//
// The Covered contract has no partial fills: an offer or a bid is for one fixed quantity. So "exactly this" means
// the same series AND the same quantity. Anything else is offered as a nearby alternative, never silently swapped in.
// Only standard orders are matched (the guided chips come from the standard grid).
import { bookRowAction, cellKey, seriesRefOf } from '../../core/market/selection'
import type { SeriesRef } from '../../core/market/selection'
import type { BookRow } from '../../core/market/book'
import type { OptionKind, TokenInfo } from '../../core/options/types'
import { intentInfo } from '../../core/payoff/strategies'
import type { GuidedIntent } from '../../core/payoff/strategies'
import type { ReferencePrice } from '../../core/reference'
import { classifyOffer, standardExpiries } from '../../core/series'
import { premiumUnits } from '../../core/units'
import { assetRows, ladderFor, marketInputs } from './market'
import type { MarketSource } from './market'

export interface GuidedTermsInput {
  intent: GuidedIntent
  /** Underlying units the user wants covered, or null while the field is empty. */
  qty: bigint | null
  /** Strike per unit in quote units, or null while not chosen. */
  strikePerUnit: bigint | null
  /** Expiry in unix seconds, or null while not chosen. */
  expiry: number | null
}

export interface GuidedAlternative {
  row: BookRow
  ref: SeriesRef
  perUnit: bigint | null
  /** What differs from the terms asked for. */
  differs: { qty: boolean; strike: boolean; expiry: boolean }
  /** Ladder steps between the strikes (0 when equal), and listed expiries between the dates (0 when equal). */
  strikeSteps: number
  expirySteps: number
}

export interface GuidedMatch {
  intent: GuidedIntent
  /** `buy`: the user pays a premium. `write`: the user locks collateral and is paid one. */
  side: 'buy' | 'write'
  kind: OptionKind
  /** Which side of the book is matched: offers and listings for a buyer, bids for a writer. */
  against: 'offers' | 'bids'
  /** The series asked for, or null while strike or expiry is missing. */
  ref: SeriesRef | null
  /**
   * The best order for exactly these terms and this quantity that the wallet can take: the cheapest offer or
   * listing for a buyer, the highest bid for a writer. Null when there is none (or the quantity is not set).
   */
  exact: BookRow | null
  exactPerUnit: bigint | null
  /** Other orders of the same series (same strike and expiry, another quantity), nearest quantity first. */
  sameSeries: GuidedAlternative[]
  /** Orders on the nearest other strikes and dates, nearest first, at most `limit`. */
  nearby: GuidedAlternative[]
  /** Series (`cellKey`) with at least one order the wallet can take, for marking the strike and expiry chips. */
  funded: ReadonlySet<string>
  /** Strikes with such an order at the chosen expiry (at any expiry while none is chosen). */
  fundedStrikes: ReadonlySet<bigint>
  /** Expiries with such an order at the chosen strike (at any strike while none is chosen). */
  fundedExpiries: ReadonlySet<number>
  /** What to offer when nothing matches: a buyer posts a request and escrows the premium; a seller posts an offer. */
  fallback: 'post-bid' | 'write-offer'
}

const TAKEABLE: ReadonlySet<string> = new Set(['buy', 'buy-resale', 'fill'])
const absDiff = (a: bigint, b: bigint): bigint => (a > b ? a - b : b - a)
const cmpBig = (a: bigint, b: bigint): number => (a < b ? -1 : a > b ? 1 : 0)

/** `a` is a better price than `b` for this side: cheaper per unit for a buyer, higher per unit for a writer. */
function betterPrice(a: BookRow, b: BookRow, side: 'buy' | 'write'): number {
  const lhs = a.totalPremium * b.underlyingQty
  const rhs = b.totalPremium * a.underlyingQty
  return side === 'buy' ? cmpBig(lhs, rhs) : cmpBig(rhs, lhs)
}

/**
 * Matches guided terms against the standard orders of one asset. `limit` caps `sameSeries` and `nearby`.
 * The reference price only shapes the strike ladder (the same ladder the chips use).
 */
export function matchGuided(
  src: MarketSource,
  asset: TokenInfo,
  quote: TokenInfo,
  reference: ReferencePrice,
  terms: GuidedTermsInput,
  limit: number = 3,
): GuidedMatch {
  const info = intentInfo(terms.intent)
  const side = info.side
  const kind = info.optionKind
  const against = side === 'buy' ? 'offers' : 'bids'
  const rows = assetRows(marketInputs(src), asset.contractId)
  const expiries = standardExpiries(src.nowSec)
  const ladder = ladderFor(reference, quote.decimals, rows)

  // Standard orders of the right kind, on the right side of the book, that this wallet can take.
  const candidates: { row: BookRow; ref: SeriesRef }[] = []
  for (const row of rows) {
    if (row.kind !== kind || (row.source === 'bid') !== (against === 'bids')) continue
    if (!TAKEABLE.has(bookRowAction(row, src.me).kind)) continue
    if (!classifyOffer(row, ladder, expiries).standard) continue
    const ref = seriesRefOf(row)
    if (ref) candidates.push({ row, ref })
  }

  const funded = new Set<string>()
  const fundedStrikes = new Set<bigint>()
  const fundedExpiries = new Set<number>()
  for (const { ref } of candidates) {
    funded.add(cellKey(ref))
    if (terms.expiry === null || ref.expiry === terms.expiry) fundedStrikes.add(ref.strikePerUnit)
    if (terms.strikePerUnit === null || ref.strikePerUnit === terms.strikePerUnit) fundedExpiries.add(ref.expiry)
  }

  const ref: SeriesRef | null =
    terms.strikePerUnit !== null && terms.expiry !== null ? { underlyingId: asset.contractId, expiry: terms.expiry, kind, strikePerUnit: terms.strikePerUnit } : null

  const strikeIndex = (k: bigint) => ladder.indexOf(k)
  const expiryIndex = (e: number) => expiries.indexOf(e)
  const alternative = (c: { row: BookRow; ref: SeriesRef }): GuidedAlternative => {
    const strike = terms.strikePerUnit !== null && c.ref.strikePerUnit !== terms.strikePerUnit
    const expiry = terms.expiry !== null && c.ref.expiry !== terms.expiry
    return {
      row: c.row,
      ref: c.ref,
      perUnit: premiumUnits(c.row),
      differs: { qty: terms.qty !== null && c.row.underlyingQty !== terms.qty, strike, expiry },
      strikeSteps: strike && terms.strikePerUnit !== null ? Math.abs(strikeIndex(c.ref.strikePerUnit) - strikeIndex(terms.strikePerUnit)) : 0,
      expirySteps: expiry && terms.expiry !== null ? Math.abs(expiryIndex(c.ref.expiry) - expiryIndex(terms.expiry)) : 0,
    }
  }
  const qtyGap = (r: BookRow): bigint => (terms.qty === null ? 0n : absDiff(r.underlyingQty, terms.qty))

  const inSeries = ref ? candidates.filter((c) => cellKey(c.ref) === cellKey(ref)) : []
  const exactRows = terms.qty === null ? [] : inSeries.filter((c) => c.row.underlyingQty === terms.qty).sort((a, b) => betterPrice(a.row, b.row, side) || (a.row.key < b.row.key ? -1 : 1))
  const exact = exactRows[0]?.row ?? null

  const sameSeries = inSeries
    .filter((c) => c.row !== exact && (terms.qty === null || c.row.underlyingQty !== terms.qty))
    .sort((a, b) => cmpBig(qtyGap(a.row), qtyGap(b.row)) || betterPrice(a.row, b.row, side))
    .slice(0, limit)
    .map(alternative)

  const nearby = candidates
    .filter((c) => !ref || cellKey(c.ref) !== cellKey(ref))
    .map(alternative)
    .sort(
      (a, b) =>
        a.strikeSteps + a.expirySteps - (b.strikeSteps + b.expirySteps) ||
        // The same date at another strike reads closer than the same strike at another date.
        a.expirySteps - b.expirySteps ||
        cmpBig(qtyGap(a.row), qtyGap(b.row)) ||
        betterPrice(a.row, b.row, side),
    )
    .slice(0, limit)

  return {
    intent: terms.intent,
    side,
    kind,
    against,
    ref,
    exact,
    exactPerUnit: exact ? premiumUnits(exact) : null,
    sameSeries,
    nearby,
    funded,
    fundedStrikes,
    fundedExpiries,
    fallback: side === 'buy' ? 'post-bid' : 'write-offer',
  }
}
