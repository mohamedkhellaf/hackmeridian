import type { ProModel, SeriesView } from './types'

/** Series state word, and whether it needs an action (shown in the warn tone). */
export function seriesStatus(s: SeriesView, now: number): { label: string; warn: boolean } {
  if (s.closed) return { label: 'Closed', warn: false }
  if (now >= s.expiry) return s.settlementPrice == null ? { label: 'Expired', warn: true } : { label: 'Settling', warn: true }
  return { label: 'Live', warn: false }
}

export function snapshotAge(model: ProModel, s: SeriesView): number | null {
  return s.snapshot ? model.now - s.snapshot.ts : null
}

