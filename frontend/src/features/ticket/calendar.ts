// The deadline of a held option as a calendar entry (brief D17): nothing settles by itself, so the receipt
// offers one. Built in the page; no server learns which option the user holds.
import type { DeadlineEvent } from '../../core/calendar'
import { formatUtc } from '../../core/format'
import { moneyText, priceText } from './fmt'
import { strikePerUnit } from './terms'
import type { Leg } from './terms'

/** The entry for the holder of `leg`. `optionId` links back to the position page. */
export function calendarFor(leg: Leg, optionId: bigint, origin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin): DeadlineEvent {
  const qty = moneyText({ token: leg.underlying, amount: leg.underlyingQty })
  const strike = priceText(strikePerUnit(leg), leg.quote)
  const event: DeadlineEvent = {
    title: `Exercise deadline: ${leg.underlying.code} ${strike} ${leg.kind} (${qty})`,
    description: [
      `Your ${leg.kind} on ${qty} at ${strike} per ${leg.underlying.code} can be exercised until ${formatUtc(leg.expiry)}.`,
      'Nothing settles by itself: after the deadline the option has expired.',
      'This entry does not update if the option is sold or exercised.',
      'This is a Testnet option on a fictional asset.',
    ].join('\n'),
    expiryTs: leg.expiry,
  }
  if (origin) event.url = `${origin}/portfolio/${optionId}`
  return event
}
