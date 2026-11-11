import { describe, expect, it } from 'vitest'
import { dayLabel, expiryDay, compactCountdown, formatDuration, formatExpiryShort, formatUtcShort, fromLocalInput, nowMs, nowSec, toLocalInput } from './time'

describe('time', () => {
  it('keys an expiry by its UTC day, whatever the local zone', () => {
    expect(expiryDay(Date.UTC(2026, 9, 29, 0, 0, 0) / 1000)).toBe('2026-10-29')
    expect(expiryDay(Date.UTC(2026, 9, 29, 23, 59, 59) / 1000)).toBe('2026-10-29')
    expect(expiryDay(Date.UTC(2026, 9, 30, 0, 0, 0) / 1000)).toBe('2026-10-30')
    expect(dayLabel('2026-10-29')).toBe('29 Oct')
    expect(dayLabel('2027-01-05')).toBe('5 Jan')
  })

  it('counts down compactly and never shows 0m while open', () => {
    const at = 1_000_000 * 1000
    expect(compactCountdown(1_000_000 + 3 * 86400, at)).toBe('3d 0h')
    expect(compactCountdown(1_000_000 + 5 * 3600 + 12 * 60, at)).toBe('5h 12m')
    expect(compactCountdown(1_000_000 + 20, at)).toBe('1m')
    expect(compactCountdown(1_000_000, at)).toBe('expired')
  })

  it('formats durations', () => {
    expect(formatDuration(40)).toBe('40s')
    expect(formatDuration(130)).toBe('2m 10s')
    expect(formatDuration(3900)).toBe('1h 5m')
    expect(formatDuration(3 * 86400 + 4 * 3600)).toBe('3d 4h')
    expect(formatDuration(-5)).toBe('0s')
  })

  it('formats UTC without a zone for columns whose header says UTC', () => {
    expect(formatUtcShort(Date.UTC(2026, 9, 29, 6, 4) / 1000)).toBe('29 Oct 2026 06:04')
  })

  it('adds the year to the compact local expiry only when it differs from the current one', () => {
    const at = new Date(2026, 5, 1).getTime()
    expect(formatExpiryShort(new Date(2026, 9, 29, 6, 4).getTime() / 1000, at)).toBe('29 Oct 06:04')
    expect(formatExpiryShort(new Date(2027, 0, 5, 18, 30).getTime() / 1000, at)).toBe('5 Jan 2027 18:30')
  })

  it('round-trips a datetime-local value', () => {
    const ms = new Date(2026, 10, 13, 9, 0).getTime()
    expect(toLocalInput(ms)).toBe('2026-11-13T09:00')
    expect(fromLocalInput(toLocalInput(ms))).toBe(ms / 1000)
    expect(fromLocalInput('not a date')).toBeNull()
  })

  it('reads the clock in both units', () => {
    expect(Math.abs(nowSec() - Math.floor(nowMs() / 1000))).toBeLessThanOrEqual(1)
  })
})
