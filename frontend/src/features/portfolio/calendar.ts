// The deadline of an option as a calendar entry (brief D17). The file is built in the page from core/calendar:
// no server learns which option the user holds. The Google link is only ever followed by the user's own click.
import { buildDeadlineIcs, deadlineIcsFileName, googleCalendarUrl, ICS_MIME_TYPE } from '../../core/calendar'
import type { DeadlineEvent } from '../../core/calendar'
import type { OptionOffer } from '../../core/options/types'
import { calendarDescription, calendarTitle } from './copy'

/** The absolute link back to the position, opening the exercise. Only http and https origins give one. */
export function positionUrl(id: bigint, origin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin): string | undefined {
  if (!origin || !/^https?:\/\//.test(origin)) return undefined
  return `${origin}/portfolio/${id}?do=exercise`
}

export function deadlineEvent(o: OptionOffer, origin?: string): DeadlineEvent {
  return {
    title: calendarTitle(o),
    description: calendarDescription(o),
    expiryTs: o.expiry,
    url: positionUrl(o.id, origin),
    uid: `option-${o.id}-${o.expiry}`,
  }
}

export interface CalendarFile {
  name: string
  text: string
  type: string
}

/** The `.ics` file for an option's deadline, or null when the deadline is not a usable timestamp. */
export function deadlineFile(o: OptionOffer, origin?: string, nowTs?: number): CalendarFile | null {
  try {
    return { name: deadlineIcsFileName(o.expiry), text: buildDeadlineIcs({ ...deadlineEvent(o, origin), nowTs }), type: ICS_MIME_TYPE }
  } catch {
    return null
  }
}

/** The same event as a Google Calendar link, or null. Opening it sends the title and description to Google. */
export function googleLink(o: OptionOffer, origin?: string): string | null {
  try {
    return googleCalendarUrl(deadlineEvent(o, origin))
  } catch {
    return null
  }
}

/** Hands a generated file to the browser as a download. Returns false when the browser cannot. */
export function downloadFile(file: CalendarFile): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // The click has started the download; the object URL can go on the next turn.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}
