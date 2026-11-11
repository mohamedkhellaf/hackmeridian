// The rows of a term sheet, shared by the modes of the ticket. Each returns `NoteTerm`s for a ruled list.
import { formatUtc } from '../../core/format'
import type { Money, OptionKind, TokenInfo } from '../../core/options/types'
import type { NoteTerm } from '../../ui'
import { moneyText, priceText } from './fmt'
import { DeadlineHint, DeadlineValue, MoneyText, PriceText } from './parts'
import { breakevenPerUnit, mostYouCanLose, strikePerUnit } from './terms'
import type { Leg, Side } from './terms'

const KIND_WORD: Record<OptionKind, string> = { put: 'Put', call: 'Call' }

/** Every option of the Covered contract is American: exercisable at any time before the deadline. */
export const kindRow = (kind: OptionKind): NoteTerm => ({ label: 'Kind', value: `${KIND_WORD[kind]}, American style` })

export function strikeRow(leg: Leg): NoteTerm {
  return {
    label: 'Strike',
    value: <PriceText units={strikePerUnit(leg)} quote={leg.quote} />,
    hint: `Per ${leg.underlying.code}. ${moneyText({ token: leg.quote, amount: leg.totalStrike })} in total.`,
  }
}

export const quantityRow = (leg: Leg, hint?: string): NoteTerm => ({ label: 'Quantity', value: <MoneyText money={{ token: leg.underlying, amount: leg.underlyingQty }} />, hint })

/** The deadline in UTC with the time left and the local time; `rule` adds who decides the time (the review). */
export const deadlineRow = (expiry: number, rule = false): NoteTerm => ({ label: 'Deadline', value: <DeadlineValue expiry={expiry} />, hint: <DeadlineHint expiry={expiry} rule={rule} /> })

export const moneyRow = (label: string, money: Money, hint?: NoteTerm['hint'], marked = false): NoteTerm => ({ label, value: <MoneyText money={money} />, hint, marked })

export const nothingRow = (label: string, hint?: string): NoteTerm => ({ label, value: 'Nothing', hint })

/** The breakeven, under the highlighter: it is the user's own figure. */
export function breakevenRow(leg: Leg, side: Side): NoteTerm {
  const up = leg.kind === 'call'
  const hint =
    side === 'long'
      ? `${leg.underlying.code} price at expiry ${up ? 'above' : 'below'} which exercising pays back more than the premium.`
      : `${leg.underlying.code} price at expiry ${up ? 'above' : 'below'} which being exercised costs you more than the premium.`
  return { label: 'Breakeven', value: <PriceText units={breakevenPerUnit(leg)} quote={leg.quote} />, hint, marked: true }
}

/** The most this side can lose on the option itself, with what that case is. */
export function mostYouCanLoseRow(leg: Leg, side: Side): NoteTerm {
  const worst = mostYouCanLose(leg, side)
  const u = leg.underlying.code
  if (worst === null) {
    return {
      label: 'Most you can lose',
      value: 'No cap',
      hint: `You give up every rise above ${priceText(strikePerUnit(leg), leg.quote)} per ${u}, and the ${u} you lock can still fall in price.`,
    }
  }
  const hint = side === 'long' ? 'The premium, if the option expires unexercised.' : `If ${u} is worth nothing when the holder exercises: the strike, less the premium.`
  return { label: 'Most you can lose', value: <MoneyText money={worst} />, hint }
}

/** The terms a receipt prints, the same for every mode. `premiumLabel` names the premium for this side. */
export function receiptTerms(leg: Leg, premiumLabel: string, collateral: Money | null): NoteTerm[] {
  const terms: NoteTerm[] = [
    { label: 'Strike', value: <PriceText units={strikePerUnit(leg)} quote={leg.quote} /> },
    { label: 'Quantity', value: <MoneyText money={{ token: leg.underlying, amount: leg.underlyingQty }} /> },
    { label: premiumLabel, value: <MoneyText money={{ token: leg.quote, amount: leg.totalPremium }} /> },
    { label: 'Breakeven', value: <PriceText units={breakevenPerUnit(leg)} quote={leg.quote} />, marked: true },
    { label: 'Deadline', value: formatUtc(leg.expiry) },
  ]
  if (collateral) terms.push({ label: 'Collateral', value: `${moneyText(collateral)} in the contract` })
  return terms
}

/** `0.36 USDx per BOND`. */
export const perUnitPhrase = (units: bigint | null, quote: TokenInfo, underlying: TokenInfo): string => `${priceText(units, quote)} per ${underlying.code}`
