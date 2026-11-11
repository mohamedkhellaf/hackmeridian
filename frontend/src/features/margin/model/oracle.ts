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
 * visible under an hour because the early-exercise limit is counted in seconds. Each figure is held to its unit
 * by a non-breaking space, so "2 min" never breaks across lines.
 */
export function spanText(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const u = (n: number, unit: string) => `${n}\u00a0${unit}`
  if (s < 60) return u(s, 's')
  if (s < 3600) return s % 60 === 0 ? u(s / 60, 'min') : `${u(Math.floor(s / 60), 'min')} ${u(s % 60, 's')}`
  if (s < 86400) return s % 3600 < 60 ? u(Math.floor(s / 3600), 'h') : `${u(Math.floor(s / 3600), 'h')} ${u(Math.floor((s % 3600) / 60), 'min')}`
  return `${u(Math.floor(s / 86400), 'd')} ${u(Math.floor((s % 86400) / 3600), 'h')}`
}
