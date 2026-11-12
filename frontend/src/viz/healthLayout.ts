import { spreadLane } from './labels.ts'
import { clamp, linearScale } from './scales.ts'

export type HealthState = 'liquidatable' | 'restricted' | 'open' | 'unknown'

/** Where the account stands: below maintenance, between maintenance and initial, at or above initial. */
export function healthState(nlv: number, mm: number, im: number): HealthState {
  if (![nlv, mm, im].every(Number.isFinite)) return 'unknown'
  if (nlv < mm) return 'liquidatable'
  if (nlv < im) return 'restricted'
  return 'open'
}

export interface HealthLayoutInput {
  width: number
  nlv: number
  mm: number
  im: number
  nlvText: string
  mmTexts: readonly string[]
  imTexts: readonly string[]
  measure: (text: string, strong?: boolean) => number
}

export interface HealthLayout {
  /** Right end of the scale: max(1.5 IM, 1.1 NLV). */
  max: number
  x: { nlv: number; mm: number; im: number }
  track: { left: number; right: number; top: number; height: number }
  nlvLabel: { x: number; text: string }
  /** Threshold labels on one row when they fit, on two when they do not. */
  thresholds: Array<{ id: 'mm' | 'im'; x: number; row: 0 | 1; text: string }>
  height: number
}

const TRACK_TOP = 26
const TRACK_H = 10
export const ROW_H = 16

/** Pure layout of the full health bar: the scale, and labels that never overlap. */
export function healthLayout({ width, nlv, mm, im, nlvText, mmTexts, imTexts, measure }: HealthLayoutInput): HealthLayout {
  const left = 1
  const right = width - 1
  const max = Math.max(1.5 * im, 1.1 * nlv, mm, 1e-9)
  const scale = linearScale([0, max], [left, right])
  const pos = (v: number) => clamp(scale(Math.max(0, v)), left, right)
  const x = { nlv: pos(nlv), mm: pos(mm), im: pos(im) }

  // The account label follows its marker and flips to the other side past the middle.
  const nlvW = measure(nlvText, true)
  const nlvX = clamp(x.nlv > (left + right) * 0.6 ? x.nlv - nlvW + 5 : x.nlv - 5, left, Math.max(left, right - nlvW))

  let thresholds: HealthLayout['thresholds'] | null = null
  let rows = 1
  for (let i = 0; i < Math.max(mmTexts.length, imTexts.length) && !thresholds; i++) {
    const mmText = mmTexts[Math.min(i, mmTexts.length - 1)]
    const imText = imTexts[Math.min(i, imTexts.length - 1)]
    const spread = spreadLane(
      [
        { id: 'mm', x: x.mm + 3, width: measure(mmText), anchor: 'end' },
        { id: 'im', x: x.im - 3, width: measure(imText), anchor: 'start' },
      ],
      { min: left, max: right, gap: 10 },
    )
    if (spread) {
      thresholds = spread.map((p) => ({ id: p.id as 'mm' | 'im', x: p.x, row: 0, text: p.id === 'mm' ? mmText : imText }))
    }
  }
  if (!thresholds) {
    // Too narrow for one row even with the short labels: one label per row, each next to its own tick.
    const mmText = mmTexts[mmTexts.length - 1]
    const imText = imTexts[imTexts.length - 1]
    rows = 2
    thresholds = [
      { id: 'mm', x: clamp(x.mm - measure(mmText) + 3, left, Math.max(left, right - measure(mmText))), row: 0, text: mmText },
      { id: 'im', x: clamp(x.im - 3, left, Math.max(left, right - measure(imText))), row: 1, text: imText },
    ]
  }

  return {
    max,
    x,
    track: { left, right, top: TRACK_TOP, height: TRACK_H },
    nlvLabel: { x: nlvX, text: nlvText },
    thresholds,
    height: TRACK_TOP + TRACK_H + 8 + rows * ROW_H,
  }
}
