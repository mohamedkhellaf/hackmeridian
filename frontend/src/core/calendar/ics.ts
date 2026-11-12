// A calendar entry for an exercise deadline (brief D17). Nothing settles by itself, so the purchase receipt and the
// position page offer this file. It is generated in the page: no server sees which option the user holds.
//
// The entry itself is the reminder: an event covering the last two hours before expiry, so it shows in the day
// view even where a calendar drops alarms on import. Two alarms are added, 48 h and 2 h before the deadline.
// Both are written as durations relative to the event start (46 h before it, and at it), because some calendars
// ignore triggers relative to the end, and the 48 h alarm comes first because some keep only the first alarm.
//
// Format: RFC 5545. CRLF line ends, lines folded at 75 octets, TEXT values escaped.

const CRLF = '\r\n'
const EVENT_SECONDS = 2 * 3_600
const EARLY_ALARM_SECONDS = 48 * 3_600

export const ICS_MIME_TYPE = 'text/calendar;charset=utf-8'
export const ICS_PRODID = '-//StellSec//Exercise deadline 1.0//EN'

export interface DeadlineEvent {
  /** One line, for example `Exercise deadline: RWA 10.00 put (5.00 RWA)`. */
  title: string
  /** Plain text. Line breaks are kept. Say that the entry does not update if the option is sold or exercised. */
  description: string
  /** The deadline, unix seconds. The event ends at this instant. */
  expiryTs: number
  /** Link back to the position. Only http and https links are written; it is also appended to the description. */
  url?: string
  /** Stable identifier of the entry, so adding it twice updates the first one. Derived from the other fields by default. */
  uid?: string
  /** Creation time, unix seconds. Defaults to the wall clock; a parameter so the output is reproducible. */
  nowTs?: number
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** `20261113T080000Z` for unix seconds. */
export function icsDateTime(ts: number): string {
  const d = new Date(ts * 1000)
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/** Drops control characters (a tab becomes a space) so that a value can never start a new content line. */
function stripControls(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 0x0a) out += ch
    else if (c === 0x09) out += ' '
    else if (c >= 0x20 && !(c >= 0x7f && c <= 0x9f)) out += ch
  }
  return out
}

/**
 * Escapes a TEXT value (RFC 5545 section 3.3.11): backslash, semicolon and comma get a backslash, every kind of
 * line break becomes `\n`, and other control characters are removed.
 */
export function escapeIcsText(text: string): string {
  return stripControls(text.replace(/\r\n|\r|\u2028|\u2029/g, '\n'))
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

const utf8Length = (codePoint: number) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4)

/**
 * Folds one content line at 75 octets (RFC 5545 section 3.1): continuation lines start with one space. A
 * multi-byte character is never split.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = []
  let current = ''
  let octets = 0
  for (const ch of line) {
    const size = utf8Length(ch.codePointAt(0) ?? 0)
    if (octets + size > 75) {
      out.push(current)
      current = ' '
      octets = 1
    }
    current += ch
    octets += size
  }
  out.push(current)
  return out.join(CRLF)
}

/** A link is written only when it is an absolute http or https URL. Returns its normalised form, or null. */
function safeUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** FNV-1a, 32 bit, as 8 hex digits. Only used to derive a stable event identifier. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function checkExpiry(expiryTs: number): void {
  if (!Number.isInteger(expiryTs) || expiryTs < EVENT_SECONDS || expiryTs > 253_402_300_799) {
    throw new RangeError('expiryTs must be a whole unix timestamp in seconds')
  }
}

const withLink = (description: string, link: string | null): string =>
  link && !description.includes(link) ? `${description}${description ? '\n' : ''}${link}` : description

/**
 * The `.ics` text for a deadline: one event from two hours before `expiryTs` until `expiryTs`, with a display
 * alarm 48 h before the deadline and another 2 h before it (at the start of the event).
 * Throws a RangeError when `expiryTs` is not a whole timestamp.
 */
export function buildDeadlineIcs(event: DeadlineEvent): string {
  checkExpiry(event.expiryTs)
  const start = event.expiryTs - EVENT_SECONDS
  const link = safeUrl(event.url)
  const title = event.title.replace(/\s+/g, ' ').trim()
  const uid = (event.uid ?? `deadline-${event.expiryTs}-${hash(`${title}\n${link ?? ''}`)}`).replace(/[^A-Za-z0-9._-]/g, '')
  const stamp = Math.floor(event.nowTs !== undefined && Number.isFinite(event.nowTs) ? event.nowTs : Date.now() / 1000)
  const alarm = (lead: string, trigger: string) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`${lead} left. ${title}`)}`,
    `TRIGGER:${trigger}`,
    'END:VALARM',
  ]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@stellsec`,
    `DTSTAMP:${icsDateTime(stamp)}`,
    `DTSTART:${icsDateTime(start)}`,
    `DTEND:${icsDateTime(event.expiryTs)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(withLink(event.description.trim(), link))}`,
    ...(link ? [`URL:${link}`] : []),
    'TRANSP:TRANSPARENT',
    // 48 h before the deadline = 46 h before the event starts. First, for calendars that keep one alarm.
    ...alarm('48 h', `-PT${(EARLY_ALARM_SECONDS - EVENT_SECONDS) / 3_600}H`),
    // 2 h before the deadline = when the event starts.
    ...alarm('2 h', 'PT0S'),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}

/** A file name for the download, `stellsec-deadline-20261113.ics`. */
export function deadlineIcsFileName(expiryTs: number): string {
  checkExpiry(expiryTs)
  return `stellsec-deadline-${icsDateTime(expiryTs).slice(0, 8)}.ics`
}

/**
 * The same event as a Google Calendar link (`render?action=TEMPLATE`). It opens Google's event editor, so the
 * user's own default notifications apply; Google does not take alarms from a link. Opening it sends the title and
 * description to Google, so it is offered as the user's choice and never loaded by the page.
 */
export function googleCalendarUrl(event: Pick<DeadlineEvent, 'title' | 'description' | 'expiryTs' | 'url'>): string {
  checkExpiry(event.expiryTs)
  const link = safeUrl(event.url)
  const enc = encodeURIComponent
  const dates = `${icsDateTime(event.expiryTs - EVENT_SECONDS)}/${icsDateTime(event.expiryTs)}`
  const title = event.title.replace(/\s+/g, ' ').trim()
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(title)}&dates=${dates}&details=${enc(withLink(event.description.trim(), link))}`
}
