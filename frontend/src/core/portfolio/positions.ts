import { deliveryAmount } from '../options/abi'
import { formatDisplay, shortAddress } from '../options/format'
import { requiredCollateral } from '../options/types'
import type { Money, OptionOffer, TokenInfo } from '../options/types'
import { optionMoneyness } from '../reference/moneyness'
import type { Moneyness, PriceInput } from '../reference/moneyness'
import { compactCountdown } from '../time'

export type Role = 'holder' | 'writer'
export type StatusTone = 'info' | 'warn' | 'ok' | 'neutral'
export type PositionFilter = 'all' | 'holding' | 'writing'

/** Amount with at least two decimals (5 -> "5.00"), at most four, thousands separators. */
export function money(units: bigint, decimals: number): string {
  return formatDisplay(units, decimals)
}

export const moneyWith = (units: bigint, t: TokenInfo) => `${money(units, t.decimals)} ${t.code}`

/** The connected wallet's side of an option. A wallet that is both writer and holder counts as writer. */
export function roleOf(o: OptionOffer, me: string | null): Role | null {
  if (!me) return null
  if (o.writer === me) return 'writer'
  if (o.holder === me) return 'holder'
  return null
}

export interface PositionStatus {
  label: string
  tone: StatusTone
  /** Terminal for this role: nothing left to do. Hidden unless "Show closed" is on. */
  closed: boolean
}

export function statusOf(o: OptionOffer, role: Role): PositionStatus {
  switch (o.state) {
    case 'offered':
      return { label: 'Open offer', tone: 'neutral', closed: false }
    case 'active':
      return role === 'holder'
        ? { label: 'Active · exercisable', tone: 'info', closed: false }
        : { label: 'Sold · active', tone: 'info', closed: false }
    case 'exercised':
      return role === 'writer'
        ? { label: 'Awaiting your claim', tone: 'warn', closed: false }
        : { label: 'Exercised', tone: 'ok', closed: false }
    case 'expired':
      return role === 'writer'
        ? { label: 'Collateral reclaimable', tone: 'warn', closed: false }
        : { label: 'Expired unexercised', tone: 'neutral', closed: true }
    case 'settled':
      return { label: 'Settled', tone: 'ok', closed: true }
    case 'reclaimed':
      return { label: 'Reclaimed', tone: 'neutral', closed: true }
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral', closed: true }
  }
}

export type ActionKind = 'exercise' | 'claim' | 'reclaim' | 'cancel'

/**
 * Which explicit action this role can take on the option's current state.
 *
 * Nothing settles by itself. After an exercise the writer's side waits in the contract, for BOTH kinds: a put
 * writer must claim the underlying the holder delivered, and a call writer must claim the strike the holder paid.
 * So `claim` depends on the state alone, never on the kind.
 */
export function actionKindOf(o: OptionOffer, role: Role): ActionKind | null {
  if (role === 'holder' && o.state === 'active') return 'exercise'
  if (role === 'writer' && o.state === 'exercised') return 'claim'
  if (role === 'writer' && o.state === 'expired') return 'reclaim'
  if (role === 'writer' && o.state === 'offered') return 'cancel'
  return null
}

/** What the writer receives when claiming delivery of an exercised option: put -> the underlying, call -> the strike. */
export const claimAmount = (o: OptionOffer): Money => deliveryAmount(o)

/**
 * A button on a position row. Defined here (not in a component) so the data layer can build it and any table
 * can render it. `kind` names the contract call; `label` may carry progress ("Exercising").
 */
export interface RowAction {
  kind: ActionKind
  label: string
  onClick: () => void
  disabled?: boolean
}

/** Button label of each action. A claim is "Claim delivery" for puts and calls alike. */
export const ACTION_LABEL: Record<ActionKind, string> = {
  exercise: 'Exercise',
  claim: 'Claim delivery',
  reclaim: 'Reclaim',
  cancel: 'Cancel offer',
}

export function actionLabel(o: OptionOffer, kind: ActionKind): string {
  switch (kind) {
    case 'exercise':
      return 'Exercise'
    case 'cancel':
      return 'Cancel'
    case 'claim': {
      const c = claimAmount(o)
      return `Claim ${moneyWith(c.amount, c.token)}`
    }
    case 'reclaim': {
      const c = requiredCollateral(o)
      return `Reclaim ${moneyWith(c.amount, c.token)}`
    }
  }
}

export interface PremiumCell {
  /** Display text including sign and unit. */
  text: string
  tone: 'neg' | 'pos' | 'muted' | 'ask'
}

/**
 * Premium for the connected wallet: +earned as writer once sold, the ask while open. For a holder it is the
 * original premium paid to the writer, which is not the holder's own cost if they bought on resale.
 */
export function premiumOf(o: OptionOffer, role: Role): PremiumCell {
  const amt = moneyWith(o.totalPremium, o.quote)
  if (role === 'holder') return { text: `${amt} original premium (paid to the writer)`, tone: 'muted' }
  if (o.holder) return { text: `+${amt}`, tone: 'pos' }
  if (o.state === 'offered') return { text: `${amt} ask`, tone: 'ask' }
  return { text: '–', tone: 'muted' }
}

/** Second line under the option name: counterparty or listing context. */
export function counterpartyLine(o: OptionOffer, role: Role): string {
  if (role === 'holder') return `Maker ${shortAddress(o.writer)}`
  if (o.holder) return `Buyer ${shortAddress(o.holder)}`
  if (o.state === 'offered') return 'Listed in Markets'
  return 'No buyer'
}

/** "in 2d 23h", "in 5h 10m", "in 12m"; "expired" once the expiry has passed. */
export function countdown(expiry: number, nowMs: number): string {
  const left = compactCountdown(expiry, nowMs)
  return left === 'expired' ? left : `in ${left}`
}

/** Second line under the expiry: countdown while live, else the state word. */
export function expirySub(o: OptionOffer, nowMs: number): string {
  if (o.state === 'offered' || o.state === 'active') return countdown(o.expiry, nowMs)
  if (o.state === 'expired') return 'expired'
  return o.state
}

export interface Kpis {
  holding: number
  writing: number
  /** Collateral the connected wallet still has locked in the contract, per token. */
  locked: { token: TokenInfo; amount: bigint }[]
  /** Premium earned on sold options, in the quote token. Null when the wallet has not written anything. */
  premium: { token: TokenInfo; amount: bigint } | null
}

export function computeKpis(options: OptionOffer[], me: string | null): Kpis {
  let holding = 0
  let writing = 0
  const locked = new Map<string, { token: TokenInfo; amount: bigint }>()
  let premiumToken: TokenInfo | null = null
  let premiumSum = 0n
  for (const o of options) {
    const role = roleOf(o, me)
    if (role === 'holder' && o.state === 'active') holding++
    if (role !== 'writer') continue
    if (!statusOf(o, 'writer').closed) writing++
    if (o.state === 'offered' || o.state === 'active' || o.state === 'expired') {
      const c = requiredCollateral(o)
      const cur = locked.get(c.token.contractId)
      locked.set(c.token.contractId, { token: c.token, amount: (cur?.amount ?? 0n) + c.amount })
    }
    premiumToken ??= o.quote
    if (o.holder) premiumSum += o.totalPremium
  }
  return { holding, writing, locked: [...locked.values()], premium: premiumToken ? { token: premiumToken, amount: premiumSum } : null }
}

export function filterPositions(options: OptionOffer[], me: string | null, filter: PositionFilter, showClosed: boolean): OptionOffer[] {
  return options.filter((o) => {
    const role = roleOf(o, me)
    if (!role) return false
    if (filter === 'holding' && role !== 'holder') return false
    if (filter === 'writing' && role !== 'writer') return false
    return showClosed || !statusOf(o, role).closed
  })
}

/** Phrases for the "N actions waiting" banner: exercise, claim and reclaim (not cancel). */
export function waitingActions(options: OptionOffer[], me: string | null, nowMs: number): string[] {
  const out: string[] = []
  for (const o of options) {
    const role = roleOf(o, me)
    if (!role) continue
    const kind = actionKindOf(o, role)
    if (kind === 'exercise' && nowMs / 1000 < o.expiry) {
      out.push(`exercise your ${o.kind} on ${moneyWith(o.underlyingQty, o.underlying)}`)
    } else if (kind === 'claim') {
      const c = claimAmount(o)
      out.push(`claim ${moneyWith(c.amount, c.token)} from an exercised ${o.kind}`)
    } else if (kind === 'reclaim') {
      const c = requiredCollateral(o)
      out.push(`reclaim ${moneyWith(c.amount, c.token)} from an expired ${o.holder ? 'option' : 'offer'}`)
    }
  }
  return out
}

// ------------------------------------------------------------------------------------------- to-do strip

/** What the connected wallet has to do, or should know, about one position. */
export type TodoKind =
  /** Holder of an active option before its deadline. Only the holder can exercise, and only before the deadline. */
  | 'exercise'
  /** Writer of an exercised option, put or call: the proceeds wait in the contract. */
  | 'claim'
  /** Writer of an expired option or offer: the collateral waits in the contract. */
  | 'reclaim'
  /** Holder of an option that expired without being exercised. Nothing to do. */
  | 'expired-unexercised'

export interface TodoItem {
  kind: TodoKind
  option: OptionOffer
  role: Role
  /**
   * True for a real action: a claim, a reclaim, or an exercise that is in the money at the reference price.
   * An exercise that is out of the money, at the money or of unknown moneyness is listed as a neutral reminder
   * of the deadline, never as a call to act.
   */
  actionable: boolean
  /** Exercise: the deadline in unix seconds. Null for the others (a claim and a reclaim never expire). */
  deadline: number | null
  secondsLeft: number | null
  /** Exercise: where the option stands at the reference price; `unknown` without one. Null for the others. */
  moneyness: Moneyness | null
  /** What the action moves into the wallet: the exercise leg received, the claim, the collateral. Null when nothing. */
  amount: Money | null
}

const TODO_RANK: Record<TodoKind, number> = { exercise: 0, claim: 1, reclaim: 2, 'expired-unexercised': 4 }

/**
 * The to-do strip of the portfolio, most pressing first: in-the-money exercises by deadline, then claims and
 * reclaims, then the neutral exercise reminders by deadline, then options that expired unexercised in the last
 * `recentSeconds` (default 7 days). `referenceOf` gives the reference price of an option's underlying (or
 * nothing): it only decides whether an exercise is shown as an action or as a reminder.
 */
export function todoItems(
  options: OptionOffer[],
  me: string | null,
  nowSec: number,
  referenceOf: (o: OptionOffer) => PriceInput = () => null,
  recentSeconds: number = 7 * 86_400,
): TodoItem[] {
  const out: TodoItem[] = []
  for (const o of options) {
    const role = roleOf(o, me)
    if (!role) continue
    const kind = actionKindOf(o, role)
    if (kind === 'exercise' && nowSec < o.expiry) {
      const m = optionMoneyness(o, referenceOf(o))
      out.push({ kind, option: o, role, actionable: m === 'in', deadline: o.expiry, secondsLeft: o.expiry - nowSec, moneyness: m, amount: requiredCollateral(o) })
    } else if (kind === 'claim') {
      out.push({ kind, option: o, role, actionable: true, deadline: null, secondsLeft: null, moneyness: null, amount: claimAmount(o) })
    } else if (kind === 'reclaim') {
      out.push({ kind, option: o, role, actionable: true, deadline: null, secondsLeft: null, moneyness: null, amount: requiredCollateral(o) })
    } else if (role === 'holder' && o.state === 'expired' && nowSec - o.expiry <= recentSeconds) {
      out.push({ kind: 'expired-unexercised', option: o, role, actionable: false, deadline: null, secondsLeft: null, moneyness: null, amount: null })
    }
  }
  const rank = (t: TodoItem) => (t.kind === 'exercise' && !t.actionable ? 3 : TODO_RANK[t.kind])
  return out.sort((a, b) => rank(a) - rank(b) || (a.deadline ?? 0) - (b.deadline ?? 0) || (a.option.id < b.option.id ? -1 : a.option.id > b.option.id ? 1 : 0))
}

/** The count for the navigation badge: actions that are real (see `TodoItem.actionable`). */
export const actionsWaiting = (items: TodoItem[]): number => items.filter((t) => t.actionable).length

/** Portfolio summary figures (brief 4.5), exact, per token. Only what the chain states: no valuation. */
export interface PortfolioSummary {
  /** Positions the wallet holds or wrote that are not closed. */
  open: number
  /** Original premiums of the options the wallet holds or held, by quote token (paid to the writer). */
  premiumPaid: Money[]
  /** Premiums of the options the wallet wrote and sold, by quote token. */
  premiumEarned: Money[]
  /** Collateral the wallet still has locked in the contract, by token. */
  locked: Money[]
  /** Proceeds of exercised options the wallet wrote and has not claimed yet, by token. */
  unclaimed: Money[]
}

/**
 * `premiumPaid` is the original premium of each option, which a wallet that bought on resale did not pay itself;
 * the chain does not record resale prices. Pass `boughtOnResale` (option ids) to leave those out.
 */
export function portfolioSummary(options: OptionOffer[], me: string | null, boughtOnResale: ReadonlySet<bigint> = new Set()): PortfolioSummary {
  const sums = { paid: new Map<string, Money>(), earned: new Map<string, Money>(), locked: new Map<string, Money>(), unclaimed: new Map<string, Money>() }
  const addTo = (m: Map<string, Money>, x: Money) => m.set(x.token.contractId, { token: x.token, amount: (m.get(x.token.contractId)?.amount ?? 0n) + x.amount })
  let open = 0
  for (const o of options) {
    const role = roleOf(o, me)
    if (!role) continue
    if (!statusOf(o, role).closed) open++
    if (role === 'holder') {
      if (!boughtOnResale.has(o.id)) addTo(sums.paid, { token: o.quote, amount: o.totalPremium })
      continue
    }
    if (o.holder) addTo(sums.earned, { token: o.quote, amount: o.totalPremium })
    if (o.state === 'offered' || o.state === 'active' || o.state === 'expired') addTo(sums.locked, requiredCollateral(o))
    if (o.state === 'exercised') addTo(sums.unclaimed, claimAmount(o))
  }
  return { open, premiumPaid: [...sums.paid.values()], premiumEarned: [...sums.earned.values()], locked: [...sums.locked.values()], unclaimed: [...sums.unclaimed.values()] }
}
