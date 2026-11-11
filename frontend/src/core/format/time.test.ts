import { describe, expect, it } from 'vitest'
import {
  deadlineUrgency,
  formatCountdown,
  formatLocal,
  formatUtcClock,
  zoneLabel,
  formatUtc,
  formatUtcDate,
  formatUtcDay,
  formatUtcTime,
  isoUtc,
  secondsUntil,
} from './index'

const FRI_13_NOV_0800 = Date.UTC(2026, 10, 13, 8, 0, 0) / 1000
/** Writes a pinned form with `_` for each no-break space (ruling F7: a date, time or duration never breaks inside). */
const nb = (s: string) => s.replaceAll('_', '\u00A0')
const MIN = 60
const HOUR = 3_600
const DAY = 86_400

describe('UTC forms', () => {
  it('gives the canonical deadline form', () => {
    expect(formatUtc(FRI_13_NOV_0800)).toBe(nb('13_Nov_2026, 08:00_UTC'))
    expect(formatUtc(Date.UTC(2027, 0, 1, 0, 5) / 1000)).toBe(nb('1_Jan_2027, 00:05_UTC'))
    expect(formatUtc(Date.UTC(2026, 8, 30, 23, 59, 59) / 1000)).toBe(nb('30_Sep_2026, 23:59_UTC'))
    expect(formatUtc(0)).toBe(nb('1_Jan_1970, 00:00_UTC'))
  })

  it('gives the date, day and time parts', () => {
    expect(formatUtcDate(FRI_13_NOV_0800)).toBe(nb('13_Nov_2026'))
    expect(formatUtcDay(FRI_13_NOV_0800)).toBe(nb('13_Nov'))
    expect(formatUtcTime(FRI_13_NOV_0800)).toBe(nb('08:00_UTC'))
    expect(isoUtc(FRI_13_NOV_0800)).toBe('2026-11-13T08:00:00Z')
  })

  it('does not depend on the zone the process runs in', () => {
    const before = process.env.TZ
    try {
      for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
        process.env.TZ = tz
        expect(formatUtc(FRI_13_NOV_0800)).toBe(nb('13_Nov_2026, 08:00_UTC'))
        expect(formatUtcDay(Date.UTC(2026, 10, 13, 0, 0) / 1000)).toBe(nb('13_Nov'))
      }
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
  })

  it('shows a dash for something that is not an instant', () => {
    expect(formatUtc(NaN)).toBe('–')
    expect(formatUtcDate(Infinity)).toBe('–')
    expect(formatUtcDay(1e20)).toBe('–')
    expect(formatUtcTime(NaN)).toBe('–')
    expect(isoUtc(NaN)).toBe('')
  })
})

describe('formatLocal', () => {
  it('uses the same shape with the zone name', () => {
    expect(formatLocal(FRI_13_NOV_0800, 'UTC')).toBe(nb('13_Nov_2026, 08:00_UTC'))
    expect(formatLocal(FRI_13_NOV_0800, 'Europe/Lisbon')).toMatch(/^13\u00A0Nov\u00A02026, 08:00\u00A0\S+$/)
    expect(formatLocal(FRI_13_NOV_0800, 'Europe/Paris')).toMatch(/^13\u00A0Nov\u00A02026, 09:00\u00A0\S+$/)
    expect(formatLocal(FRI_13_NOV_0800, 'America/New_York')).toMatch(/^13\u00A0Nov\u00A02026, 03:00\u00A0\S+$/)
  })

  it('moves the calendar day when the zone does', () => {
    expect(formatLocal(FRI_13_NOV_0800, 'Pacific/Auckland')).toMatch(/^13\u00A0Nov\u00A02026, 21:00\u00A0\S+$/)
    expect(formatLocal(Date.UTC(2026, 10, 13, 20, 0) / 1000, 'Asia/Tokyo')).toMatch(/^14\u00A0Nov\u00A02026, 05:00\u00A0\S+$/)
    expect(formatLocal(Date.UTC(2026, 8, 1, 2, 0) / 1000, 'America/New_York')).toMatch(/^31\u00A0Aug\u00A02026, 22:00\u00A0\S+$/)
  })

  it('writes September as Sep and midnight as 00', () => {
    expect(formatLocal(Date.UTC(2026, 8, 10, 0, 0) / 1000, 'UTC')).toBe(nb('10_Sep_2026, 00:00_UTC'))
  })

  it('falls back to the canonical UTC form on an unknown zone, and a dash on a bad instant', () => {
    expect(formatLocal(FRI_13_NOV_0800, 'Not/AZone')).toBe(nb('13_Nov_2026, 08:00_UTC'))
    expect(formatLocal(NaN, 'UTC')).toBe('–')
  })

  it('works without a zone argument', () => {
    expect(formatLocal(FRI_13_NOV_0800)).toMatch(/^1[34]\u00A0Nov\u00A02026, \d{2}:\d{2}(\u00A0\S+)?$/)
  })
})

describe('formatCountdown', () => {
  it('matches the forms of the brief', () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR)).toBe(nb('2_d_4_h'))
    expect(formatCountdown(3 * HOUR + 12 * MIN)).toBe(nb('3_h_12_min'))
    expect(formatCountdown(8 * MIN)).toBe(nb('8_min'))
  })

  it('floors every unit', () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR + 59 * MIN + 59)).toBe(nb('2_d_4_h'))
    expect(formatCountdown(3 * HOUR + 12 * MIN + 59)).toBe(nb('3_h_12_min'))
    expect(formatCountdown(8 * MIN + 59)).toBe(nb('8_min'))
    expect(formatCountdown(DAY - 1)).toBe(nb('23_h_59_min'))
    expect(formatCountdown(HOUR - 1)).toBe(nb('59_min'))
  })

  it('drops a zero second unit, and hours from ten days up', () => {
    expect(formatCountdown(2 * DAY)).toBe(nb('2_d'))
    expect(formatCountdown(2 * DAY + 30 * MIN)).toBe(nb('2_d'))
    expect(formatCountdown(3 * HOUR)).toBe(nb('3_h'))
    expect(formatCountdown(9 * DAY + 23 * HOUR)).toBe(nb('9_d_23_h'))
    expect(formatCountdown(10 * DAY + 5 * HOUR)).toBe(nb('10_d'))
    expect(formatCountdown(45 * DAY + 7 * HOUR)).toBe(nb('45_d'))
  })

  it('never shows zero minutes while time is left', () => {
    expect(formatCountdown(59)).toBe(nb('<1_min'))
    expect(formatCountdown(1)).toBe(nb('<1_min'))
    expect(formatCountdown(0.4)).toBe(nb('<1_min'))
    expect(formatCountdown(60)).toBe(nb('1_min'))
  })

  it('says expired at zero and below', () => {
    expect(formatCountdown(0)).toBe('expired')
    expect(formatCountdown(-5)).toBe('expired')
    expect(formatCountdown(NaN)).toBe('expired')
  })
})

describe('deadlineUrgency', () => {
  it('bands the time left with inclusive thresholds', () => {
    expect(deadlineUrgency(48 * HOUR + 1)).toBe('far')
    expect(deadlineUrgency(30 * DAY)).toBe('far')
    expect(deadlineUrgency(48 * HOUR)).toBe('within48h')
    expect(deadlineUrgency(2 * HOUR + 1)).toBe('within48h')
    expect(deadlineUrgency(2 * HOUR)).toBe('within2h')
    expect(deadlineUrgency(15 * MIN + 1)).toBe('within2h')
    expect(deadlineUrgency(15 * MIN)).toBe('within15min')
    expect(deadlineUrgency(1)).toBe('within15min')
  })

  it('is past at zero, below zero and for a bad value', () => {
    expect(deadlineUrgency(0)).toBe('past')
    expect(deadlineUrgency(-1)).toBe('past')
    expect(deadlineUrgency(NaN)).toBe('past')
  })
})

describe('secondsUntil', () => {
  it('is signed and whole', () => {
    expect(secondsUntil(FRI_13_NOV_0800, FRI_13_NOV_0800 - 90)).toBe(90)
    expect(secondsUntil(FRI_13_NOV_0800, FRI_13_NOV_0800 + 90)).toBe(-90)
    expect(secondsUntil(FRI_13_NOV_0800, FRI_13_NOV_0800 - 90.6)).toBe(90)
  })
})

describe('zone names and the clock to the second', () => {
  it('writes an offset from UTC with a true minus, never GMT', () => {
    expect(zoneLabel('GMT-10')).toBe('UTC\u221210')
    expect(zoneLabel('GMT+1')).toBe('UTC+1')
    expect(zoneLabel('GMT+5:30')).toBe('UTC+5:30')
    expect(zoneLabel('GMT')).toBe('UTC')
    expect(zoneLabel('UTC')).toBe('UTC')
    expect(zoneLabel('CET')).toBe('CET')
    expect(formatLocal(Date.UTC(2026, 10, 20, 8, 0) / 1000, 'Pacific/Honolulu')).toBe(nb('19_Nov_2026, 22:00_UTC\u221210'))
  })
  it('gives hours, minutes and seconds in UTC', () => {
    expect(formatUtcClock(Date.UTC(2026, 10, 13, 13, 45, 12) / 1000)).toBe(nb('13:45:12_UTC'))
  })
})
