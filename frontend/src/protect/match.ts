import { formatDisplay } from '../options/format'
import type { OptionOffer } from '../options/types'

/** What the user wants to protect. Amounts are exact units of the underlying / quote token. */
export interface ProtectGoal {
  underlyingId: string
  /** Quantity to protect, in underlying units. */
  qty: bigint
  /** Floor price: quote units per ONE whole underlying unit (scaled by the quote decimals). */
  floor: bigint
  /** Latest acceptable expiry, in days from now; null = any. */
  maxDays: number | null
  /** Connected wallet: its own offers are never suggested. */
  me?: string | null
}

export interface ProtectMatch {
  offer: OptionOffer
  /** Strike per whole underlying unit, in quote units. */
  strikePU: bigint
  /** Premium per whole underlying unit, in quote units. */
  premiumPU: bigint
  /** Underlying units of the user's goal this offer covers (min of offer size and goal). */
  covered: bigint
  /** The offer covers less than the whole goal. */
  partial: boolean
}

export interface ProtectResult {
  /** Offers meeting the floor, expiry and size filters, best (lowest premium per unit) first. */
  matches: ProtectMatch[]
  /** Only filled when `matches` is empty: puts with a strike below the floor, closest strike first. */
  closest: ProtectMatch[]
  /** Offers that fit except they are larger than the quantity to protect. */
  oversized: number
}

const pow10 = (n: number) => 10n ** BigInt(n)

/** Quote units per whole underlying unit. Floors the division; display and ranking only. */
export function perUnit(totalQuote: bigint, qty: bigint, underlyingDecimals: number): bigint {
  return qty === 0n ? 0n : (totalQuote * pow10(underlyingDecimals)) / qty
}

/** Lower premium per unit first (exact cross-multiplication), then higher strike, then sooner expiry. */
export function byBest(a: ProtectMatch, b: ProtectMatch): number {
  const l = a.offer.totalPremium * b.offer.underlyingQty
  const r = b.offer.totalPremium * a.offer.underlyingQty
  if (l !== r) return l < r ? -1 : 1
  if (a.strikePU !== b.strikePU) return a.strikePU > b.strikePU ? -1 : 1
  return a.offer.expiry - b.offer.expiry
}

function toMatch(o: OptionOffer, goalQty: bigint): ProtectMatch {
  const d = o.underlying.decimals
  return {
    offer: o,
    strikePU: perUnit(o.totalStrike, o.underlyingQty, d),
    premiumPU: perUnit(o.totalPremium, o.underlyingQty, d),
    covered: o.underlyingQty < goalQty ? o.underlyingQty : goalQty,
    partial: o.underlyingQty < goalQty,
  }
}

/**
 * Finds funded PUT offers that protect `goal`. Pure: `nowSec` is injected. An offer is a candidate when it is open
 * (state offered, not expired), a put on the same underlying, not the user's own, and expires within the window.
 * Candidates larger than the quantity are excluded (they would insure more than is held); smaller ones are kept
 * with partial coverage. Nothing is priced or invented: every figure comes from the offer itself.
 */
export function matchProtection(offers: OptionOffer[], goal: ProtectGoal, nowSec: number): ProtectResult {
  const maxExpiry = goal.maxDays == null ? Infinity : nowSec + goal.maxDays * 86400
  const candidates = offers.filter(
    (o) =>
      o.state === 'offered' &&
      o.expiry > nowSec &&
      o.kind === 'put' &&
      o.underlying.contractId === goal.underlyingId &&
      o.expiry <= maxExpiry &&
      !(goal.me && o.writer === goal.me),
  )
  let oversized = 0
  const fits: ProtectMatch[] = []
  for (const o of candidates) {
    if (o.underlyingQty > goal.qty) {
      oversized++
      continue
    }
    fits.push(toMatch(o, goal.qty))
  }
  const matches = fits.filter((m) => m.strikePU >= goal.floor).sort(byBest)
  const closest =
    matches.length > 0
      ? []
      : fits
          .filter((m) => m.strikePU < goal.floor)
          .sort((a, b) => (a.strikePU !== b.strikePU ? (a.strikePU > b.strikePU ? -1 : 1) : byBest(a, b)))
          .slice(0, 3)
  return { matches, closest, oversized }
}

/** Display text for a per-unit quote amount. */
export function formatPU(v: bigint, quoteDecimals: number): string {
  return formatDisplay(v, quoteDecimals)
}

/** "Covers 5 of your 50 RWA" */
export function coverageText(m: ProtectMatch, goalQty: bigint, decimals: number, code: string): string {
  return `Covers ${formatDisplay(m.covered, decimals)} of your ${formatDisplay(goalQty, decimals)} ${code}`
}
