import { describe, expect, it } from 'vitest'
import type { BookRow } from '../../../core/market/book'
import { MIN_LEAD_SECONDS, putChoices, selectFloor } from './selection'
import type { PutGrid } from './selection'

const NOW = 1_800_000_000
const DAY = 86_400
const E1 = NOW + DAY // inside 48 hours
const E2 = NOW + 9 * DAY
const E3 = NOW + 30 * DAY
const U = 10_000_000n

const token = (code: string) => ({ contractId: `C_${code}`, code, decimals: 7 })

function row(source: BookRow['source'], kind: BookRow['kind'], strike: bigint, expiry: number, premium: bigint): BookRow {
  return {
    key: `${source}-${kind}-${strike}-${expiry}`,
    source,
    kind,
    underlying: token('FUND'),
    quote: token('USDx'),
    underlyingQty: 5n * U,
    totalStrike: 5n * strike,
    totalPremium: premium,
    expiry,
    counterparty: 'GMAKER',
  }
}

function grid(cells: Array<[expiry: number, strike: bigint, best: BookRow | null]>): PutGrid {
  const expiries = [...new Set(cells.map((c) => c[0]))]
  return {
    columns: expiries.map((expiry) => ({
      expiry,
      rows: cells.filter((c) => c[0] === expiry).map(([, strikePerUnit, best]) => ({ strikePerUnit, put: { key: `${expiry}:${strikePerUnit}`, best } })),
    })),
  }
}

const BOOK = grid([
  [E2, 10n * U, row('maker', 'put', 10n * U, E2, 2n * U)],
  [E2, 9n * U, row('maker', 'put', 9n * U, E2, 1n * U)],
  [E2, 11n * U, null],
  [E1, 10n * U, row('maker', 'put', 10n * U, E1, 1n * U)],
  [E3, 8n * U, row('resale', 'put', 8n * U, E3, 1n * U)],
  [E3, 12n * U, row('bid', 'put', 12n * U, E3, 1n * U)],
])

describe('putChoices', () => {
  it('lists the series with a put on offer, by deadline then floor, and leaves out empty cells and bids', () => {
    expect(putChoices(BOOK).map((c) => [c.expiry, c.strikePerUnit, c.row.source])).toEqual([
      [E1, 10n * U, 'maker'],
      [E2, 9n * U, 'maker'],
      [E2, 10n * U, 'maker'],
      [E3, 8n * U, 'resale'],
    ])
  })
})

describe('selectFloor', () => {
  const choices = putChoices(BOOK)

  it('opens on the first deadline at least 48 hours away and the floor just under the reference', () => {
    const s = selectFloor(choices, {}, 102_000_000n, NOW)
    expect(E1 - NOW).toBeLessThan(MIN_LEAD_SECONDS)
    expect(s.expiries).toEqual([E1, E2, E3])
    expect(s.strikes).toEqual([9n * U, 10n * U])
    expect(s.chosen?.expiry).toBe(E2)
    expect(s.chosen?.strikePerUnit).toBe(10n * U)
    expect(s.movedFrom).toBeNull()
  })

  it('takes the lowest floor when every floor is above the reference, and the middle one without a reference', () => {
    expect(selectFloor(choices, {}, 80_000_000n, NOW).chosen?.strikePerUnit).toBe(9n * U)
    expect(selectFloor(choices, {}, null, NOW).chosen?.strikePerUnit).toBe(9n * U)
  })

  it('keeps the picked terms when they are on offer', () => {
    const s = selectFloor(choices, { expiry: E2, strike: 9n * U }, 102_000_000n, NOW)
    expect([s.chosen?.expiry, s.chosen?.strikePerUnit, s.movedFrom]).toEqual([E2, 9n * U, null])
  })

  it('says so when the floor asked for has no offer at the new deadline', () => {
    const s = selectFloor(choices, { expiry: E3, strike: 10n * U }, 102_000_000n, NOW)
    expect(s.strikes).toEqual([8n * U])
    expect(s.chosen?.strikePerUnit).toBe(8n * U)
    expect(s.movedFrom).toBe(10n * U)
  })

  it('falls back to the default deadline when the picked one is gone', () => {
    expect(selectFloor(choices, { expiry: NOW + 400 * DAY }, 102_000_000n, NOW).chosen?.expiry).toBe(E2)
  })

  it('takes the nearest deadline when none is 48 hours away', () => {
    const soon = putChoices(grid([[E1, 10n * U, row('maker', 'put', 10n * U, E1, 1n * U)]]))
    expect(selectFloor(soon, {}, null, NOW).chosen?.expiry).toBe(E1)
  })

  it('has nothing to choose in an empty book', () => {
    expect(selectFloor([], { strike: 10n * U }, null, NOW)).toEqual({ expiries: [], strikes: [], chosen: null, movedFrom: null })
  })
})
