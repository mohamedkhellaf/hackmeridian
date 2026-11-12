// A direct label made of a few spans (muted words, an ink or coloured figure) and, inline, the triangle that
// goes with a gain or a loss. Shared by the layouts (which place label boxes) and the SVG renderer.

import type { Rect } from './labels.ts'

export type Tone = 'label' | 'muted' | 'ink' | 'gain' | 'loss'

export interface Span {
  /** Text of the span. Leave out for a triangle. */
  text?: string
  /** Up for a gain, down for a loss. The sign and the word are in the text; the triangle is the third cue. */
  triangle?: 'up' | 'down'
  tone?: Tone
  strong?: boolean
}

export interface RichLabel {
  spans: readonly Span[]
}

export interface PlacedLabel extends RichLabel {
  id: string
  box: Rect
  spanWidths: readonly number[]
}

/** Width of `text` at the label size, regular or strong. */
export type Measure = (text: string, strong?: boolean) => number

/** Box height of a 12 px label and the offset of its baseline inside the box. */
export const TEXT_H = 14
export const BASELINE = 10.5
export const SPAN_GAP = 3.5
export const TRIANGLE = 7
export const TRIANGLE_W = 8.2

export function spanWidths(label: RichLabel, measure: Measure): number[] {
  return label.spans.map((s) => (s.triangle ? TRIANGLE_W : measure(s.text ?? '', s.strong)))
}

export function richWidth(label: RichLabel, measure: Measure): number {
  const widths = spanWidths(label, measure)
  return widths.reduce((sum, w) => sum + w, 0) + SPAN_GAP * Math.max(0, widths.length - 1)
}

export function placed(id: string, label: RichLabel, box: Rect, measure: Measure): PlacedLabel {
  return { ...label, id, box, spanWidths: spanWidths(label, measure) }
}

export const plain = (text: string, tone: Tone = 'label', strong = false): RichLabel => ({ spans: [{ text, tone, strong }] })

/** The label as a plain string, for accessible descriptions and tests. */
export function richText(label: RichLabel): string {
  return label.spans
    .map((s) => s.text ?? '')
    .filter(Boolean)
    .join(' ')
}

/** True when a label has a span whose colour needs a bare ground to stay readable (muted, gain or loss ink). */
export function needsBareGround(label: RichLabel): boolean {
  return label.spans.some((s) => s.tone === 'muted' || s.tone === 'gain' || s.tone === 'loss')
}
