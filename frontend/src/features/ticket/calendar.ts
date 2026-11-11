// The deadline of a held option as a calendar entry (brief D17): exercise is never automatic, so the receipt
// offers one. Built in the page; no server learns which option the user holds.
import type { DeadlineEvent } from '../../core/calendar'
import { formatUtc } from '../../core/format'
import { moneyText, priceText } from './fmt'
import { exerciseGives, strikePerUnit } from './terms'
import type { Leg } from './terms'

/** The entry for the holder of `leg`. `optionId` links back to the position page. */
export function calendarFor(leg: Leg, optionId: bigint, origin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin): DeadlineEvent {
  const qty = moneyText({ token: leg.underlying, amount: leg.underlyingQty })
  const strike = priceText(strikePerUnit(leg), leg.quote)
  const event: DeadlineEvent = {
    title: `Exercise deadline: ${leg.underlying.code} ${strike} ${leg.kind} (${qty})`,
    description: [
      `Your ${leg.kind} on ${qty} at ${strike} per ${leg.underlying.code} can be exercised until ${formatUtc(leg.expiry)}.`,
      `To exercise you need ${moneyText(exerciseGives(leg))} in your wallet. If it is not exercised by then, the option expires.`,
      'This entry does not update if the option is sold or exercised.',
    ].join('\n'),
    expiryTs: leg.expiry,
    // The same entry as the position page's (features/portfolio/calendar.ts): adding it from both places updates
    // one event, and its link opens the exercise.
    uid: `option-${optionId}-${leg.expiry}`,
  }
  if (origin && /^https?:\/\//.test(origin)) event.url = `${origin}/portfolio/${optionId}?do=exercise`
  return event
}
