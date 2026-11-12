// The exact figures of one option seen from one side of the trade live in core/payoff/leg (shared with the
// position page); this file re-exports them for the ticket and adds the ticket's own words.
import type { PayoffGlyph } from '../../ui'
import type { OptionKind } from '../../core/options/types'
import type { Side } from '../../core/payoff/leg'

export { breakevenPerUnit, exerciseGives, exerciseReceives, mostYouCanGain, mostYouCanLose, premiumPerUnit, strikePerUnit } from '../../core/payoff/leg'
export type { Leg, Side } from '../../core/payoff/leg'

/** The payoff glyph of a position. Always shown next to the words. */
export const glyphOf = (side: Side, kind: OptionKind): PayoffGlyph => `${side}-${kind}`

/** "Long put", "Short call". */
export const positionWords = (side: Side, kind: OptionKind): string => `${side === 'long' ? 'Long' : 'Short'} ${kind}`

/** "184": an id as the contract numbers it, unpadded everywhere. */
export { serialOf } from '../../core/format/option'
