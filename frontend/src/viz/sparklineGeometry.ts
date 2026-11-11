import { crisp } from './geometry.ts'
import type { Point } from './geometry.ts'
import { extent, linearScale } from './scales.ts'

export interface SparklineGeometry {
  line: Point[]
  last: Point | null
  ruleY: number | null
}

/** Pixel geometry of a sparkline inside a box, with room on the right for the last-value label. Pure. */
export function sparklineGeometry(values: readonly number[], width: number, height: number, rule?: number, inset = 4): SparklineGeometry {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length === 0 || width <= 0) return { line: [], last: null, ruleY: null }
  const range = extent(rule !== undefined && Number.isFinite(rule) ? [...finite, rule] : finite) ?? [0, 0]
  const flat = range[0] === range[1]
  const x = linearScale([0, Math.max(1, finite.length - 1)], [inset, width - inset])
  const y = flat ? () => height / 2 : linearScale(range, [height - inset, inset])
  const line = finite.map((v, i) => ({ x: finite.length === 1 ? width - inset : x(i), y: y(v) }))
  return { line, last: line[line.length - 1], ruleY: rule !== undefined && Number.isFinite(rule) ? crisp(y(rule)) : null }
}
