import { DASH, duration, usdx } from './format'
import type { ProModel, SeriesView } from './types'

export function seriesLabel(s: SeriesView | undefined): string {
  return s ? `Series ${s.id} · strike ${usdx(s.strike, 2)}` : DASH
}

export function seriesStatus(s: SeriesView, now: number): { label: string; tone: 'ok' | 'warn' | 'neutral' | 'call' } {
  if (s.closed) return { label: 'Closed', tone: 'neutral' }
  if (now >= s.expiry) return s.settlementPrice == null ? { label: 'Expired, no price yet', tone: 'warn' } : { label: 'Settling', tone: 'warn' }
  return { label: 'Live', tone: 'call' }
}

export function snapshotAge(model: ProModel, s: SeriesView): number | null {
  return s.snapshot ? model.now - s.snapshot.ts : null
}

export const ageText = (a: number | null) => (a == null ? DASH : duration(a))
