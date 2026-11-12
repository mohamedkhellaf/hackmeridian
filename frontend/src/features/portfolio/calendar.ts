// The deadline of an option as a calendar entry (brief D17). The file is built in the page from core/calendar:
// no server learns which option the user holds. The Google link is only ever followed by the user's own click.
import { buildDeadlineIcs, deadlineIcsFileName, googleCalendarUrl, ICS_MIME_TYPE } from '../../core/calendar'
import type { DeadlineEvent } from '../../core/calendar'
import type { OptionOffer } from '../../core/options/types'
import type { Role } from '../../core/portfolio/positions'
import { calendarDescription, calendarTitle, makerCalendarDescription, makerCalendarTitle } from './copy'

/**
 * The absolute link back to the position: for the holder it opens the exercise; for the maker it opens the
 * position, where the claim or the reclaim waits after the deadline. Only http and https origins give one.
 */
export function positionUrl(id: bigint, origin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin, role: Role = 'holder'): string | undefined {
  if (!origin || !/^https?:\/\//.test(origin)) return undefined
  return role === 'holder' ? `${origin}/portfolio/${id}?do=exercise` : `${origin}/portfolio/${id}`
}

export function deadlineEvent(o: OptionOffer, origin?: string, role: Role = 'holder'): DeadlineEvent {
  return {
    title: role === 'holder' ? calendarTitle(o) : makerCalendarTitle(o),
    description: role === 'holder' ? calendarDescription(o) : makerCalendarDescription(o),
    expiryTs: o.expiry,
    url: positionUrl(o.id, origin, role),
    uid: `option-${o.id}-${o.expiry}${role === 'holder' ? '' : '-maker'}`,
  }
}

export interface CalendarFile {
  name: string
  text: string
  type: string
}

/** The `.ics` file for an option's deadline, or null when the deadline is not a usable timestamp. */
export function deadlineFile(o: OptionOffer, origin?: string, nowTs?: number, role: Role = 'holder'): CalendarFile | null {
  try {
    return { name: deadlineIcsFileName(o.expiry), text: buildDeadlineIcs({ ...deadlineEvent(o, origin, role), nowTs }), type: ICS_MIME_TYPE }
  } catch {
    return null
  }
}

/** The same event as a Google Calendar link, or null. Opening it sends the title and description to Google. */
export function googleLink(o: OptionOffer, origin?: string, role: Role = 'holder'): string | null {
  try {
    return googleCalendarUrl(deadlineEvent(o, origin, role))
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
