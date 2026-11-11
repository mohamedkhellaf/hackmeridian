import { describe, expect, it } from 'vitest'
import { buildDeadlineIcs, deadlineIcsFileName, escapeIcsText, foldIcsLine, googleCalendarUrl, ICS_MIME_TYPE, icsDateTime } from './index'
import type { DeadlineEvent } from './index'

const EXPIRY = Date.UTC(2026, 10, 13, 8, 0, 0) / 1000 // Friday 13 Nov 2026, 08:00 UTC
const NOW = Date.UTC(2026, 10, 11, 1, 30, 0) / 1000

const event: DeadlineEvent = {
  title: 'Exercise deadline: FUND 10.00 put (5.00 FUND)',
  description:
    'Your right to sell 5.00 FUND at 10.00 USDx each ends at 08:00 UTC on 13 Nov 2026.\nNothing happens by itself. To exercise you need 5.00 FUND in your wallet.\nThis entry does not update if you sell or exercise the option. Testnet only.',
  expiryTs: EXPIRY,
  url: 'https://app.example/portfolio/12',
  uid: 'option-12',
  nowTs: NOW,
}

const octets = (line: string) => new TextEncoder().encode(line).length
/** Physical lines without the final empty piece. */
const physical = (ics: string) => ics.split('\r\n').slice(0, -1)
/** Content lines after unfolding (RFC 5545 section 3.1: CRLF followed by one space is removed). */
const unfolded = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n').slice(0, -1)
const valueOf = (ics: string, name: string) => unfolded(ics).find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1)

describe('buildDeadlineIcs', () => {
  it('writes the whole file, line by line', () => {
    expect(physical(buildDeadlineIcs(event))).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StellSec//Exercise deadline 1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:option-12@stellsec',
      'DTSTAMP:20261111T013000Z',
      'DTSTART:20261113T060000Z',
      'DTEND:20261113T080000Z',
      'SUMMARY:Exercise deadline: FUND 10.00 put (5.00 FUND)',
      'DESCRIPTION:Your right to sell 5.00 FUND at 10.00 USDx each ends at 08:00 U',
      ' TC on 13 Nov 2026.\\nNothing happens by itself. To exercise you need 5.00 F',
      ' UND in your wallet.\\nThis entry does not update if you sell or exercise th',
      ' e option. Testnet only.\\nhttps://app.example/portfolio/12',
      'URL:https://app.example/portfolio/12',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:48 h left. Exercise deadline: FUND 10.00 put (5.00 FUND)',
      'TRIGGER:-PT46H',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:2 h left. Exercise deadline: FUND 10.00 put (5.00 FUND)',
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ])
  })

  it('ends every line with CRLF and has no bare line feed or carriage return', () => {
    const ics = buildDeadlineIcs(event)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('spans the last two hours before expiry', () => {
    const ics = buildDeadlineIcs(event)
    expect(valueOf(ics, 'DTEND')).toBe(icsDateTime(EXPIRY))
    expect(valueOf(ics, 'DTSTART')).toBe(icsDateTime(EXPIRY - 2 * 3600))
    expect(valueOf(ics, 'DTEND')).toBe('20261113T080000Z')
  })

  it('sets alarms 48 h and 2 h before the end, as durations from the start, the early one first', () => {
    const lines = unfolded(buildDeadlineIcs(event))
    const triggers = lines.filter((l) => l.startsWith('TRIGGER'))
    expect(triggers).toEqual(['TRIGGER:-PT46H', 'TRIGGER:PT0S'])
    // start is 2 h before the end: 46 h before start is 48 h before the end, and "at start" is 2 h before it
    const start = EXPIRY - 2 * 3600
    expect(EXPIRY - (start - 46 * 3600)).toBe(48 * 3600)
    expect(EXPIRY - start).toBe(2 * 3600)
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(2)
    expect(lines.filter((l) => l === 'ACTION:DISPLAY')).toHaveLength(2)
    for (const t of triggers) expect(t).not.toContain('RELATED') // no end-relative or absolute triggers
  })

  it('is structurally valid: balanced components, known properties, required fields once', () => {
    const lines = unfolded(buildDeadlineIcs(event))
    const stack: string[] = []
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z][A-Z0-9-]*[:;]/)
      const [name, value] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]
      if (name === 'BEGIN') stack.push(value)
      if (name === 'END') expect(stack.pop()).toBe(value)
    }
    expect(stack).toEqual([])
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR')
    for (const required of ['VERSION', 'PRODID', 'UID', 'DTSTAMP', 'DTSTART', 'DTEND', 'SUMMARY']) {
      expect(lines.filter((l) => l.startsWith(`${required}:`)), required).toHaveLength(1)
    }
    expect(lines.filter((l) => l.startsWith('DESCRIPTION:'))).toHaveLength(3) // the event and its two alarms
  })

  it('folds at 75 octets and unfolds to the original values', () => {
    const ics = buildDeadlineIcs(event)
    for (const line of physical(ics)) expect(octets(line), line).toBeLessThanOrEqual(75)
    expect(valueOf(ics, 'DESCRIPTION')).toBe(
      'Your right to sell 5.00 FUND at 10.00 USDx each ends at 08:00 UTC on 13 Nov 2026.\\nNothing happens by itself. To exercise you need 5.00 FUND in your wallet.\\nThis entry does not update if you sell or exercise the option. Testnet only.\\nhttps://app.example/portfolio/12',
    )
  })

  it('escapes commas, semicolons, backslashes and line breaks in text', () => {
    const ics = buildDeadlineIcs({ ...event, title: 'Deadline; BOND, 100 put \\ note', description: 'a,b;c\\d\r\ne\rf\ng' })
    expect(valueOf(ics, 'SUMMARY')).toBe('Deadline\\; BOND\\, 100 put \\\\ note')
    expect(valueOf(ics, 'DESCRIPTION')).toBe('a\\,b\\;c\\\\d\\ne\\nf\\ng\\nhttps://app.example/portfolio/12')
  })

  it('cannot be made to start a new content line', () => {
    const hostile = 'Deadline\r\nATTENDEE:mailto:someone@example.org\nBEGIN:VEVENT\u2028X\u0000\u0007'
    const ics = buildDeadlineIcs({ ...event, title: hostile, description: hostile })
    const lines = unfolded(ics)
    expect(lines.filter((l) => l.startsWith('ATTENDEE'))).toEqual([])
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(valueOf(ics, 'SUMMARY')).toBe('Deadline ATTENDEE:mailto:someone@example.org BEGIN:VEVENT X')
    expect(valueOf(ics, 'DESCRIPTION')).toBe(
      'Deadline\\nATTENDEE:mailto:someone@example.org\\nBEGIN:VEVENT\\nX\\nhttps://app.example/portfolio/12',
    )
    const stray = [...ics.replace(/\r\n/g, '')].filter((ch) => {
      const c = ch.codePointAt(0) ?? 0
      return c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029
    })
    expect(stray).toEqual([])
  })

  it('never splits a multi-byte character when folding', () => {
    const title = `Échéance ${'é'.repeat(60)} ${'日本語'.repeat(20)} ${'😀'.repeat(15)} fin`
    const ics = buildDeadlineIcs({ ...event, title })
    for (const line of physical(ics)) {
      expect(octets(line)).toBeLessThanOrEqual(75)
      expect(line).not.toMatch(/[\uD800-\uDBFF]$/) // no line ends on half of a surrogate pair
      expect(line).not.toMatch(/^ ?[\uDC00-\uDFFF]/)
    }
    expect(valueOf(ics, 'SUMMARY')).toBe(title)
    expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(ics))).toBe(ics)
  })

  it('writes the link only when it is http or https, and never twice in the description', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'not a url', '/portfolio/12', 'ftp://example.org/x', '']) {
      const ics = buildDeadlineIcs({ ...event, url })
      expect(unfolded(ics).filter((l) => l.startsWith('URL')), url).toEqual([])
      expect(ics, url).not.toContain('javascript')
    }
    const noUrl = buildDeadlineIcs({ ...event, url: undefined })
    expect(unfolded(noUrl).filter((l) => l.startsWith('URL'))).toEqual([])
    expect(valueOf(noUrl, 'DESCRIPTION')).not.toContain('https://')

    const already = buildDeadlineIcs({ ...event, description: 'Open https://app.example/portfolio/12 to exercise.' })
    expect(valueOf(already, 'DESCRIPTION')).toBe('Open https://app.example/portfolio/12 to exercise.')

    const breaking = buildDeadlineIcs({ ...event, url: 'https://app.example/portfolio/12\r\nX-EVIL:1' })
    expect(unfolded(breaking).filter((l) => l.startsWith('X-EVIL'))).toEqual([])
    expect(valueOf(breaking, 'URL')).toBe('https://app.example/portfolio/12X-EVIL:1')
  })

  it('derives a stable identifier when none is given', () => {
    const a = buildDeadlineIcs({ ...event, uid: undefined })
    const b = buildDeadlineIcs({ ...event, uid: undefined, nowTs: NOW + 999, description: 'changed' })
    const other = buildDeadlineIcs({ ...event, uid: undefined, url: 'https://app.example/portfolio/13' })
    expect(valueOf(a, 'UID')).toMatch(/^deadline-\d+-[0-9a-f]{8}@stellsec$/)
    expect(valueOf(a, 'UID')).toBe(valueOf(b, 'UID'))
    expect(valueOf(a, 'UID')).not.toBe(valueOf(other, 'UID'))
    expect(valueOf(buildDeadlineIcs({ ...event, uid: 'a b\r\nc:d;e' }), 'UID')).toBe('abcde@stellsec')
  })

  it('stamps the creation time, from the clock by default', () => {
    expect(valueOf(buildDeadlineIcs(event), 'DTSTAMP')).toBe('20261111T013000Z')
    expect(valueOf(buildDeadlineIcs({ ...event, nowTs: undefined }), 'DTSTAMP')).toMatch(/^\d{8}T\d{6}Z$/)
    expect(valueOf(buildDeadlineIcs({ ...event, nowTs: NaN }), 'DTSTAMP')).toMatch(/^\d{8}T\d{6}Z$/)
  })

  it('collapses the title to one line and trims the description', () => {
    const ics = buildDeadlineIcs({ ...event, title: '  Exercise   deadline:\tBOND  ', description: '\n  Body.  \n', url: undefined })
    expect(valueOf(ics, 'SUMMARY')).toBe('Exercise deadline: BOND')
    expect(valueOf(ics, 'DESCRIPTION')).toBe('Body.')
  })

  it('refuses a deadline that is not a whole timestamp', () => {
    for (const bad of [NaN, Infinity, 1.5, -1, 0, 1e13]) {
      expect(() => buildDeadlineIcs({ ...event, expiryTs: bad }), String(bad)).toThrow(RangeError)
    }
  })
})

describe('helpers', () => {
  it('formats UTC date-times', () => {
    expect(icsDateTime(EXPIRY)).toBe('20261113T080000Z')
    expect(icsDateTime(0)).toBe('19700101T000000Z')
    expect(icsDateTime(Date.UTC(2027, 0, 1, 23, 59, 59) / 1000)).toBe('20270101T235959Z')
  })

  it('escapes text', () => {
    expect(escapeIcsText('plain')).toBe('plain')
    expect(escapeIcsText('a\\b')).toBe('a\\\\b')
    expect(escapeIcsText('1,080.00 USDx; now')).toBe('1\\,080.00 USDx\\; now')
    expect(escapeIcsText('one\ntwo\r\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour')
    expect(escapeIcsText('tab\there')).toBe('tab here')
    expect(escapeIcsText('colon: stays')).toBe('colon: stays')
  })

  it('folds long lines and leaves short ones alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short')
    expect(foldIcsLine('x'.repeat(75))).toBe('x'.repeat(75))
    expect(foldIcsLine('x'.repeat(76))).toBe(`${'x'.repeat(75)}\r\n x`)
    expect(foldIcsLine('x'.repeat(75 + 74))).toBe(`${'x'.repeat(75)}\r\n ${'x'.repeat(74)}`)
    expect(foldIcsLine('x'.repeat(75 + 74 + 1))).toBe(`${'x'.repeat(75)}\r\n ${'x'.repeat(74)}\r\n x`)
    expect(foldIcsLine('')).toBe('')
  })

  it('names the download and its media type', () => {
    expect(deadlineIcsFileName(EXPIRY)).toBe('stellsec-deadline-20261113.ics')
    expect(ICS_MIME_TYPE).toBe('text/calendar;charset=utf-8')
    expect(() => deadlineIcsFileName(NaN)).toThrow(RangeError)
  })
})

describe('googleCalendarUrl', () => {
  it('builds the event template link', () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Exercise deadline: FUND 10.00 put (5.00 FUND)')
    expect(url.searchParams.get('dates')).toBe('20261113T060000Z/20261113T080000Z')
    expect(url.searchParams.get('details')).toBe(`${event.description}\nhttps://app.example/portfolio/12`)
    expect([...url.searchParams.keys()]).toEqual(['action', 'text', 'dates', 'details'])
  })

  it('keeps the dates readable and encodes everything else', () => {
    const text = googleCalendarUrl({ ...event, title: 'A & B = 100% #1 ?x', description: 'line 1\nline 2 + more' })
    expect(text).toContain('&dates=20261113T060000Z/20261113T080000Z&')
    expect(text).toContain('text=A%20%26%20B%20%3D%20100%25%20%231%20%3Fx')
    expect(text).toContain('details=line%201%0Aline%202%20%2B%20more%0Ahttps%3A%2F%2Fapp.example%2Fportfolio%2F12')
    expect(text).not.toMatch(/\s/)
  })

  it('leaves out a link that is not http or https, and refuses a bad deadline', () => {
    expect(new URL(googleCalendarUrl({ ...event, url: 'javascript:alert(1)' })).searchParams.get('details')).toBe(event.description)
    expect(new URL(googleCalendarUrl({ ...event, url: undefined })).searchParams.get('details')).toBe(event.description)
    expect(() => googleCalendarUrl({ ...event, expiryTs: NaN })).toThrow(RangeError)
  })
})
