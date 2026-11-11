// Pure view helpers of the portfolio feature: names, glyphs, formatted figures and which actions a position
// allows. No React and no maths on money: every amount is formatted from exact integer units, and anything
// that compares a strike with a price comes from core/reference through the data layer's `PositionView`.
import { formatExact, formatMoney, formatUnits, NO_VALUE } from '../../core/format'
import type { Ask, Money, OptionKind, OptionOffer, TokenInfo } from '../../core/options/types'
import type { ActionKind, Role } from '../../core/portfolio/positions'
import { priceOf } from '../../core/reference'
import type { Moneyness, ReferencePrice } from '../../core/reference'
import { canList } from '../../core/resale/resale'
import { premiumUnits, strikeUnits } from '../../core/units'
import { lowestOpenInSeries } from '../../core/maker/lowestOffer'
import type { PositionView, TodoView } from '../../data'
import type { PayoffGlyph } from '../../ui'

/** What the URL can ask the position page to open (`?do=`), plus `unlist`, which only a button opens. */
export type PositionAction = 'exercise' | 'claim' | 'reclaim' | 'cancel' | 'sell' | 'unlist'

import { KIND_WORD } from '../../core/format/option'
export { KIND_WORD }

/** The payoff shape of a position: long for the holder, short for the writer. A viewer with no side sees the long shape. */
export function glyphOf(kind: OptionKind, role: Role | null): PayoffGlyph {
  if (role === 'writer') return kind === 'put' ? 'short-put' : 'short-call'
  return kind === 'put' ? 'long-put' : 'long-call'
}

/** `5.00 USDx`: two decimals, truncated, grouped. For tables and summaries. */
export const money = (m: Money): string => formatMoney(m.amount, m.token)

/** `5.00 USDx` with every digit of the amount. For sentences that state what a transaction moves. */
export const exactMoney = (m: Money): string => `${formatExact(m.amount, m.token.decimals)} ${m.token.code}`

export const qtyOf = (o: Pick<OptionOffer, 'underlying' | 'underlyingQty'>): Money => ({ token: o.underlying, amount: o.underlyingQty })
export const strikeOf = (o: Pick<OptionOffer, 'quote' | 'totalStrike'>): Money => ({ token: o.quote, amount: o.totalStrike })
export const premiumOf = (o: Pick<OptionOffer, 'quote' | 'totalPremium'>): Money => ({ token: o.quote, amount: o.totalPremium })

type StrikeTerms = Pick<OptionOffer, 'underlying' | 'quote' | 'underlyingQty' | 'totalStrike'>

/** Strike per whole unit of underlying as text (`10.40`), truncated; an en dash when the quantity is zero. */
export function strikeText(o: StrikeTerms): string {
  const perUnit = strikeUnits(o)
  return perUnit === null ? NO_VALUE : formatUnits(perUnit, o.quote.decimals)
}

/** The same figure with every digit, for the exact-value popover. */
export function strikeExact(o: StrikeTerms): string {
  const perUnit = strikeUnits(o)
  return perUnit === null ? NO_VALUE : formatExact(perUnit, o.quote.decimals)
}

/** `put on 10.00 FUND`: the option inside a sentence. */
export const optionPhrase = (o: Pick<OptionOffer, 'kind' | 'underlying' | 'underlyingQty'>): string => `${o.kind} on ${money(qtyOf(o))}`

/** `Put on 10.00 FUND`: the option as a title. */
export const optionTitle = (o: Pick<OptionOffer, 'kind' | 'underlying' | 'underlyingQty'>): string => `${KIND_WORD[o.kind]} on ${money(qtyOf(o))}`

/** The heading of the contract note: `Long put, FUND` for the holder, `Short put, FUND` for the writer, `Put, FUND` otherwise. */
export function noteKind(o: Pick<OptionOffer, 'kind' | 'underlying'>, role: Role | null): string {
  if (role === 'holder') return `Long ${o.kind}, ${o.underlying.code}`
  if (role === 'writer') return `Short ${o.kind}, ${o.underlying.code}`
  return `${KIND_WORD[o.kind]}, ${o.underlying.code}`
}

/** The option id as the contract note prints it: `000184`. */
export { serialOf } from '../../core/format/option'

/**
 * The contract's own state name for the tag. An option past its deadline reads `Expired` whether or not the
 * writer has reclaimed the collateral: the status line beside it says which.
 */
export function stateName(o: Pick<OptionOffer, 'state'>): string {
  switch (o.state) {
    case 'offered':
      return 'Offered'
    case 'active':
      return 'Active'
    case 'exercised':
      return 'Exercised'
    case 'settled':
      return 'Settled'
    case 'expired':
    case 'reclaimed':
      return 'Expired'
    case 'cancelled':
      return 'Cancelled'
  }
}

export const MONEYNESS_WORD: Record<Moneyness, string> = {
  in: 'In the money',
  at: 'At the money',
  out: 'Out of the money',
  unknown: 'No reference price',
}

/** The source of a reference price inside a sentence: `demo price`, `Testnet faucet price`. */
export function referenceName(ref: Pick<ReferencePrice, 'kind'>): string {
  switch (ref.kind) {
    case 'demo':
      return 'demo price'
    case 'fixed':
      return 'Testnet faucet price'
    case 'desk':
      return 'Testnet desk price'
    case 'none':
      return 'reference price'
  }
}

/** The reference figure as text (`10.20`), or null when there is none. */
export function referenceFigure(ref: ReferencePrice | null, quote: TokenInfo): string | null {
  const price = priceOf(ref)
  return price === null ? null : formatUnits(price, quote.decimals)
}

/** `at the demo price 10.20`: where a moneyness word was measured. Null without a reference. */
export function referencePhrase(ref: ReferencePrice | null, quote: TokenInfo): string | null {
  const figure = referenceFigure(ref, quote)
  return ref && figure !== null ? `at the ${referenceName(ref)} ${figure}` : null
}

/** The primary contract call of a position as a page action. */
export const ACTION_OF_KIND: Record<ActionKind, PositionAction> = { exercise: 'exercise', claim: 'claim', reclaim: 'reclaim', cancel: 'cancel' }

/** Button label of each action. An action keeps its name through the flow. */
export const ACTION_NAME: Record<PositionAction, string> = {
  exercise: 'Exercise',
  claim: 'Claim delivery',
  reclaim: 'Reclaim',
  cancel: 'Cancel offer',
  sell: 'List for sale',
  unlist: 'Cancel listing',
}

/**
 * Every action the connected wallet can take on a position now, the primary contract call first. A holder of
 * a live option can also list it for sale, and change or withdraw a listing.
 */
export function actionsFor(p: PositionView | null, me: string | null, nowSec: number, resale: boolean): PositionAction[] {
  if (!p) return []
  const out: PositionAction[] = []
  // An option past its deadline still reads `active` for a few seconds, until the next read: nothing to exercise then.
  if (p.action && !(p.action === 'exercise' && p.option.expiry <= nowSec)) out.push(ACTION_OF_KIND[p.action])
  if (resale && canList(p.option, me, nowSec)) {
    out.push('sell')
    if (p.listing) out.push('unlist')
  }
  return out
}

/** Whether `action` can be opened on this position right now. A reminder link may arrive after the fact. */
export const allows = (actions: readonly PositionAction[], action: PositionAction | null | undefined): action is PositionAction =>
  !!action && actions.includes(action)

/** The label of the resale action: a listed option is re-priced, not sold again. */
export const sellLabel = (listing: Ask | null): string => (listing ? 'Change price' : ACTION_NAME.sell)

/** A to-do item that earns a card: a real action, or a held option in its last 48 hours or with no reference price. */
export function showsCard(t: TodoView): boolean {
  if (t.kind === 'expired-unexercised') return false
  if (t.actionable) return true
  return t.kind === 'exercise' && ((t.urgency !== null && t.urgency !== 'far') || t.moneyness === 'unknown')
}

/** The premium per whole unit of underlying as text (`0.43 per FUND`), or null when the quantity is zero. */
export function premiumPerUnitLine(o: Pick<OptionOffer, 'underlying' | 'quote' | 'underlyingQty' | 'totalPremium'>): string | null {
  const unit = premiumUnits(o)
  return unit === null ? null : `${formatUnits(unit, o.quote.decimals)} per ${o.underlying.code}`
}

/**
 * Where the wallet's open offer ranks in its series, per unit of underlying: the lowest, or how far above the
 * lowest. Null when the offer is no longer open or the series cannot be read.
 */
export function rankInSeries(mine: OptionOffer, offers: OptionOffer[]): string | null {
  if (mine.state !== 'offered') return null
  const best = lowestOpenInSeries(offers, mine, mine.quote)
  if (!best) return null
  if (best.id === mine.id) return 'Lowest in its series'
  const a = premiumUnits(mine)
  const b = premiumUnits(best)
  if (a === null || b === null) return null
  if (a <= b) return 'Lowest in its series'
  return `${formatUnits(a - b, mine.quote.decimals)} above the lowest`
}

/**
 * What exercising takes from the holder's wallet (a put delivers the underlying, a call pays the strike) when the
 * wallet holds less of it, with what it holds. Null when it is covered or the balance is not known.
 */
export function exerciseShortOf(o: OptionOffer, balances: Readonly<Record<string, { balance: bigint | null }>> | undefined): { have: Money; need: Money } | null {
  const need = o.kind === 'put' ? qtyOf(o) : strikeOf(o)
  const balance = balances?.[need.token.contractId]?.balance
  if (balance === null || balance === undefined || balance >= need.amount) return null
  return { have: { token: need.token, amount: balance }, need }
}
