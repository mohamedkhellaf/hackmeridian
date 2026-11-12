// Scales for the hand-written SVG charts. Pure functions on plain numbers: no React, no DOM.

export type Domain = readonly [number, number]

/** Keeps `value` inside [min, max]. The bounds may be given in either order. */
export function clamp(value: number, min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (Number.isNaN(value)) return lo
  return Math.min(hi, Math.max(lo, value))
}

export interface LinearScale {
  (value: number): number
  /** Pixel back to value. */
  invert(pixel: number): number
  domain: Domain
  range: Domain
}

/**
 * Linear map from a data domain to a pixel range. Either may be descending (the y axis of an SVG is).
 * A zero-width domain maps every value to the middle of the range.
 */
export function linearScale(domain: Domain, range: Domain): LinearScale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  const k = span === 0 ? 0 : (r1 - r0) / span
  const scale = ((value: number) => (span === 0 ? (r0 + r1) / 2 : r0 + (value - d0) * k)) as LinearScale
  scale.invert = (pixel: number) => (k === 0 ? d0 : d0 + (pixel - r0) / k)
  scale.domain = domain
  scale.range = range
  return scale
}

/** [min, max] of the finite values, or null when there is none. */
export function extent(values: Iterable<number>): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return lo <= hi ? [lo, hi] : null
}

interface Step {
  /** The step is `mult * 10^exp`, with mult in 1, 2, 5. */
  mult: number
  exp: number
}

function stepParts(span: number, count: number): Step | null {
  if (!(span > 0) || !(count > 0) || !Number.isFinite(span)) return null
  const raw = span / count
  let exp = Math.floor(Math.log10(raw))
  const err = raw / 10 ** exp
  // Thresholds at the geometric means, so the chosen step is the closest of 1, 2, 5, 10 on a log scale.
  let mult = err >= Math.sqrt(50) ? 10 : err >= Math.sqrt(10) ? 5 : err >= Math.sqrt(2) ? 2 : 1
  if (mult === 10) {
    mult = 1
    exp += 1
  }
  return { mult, exp }
}

function stepValue({ mult, exp }: Step): number {
  // Dividing by a power of ten keeps 0.1, 0.02 and friends exact where multiplying by 10^-n would not.
  return exp >= 0 ? mult * 10 ** exp : mult / 10 ** -exp
}

function multiple(i: number, { mult, exp }: Step): number {
  return exp >= 0 ? i * mult * 10 ** exp : (i * mult) / 10 ** -exp
}

/** A step of 1, 2 or 5 times a power of ten that cuts `span` into about `count` intervals. 0 when undefined. */
export function niceStep(span: number, count = 5): number {
  const parts = stepParts(Math.abs(span), count)
  return parts ? stepValue(parts) : 0
}

/**
 * Ticks at multiples of a 1-2-5 step inside [min, max], about `count` of them. No floating-point noise:
 * 0.1 + 0.2 comes out as 0.3. A zero-width domain gives its single value.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (lo === hi) return [lo]
  const parts = stepParts(hi - lo, count)
  if (!parts) return []
  const step = stepValue(parts)
  const eps = step * 1e-9
  const first = Math.ceil((lo - eps) / step)
  const last = Math.floor((hi + eps) / step)
  const ticks: number[] = []
  for (let i = first; i <= last; i++) ticks.push(multiple(i, parts) + 0)
  return ticks
}

/** Widens [min, max] outward to the nearest multiples of the nice step. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const parts = stepParts(hi - lo, count)
  if (!parts) return [lo, hi]
  const step = stepValue(parts)
  const eps = step * 1e-9
  return [multiple(Math.floor((lo + eps) / step), parts) + 0, multiple(Math.ceil((hi - eps) / step), parts) + 0]
}

/** Grows a domain by `fraction` of its span on each side (or on the sides given). */
export function padDomain(domain: Domain, fraction: number, sides: 'both' | 'min' | 'max' = 'both'): [number, number] {
  const [a, b] = domain
  const pad = (b - a) * fraction
  return [sides === 'max' ? a : a - pad, sides === 'min' ? b : b + pad]
}

/** Decimals needed to print multiples of `step` exactly (0.05 gives 2, 0.5 gives 1, 20 gives 0). Capped at 7. */
export function stepDecimals(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0
  for (let d = 0; d <= 7; d++) {
    const scaled = step * 10 ** d
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9 * Math.max(1, scaled)) return d
  }
  return 7
}

export interface PriceDomainInput {
  /** The reference price when there is one, else the strike. */
  center: number
  /** Half-width as a fraction of the centre. 0.4 shows the centre plus and minus 40 %. */
  range?: number
  /** Prices that must stay visible (strike, breakevens, the assumed price). */
  include?: readonly number[]
  /** Extra room, as a fraction of the span, beside an included price that would sit on the edge. */
  pad?: number
  /** Rounds both ends outward to a 1-2-5 step, so the axis ends read 5.80 and 13.80 rather than 5.89 and 13.75. Default true. */
  nice?: boolean
}

/**
 * The price axis of a payoff figure: centred on the reference (or strike), widened so every price in `include`
 * is visible, never below zero. Compute it when the inputs change, not while the handle is dragged.
 */
export function priceDomain({ center, range = 0.4, include = [], pad = 0.05, nice = true }: PriceDomainInput): [number, number] {
  const c = Number.isFinite(center) && center > 0 ? center : 1
  let lo = c * (1 - range)
  let hi = c * (1 + range)
  const wanted = include.filter((v) => Number.isFinite(v) && v >= 0)
  const span = Math.max(hi, ...wanted) - Math.min(lo, ...wanted)
  for (const v of wanted) {
    if (v - span * pad < lo) lo = v - span * pad
    if (v + span * pad > hi) hi = v + span * pad
  }
  lo = Math.max(0, lo)
  if (!nice) return [lo, hi]
  const parts = stepParts(hi - lo, 40)
  if (!parts) return [lo, hi]
  const step = stepValue(parts)
  const eps = step * 1e-9
  return [multiple(Math.floor((lo + eps) / step), parts) + 0, multiple(Math.ceil((hi - eps) / step), parts) + 0]
}
