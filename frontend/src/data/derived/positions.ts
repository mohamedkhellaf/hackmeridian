// The connected wallet's side of the contract: what it holds, what it wrote, its open orders, and what it has to
// do. Pure functions over the option, ask and bid lists; the hooks in ../derived.ts feed them.
//
// Nothing here values a position. Moneyness and the exercise value are measured against a reference price that
// the caller supplies and the screen must name ("at the reference price 10.00").
import { deadlineUrgency } from '../../core/format'
import type { DeadlineUrgency } from '../../core/format'
import { requiredCollateral } from '../../core/options/types'
import type { Ask, Money, OptionOffer } from '../../core/options/types'
import { actionKindOf, actionsWaiting, claimAmount, counterpartyLine, portfolioSummary, premiumOf, roleOf, statusOf, todoItems } from '../../core/portfolio/positions'
import type { ActionKind, PortfolioSummary, PositionStatus, PremiumCell, Role, TodoItem } from '../../core/portfolio/positions'
import { exerciseValue, optionMoneyness } from '../../core/reference'
import type { Moneyness, ReferencePrice } from '../../core/reference'
import { myOpenBids } from '../../core/requests/requests'
import type { Bid } from '../../core/requests/types'
import { askOf, isLive } from '../../core/resale/resale'
import { seriesNameOf } from '../../core/series'

/** The reference price of an option's underlying, or null when there is none. */
export type ReferenceOf = (o: OptionOffer) => ReferencePrice | null

export interface PositionView {
  option: OptionOffer
  /** The wallet's side. A wallet that is both writer and holder counts as writer. */
  role: Role
  status: PositionStatus
  /** The contract call this role can make now: exercise, claim, reclaim or cancel. Null when there is none. */
  action: ActionKind | null
  /** Second line: "Maker GABC...", "Buyer GABC...", "Listed in Markets", "No buyer". */
  counterparty: string
  premium: PremiumCell
  /** What the writer locked in the contract for this option. */
  collateral: Money
  /** Writer of an exercised option: what waits in the contract to be claimed (put: the underlying; call: the strike). */
  claim: Money | null
  /** The holder's live resale listing of this option, if any. */
  listing: Ask | null
  /** Seconds to the deadline while the option or offer is live, else null. */
  secondsLeft: number | null
  /** How close the deadline is (48 h, 2 h and 15 min thresholds), while live. */
  urgency: DeadlineUrgency | null
  /** Active options only: where the strike stands at the reference price. Null otherwise. */
  moneyness: Moneyness | null
  /** Active options only: what exercising now would be worth against not exercising, in quote units, signed. */
  exerciseValue: bigint | null
  reference: ReferencePrice | null
  /** `BOND-20261218-100-P`, or null when the strike per unit is not an exact amount. */
  series: string | null
  /** Nothing left to do for this role. Hidden unless "Show closed" is on. */
  closed: boolean
}

export interface PositionsView {
  /** Options the wallet holds or held. */
  holding: PositionView[]
  /** Options the wallet wrote that found a buyer. */
  written: PositionView[]
  orders: {
    /** Offers the wallet wrote that have no buyer: open, expired with collateral to reclaim, and (closed) cancelled or reclaimed. */
    offers: PositionView[]
    /** The wallet's requests (bids): open, or expired with the premium still escrowed; with closed ones when asked. */
    requests: Bid[]
    /** The wallet's live resale listings. */
    listings: { position: PositionView; ask: Ask }[]
  }
  counts: { holding: number; written: number; orders: number; closed: number }
}

export interface PositionsSource {
  options: OptionOffer[]
  asks: Ask[] | null
  bids: Bid[] | null
  me: string | null
  nowSec: number
  referenceOf?: ReferenceOf
}

/** One option as the wallet sees it, or null when the wallet is neither its writer nor its holder. */
export function positionView(o: OptionOffer, src: Omit<PositionsSource, 'options' | 'bids'>): PositionView | null {
  const role = roleOf(o, src.me)
  if (!role) return null
  const status = statusOf(o, role)
  const pending = o.state === 'offered' || o.state === 'active'
  const secondsLeft = pending ? o.expiry - src.nowSec : null
  const active = o.state === 'active'
  const reference = src.referenceOf?.(o) ?? null
  const ask = role === 'holder' && isLive(o, src.nowSec) ? askOf(src.asks, o.id) : undefined
  return {
    option: o,
    role,
    status,
    action: actionKindOf(o, role),
    counterparty: counterpartyLine(o, role),
    premium: premiumOf(o, role),
    collateral: requiredCollateral(o),
    claim: role === 'writer' && o.state === 'exercised' ? claimAmount(o) : null,
    listing: ask && ask.holder === src.me ? ask : null,
    secondsLeft,
    urgency: secondsLeft === null ? null : deadlineUrgency(secondsLeft),
    moneyness: active ? optionMoneyness(o, reference) : null,
    exerciseValue: active ? exerciseValue(o, reference) : null,
    reference,
    series: seriesNameOf(o),
    closed: status.closed,
  }
}

// Open first (soonest deadline first), then closed (most recent expiry first); ids break ties.
function byDeadline(a: PositionView, b: PositionView): number {
  if (a.closed !== b.closed) return a.closed ? 1 : -1
  const d = a.closed ? b.option.expiry - a.option.expiry : a.option.expiry - b.option.expiry
  return d || (a.option.id < b.option.id ? -1 : a.option.id > b.option.id ? 1 : 0)
}

const CLOSED_BIDS: ReadonlySet<Bid['state']> = new Set<Bid['state']>(['filled', 'cancelled', 'pruned'])

/**
 * The three tabs of the portfolio. Closed rows are left out unless `showClosed`; `counts.closed` says how many
 * there are either way.
 */
export function buildPositions(src: PositionsSource, showClosed: boolean = false): PositionsView {
  const all: PositionView[] = []
  for (const o of src.options) {
    const v = positionView(o, src)
    if (v) all.push(v)
  }
  const keep = (v: PositionView) => showClosed || !v.closed
  const holding = all.filter((v) => v.role === 'holder' && keep(v)).sort(byDeadline)
  const written = all.filter((v) => v.role === 'writer' && v.option.holder !== null && keep(v)).sort(byDeadline)
  const offers = all.filter((v) => v.role === 'writer' && v.option.holder === null && keep(v)).sort(byDeadline)
  const mine = src.me ? (src.bids ?? []).filter((b) => b.buyer === src.me) : []
  const requests = (showClosed ? mine : myOpenBids(src.bids ?? [], src.me)).slice().sort((a, b) => a.expiry - b.expiry || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const listings = all.flatMap((v) => (v.listing ? [{ position: v, ask: v.listing }] : []))
  const closed = all.filter((v) => v.closed).length + mine.filter((b) => CLOSED_BIDS.has(b.state)).length
  return {
    holding,
    written,
    orders: { offers, requests, listings },
    counts: { holding: holding.length, written: written.length, orders: offers.length + requests.length + listings.length, closed },
  }
}

// ------------------------------------------------------------------------------------------- to-do

/**
 * How a to-do card is shown:
 *   urgent   an exercise that is in the money at the reference price with 48 hours or less to the deadline
 *   action   a real action without a clock running out: an in-the-money exercise further away, a claim, a reclaim
 *   neutral  an exercise reminder: the option is at or out of the money at the reference, or there is no reference
 *   info     nothing to do (an option that expired unexercised)
 */
export type TodoTone = 'urgent' | 'action' | 'neutral' | 'info'

export interface TodoView extends TodoItem {
  /** `kind:optionId`, a stable React key. */
  key: string
  tone: TodoTone
  /** Exercise only: how close the deadline is. Null for the others (a claim and a reclaim never expire). */
  urgency: DeadlineUrgency | null
  /** Exercise only: the reference the moneyness was measured against, for the card's wording. */
  reference: ReferencePrice | null
  /** Exercise only: what exercising now would be worth against not exercising, in quote units, signed. */
  exerciseValue: bigint | null
}

function toneOf(t: TodoItem, urgency: DeadlineUrgency | null): TodoTone {
  if (t.kind === 'expired-unexercised') return 'info'
  if (t.kind !== 'exercise') return 'action'
  if (!t.actionable) return 'neutral'
  return urgency !== null && urgency !== 'far' ? 'urgent' : 'action'
}

/** The to-do strip (brief 4.5), most pressing first. Order and `actionable` come from core/portfolio `todoItems`. */
export function buildTodo(options: OptionOffer[], me: string | null, nowSec: number, referenceOf: ReferenceOf = () => null): TodoView[] {
  return todoItems(options, me, nowSec, referenceOf).map((t) => {
    const exercise = t.kind === 'exercise'
    const urgency = exercise && t.secondsLeft !== null ? deadlineUrgency(t.secondsLeft) : null
    const reference = exercise ? referenceOf(t.option) : null
    return {
      ...t,
      key: `${t.kind}:${t.option.id}`,
      tone: toneOf(t, urgency),
      urgency,
      reference,
      exerciseValue: exercise ? exerciseValue(t.option, reference) : null,
    }
  })
}

/** The number for the navigation badge: real actions only (claims, reclaims, in-the-money exercises). */
export function countActionsWaiting(options: OptionOffer[], me: string | null, nowSec: number, referenceOf: ReferenceOf = () => null): number {
  return actionsWaiting(todoItems(options, me, nowSec, referenceOf))
}

/** Summary figures of the portfolio: exact sums per token, no valuation. */
export function buildKpis(options: OptionOffer[], me: string | null): PortfolioSummary {
  return portfolioSummary(options, me)
}
