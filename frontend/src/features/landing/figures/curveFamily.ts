// The one ornament of the page: a family of hyperbolas that close in on the payoff of a put (flat, then rising
// to the left). Pure geometry. It is not a pricing model and the page says so beside it.

export interface FamilyCurve {
  /** SVG path data. */
  d: string
  /** The payoff itself: the heavy line the others converge on. */
  payoff: boolean
  opacity: number
}

export interface FamilyOptions {
  width?: number
  height?: number
  /** Curves besides the payoff. */
  count?: number
  /** Where the kink sits, as a share of the width. */
  kink?: number
}

const fix = (n: number): string => (Math.round(n * 100) / 100).toString()

/**
 * `count` smoothed curves and the payoff. Each curve is `u / 2 + sqrt(u^2 / 4 + c^2)`, the hyperbola whose
 * asymptotes are the two arms of the payoff; `c` grows with the square of the index, so the family fans out.
 */
export function curveFamily({ width = 520, height = 280, count = 13, kink = 0.46 }: FamilyOptions = {}): FamilyCurve[] {
  const k = kink * width
  const base = height - 2
  const top = 2
  const slope = (base - top) / k
  const curves: FamilyCurve[] = []
  for (let i = count; i >= 1; i--) {
    const c = 6 + i * i * 0.95
    let d = ''
    for (let x = 0; x <= width; x += 4) {
      const u = (k - x) * slope
      const y = base - (u / 2 + Math.sqrt((u * u) / 4 + c * c))
      if (y < top - 40) continue
      d += `${d ? 'L' : 'M'}${fix(x)} ${fix(y)}`
    }
    curves.push({ d, payoff: false, opacity: Number((0.16 + 0.5 * (1 - i / count)).toFixed(3)) })
  }
  curves.push({ d: `M0 ${fix(top)}L${fix(k)} ${fix(base)}H${fix(width)}`, payoff: true, opacity: 1 })
  return curves
}
