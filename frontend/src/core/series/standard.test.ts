import { describe, expect, it } from 'vitest'
import type { Bid } from '../requests/types'
import type { OptionOffer } from '../options/types'
import {
  classifyOffer,
  exactStrikePerUnit,
  expiryCycle,
  expiryDayKey,
  expiryFromDayKey,
  isMonthlyExpiry,
  isStandardExpiry,
  isStandardStrike,
  ladderFromStrikes,
  ladderStep,
  lastFridayOfMonth,
  nearestStrike,
  NON_STANDARD_REASONS,
  parseSeriesName,
  partitionOffers,
  plainDecimal,
  seriesName,
  seriesNameOf,
  significantDigits,
  standardExpiries,
  strikeLadder,
  strikesOf,
  tickUnits,
} from './index'

const HOUR = 3_600
const DAY = 86_400
const WEEK = 7 * DAY
const UNIT = 10_000_000n // 7 decimals

/** Unix seconds for a UTC date and time. Months are 1 to 12. */
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) / 1000
/** Quote units (7 decimals) from a decimal string, exact. */
const q = (text: string): bigint => {
  const [whole, frac = ''] = text.split('.')
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(7, '0'))
}
const iso = (ts: number) => new Date(ts * 1000).toISOString()

describe('standard expiries', () => {
  it('recognises Friday 08:00:00 UTC and nothing else', () => {
    expect(isStandardExpiry(at(2026, 11, 13, 8))).toBe(true)
    expect(isStandardExpiry(at(2026, 12, 18, 8))).toBe(true) // the series-name example of the brief
    expect(isStandardExpiry(at(2026, 11, 13, 8, 0, 1))).toBe(false)
    expect(isStandardExpiry(at(2026, 11, 13, 7))).toBe(false)
    expect(isStandardExpiry(at(2026, 11, 12, 8))).toBe(false) // Thursday
    expect(isStandardExpiry(at(2026, 11, 14, 8))).toBe(false) // Saturday
    expect(isStandardExpiry(at(2026, 11, 13, 8) + 0.5)).toBe(false)
    expect(isStandardExpiry(0)).toBe(false)
    expect(isStandardExpiry(NaN)).toBe(false)
  })

  it('agrees with the calendar for every hour of 400 days', () => {
    for (let ts = at(2026, 1, 1); ts < at(2026, 1, 1) + 400 * DAY; ts += HOUR) {
      const d = new Date(ts * 1000)
      expect(isStandardExpiry(ts)).toBe(d.getUTCDay() === 5 && d.getUTCHours() === 8)
    }
  })

  it('finds the last Friday of a month', () => {
    expect(iso(lastFridayOfMonth(2026, 10))).toBe('2026-11-27T08:00:00.000Z')
    expect(iso(lastFridayOfMonth(2026, 11))).toBe('2026-12-25T08:00:00.000Z')
    expect(iso(lastFridayOfMonth(2027, 0))).toBe('2027-01-29T08:00:00.000Z')
    expect(iso(lastFridayOfMonth(2027, 1))).toBe('2027-02-26T08:00:00.000Z')
    expect(iso(lastFridayOfMonth(2026, 9))).toBe('2026-10-30T08:00:00.000Z')
    expect(iso(lastFridayOfMonth(2026, 6))).toBe('2026-07-31T08:00:00.000Z') // the month ends on a Friday
    expect(iso(lastFridayOfMonth(2028, 1))).toBe('2028-02-25T08:00:00.000Z') // leap February
    expect(iso(lastFridayOfMonth(2026, 12))).toBe('2027-01-29T08:00:00.000Z') // month overflow
  })

  it('tells monthly from weekly expiries', () => {
    expect(isMonthlyExpiry(at(2026, 11, 27, 8))).toBe(true)
    expect(isMonthlyExpiry(at(2026, 11, 20, 8))).toBe(false)
    expect(isMonthlyExpiry(at(2026, 12, 18, 8))).toBe(false)
    expect(isMonthlyExpiry(at(2026, 11, 27, 9))).toBe(false)
    expect(expiryCycle(at(2026, 11, 27, 8))).toBe('monthly')
    expect(expiryCycle(at(2026, 11, 13, 8))).toBe('weekly')
    expect(expiryCycle(at(2026, 11, 12, 8))).toBeNull()
  })

  it('lists the next 2 Fridays and the next 3 month-ends', () => {
    expect(standardExpiries(at(2026, 11, 11, 12)).map(iso)).toEqual([
      '2026-11-13T08:00:00.000Z',
      '2026-11-20T08:00:00.000Z',
      '2026-11-27T08:00:00.000Z',
      '2026-12-25T08:00:00.000Z',
      '2027-01-29T08:00:00.000Z',
    ])
  })

  it('removes duplicates when a weekly is also a month-end', () => {
    expect(standardExpiries(at(2026, 11, 18, 12)).map(iso)).toEqual([
      '2026-11-20T08:00:00.000Z',
      '2026-11-27T08:00:00.000Z',
      '2026-12-25T08:00:00.000Z',
      '2027-01-29T08:00:00.000Z',
    ])
    // Two consecutive Fridays are never both month-ends, so at most one date overlaps and the list is 4 or 5 long.
    expect(standardExpiries(at(2026, 11, 25, 12)).map(iso)).toEqual([
      '2026-11-27T08:00:00.000Z',
      '2026-12-04T08:00:00.000Z',
      '2026-12-25T08:00:00.000Z',
      '2027-01-29T08:00:00.000Z',
    ])
  })

  it('keeps every expiry at least one hour ahead', () => {
    const friday = at(2026, 11, 13, 8)
    expect(standardExpiries(friday - HOUR - 1)[0]).toBe(friday)
    expect(standardExpiries(friday - HOUR)[0]).toBe(friday) // exactly one hour ahead still counts
    expect(standardExpiries(friday - HOUR + 1)[0]).toBe(friday + WEEK)
    expect(standardExpiries(friday - 1)[0]).toBe(friday + WEEK)
    expect(standardExpiries(friday)[0]).toBe(friday + WEEK)
    expect(standardExpiries(friday - HOUR + 0.2)[0]).toBe(friday + WEEK) // fractional clocks round against the user
  })

  it('skips a month whose last Friday is less than an hour away', () => {
    expect(standardExpiries(at(2026, 11, 27, 7, 30)).map(iso)).toEqual([
      '2026-12-04T08:00:00.000Z',
      '2026-12-11T08:00:00.000Z',
      '2026-12-25T08:00:00.000Z',
      '2027-01-29T08:00:00.000Z',
      '2027-02-26T08:00:00.000Z',
    ])
  })

  it('crosses the year end', () => {
    expect(standardExpiries(at(2026, 12, 30, 12)).map(iso)).toEqual([
      '2027-01-01T08:00:00.000Z',
      '2027-01-08T08:00:00.000Z',
      '2027-01-29T08:00:00.000Z',
      '2027-02-26T08:00:00.000Z',
      '2027-03-26T08:00:00.000Z',
    ])
  })

  it('holds its invariants for every 7 h 13 min step of two years', () => {
    for (let now = at(2026, 1, 1); now < at(2028, 1, 1); now += 7 * HOUR + 13 * 60) {
      const list = standardExpiries(now)
      expect(list.length).toBeGreaterThanOrEqual(3)
      expect(list.length).toBeLessThanOrEqual(5)
      expect(new Set(list).size).toBe(list.length)
      expect([...list].sort((a, b) => a - b)).toEqual(list)
      for (const ts of list) {
        expect(isStandardExpiry(ts)).toBe(true)
        expect(ts - now).toBeGreaterThanOrEqual(HOUR)
      }
      expect(list[0] - now).toBeLessThan(WEEK + HOUR + 1)
      expect(list.filter(isMonthlyExpiry)).toHaveLength(3)
      expect(list.filter((ts) => !isMonthlyExpiry(ts)).length).toBeLessThanOrEqual(2)
      expect(list).toContain(list[0] + WEEK) // the two nearest Fridays are always both listed
    }
  })

  it('matches a brute-force scan of the calendar', () => {
    // An independent oracle: walk forward hour by hour from one hour ahead and pick the dates by reading the calendar.
    const scan = (now: number): number[] => {
      const picked = new Set<number>()
      let weeklies = 0
      let monthlies = 0
      for (let ts = Math.ceil((now + HOUR) / HOUR) * HOUR; weeklies < 2 || monthlies < 3; ts += HOUR) {
        const d = new Date(ts * 1000)
        if (d.getUTCDay() !== 5 || d.getUTCHours() !== 8) continue
        const lastOfMonth = new Date((ts + WEEK) * 1000).getUTCMonth() !== d.getUTCMonth()
        if (weeklies < 2) {
          picked.add(ts)
          weeklies++
        }
        if (lastOfMonth && monthlies < 3) {
          picked.add(ts)
          monthlies++
        }
      }
      return [...picked].sort((a, b) => a - b)
    }
    for (let now = at(2026, 10, 1); now < at(2027, 10, 1); now += 2 * DAY + 11 * HOUR + 7 * 60) {
      expect(standardExpiries(now).map(iso), iso(now)).toEqual(scan(now).map(iso))
    }
    for (const now of [at(2026, 11, 13, 6, 59, 59), at(2026, 11, 13, 7), at(2026, 11, 13, 7, 0, 1), at(2026, 11, 27, 7, 30), at(2026, 12, 31, 23, 59, 59), at(2028, 2, 25, 6)]) {
      expect(standardExpiries(now).map(iso), iso(now)).toEqual(scan(now).map(iso))
    }
  })

  it('never delists an expiry before it is an hour away', () => {
    for (let now = at(2026, 6, 1); now < at(2027, 6, 1); now += 3 * DAY + 5 * HOUR) {
      const before = standardExpiries(now)
      for (const later of [now + HOUR, now + DAY, now + 6 * DAY, now + 20 * DAY]) {
        const after = standardExpiries(later)
        for (const ts of before) if (ts - later >= HOUR) expect(after, `${iso(ts)} at ${iso(later)}`).toContain(ts)
      }
    }
  })

  it('returns nothing for a clock that is not a number', () => {
    expect(standardExpiries(NaN)).toEqual([])
    expect(standardExpiries(Infinity)).toEqual([])
    expect(standardExpiries(1e18)).toEqual([]) // beyond the range of a Date
  })

  it('converts between an expiry and its UTC day key', () => {
    expect(expiryDayKey(at(2026, 11, 13, 8))).toBe('2026-11-13')
    expect(expiryDayKey(at(2026, 11, 13, 23, 59, 59))).toBe('2026-11-13')
    expect(expiryDayKey(at(2027, 1, 1, 0))).toBe('2027-01-01')
    expect(expiryFromDayKey('2026-11-13')).toBe(at(2026, 11, 13, 8))
    for (const ts of standardExpiries(at(2026, 11, 11))) expect(expiryFromDayKey(expiryDayKey(ts))).toBe(ts)
    expect(expiryFromDayKey('2026-02-30')).toBeNull()
    expect(expiryFromDayKey('2026-13-01')).toBeNull()
    expect(expiryFromDayKey('2026-1-1')).toBeNull()
    expect(expiryFromDayKey('13 Nov 2026')).toBeNull()
    expect(expiryFromDayKey('')).toBeNull()
  })
})

describe('strike ladder', () => {
  it('counts significant digits without trailing zeros', () => {
    expect(significantDigits(q('100'))).toBe(1)
    expect(significantDigits(q('97.5'))).toBe(3)
    expect(significantDigits(q('1.02'))).toBe(3)
    expect(significantDigits(q('10.25'))).toBe(4)
    expect(significantDigits(1n)).toBe(1)
    expect(significantDigits(1001n)).toBe(4)
    expect(significantDigits(0n)).toBe(0)
    expect(significantDigits(-q('97.5'))).toBe(3)
  })

  it('gives one tick in token units', () => {
    expect(tickUnits(7)).toBe(100_000n)
    expect(tickUnits(2)).toBe(1n)
    expect(tickUnits(0)).toBe(1n)
    expect(tickUnits(7, 4)).toBe(1_000n)
  })

  it('picks the smallest 1-2-5 step that is at least 1 % of the reference', () => {
    expect(ladderStep(q('10.20'), 7)).toBe(q('0.2'))
    expect(ladderStep(q('24.60'), 7)).toBe(q('0.5'))
    expect(ladderStep(q('99.40'), 7)).toBe(q('1'))
    expect(ladderStep(q('250'), 7)).toBe(q('5'))
    expect(ladderStep(q('1.02'), 7)).toBe(q('0.02'))
    expect(ladderStep(q('4050'), 7)).toBe(q('50'))
    expect(ladderStep(q('0.99'), 7)).toBe(q('0.01'))
  })

  it('takes the smaller step where two fit the 1 % to 2.5 % band', () => {
    expect(ladderStep(q('100'), 7)).toBe(q('1')) // 1 and 2 both fit
    expect(ladderStep(q('10'), 7)).toBe(q('0.1')) // 0.1 and 0.2 both fit
    expect(ladderStep(q('200'), 7)).toBe(q('2')) // 2 and 5 both fit
    expect(ladderStep(q('500'), 7)).toBe(q('5')) // 5 and 10 both fit
    expect(ladderStep(q('100') + 1n, 7)).toBe(q('2')) // 1 is now below 1 %
    expect(ladderStep(q('200') + 1n, 7)).toBe(q('5'))
    expect(ladderStep(q('500') + 1n, 7)).toBe(q('10'))
  })

  it('never steps below the strike tick, and has no step without a reference', () => {
    expect(ladderStep(q('0.5'), 7)).toBe(q('0.01'))
    expect(ladderStep(q('0.03'), 7)).toBe(q('0.01'))
    expect(ladderStep(1n, 7)).toBe(q('0.01'))
    expect(ladderStep(q('0.064'), 7, 4)).toBe(q('0.001'))
    expect(ladderStep(null, 7)).toBeNull()
    expect(ladderStep(0n, 7)).toBeNull()
    expect(ladderStep(-q('10'), 7)).toBeNull()
  })

  it('builds 7 strikes centred on the reference', () => {
    expect(strikeLadder(q('100'), 7)).toEqual(['97', '98', '99', '100', '101', '102', '103'].map(q))
    expect(strikeLadder(q('10.20'), 7)).toEqual(['9.6', '9.8', '10', '10.2', '10.4', '10.6', '10.8'].map(q))
    expect(strikeLadder(q('99.40'), 7)).toEqual(['96', '97', '98', '99', '100', '101', '102'].map(q))
    expect(strikeLadder(q('24.60'), 7)).toEqual(['23', '23.5', '24', '24.5', '25', '25.5', '26'].map(q))
    expect(strikeLadder(q('10'), 7)).toEqual(['9.7', '9.8', '9.9', '10', '10.1', '10.2', '10.3'].map(q))
    expect(strikeLadder(q('250'), 7)).toEqual(['235', '240', '245', '250', '255', '260', '265'].map(q))
  })

  it('rounds the centre to the nearest strike, upward on a tie', () => {
    expect(strikeLadder(q('10.04'), 7, 3)).toEqual(['9.8', '10', '10.2'].map(q))
    expect(strikeLadder(q('10.1'), 7, 3)).toEqual(['10', '10.2', '10.4'].map(q)) // exactly between 10.0 and 10.2
    expect(strikeLadder(q('10.0999999'), 7, 3)).toEqual(['9.8', '10', '10.2'].map(q))
    expect(strikeLadder(q('99.5'), 7, 1)).toEqual([q('100')])
    expect(strikeLadder(q('99.4999999'), 7, 1)).toEqual([q('99')])
  })

  it('honours the count, putting the extra strike of an even count above', () => {
    expect(strikeLadder(q('100'), 7, 1)).toEqual([q('100')])
    expect(strikeLadder(q('100'), 7, 4)).toEqual(['99', '100', '101', '102'].map(q))
    expect(strikeLadder(q('100'), 7, 9)).toEqual(['96', '97', '98', '99', '100', '101', '102', '103', '104'].map(q))
    expect(strikeLadder(q('100'), 7, 0)).toEqual([q('100')])
    expect(strikeLadder(q('100'), 7, 3.9)).toHaveLength(3)
  })

  it('never lists a zero or negative strike', () => {
    expect(strikeLadder(q('0.03'), 7)).toEqual(['0.01', '0.02', '0.03', '0.04', '0.05', '0.06', '0.07'].map(q))
    expect(strikeLadder(q('0.01'), 7)).toEqual(['0.01', '0.02', '0.03', '0.04', '0.05', '0.06', '0.07'].map(q))
    expect(strikeLadder(1n, 7, 3)).toEqual(['0.01', '0.02', '0.03'].map(q))
  })

  it('works for other token decimals and a finer tick', () => {
    expect(strikeLadder(10_000n, 2, 3)).toEqual([9_900n, 10_000n, 10_100n]) // 100.00 with 2 decimals
    expect(strikeLadder(100n, 0, 3)).toEqual([99n, 100n, 101n])
    expect(strikeLadder(q('0.064'), 7, 3, { tickDp: 4 })).toEqual(['0.063', '0.064', '0.065'].map(q))
  })

  it('keeps every strike to 3 significant digits, evenly spaced around the reference', () => {
    let checked = 0
    // 0.5 to 400 in steps of 0.007 (the range checked in the research), then wider magnitudes.
    const refs: bigint[] = []
    for (let r = q('0.5'); r <= q('400'); r += q('0.007')) refs.push(r)
    for (const base of ['1', '1.0000001', '1.37', '1.9999999', '2', '2.0000001', '4.99', '5', '5.0000001', '9.9999999']) {
      for (let scale = 1n; scale <= 1_000_000n; scale *= 10n) refs.push(q(base) * scale)
    }
    // Plain checks collected into a list: one `expect` per strike would make this loop take many seconds.
    const problems: string[] = []
    const tick = tickUnits(7)
    for (const ref of refs) {
      const step = ladderStep(ref, 7)!
      // step between 1 % and 2.5 % of the reference (the tick floor never binds from 0.5 up)
      if (step * 100n < ref || (step * 40n >= ref && step !== tick)) problems.push(`step ${step} for ${ref}`)
      for (const count of [7, 9, 11]) {
        const ladder = strikeLadder(ref, 7, count)
        if (ladder.length !== count) problems.push(`length ${ladder.length} for ${ref}`)
        for (let i = 0; i < ladder.length; i++) {
          if (ladder[i] <= 0n) problems.push(`non-positive strike for ${ref}`)
          if (significantDigits(ladder[i]) > 3) problems.push(`${ladder[i]} has more than 3 significant digits (reference ${ref})`)
          if (ladder[i] % tick !== 0n) problems.push(`${ladder[i]} is off the tick (reference ${ref})`)
          if (i > 0 && ladder[i] - ladder[i - 1] !== step) problems.push(`uneven spacing for ${ref}`)
        }
        // the middle strike is the multiple of the step nearest the reference
        const centre = ladder[Math.floor((count - 1) / 2)]
        const off = centre > ref ? centre - ref : ref - centre
        if (off * 2n > step) problems.push(`centre ${centre} is not nearest ${ref}`)
        checked++
      }
    }
    expect(problems.slice(0, 5)).toEqual([])
    expect(checked).toBeGreaterThan(170_000)
  })

  it('falls back to the strikes that exist when there is no reference', () => {
    const existing = [q('10'), q('9'), q('12'), q('10'), q('10.123'), q('10.005'), 0n, -q('5')]
    expect(strikeLadder(null, 7, 7, { existing })).toEqual([q('9'), q('10'), q('12')])
    expect(ladderFromStrikes(existing, 7)).toEqual([q('9'), q('10'), q('12')])
    expect(strikeLadder(null, 7)).toEqual([])
    expect(strikeLadder(0n, 7, 7, { existing: [q('10')] })).toEqual([q('10')])
  })

  it('keeps the strikes around the median when more exist than rows', () => {
    const existing = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(q)
    expect(ladderFromStrikes(existing, 7, 3)).toEqual(['4', '5', '6'].map(q))
    expect(ladderFromStrikes(existing, 7, 7)).toEqual(['2', '3', '4', '5', '6', '7', '8'].map(q))
    expect(ladderFromStrikes(existing, 7, 10)).toEqual(existing)
    expect(ladderFromStrikes(existing, 7, 99)).toEqual(existing)
  })

  it('ignores the existing strikes when a reference is known', () => {
    expect(strikeLadder(q('100'), 7, 3, { existing: [q('50'), q('60')] })).toEqual(['99', '100', '101'].map(q))
  })

  it('tests ladder membership and finds the nearest strike', () => {
    const ladder = strikeLadder(q('10.20'), 7)
    expect(isStandardStrike(q('10'), ladder)).toBe(true)
    expect(isStandardStrike(q('10.1'), ladder)).toBe(false)
    expect(isStandardStrike(q('11'), ladder)).toBe(false)
    expect(isStandardStrike(null, ladder)).toBe(false)
    expect(isStandardStrike(q('10'), [])).toBe(false)
    expect(nearestStrike(q('10.29'), ladder)).toBe(q('10.2'))
    expect(nearestStrike(q('10.3'), ladder)).toBe(q('10.2')) // tie: the lower one
    expect(nearestStrike(q('10.31'), ladder)).toBe(q('10.4'))
    expect(nearestStrike(q('1'), ladder)).toBe(q('9.6'))
    expect(nearestStrike(q('99'), ladder)).toBe(q('10.8'))
    expect(nearestStrike(null, ladder)).toBeNull()
    expect(nearestStrike(q('10'), [])).toBeNull()
  })
})

const USDX = { contractId: 'C_MOCK_USDX', code: 'USDx', decimals: 7 }
const FUND = { contractId: 'C_MOCK_FUND', code: 'FUND', decimals: 7 }
const NOW = at(2026, 11, 11, 12)
const EXPIRIES = standardExpiries(NOW)
const LADDER = strikeLadder(q('10.20'), 7)

const offer = (over: Partial<OptionOffer> = {}): OptionOffer => ({
  id: 1n,
  kind: 'put',
  underlying: FUND,
  quote: USDX,
  underlyingQty: 5n * UNIT,
  totalStrike: q('50'),
  totalPremium: q('1.8'),
  expiry: EXPIRIES[0],
  writer: 'GMAKERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  holder: null,
  state: 'offered',
  ...over,
})

describe('exact strike per unit', () => {
  it('divides when the division is exact', () => {
    expect(exactStrikePerUnit(offer())).toBe(q('10'))
    expect(exactStrikePerUnit(offer({ underlyingQty: UNIT / 2n, totalStrike: q('5.1') }))).toBe(q('10.2'))
    expect(exactStrikePerUnit(offer({ underlyingQty: 3n * UNIT, totalStrike: q('30.6') }))).toBe(q('10.2'))
  })

  it('is null when the strike is not an exact amount per unit, or the quantity is not positive', () => {
    expect(exactStrikePerUnit(offer({ underlyingQty: 3n * UNIT, totalStrike: q('10') }))).toBeNull()
    expect(exactStrikePerUnit(offer({ underlyingQty: 0n }))).toBeNull()
    expect(exactStrikePerUnit(offer({ underlyingQty: -UNIT }))).toBeNull()
  })

  it('respects the underlying decimals', () => {
    const cents = { contractId: 'CB', code: 'BOND', decimals: 2 }
    expect(exactStrikePerUnit({ underlying: cents, underlyingQty: 250n, totalStrike: q('245') })).toBe(q('98'))
  })

  it('collects the strikes of lots of at least one unit', () => {
    expect(
      strikesOf([
        offer(),
        offer({ totalStrike: q('51') }),
        offer({ underlyingQty: UNIT - 1n, totalStrike: q('9') }), // dust lot: ignored
        offer({ underlyingQty: 3n * UNIT, totalStrike: q('10') }), // not exact: ignored
      ]),
    ).toEqual([q('10'), q('10.2')])
  })
})

describe('classifyOffer', () => {
  const classify = (over: Partial<OptionOffer> = {}) => classifyOffer(offer(over), LADDER, EXPIRIES)

  it('accepts a standard put and a standard call', () => {
    expect(classify()).toEqual({ standard: true })
    expect(classify({ kind: 'call', totalStrike: q('52'), totalPremium: q('0.75'), expiry: EXPIRIES[4] })).toEqual({ standard: true })
    expect(classify({ underlyingQty: UNIT, totalStrike: q('10.2'), totalPremium: q('0.01') })).toEqual({ standard: true })
  })

  it('flags a lot below 1 unit', () => {
    expect(classify({ underlyingQty: UNIT - 1n, totalStrike: q('10') })).toEqual({ standard: false, reason: 'lot below 1 unit' })
    expect(classify({ underlyingQty: 1n, totalStrike: 1n })).toEqual({ standard: false, reason: 'lot below 1 unit' })
    expect(classify({ underlyingQty: 0n })).toEqual({ standard: false, reason: 'lot below 1 unit' })
  })

  it('flags a strike that is off the ladder or not exact per unit', () => {
    expect(classify({ totalStrike: q('50.25') })).toEqual({ standard: false, reason: 'off-grid strike' }) // 10.05
    expect(classify({ totalStrike: q('60') })).toEqual({ standard: false, reason: 'off-grid strike' }) // 12, outside the ladder
    expect(classify({ underlyingQty: 3n * UNIT, totalStrike: q('31') })).toEqual({ standard: false, reason: 'off-grid strike' })
    expect(classifyOffer(offer(), [], EXPIRIES)).toEqual({ standard: false, reason: 'off-grid strike' })
  })

  it('flags an expiry that is not listed', () => {
    expect(classify({ expiry: EXPIRIES[0] + 1 })).toEqual({ standard: false, reason: 'non-standard expiry' })
    expect(classify({ expiry: NOW + 3 * DAY })).toEqual({ standard: false, reason: 'non-standard expiry' })
    expect(classify({ expiry: at(2026, 12, 4, 8) })).toEqual({ standard: false, reason: 'non-standard expiry' }) // a Friday, not listed
    expect(classify({ expiry: at(2026, 11, 6, 8) })).toEqual({ standard: false, reason: 'non-standard expiry' }) // expired
    expect(classifyOffer(offer(), LADDER, [])).toEqual({ standard: false, reason: 'non-standard expiry' })
  })

  it('flags a premium off the 0.01 tick', () => {
    expect(classify({ totalPremium: q('1.805') })).toEqual({ standard: false, reason: 'premium off the 0.01 tick' })
    expect(classify({ totalPremium: 1n })).toEqual({ standard: false, reason: 'premium off the 0.01 tick' })
    expect(classify({ totalPremium: 0n })).toEqual({ standard: false, reason: 'premium off the 0.01 tick' })
    expect(classify({ totalPremium: -q('1') })).toEqual({ standard: false, reason: 'premium off the 0.01 tick' })
  })

  it('flags a put priced above its strike, and only a put', () => {
    expect(classify({ totalPremium: q('50.01') })).toEqual({ standard: false, reason: 'put premium above strike' })
    expect(classify({ totalPremium: q('50') })).toEqual({ standard: true }) // equal is allowed
    expect(classify({ kind: 'call', totalPremium: q('50.01') })).toEqual({ standard: true })
    expect(classify({ totalPremium: (1n << 127n) - 1n })).toEqual({ standard: false, reason: 'premium off the 0.01 tick' })
    expect(classify({ totalPremium: q('170141183460469231731687303715') })).toEqual({ standard: false, reason: 'put premium above strike' })
  })

  it('reports the first rule that fails, in the documented order', () => {
    const dust = { underlyingQty: 1n, totalStrike: 3n, expiry: NOW + 5, totalPremium: 1n }
    expect(classify(dust)).toEqual({ standard: false, reason: 'lot below 1 unit' })
    expect(classify({ totalStrike: q('50.25'), expiry: NOW + 5, totalPremium: 1n })).toEqual({ standard: false, reason: 'off-grid strike' })
    expect(classify({ expiry: NOW + 5, totalPremium: 1n })).toEqual({ standard: false, reason: 'non-standard expiry' })
    expect(NON_STANDARD_REASONS).toEqual([
      'lot below 1 unit',
      'off-grid strike',
      'non-standard expiry',
      'premium off the 0.01 tick',
      'put premium above strike',
    ])
  })

  it('classifies a bid with the same rules', () => {
    const bid: Bid = {
      id: 7n,
      buyer: 'GBUYER',
      kind: 'put',
      underlying: FUND,
      quote: USDX,
      underlyingQty: 5n * UNIT,
      totalStrike: q('50'),
      totalPremium: q('2'),
      expiry: EXPIRIES[1],
      state: 'open',
      optionId: null,
    }
    expect(classifyOffer(bid, LADDER, EXPIRIES)).toEqual({ standard: true })
    expect(classifyOffer({ ...bid, underlyingQty: 1n }, LADDER, EXPIRIES)).toEqual({ standard: false, reason: 'lot below 1 unit' })
  })

  it('partitions a book and counts each hidden offer once', () => {
    const book = [
      offer({ id: 1n }),
      offer({ id: 2n, totalPremium: q('2') }),
      offer({ id: 3n, underlyingQty: 1n, totalStrike: 1n }),
      offer({ id: 4n, underlyingQty: 2n, totalStrike: 7n, expiry: NOW + 9 }),
      offer({ id: 5n, totalStrike: q('50.25') }),
      offer({ id: 6n, expiry: NOW + 3 * DAY }),
      offer({ id: 7n, totalPremium: q('99') }),
    ]
    const p = partitionOffers(book, LADDER, EXPIRIES)
    expect(p.standard.map((o) => o.id)).toEqual([1n, 2n])
    expect(p.other.map((o) => [o.offer.id, o.reason])).toEqual([
      [3n, 'lot below 1 unit'],
      [4n, 'lot below 1 unit'],
      [5n, 'off-grid strike'],
      [6n, 'non-standard expiry'],
      [7n, 'put premium above strike'],
    ])
    expect(p.counts).toEqual({
      'lot below 1 unit': 2,
      'off-grid strike': 1,
      'non-standard expiry': 1,
      'premium off the 0.01 tick': 0,
      'put premium above strike': 1,
    })
    expect(p.standard.length + p.other.length).toBe(book.length)
    expect(partitionOffers([], LADDER, EXPIRIES)).toEqual({ standard: [], other: [], counts: { ...p.counts, 'lot below 1 unit': 0, 'off-grid strike': 0, 'non-standard expiry': 0, 'put premium above strike': 0 } })
  })
})

describe('series names', () => {
  it('writes plain decimals', () => {
    expect(plainDecimal(q('100'), 7)).toBe('100')
    expect(plainDecimal(q('10.2'), 7)).toBe('10.2')
    expect(plainDecimal(q('97.5'), 7)).toBe('97.5')
    expect(plainDecimal(q('1080'), 7)).toBe('1080')
    expect(plainDecimal(1n, 7)).toBe('0.0000001')
    expect(plainDecimal(-q('1.5'), 7)).toBe('-1.5')
    expect(plainDecimal(12n, 0)).toBe('12')
    expect(plainDecimal(0n, 7)).toBe('0')
  })

  it('names a series as in the brief', () => {
    expect(seriesName({ code: 'BOND', expiry: at(2026, 12, 18, 8), strikePerUnit: q('100'), decimals: 7, kind: 'put' })).toBe('BOND-20261218-100-P')
    expect(seriesName({ code: 'FUND', expiry: at(2026, 11, 13, 8), strikePerUnit: q('10.2'), decimals: 7, kind: 'call' })).toBe('FUND-20261113-10.2-C')
    expect(seriesName({ code: 'EQTY', expiry: at(2027, 1, 29, 8), strikePerUnit: q('24.5'), decimals: 7, kind: 'put' })).toBe('EQTY-20270129-24.5-P')
  })

  it('names the series of an offer, or nothing when its strike per unit is not exact', () => {
    expect(seriesNameOf(offer({ expiry: at(2026, 11, 13, 8) }))).toBe('FUND-20261113-10-P')
    expect(seriesNameOf(offer({ kind: 'call', underlyingQty: 3n * UNIT, totalStrike: q('30.6'), expiry: at(2026, 12, 25, 8) }))).toBe('FUND-20261225-10.2-C')
    expect(seriesNameOf(offer({ underlyingQty: 3n * UNIT, totalStrike: q('10') }))).toBeNull()
    expect(seriesNameOf(offer({ underlyingQty: 0n }))).toBeNull()
  })

  it('sorts by expiry within an asset because the day is ISO', () => {
    const names = [at(2027, 1, 29, 8), at(2026, 11, 13, 8), at(2026, 12, 25, 8)].map((expiry) =>
      seriesName({ code: 'BOND', expiry, strikePerUnit: q('100'), decimals: 7, kind: 'put' }),
    )
    expect([...names].sort()).toEqual(['BOND-20261113-100-P', 'BOND-20261225-100-P', 'BOND-20270129-100-P'])
  })

  it('parses its own names back', () => {
    expect(parseSeriesName('BOND-20261218-100-P')).toEqual({ code: 'BOND', day: '2026-12-18', expiry: at(2026, 12, 18, 8), strike: '100', kind: 'put' })
    expect(parseSeriesName('FUND-20261113-10.2-C')).toEqual({ code: 'FUND', day: '2026-11-13', expiry: at(2026, 11, 13, 8), strike: '10.2', kind: 'call' })
    for (const expiry of EXPIRIES) {
      for (const strikePerUnit of LADDER) {
        const id = { code: 'FUND', expiry, strikePerUnit, decimals: 7, kind: 'put' as const }
        const parsed = parseSeriesName(seriesName(id))!
        expect(parsed.expiry).toBe(expiry)
        expect(q(parsed.strike)).toBe(strikePerUnit)
        expect(parsed.kind).toBe('put')
      }
    }
  })

  it('rejects anything that is not a series name', () => {
    for (const bad of [
      '',
      'BOND',
      'BOND-20261218-100',
      'BOND-20261218-100-X',
      'BOND-20261218-100-p',
      'BOND-2026-12-18-100-P',
      'BOND-20261318-100-P', // month 13
      'BOND-20260230-100-P', // 30 February
      'BOND-20261218--P',
      'BOND-20261218-1e3-P',
      'BOND-20261218-100.-P',
      'BO ND-20261218-100-P',
      'TOOLONGCODE12-20261218-100-P',
      '<b>-20261218-100-P',
    ]) {
      expect(parseSeriesName(bad), bad).toBeNull()
    }
  })
})
