// Which open put the hero widget shows, and which floors and deadlines its inputs offer.
//
// The inputs only ever list terms that have a funded offer behind them: the widget is an example drawn from the
// book, not an order form. Only orders on the standard grid are read (the market view of src/data leaves the
// rest out), so a dust lot posted by a stranger can never become the example on the landing page.
import type { BookRow } from '../../../core/market/book'

/** The part of the data layer's `MarketView` this file reads. */
export interface PutGrid {
  columns: ReadonlyArray<{
    expiry: number
    rows: ReadonlyArray<{ strikePerUnit: bigint; put: { key: string; best: BookRow | null } }>
  }>
}

/** One series with a put on offer: its cheapest standard offer or resale listing. */
export interface PutChoice {
  key: string
  row: BookRow
  strikePerUnit: bigint
  expiry: number
}

/** Every series of the grid that has a put on offer, by deadline then floor. */
export function putChoices(grid: PutGrid): PutChoice[] {
  const out: PutChoice[] = []
  for (const column of grid.columns) {
    for (const row of column.rows) {
      const best = row.put.best
      if (best && best.source !== 'bid' && best.kind === 'put') out.push({ key: row.put.key, row: best, strikePerUnit: row.strikePerUnit, expiry: column.expiry })
    }
  }
  return out.sort((a, b) => a.expiry - b.expiry || (a.strikePerUnit < b.strikePerUnit ? -1 : a.strikePerUnit > b.strikePerUnit ? 1 : 0))
}

export interface FloorPick {
  /** Floor per unit, in quote units. */
  strike?: bigint | null
  /** Deadline, unix seconds. */
  expiry?: number | null
}

export interface FloorSelection {
  /** Deadlines with a put on offer, soonest first. */
  expiries: number[]
  /** Floors on offer at the chosen deadline, lowest first. */
  strikes: bigint[]
  chosen: PutChoice | null
  /** The floor that was asked for, when it has no offer at the chosen deadline and the nearest one is shown. */
  movedFrom: bigint | null
}

/** A deadline closer than this is not a good first example: the visitor could not act on it in time. */
export const MIN_LEAD_SECONDS = 48 * 3600

const distance = (a: bigint, b: bigint): bigint => (a > b ? a - b : b - a)

/** The floor shown first: the highest one at or under the reference price, else the lowest one on offer. */
function defaultStrike(strikes: readonly bigint[], referencePerUnit: bigint | null): bigint {
  if (referencePerUnit === null) return strikes[Math.floor((strikes.length - 1) / 2)]
  const under = strikes.filter((k) => k <= referencePerUnit)
  return under.length > 0 ? under[under.length - 1] : strikes[0]
}

/** The floor nearest the one asked for; of two at the same distance, the lower. */
function nearestStrike(strikes: readonly bigint[], asked: bigint): bigint {
  return strikes.reduce((best, k) => (distance(k, asked) < distance(best, asked) ? k : best), strikes[0])
}

/**
 * Resolves what the visitor picked against what is on offer. Nothing is ever substituted silently: when the
 * floor asked for is missing at the chosen deadline, `movedFrom` says so and the widget prints it.
 */
export function selectFloor(choices: readonly PutChoice[], pick: FloorPick, referencePerUnit: bigint | null, nowSec: number): FloorSelection {
  const expiries = [...new Set(choices.map((c) => c.expiry))].sort((a, b) => a - b)
  if (expiries.length === 0) return { expiries, strikes: [], chosen: null, movedFrom: null }

  const asked = pick.expiry ?? null
  const expiry = asked !== null && expiries.includes(asked) ? asked : (expiries.find((e) => e - nowSec >= MIN_LEAD_SECONDS) ?? expiries[0])
  const here = choices.filter((c) => c.expiry === expiry)
  const strikes = here.map((c) => c.strikePerUnit)

  const want = pick.strike ?? null
  const strike = want === null ? defaultStrike(strikes, referencePerUnit) : strikes.includes(want) ? want : nearestStrike(strikes, want)
  return {
    expiries,
    strikes,
    chosen: here.find((c) => c.strikePerUnit === strike) ?? null,
    movedFrom: want !== null && want !== strike ? want : null,
  }
}
