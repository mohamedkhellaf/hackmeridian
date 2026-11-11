import { formatDisplay, shortAddress } from '../options/format'
import { requiredCollateral } from '../options/types'
import type { OptionOffer, TokenInfo } from '../options/types'

/** Wall clock in ms. A function so components can call it from render without tripping purity lint. */
export const nowMs = (): number => Date.now()

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

/** Which explicit action this role can take on the option's current state. */
export function actionKindOf(o: OptionOffer, role: Role): ActionKind | null {
  if (role === 'holder' && o.state === 'active') return 'exercise'
  if (role === 'writer' && o.state === 'exercised') return 'claim'
  if (role === 'writer' && o.state === 'expired') return 'reclaim'
  if (role === 'writer' && o.state === 'offered') return 'cancel'
  return null
}

/** What the writer receives when claiming delivery of an exercised option: put -> the underlying, call -> the strike. */
export function claimAmount(o: OptionOffer): { token: TokenInfo; amount: bigint } {
  return o.kind === 'put' ? { token: o.underlying, amount: o.underlyingQty } : { token: o.quote, amount: o.totalStrike }
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
  const s = Math.floor(expiry - nowMs / 1000)
  if (s <= 0) return 'expired'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `in ${d}d ${h}h`
  if (h > 0) return `in ${h}h ${m}m`
  return `in ${Math.max(m, 1)}m`
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
