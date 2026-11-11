// Pure geometry for the charts: polylines, the bands between two lines, SVG path strings, slider snapping.
// Everything is piecewise-linear, which is exactly what an option payoff at expiry is.

export interface Point {
  x: number
  y: number
}

const fix = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return (Object.is(r, -0) ? 0 : r).toString()
}

/** `M x y L x y …` for an open polyline. Coordinates are rounded to 1/100 of a pixel. */
export function linePath(points: readonly Point[]): string {
  let d = ''
  for (let i = 0; i < points.length; i++) d += `${i === 0 ? 'M' : 'L'}${fix(points[i].x)} ${fix(points[i].y)}`
  return d
}

/** A closed polygon path. Fewer than three points give an empty string. */
export function polygonPath(points: readonly Point[]): string {
  return points.length < 3 ? '' : `${linePath(points)}Z`
}

/** Sorted by x, with exact duplicates removed. */
export function sortPoints(points: readonly Point[]): Point[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x)
  return sorted.filter((p, i) => i === 0 || p.x !== sorted[i - 1].x || p.y !== sorted[i - 1].y)
}

/**
 * The value of a polyline (sorted by x) at `x`, by linear interpolation. Outside the sampled range it returns
 * the end value: a chart never extrapolates a payoff it was not given.
 */
export function interpolateAt(points: readonly Point[], x: number): number {
  const n = points.length
  if (n === 0) return NaN
  if (x <= points[0].x) return points[0].y
  if (x >= points[n - 1].x) return points[n - 1].y
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].x <= x) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi]
  if (b.x === a.x) return b.y
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)
}

/**
 * Samples a piecewise-linear function at the two ends of `domain` and at every kink inside it. That is all a
 * payoff at expiry needs, and it keeps the corners exact (no rounded strike). Pass `steps` for a curve that is
 * not piecewise-linear.
 */
export function samplePiecewise(
  fn: (x: number) => number,
  domain: readonly [number, number],
  kinks: readonly number[] = [],
  steps = 0,
): Point[] {
  const lo = Math.min(domain[0], domain[1])
  const hi = Math.max(domain[0], domain[1])
  const xs = new Set<number>([lo, hi])
  for (const k of kinks) if (Number.isFinite(k) && k > lo && k < hi) xs.add(k)
  for (let i = 1; i < steps; i++) xs.add(lo + ((hi - lo) * i) / steps)
  return [...xs].sort((a, b) => a - b).map((x) => ({ x, y: fn(x) }))
}

/** The part of a polyline inside [x0, x1], with interpolated points on both bounds. */
export function clipLine(points: readonly Point[], x0: number, x1: number): Point[] {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  if (points.length === 0 || hi < points[0].x || lo > points[points.length - 1].x) return []
  const from = Math.max(lo, points[0].x)
  const to = Math.min(hi, points[points.length - 1].x)
  const out: Point[] = [{ x: from, y: interpolateAt(points, from) }]
  for (const p of points) if (p.x > from && p.x < to) out.push(p)
  if (to > from) out.push({ x: to, y: interpolateAt(points, to) })
  return out
}

export interface Band {
  /** +1 where the first line is above the second, −1 where it is below. */
  sign: 1 | -1
  /** Closed outline: along the first line left to right, then back along the second. */
  points: Point[]
}

/**
 * The areas enclosed between two polylines over the range they share, split at every crossing. Used for the
 * gain and loss areas of a payoff (second line = zero) and for the gap between "with" and "without".
 * Stretches where the lines coincide enclose nothing and are left out.
 */
export function bandsBetween(a: readonly Point[], b: readonly Point[]): Band[] {
  if (a.length < 2 || b.length < 2) return []
  const lo = Math.max(a[0].x, b[0].x)
  const hi = Math.min(a[a.length - 1].x, b[b.length - 1].x)
  if (!(hi > lo)) return []

  const xs = new Set<number>([lo, hi])
  for (const p of a) if (p.x > lo && p.x < hi) xs.add(p.x)
  for (const p of b) if (p.x > lo && p.x < hi) xs.add(p.x)
  const sorted = [...xs].sort((p, q) => p - q)

  let scale = 0
  const nodes = sorted.map((x) => {
    const ya = interpolateAt(a, x)
    const yb = interpolateAt(b, x)
    scale = Math.max(scale, Math.abs(ya), Math.abs(yb))
    return { x, ya, yb }
  })
  const eps = Math.max(scale, 1) * 1e-9
  const side = (d: number): -1 | 0 | 1 => (d > eps ? 1 : d < -eps ? -1 : 0)

  // Insert the crossing wherever the difference changes sign between two neighbours.
  const all: Array<{ x: number; ya: number; yb: number }> = []
  for (let i = 0; i < nodes.length; i++) {
    all.push(nodes[i])
    if (i + 1 === nodes.length) break
    const d0 = nodes[i].ya - nodes[i].yb
    const d1 = nodes[i + 1].ya - nodes[i + 1].yb
    if (side(d0) * side(d1) < 0) {
      const t = d0 / (d0 - d1)
      const x = nodes[i].x + t * (nodes[i + 1].x - nodes[i].x)
      const y = nodes[i].ya + t * (nodes[i + 1].ya - nodes[i].ya)
      all.push({ x, ya: y, yb: y })
    }
  }

  const bands: Band[] = []
  let start = 0
  let current: -1 | 0 | 1 = 0
  const close = (end: number) => {
    if (current !== 0 && end > start) {
      const upper = all.slice(start, end + 1).map((n) => ({ x: n.x, y: n.ya }))
      const lower = all
        .slice(start, end + 1)
        .reverse()
        .map((n) => ({ x: n.x, y: n.yb }))
      // Where the two lines meet at an end, the shared point would appear twice.
      const outline = [...upper, ...lower].filter((p, i, arr) => {
        const prev = arr[(i + arr.length - 1) % arr.length]
        return !(Math.abs(p.x - prev.x) < 1e-12 && Math.abs(p.y - prev.y) <= eps)
      })
      if (outline.length >= 3) bands.push({ sign: current, points: outline })
    }
  }
  for (let i = 0; i + 1 < all.length; i++) {
    const mid = side((all[i].ya - all[i].yb + all[i + 1].ya - all[i + 1].yb) / 2)
    if (mid !== current) {
      close(i)
      start = i
      current = mid
    }
  }
  close(all.length - 1)
  return bands
}

/** A horizontal line at `y` across the x-range of `points`: the second line for gain and loss areas. */
export function levelLine(points: readonly Point[], y = 0): Point[] {
  if (points.length === 0) return []
  return [
    { x: points[0].x, y },
    { x: points[points.length - 1].x, y },
  ]
}

/** Where a polyline crosses the level `y` (touching counts once). */
export function crossingsAt(points: readonly Point[], y = 0): number[] {
  const out: number[] = []
  const push = (x: number) => {
    if (!out.some((v) => Math.abs(v - x) < 1e-9)) out.push(x)
  }
  for (let i = 0; i < points.length; i++) {
    const d0 = points[i].y - y
    if (d0 === 0) {
      // A flat stretch on the level is not a crossing; only its isolated touches are.
      const prev = i > 0 ? points[i - 1].y - y : NaN
      const next = i + 1 < points.length ? points[i + 1].y - y : NaN
      if (prev !== 0 && next !== 0) push(points[i].x)
      continue
    }
    if (i + 1 < points.length) {
      const d1 = points[i + 1].y - y
      if (d0 * d1 < 0) push(points[i].x + (d0 / (d0 - d1)) * (points[i + 1].x - points[i].x))
    }
  }
  return out
}

/** Maps data points to pixels with two scale functions. */
export function project(points: readonly Point[], x: (v: number) => number, y: (v: number) => number): Point[] {
  return points.map((p) => ({ x: x(p.x), y: y(p.y) }))
}

/** The highest and lowest value of a polyline between two x positions (interpolated at both). */
export function rangeWithin(points: readonly Point[], x0: number, x1: number): [number, number] {
  const part = clipLine(points, x0, x1)
  if (part.length === 0) {
    const y = interpolateAt(points, (x0 + x1) / 2)
    return [y, y]
  }
  let lo = Infinity
  let hi = -Infinity
  for (const p of part) {
    if (p.y < lo) lo = p.y
    if (p.y > hi) hi = p.y
  }
  return [lo, hi]
}

/** Rounds to the nearest multiple of `step` and removes the floating-point tail (8.1, not 8.100000000000001). */
export function snapToStep(value: number, step: number): number {
  if (!(step > 0)) return value
  const snapped = Math.round(value / step) * step
  return Number.parseFloat(snapped.toPrecision(12))
}

/**
 * Pulls `value` onto the nearest target within `tolerance`, so a drag can land exactly on the strike, the
 * breakeven or the reference price.
 */
export function magnet(value: number, targets: readonly number[], tolerance: number): number {
  let best = value
  let distance = tolerance
  for (const t of targets) {
    const d = Math.abs(t - value)
    if (Number.isFinite(t) && d <= distance) {
      best = t
      distance = d
    }
  }
  return best
}

/** An upward or downward triangle centred on (cx, cy), as path data. Used beside every gain and loss figure. */
export function trianglePath(cx: number, cy: number, size: number, direction: 'up' | 'down'): string {
  const h = size * 0.5
  const w = size * 0.58
  return direction === 'up'
    ? `M${fix(cx - w)} ${fix(cy + h)}L${fix(cx)} ${fix(cy - h)}L${fix(cx + w)} ${fix(cy + h)}Z`
    : `M${fix(cx - w)} ${fix(cy - h)}L${fix(cx)} ${fix(cy + h)}L${fix(cx + w)} ${fix(cy - h)}Z`
}

/** Half-pixel alignment for 1 px rules, so hairlines stay one device pixel wide. */
export function crisp(value: number): number {
  return Math.round(value - 0.5) + 0.5
}
