import { DASH, duration, usdx } from './format'
import type { ProModel, SeriesView } from './types'

export function seriesLabel(s: SeriesView | undefined): string {
  return s ? `Series ${s.id}, strike ${usdx(s.strike)}` : DASH
}

/** Series state word, and whether it needs an action (shown in the warn tone). */
export function seriesStatus(s: SeriesView, now: number): { label: string; warn: boolean } {
  if (s.closed) return { label: 'Closed', warn: false }
  if (now >= s.expiry) return s.settlementPrice == null ? { label: 'Expired', warn: true } : { label: 'Settling', warn: true }
  return { label: 'Live', warn: false }
}

export function snapshotAge(model: ProModel, s: SeriesView): number | null {
  return s.snapshot ? model.now - s.snapshot.ts : null
}

export const ageText = (a: number | null) => (a == null ? DASH : duration(a))
