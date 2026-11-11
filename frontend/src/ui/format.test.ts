import { describe, expect, it } from 'vitest'
import {
  countdownParts,
  countdownTickMs,
  formatCountdown,
  formatCountdownWords,
  formatLocalTime,
  formatUtcDateTime,
  groupAddress,
  hasExponent,
  sanitizeDecimalInput,
  shortenAddress,
  shortenHash,
  toIsoUtc,
} from './format'

const DEADLINE = Date.UTC(2026, 10, 13, 8, 0, 0)
const HOUR = 3_600_000
const NBSP = ' '

describe('formatUtcDateTime', () => {
  it('writes the canonical form with the zone', () => {
    expect(formatUtcDateTime(DEADLINE)).toBe('13 Nov 2026, 08:00 UTC')
    expect(formatUtcDateTime(new Date(DEADLINE))).toBe('13 Nov 2026, 08:00 UTC')
    expect(formatUtcDateTime('2026-11-13T08:00:00Z')).toBe('13 Nov 2026, 08:00 UTC')
  })

  it('has a table form and a date form', () => {
    expect(formatUtcDateTime(DEADLINE, 'table')).toBe('13 Nov 08:00')
    expect(formatUtcDateTime(DEADLINE, 'date')).toBe('13 Nov 2026')
  })

  it('does not depend on the local zone and pads the clock', () => {
    expect(formatUtcDateTime(Date.UTC(2027, 0, 1, 0, 5))).toBe('1 Jan 2027, 00:05 UTC')
    expect(formatUtcDateTime('not a date')).toBe('')
  })

  it('gives the datetime attribute in UTC at seconds precision', () => {
    expect(toIsoUtc(DEADLINE)).toBe('2026-11-13T08:00:00Z')
  })
})

describe('formatLocalTime', () => {
  it('says the local clock and its offset', () => {
    expect(formatLocalTime(DEADLINE, 'Europe/Lisbon')).toBe('08:00 your time (UTC)')
    expect(formatLocalTime(DEADLINE, 'Europe/Paris')).toBe('09:00 your time (UTC+1)')
  })

  it('adds the local date when it differs from the UTC date', () => {
    expect(formatLocalTime(DEADLINE, 'Pacific/Auckland')).toBe('21:00 your time (UTC+13)')
    expect(formatLocalTime(Date.UTC(2026, 10, 13, 20, 0), 'Pacific/Auckland')).toBe('14 Nov, 09:00 your time (UTC+13)')
    expect(formatLocalTime(Date.UTC(2026, 10, 13, 2, 0), 'America/Los_Angeles')).toBe('12 Nov, 18:00 your time (UTC\u22128)')
  })
})

describe('countdown', () => {
  it('shows two units at most', () => {
    expect(formatCountdown(52 * HOUR)).toBe(`2${NBSP}d 4${NBSP}h`)
    expect(formatCountdown(5 * HOUR + 12 * 60_000)).toBe(`5${NBSP}h 12${NBSP}min`)
    expect(formatCountdown(12 * 60_000 + 40_000)).toBe(`12${NBSP}min`)
    expect(formatCountdown(40_000)).toBe(`<1${NBSP}min`)
    expect(formatCountdown(48 * HOUR)).toBe(`2${NBSP}d`)
    expect(formatCountdown(3 * HOUR)).toBe(`3${NBSP}h`)
    expect(formatCountdown(15 * 24 * HOUR + 17 * HOUR)).toBe(`15${NBSP}d`)
  })

  it('truncates time left and never rounds it up', () => {
    expect(formatCountdown(52 * HOUR - 1)).toBe(`2${NBSP}d 3${NBSP}h`)
    expect(formatCountdown(59_999)).toBe(`<1${NBSP}min`)
    expect(formatCountdown(-5)).toBe(`<1${NBSP}min`)
  })

  it('reads in words with plural forms', () => {
    expect(formatCountdownWords(52 * HOUR)).toBe('2 days 4 hours')
    expect(formatCountdownWords(25 * HOUR)).toBe('1 day 1 hour')
    expect(formatCountdownWords(61_000)).toBe('1 minute')
    expect(formatCountdownWords(30_000)).toBe('less than a minute')
  })

  it('knows when it has expired and how often to repaint', () => {
    expect(countdownParts(0).expired).toBe(true)
    expect(countdownParts(1).expired).toBe(false)
    expect(countdownTickMs(2 * HOUR)).toBe(60_000)
    expect(countdownTickMs(HOUR - 1)).toBe(1000)
  })
})

describe('addresses and hashes', () => {
  const address = 'GAJ2RZUNJM6VEZWBZJRZWQ5ZG5OCN7LKN2CJMKE2MJRER52IF2UAVC7G'

  it('shortens by tier', () => {
    expect(shortenAddress(address)).toBe('GAJ2…VC7G')
    expect(shortenAddress(address, 'medium')).toBe('GAJ2RZ…UAVC7G')
    expect(shortenAddress(address, 'full')).toBe(address)
    expect(shortenAddress('GABC')).toBe('GABC')
  })

  it('shortens a hash to 8 and 4', () => {
    expect(shortenHash('b3c8fdd1a609e688f2b76b92e9dc9ce3f867062129a09fcc6092e667c7c7808e')).toBe('b3c8fdd1…808e')
  })

  it('groups the full address in fours without losing a character', () => {
    const groups = groupAddress(address)
    expect(groups).toHaveLength(14)
    expect(groups.join('')).toBe(address)
  })
})

describe('sanitizeDecimalInput', () => {
  it('keeps plain decimals as typed', () => {
    expect(sanitizeDecimalInput('12.5')).toBe('12.5')
    expect(sanitizeDecimalInput('0')).toBe('0')
    expect(sanitizeDecimalInput('0.')).toBe('0.')
    expect(sanitizeDecimalInput('0.05')).toBe('0.05')
    expect(sanitizeDecimalInput('')).toBe('')
  })

  it('drops signs, letters and exponents', () => {
    expect(sanitizeDecimalInput('-5')).toBe('5')
    expect(sanitizeDecimalInput('1e5')).toBe('15')
    expect(sanitizeDecimalInput('12 USDx')).toBe('12')
  })

  it('reads a single comma as the decimal point when it cannot be grouping', () => {
    expect(sanitizeDecimalInput('1,5')).toBe('1.5')
    expect(sanitizeDecimalInput('1,50')).toBe('1.50')
    expect(sanitizeDecimalInput('0,5')).toBe('0.5')
    expect(sanitizeDecimalInput('0,500')).toBe('0.500')
    expect(sanitizeDecimalInput('1,')).toBe('1.')
    expect(sanitizeDecimalInput('1,0005')).toBe('1.0005')
  })

  it('reads a comma before exactly three digits as grouping, as the app prints amounts', () => {
    expect(sanitizeDecimalInput('1,000')).toBe('1000')
    expect(sanitizeDecimalInput('12,500')).toBe('12500')
    expect(sanitizeDecimalInput('1,000', 0)).toBe('1000')
    expect(sanitizeDecimalInput('1,000,000')).toBe('1000000')
    expect(sanitizeDecimalInput('1,000.50')).toBe('1000.50')
  })

  it('treats the other separator as grouping when both appear', () => {
    expect(sanitizeDecimalInput('1,234.56')).toBe('1234.56')
    expect(sanitizeDecimalInput('1.234,56')).toBe('1234.56')
    expect(sanitizeDecimalInput('1,234,567')).toBe('1234567')
  })

  it('spots an exponent, which the amount field refuses', () => {
    expect(hasExponent('1e3')).toBe(true)
    expect(hasExponent('2.5E-4')).toBe(true)
    expect(hasExponent('12 USDx')).toBe(false)
    expect(hasExponent('1,000')).toBe(false)
  })

  it('ignores a second point', () => {
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23')
  })

  it('caps the fraction digits and never rounds', () => {
    expect(sanitizeDecimalInput('1.23456789', 7)).toBe('1.2345678')
    expect(sanitizeDecimalInput('0.999', 2)).toBe('0.99')
  })

  it('drops the fraction of an asset without decimals instead of appending it', () => {
    expect(sanitizeDecimalInput('12.5', 0)).toBe('12')
    expect(sanitizeDecimalInput('12,5', 0)).toBe('12')
  })

  it('normalises leading zeros and a bare point', () => {
    expect(sanitizeDecimalInput('007')).toBe('7')
    expect(sanitizeDecimalInput('.5')).toBe('0.5')
    expect(sanitizeDecimalInput('000')).toBe('0')
  })

  it('keeps amounts beyond the safe integer range exact', () => {
    expect(sanitizeDecimalInput('922337203685.4775807')).toBe('922337203685.4775807')
  })
})
