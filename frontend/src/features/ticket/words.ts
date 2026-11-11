// Sentences of the review that carry the option's own figures: the outcome pair and the holder's reminder. Every
// figure is formatted from exact integers.
import { formatUtc } from '../../core/format'
import { outcomePair } from './copy'
import type { HolderWords } from './copy'
import { moneyText, priceText } from './fmt'
import { strikePerUnit } from './terms'
import type { Leg, Side } from './terms'

/** The two sentences of the review: the right used, and not used. */
export function outcomeFor(leg: Leg, side: Side): [string, string] {
  return outcomePair(side, leg.kind, {
    code: leg.underlying.code,
    strike: priceText(strikePerUnit(leg), leg.quote),
    qty: moneyText({ token: leg.underlying, amount: leg.underlyingQty }),
    strikeTotal: moneyText({ token: leg.quote, amount: leg.totalStrike }),
    premium: moneyText({ token: leg.quote, amount: leg.totalPremium }),
  })
}

/** The figures of a holder's reminder on the receipt. */
export function holderWords(leg: Leg): HolderWords {
  return {
    code: leg.underlying.code,
    qty: moneyText({ token: leg.underlying, amount: leg.underlyingQty }),
    strikeTotal: moneyText({ token: leg.quote, amount: leg.totalStrike }),
    strike: priceText(strikePerUnit(leg), leg.quote),
    deadline: formatUtc(leg.expiry),
  }
}
