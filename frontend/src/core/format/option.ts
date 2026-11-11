// The words and figures every screen uses to name an option, in one place (review finding 50): the serial, the
// kind, and the strike per unit. Features import these instead of keeping their own copies.
import type { OptionKind } from '../options/types'
import { strikeUnits } from '../units'
import type { Sized } from '../units'
import { NO_VALUE, formatExact, formatUnits } from './amount'

/** `No. 000012`'s digits: the contract id of an offer, an option or a request, padded to six. */
export const serialOf = (id: bigint): string => id.toString().padStart(6, '0')

/** The kind as a word that starts a label: `Put`, `Call`. Lower-case it inside a sentence. */
export const KIND_WORD: Readonly<Record<OptionKind, string>> = { put: 'Put', call: 'Call' }

type StrikeTerms = Sized & { totalStrike: bigint; quote: { decimals: number } }

/**
 * The strike per whole unit of underlying, two decimals, truncated (`98.00`): the one precision of every screen,
 * so an off-grid strike prints the same on the chain and on a position. An en dash for a zero quantity.
 */
export function strikePerUnitText(o: StrikeTerms): string {
  const v = strikeUnits(o)
  return v === null ? NO_VALUE : formatUnits(v, o.quote.decimals)
}

/** The same strike with every digit, for the exact-value popover. */
export function strikePerUnitExact(o: StrikeTerms): string {
  const v = strikeUnits(o)
  return v === null ? NO_VALUE : formatExact(v, o.quote.decimals)
}
