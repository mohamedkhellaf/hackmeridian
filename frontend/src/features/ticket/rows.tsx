// The rows of a term sheet, shared by the modes of the ticket. Each returns `NoteTerm`s for a ruled list.
//
// The rule for a row's caption (`hint`): a required sentence from core/disclosures, a second figure of the same
// quantity (the total beside a per-unit price, the local time and the time left beside a deadline), or where the
// money sits. A caption never defines its own label.
import { formatUtc } from '../../core/format'
import type { Money, OptionKind } from '../../core/options/types'
import type { NoteTerm } from '../../ui'
import { giveUpHint, giveUpValue } from './copy'
import { moneyText, priceText } from './fmt'
import { DeadlineHint, DeadlineValue, MoneyText, Party, PriceText } from './parts'
import { breakevenPerUnit, mostYouCanLose, strikePerUnit } from './terms'
import type { Leg, Side } from './terms'

const KIND_WORD: Record<OptionKind, string> = { put: 'Put', call: 'Call' }

/** Every option of the Covered contract is American: exercisable at any time before the deadline. */
export const kindRow = (kind: OptionKind): NoteTerm => ({ label: 'Kind', value: `${KIND_WORD[kind]}, American style` })

export function strikeRow(leg: Leg): NoteTerm {
  return {
    label: 'Strike',
    value: <PriceText units={strikePerUnit(leg)} quote={leg.quote} per={leg.underlying.code} />,
    hint: `${moneyText({ token: leg.quote, amount: leg.totalStrike })} in total.`,
  }
}

export const quantityRow = (leg: Leg): NoteTerm => ({ label: 'Quantity', value: <MoneyText money={{ token: leg.underlying, amount: leg.underlyingQty }} /> })

/** The deadline in UTC, with the time left and the local time under it. */
export const deadlineRow = (expiry: number): NoteTerm => ({ label: 'Deadline', value: <DeadlineValue expiry={expiry} />, hint: <DeadlineHint expiry={expiry} /> })

export const moneyRow = (label: string, money: Money, hint?: NoteTerm['hint'], marked = false): NoteTerm => ({ label, value: <MoneyText money={money} />, hint, marked })

/** The first row of a review: what moves, set as the large figure. */
export const leadRow = (label: string, money: Money, hint?: NoteTerm['hint']): NoteTerm => ({ label, value: <MoneyText money={money} size="lg" />, hint })

/** The breakeven, under the highlighter: on the term sheet of the user's own order it is the one marked figure. */
export function breakevenRow(leg: Leg): NoteTerm {
  return { label: 'Breakeven', value: <PriceText units={breakevenPerUnit(leg)} quote={leg.quote} />, marked: true }
}

/**
 * The most this side can lose on the option itself (core/payoff/leg). A buyer can lose the premium, and the row
 * says no more. A written put can lose the strike, less the premium. A written call locks the underlying itself:
 * it has no loss figure, only what it gives up.
 */
export function mostYouCanLoseRow(leg: Leg, side: Side): NoteTerm {
  const worst = mostYouCanLose(leg, side)
  const u = leg.underlying.code
  if (worst === null) {
    return {
      label: 'You give up',
      value: giveUpValue(priceText(strikePerUnit(leg), leg.quote), u),
      hint: giveUpHint(moneyText({ token: leg.underlying, amount: leg.underlyingQty })),
    }
  }
  if (side === 'long') return { label: 'Most you can lose', value: <MoneyText money={worst} /> }
  return { label: 'Most you can lose', value: <MoneyText money={worst} />, hint: `If ${u} is worth nothing when the holder exercises: the strike, less the premium.` }
}

/** The other side of the trade, by role, with the address alone as the value. */
export const partyRow = (role: 'Maker' | 'Buyer' | 'Seller', address: string, me: string | null): NoteTerm => ({ label: role, value: <Party role={role} address={address} me={me} named={false} /> })

/** The terms a receipt prints, the same for every mode. `premiumLabel` names the premium for this side. */
export function receiptTerms(leg: Leg, premiumLabel: string, collateral: Money | null): NoteTerm[] {
  const terms: NoteTerm[] = [
    { label: 'Strike', value: <PriceText units={strikePerUnit(leg)} quote={leg.quote} per={leg.underlying.code} /> },
    { label: 'Quantity', value: <MoneyText money={{ token: leg.underlying, amount: leg.underlyingQty }} /> },
    { label: premiumLabel, value: <MoneyText money={{ token: leg.quote, amount: leg.totalPremium }} /> },
    { label: 'Breakeven', value: <PriceText units={breakevenPerUnit(leg)} quote={leg.quote} />, marked: true },
    { label: 'Deadline', value: formatUtc(leg.expiry) },
  ]
  if (collateral) {
    terms.push({
      label: 'Collateral',
      value: (
        <>
          <MoneyText money={collateral} /> in the contract
        </>
      ),
    })
  }
  return terms
}
