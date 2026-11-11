import { describe, expect, it } from 'vitest'
import { deadlineEvent, deadlineFile, googleLink, positionUrl } from './calendar'
import { opt } from './fixtures.testhelper'

const EXPIRY = 1_794_556_800 // 13 Nov 2026, 08:00 UTC
const ORIGIN = 'https://stellsec.example'

describe('deadline calendar entry', () => {
  it('links back to the position with the exercise open', () => {
    expect(positionUrl(184n, ORIGIN)).toBe('https://stellsec.example/portfolio/184?do=exercise')
    expect(positionUrl(184n, 'file://')).toBeUndefined()
    expect(positionUrl(184n, undefined)).toBeUndefined()
  })

  it('builds a file named after the deadline day, with the title, the event and both alarms', () => {
    const file = deadlineFile(opt({ expiry: EXPIRY }), ORIGIN, 1_794_000_000)!
    expect(file.name).toBe('stellsec-deadline-20261113.ics')
    expect(file.type).toContain('text/calendar')
    expect(file.text).toContain('BEGIN:VEVENT')
    expect(file.text).toContain('SUMMARY:Exercise deadline: FUND 10.00 put (5.00 FUND)')
    expect(file.text).toContain('DTEND:20261113T080000Z')
    expect(file.text).toContain('URL:https://stellsec.example/portfolio/184?do=exercise')
    expect(file.text.match(/BEGIN:VALARM/g)).toHaveLength(2)
  })

  it('keeps one entry per option, so adding it twice updates the first', () => {
    const a = deadlineEvent(opt({ expiry: EXPIRY }), ORIGIN)
    const b = deadlineEvent(opt({ expiry: EXPIRY }), ORIGIN)
    expect(a.uid).toBe('option-184-1794556800')
    expect(a.uid).toBe(b.uid)
  })

  it('offers the same event as a Google Calendar link', () => {
    const link = googleLink(opt({ expiry: EXPIRY }), ORIGIN)!
    expect(link).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/)
    expect(link).toContain('dates=20261113T060000Z/20261113T080000Z')
  })

  it('gives the maker its own entry: what to claim or reclaim after the deadline, linked to the position', () => {
    const event = deadlineEvent(opt({ expiry: EXPIRY }), ORIGIN, 'writer')
    expect(event.title).toBe('Reclaim 50.00 USDx, or claim the FUND delivered')
    expect(event.description).toContain('claim the 5.00 FUND it left in the contract; if not, reclaim your 50.00 USDx.')
    expect(event.url).toBe('https://stellsec.example/portfolio/184')
    expect(event.uid).toBe('option-184-1794556800-maker')
    expect(deadlineEvent(opt({ kind: 'call', expiry: EXPIRY }), ORIGIN, 'writer').title).toBe('Reclaim 5.00 FUND, or claim the USDx paid')
  })

  it('gives nothing for a deadline that is not a usable timestamp', () => {
    expect(deadlineFile(opt({ expiry: 12.5 }), ORIGIN)).toBeNull()
    expect(googleLink(opt({ expiry: 0 }), ORIGIN)).toBeNull()
  })
})
