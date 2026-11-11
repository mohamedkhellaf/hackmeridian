// What the oracle strip says: the latest publisher snapshot, how old it is, whether early exercise can use
// it, and which series wait for a settlement price. Read from the model; the limits come from the contract config.
import type { ProModel, SeriesView, SnapshotView } from '../../../core/pro/types'

export type Freshness = 'fresh' | 'stale'

export interface OracleView {
  /** The most recent snapshot across the series, with its series. Null when the publisher has posted none. */
  latest: { series: SeriesView; snapshot: SnapshotView } | null
  /** Seconds between the snapshot and the contract clock. */
  age: number | null
  /** Against `config.maxAge`: a stale snapshot stops trading and takeovers that need a mark. */
  freshness: Freshness | null
  /** Against `config.exerciseMaxAge`: early exercise needs a snapshot at most that old. */
  exerciseOpen: boolean
  exerciseMaxAge: number
  maxAge: number
  /** Expired series whose settlement price is not published yet. */
  pending: SeriesView[]
}

export function oracleView(model: ProModel): OracleView {
  let latest: OracleView['latest'] = null
  for (const s of model.series) {
    if (s.snapshot && (!latest || s.snapshot.ts > latest.snapshot.ts)) latest = { series: s, snapshot: s.snapshot }
  }
  const age = latest ? Math.max(0, model.now - latest.snapshot.ts) : null
  return {
    latest,
    age,
    freshness: age === null ? null : age <= model.config.maxAge ? 'fresh' : 'stale',
    exerciseOpen: age !== null && age <= model.config.exerciseMaxAge,
    exerciseMaxAge: model.config.exerciseMaxAge,
    maxAge: model.config.maxAge,
    pending: model.series.filter((s) => model.now >= s.expiry && s.settlementPrice == null),
  }
}

/** Age of one series' snapshot on the contract clock, or null without a snapshot. */
export function snapshotAge(model: Pick<ProModel, 'now'>, s: SeriesView): number | null {
  return s.snapshot ? Math.max(0, model.now - s.snapshot.ts) : null
}

/**
 * A span of seconds in the product's time style: `45 s`, `2 min 1 s`, `1 h 5 min`, `3 d 4 h`. Seconds stay
 * visible under an hour because the early-exercise limit is counted in seconds.
 */
export function spanText(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 60) return `${s} s`
  if (s < 3600) return s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`
  if (s < 86400) return s % 3600 < 60 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`
}
