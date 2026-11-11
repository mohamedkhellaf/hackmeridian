// The standard series grid (brief D11). An app convention only: the contract accepts any terms, and an offer that
// is off the grid stays buyable from an "Other offers" list. The grid decides which expiry tabs and strike rows
// the chain shows, so nothing a stranger posts can add a tab or a row.
//
// - Expiries: Fridays 08:00:00 UTC. Listed at any moment: the next 2 Fridays and the next 3 month-end Fridays
//   (the last Friday of a month), every one at least one hour ahead.
// - Strikes: a 1-2-5 step ladder around the reference price. The step is the smallest of {1, 2, 5} x 10^n that is
//   at least 1 % of the reference (so 1 % to 2.5 %; where two steps fit, the smaller), and never below the strike
//   tick of 0.01 quote unit. Every strike on the ladder has at most 3 significant digits.
// - A standard offer: lot of at least 1 whole unit, strike on the ladder, a listed expiry, premium on the 0.01
//   tick, and for a put a premium that does not exceed the strike.
//
// All arithmetic is exact bigint in token units. Prices "per unit" are quote units for one whole underlying unit.

import type { OptionKind } from '../options/types'

export const DAY_SECONDS = 86_400
export const WEEK_SECONDS = 604_800
/** `ts % WEEK_SECONDS` of every Friday 08:00:00 UTC (the epoch began on a Thursday). */
export const FRIDAY_0800_UTC_OFFSET = 115_200
/** A listed expiry is at least this far ahead. */
export const MIN_EXPIRY_LEAD_SECONDS = 3_600
export const WEEKLY_EXPIRIES = 2
export const MONTHLY_EXPIRIES = 3

/** True for any Friday 08:00:00 UTC, past or future. */
export function isStandardExpiry(ts: number): boolean {
  return Number.isInteger(ts) && ts > 0 && ts % WEEK_SECONDS === FRIDAY_0800_UTC_OFFSET
}

/** The last Friday 08:00:00 UTC of a UTC month (`month` is 0 to 11 and may overflow into the next year). */
export function lastFridayOfMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 8, 0, 0))
  const back = (lastDay.getUTCDay() - 5 + 7) % 7
  return lastDay.getTime() / 1000 - back * DAY_SECONDS
}

/** True when `ts` is the last Friday 08:00:00 UTC of its month. */
export function isMonthlyExpiry(ts: number): boolean {
  if (!isStandardExpiry(ts)) return false
  const d = new Date(ts * 1000)
  return lastFridayOfMonth(d.getUTCFullYear(), d.getUTCMonth()) === ts
}

/**
 * The listed expiries at `nowSec`: the next 2 Fridays 08:00 UTC and the next 3 month-end Fridays 08:00 UTC,
 * without duplicates, ascending. Each is at least one hour after `nowSec`, so on a Friday after 07:00 UTC that
 * day's expiry is no longer listed. A month whose last Friday has passed is skipped, not replaced by an earlier date.
 */
export function standardExpiries(nowSec: number): number[] {
  if (!Number.isFinite(nowSec)) return []
  const earliest = Math.ceil(nowSec) + MIN_EXPIRY_LEAD_SECONDS
  const sinceFriday = (((earliest - FRIDAY_0800_UTC_OFFSET) % WEEK_SECONDS) + WEEK_SECONDS) % WEEK_SECONDS
  const first = sinceFriday === 0 ? earliest : earliest + (WEEK_SECONDS - sinceFriday)
  const start = new Date(earliest * 1000)
  if (Number.isNaN(start.getTime())) return [] // beyond the range of a Date: not a clock reading
  const out = new Set<number>()
  for (let i = 0; i < WEEKLY_EXPIRIES; i++) out.add(first + i * WEEK_SECONDS)
  let monthlies = 0
  for (let m = 0; monthlies < MONTHLY_EXPIRIES; m++) {
    const ts = lastFridayOfMonth(start.getUTCFullYear(), start.getUTCMonth() + m)
    if (ts < earliest) continue
    out.add(ts)
    monthlies++
  }
  return [...out].sort((a, b) => a - b)
}

/** `weekly` or `monthly` for a Friday 08:00 UTC expiry, null for any other instant. */
export function expiryCycle(ts: number): 'weekly' | 'monthly' | null {
  if (!isStandardExpiry(ts)) return null
  return isMonthlyExpiry(ts) ? 'monthly' : 'weekly'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** UTC day key of an expiry, `2026-11-13`: the value of the `expiry=` search param. */
export function expiryDayKey(ts: number): string {
  const d = new Date(ts * 1000)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/**
 * 08:00:00 UTC on a `YYYY-MM-DD` day, or null when the text is not a real calendar day. The result is a standard
 * expiry only when that day is a Friday (check with `isStandardExpiry`).
 */
export function expiryFromDayKey(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(y, mo - 1, d, 8, 0, 0)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return ms / 1000
}

// ---------------------------------------------------------------------------------------------- strikes

/** Default number of strike rows. */
export const DEFAULT_LADDER_COUNT = 7
/** A standard strike has at most this many significant digits. */
export const MAX_STRIKE_SIGNIFICANT_DIGITS = 3
/** Strikes and premiums are quoted on 0.01 of the quote token. */
export const TICK_DP = 2

/** Significant digits of a positive integer amount: trailing zeros do not count (`1_020_000_000n` has 3). Zero has 0. */
export function significantDigits(units: bigint): number {
  const abs = units < 0n ? -units : units
  if (abs === 0n) return 0
  return abs.toString().replace(/0+$/, '').length
}

/** One tick (0.01 by default) in units of a token with `decimals` decimals. At least one unit. */
export function tickUnits(decimals: number, tickDp: number = TICK_DP): bigint {
  return decimals > tickDp ? 10n ** BigInt(decimals - tickDp) : 1n
}

export interface LadderOptions {
  /** Strikes that exist (per unit), used only when there is no reference price. */
  existing?: readonly bigint[]
  /** Decimal places of the strike tick. Default 2 (0.01). */
  tickDp?: number
}

/**
 * The ladder step for a reference price: the smallest of {1, 2, 5} x 10^n quote units with `step x 100 >= reference`,
 * raised to the strike tick when the reference is very low. Where two steps fit the 1 % to 2.5 % band, this is the
 * smaller one. Null without a positive reference.
 */
export function ladderStep(referencePerUnit: bigint | null, decimals: number, tickDp: number = TICK_DP): bigint | null {
  if (referencePerUnit === null || referencePerUnit <= 0n) return null
  const tick = tickUnits(decimals, tickDp)
  for (let magnitude = 1n; ; magnitude *= 10n) {
    for (const mantissa of [1n, 2n, 5n]) {
      const step = mantissa * magnitude
      if (step >= tick && step * 100n >= referencePerUnit) return step
    }
  }
}

const dedupeAscending = (values: readonly bigint[]): bigint[] =>
  [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** The window of `count` entries around the middle of `sorted`. */
function middle(sorted: bigint[], count: number): bigint[] {
  if (sorted.length <= count) return sorted
  const mid = Math.floor((sorted.length - 1) / 2)
  const start = Math.min(Math.max(mid - Math.floor((count - 1) / 2), 0), sorted.length - count)
  return sorted.slice(start, start + count)
}

/**
 * The ladder when there is no reference price: the strikes that exist, kept when they are positive, on the tick
 * and have at most 3 significant digits; ascending; when there are more than `count`, the `count` around the median.
 */
export function ladderFromStrikes(existing: readonly bigint[], decimals: number, count: number = DEFAULT_LADDER_COUNT, tickDp: number = TICK_DP): bigint[] {
  const tick = tickUnits(decimals, tickDp)
  const ok = existing.filter((k) => k > 0n && k % tick === 0n && significantDigits(k) <= MAX_STRIKE_SIGNIFICANT_DIGITS)
  return middle(dedupeAscending(ok), Math.max(1, Math.floor(count)))
}

/**
 * The standard strikes (per unit, in quote units, ascending) for a reference price: `count` strikes one step apart,
 * centred on the multiple of the step nearest the reference (a reference exactly between two strikes takes the
 * upper one; an even `count` puts the extra strike above). The ladder never contains zero or a negative strike:
 * for a very low reference it starts at one step and still has `count` strikes.
 *
 * Without a reference (`null` or not positive) the ladder is built from `opts.existing`, see `ladderFromStrikes`;
 * with no reference and no strikes it is empty.
 */
export function strikeLadder(
  referencePerUnit: bigint | null,
  decimals: number,
  count: number = DEFAULT_LADDER_COUNT,
  opts: LadderOptions = {},
): bigint[] {
  const n = Math.max(1, Math.floor(count))
  const step = ladderStep(referencePerUnit, decimals, opts.tickDp)
  if (step === null || referencePerUnit === null) return ladderFromStrikes(opts.existing ?? [], decimals, n, opts.tickDp)
  const centre = ((referencePerUnit + step / 2n) / step) * step
  const below = BigInt(Math.floor((n - 1) / 2))
  const lowest = centre - below * step
  const start = lowest < step ? step : lowest
  return Array.from({ length: n }, (_, i) => start + BigInt(i) * step)
}

/** True when the per-unit strike is one of the ladder's strikes. */
export function isStandardStrike(strikePerUnit: bigint | null, ladder: readonly bigint[]): boolean {
  return strikePerUnit !== null && ladder.includes(strikePerUnit)
}

/** The ladder strike nearest a price (the lower one on a tie). Null for an empty ladder or no price. */
export function nearestStrike(pricePerUnit: bigint | null, ladder: readonly bigint[]): bigint | null {
  if (pricePerUnit === null || ladder.length === 0) return null
  const dist = (k: bigint) => (k > pricePerUnit ? k - pricePerUnit : pricePerUnit - k)
  return ladder.reduce((best, k) => (dist(k) < dist(best) ? k : best))
}

// ---------------------------------------------------------------------------------------------- offers

/** The terms an offer, a bid or a position has in common. `OptionOffer`, `Bid` and `NewOffer` all satisfy it. */
export interface SeriesTerms {
  kind: OptionKind
  underlying: { decimals: number }
  quote: { decimals: number }
  underlyingQty: bigint
  totalStrike: bigint
  totalPremium: bigint
  expiry: number
}

/**
 * Strike for one whole unit of underlying, in quote units, when that is an exact amount; null when the total
 * strike does not divide evenly (such an offer can never sit on the ladder) or the quantity is not positive.
 */
export function exactStrikePerUnit(o: Pick<SeriesTerms, 'underlying' | 'underlyingQty' | 'totalStrike'>): bigint | null {
  if (o.underlyingQty <= 0n) return null
  const scaled = o.totalStrike * 10n ** BigInt(o.underlying.decimals)
  return scaled % o.underlyingQty === 0n ? scaled / o.underlyingQty : null
}

/**
 * The exact per-unit strikes of offers of at least 1 whole unit, for `strikeLadder(null, ..., { existing })`.
 * Smaller lots are left out so that dust cannot shape the ladder of an asset without a reference price.
 */
export function strikesOf(offers: readonly Pick<SeriesTerms, 'underlying' | 'underlyingQty' | 'totalStrike'>[]): bigint[] {
  const out: bigint[] = []
  for (const o of offers) {
    if (o.underlyingQty < 10n ** BigInt(o.underlying.decimals)) continue
    const k = exactStrikePerUnit(o)
    if (k !== null) out.push(k)
  }
  return out
}

/** Why an offer is not standard. The first rule that fails, in this order. */
export type NonStandardReason =
  | 'lot below 1 unit'
  | 'off-grid strike'
  | 'non-standard expiry'
  | 'premium off the 0.01 tick'
  | 'put premium above strike'

export const NON_STANDARD_REASONS: readonly NonStandardReason[] = [
  'lot below 1 unit',
  'off-grid strike',
  'non-standard expiry',
  'premium off the 0.01 tick',
  'put premium above strike',
]

export type OfferClass = { standard: true } | { standard: false; reason: NonStandardReason }

/**
 * Standard, or the first reason it is not. `ladder` is the strike ladder of the offer's asset (`strikeLadder`),
 * `expiries` the listed expiries (`standardExpiries(now)`), so an expired offer is never standard.
 *
 * Rules, in order: the lot is at least 1 whole unit of underlying; the strike per unit is exact and on the ladder;
 * the expiry is listed; the total premium is a positive multiple of 0.01 quote unit; a put's premium does not
 * exceed its strike (a put cannot be worth more than its strike). Classification never blocks a trade: a
 * non-standard offer is still buyable.
 */
export function classifyOffer(offer: SeriesTerms, ladder: readonly bigint[], expiries: readonly number[]): OfferClass {
  const no = (reason: NonStandardReason): OfferClass => ({ standard: false, reason })
  if (offer.underlyingQty < 10n ** BigInt(offer.underlying.decimals)) return no('lot below 1 unit')
  if (!isStandardStrike(exactStrikePerUnit(offer), ladder)) return no('off-grid strike')
  if (!expiries.includes(offer.expiry)) return no('non-standard expiry')
  if (offer.totalPremium <= 0n || offer.totalPremium % tickUnits(offer.quote.decimals) !== 0n) return no('premium off the 0.01 tick')
  if (offer.kind === 'put' && offer.totalPremium > offer.totalStrike) return no('put premium above strike')
  return { standard: true }
}

export interface Partition<T> {
  standard: T[]
  other: { offer: T; reason: NonStandardReason }[]
  /** How many offers fell under each reason (each offer is counted once, under its first reason). */
  counts: Record<NonStandardReason, number>
}

/** Splits offers into the chain's standard offers and the "Other offers" list with the reason for each. */
export function partitionOffers<T extends SeriesTerms>(offers: readonly T[], ladder: readonly bigint[], expiries: readonly number[]): Partition<T> {
  const counts = Object.fromEntries(NON_STANDARD_REASONS.map((r) => [r, 0])) as Record<NonStandardReason, number>
  const out: Partition<T> = { standard: [], other: [], counts }
  for (const offer of offers) {
    const c = classifyOffer(offer, ladder, expiries)
    if (c.standard) out.standard.push(offer)
    else {
      out.other.push({ offer, reason: c.reason })
      counts[c.reason]++
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------- names

/** Plain decimal text without grouping or trailing zeros: `1_000_000_000n` at 7 decimals is `100`, `102_000_000n` is `10.2`. */
export function plainDecimal(units: bigint, decimals: number): string {
  const negative = units < 0n
  const abs = negative ? -units : units
  const base = 10n ** BigInt(decimals)
  const fraction = decimals > 0 ? (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  return `${negative ? '-' : ''}${abs / base}${fraction ? `.${fraction}` : ''}`
}

export interface SeriesId {
  /** Underlying asset code. A display label: the asset's identity is its contract id. */
  code: string
  /** Expiry, unix seconds. */
  expiry: number
  /** Strike per unit, in quote units. */
  strikePerUnit: bigint
  /** Decimals of the quote token. */
  decimals: number
  kind: OptionKind
}

/** `BOND-20261218-100-P`: code, UTC expiry day, strike per unit, P or C. The ISO day makes names sort by expiry. */
export function seriesName(s: SeriesId): string {
  const day = expiryDayKey(s.expiry).replaceAll('-', '')
  return `${s.code}-${day}-${plainDecimal(s.strikePerUnit, s.decimals)}-${s.kind === 'put' ? 'P' : 'C'}`
}

/**
 * The series name of an offer, a bid or a position, or null when its strike per unit is not an exact amount
 * (such terms belong to no series).
 */
export function seriesNameOf(o: SeriesTerms & { underlying: { code: string; decimals: number } }): string | null {
  const strikePerUnit = exactStrikePerUnit(o)
  if (strikePerUnit === null) return null
  return seriesName({ code: o.underlying.code, expiry: o.expiry, strikePerUnit, decimals: o.quote.decimals, kind: o.kind })
}

export interface ParsedSeriesName {
  code: string
  /** UTC day, `2026-12-18`. */
  day: string
  /** 08:00:00 UTC on that day. */
  expiry: number
  /** Strike per unit as written, `100` or `10.2`. Parse it with the quote token's decimals. */
  strike: string
  kind: OptionKind
}

/** The parts of a series name, or null when it is not one. The inverse of `seriesName` for standard expiries. */
export function parseSeriesName(name: string): ParsedSeriesName | null {
  const m = /^([A-Za-z0-9]{1,12})-(\d{4})(\d{2})(\d{2})-(\d{1,30}(?:\.\d{1,18})?)-([PC])$/.exec(name)
  if (!m) return null
  const day = `${m[2]}-${m[3]}-${m[4]}`
  const expiry = expiryFromDayKey(day)
  if (expiry === null) return null
  return { code: m[1], day, expiry, strike: m[5], kind: m[6] === 'P' ? 'put' : 'call' }
}
